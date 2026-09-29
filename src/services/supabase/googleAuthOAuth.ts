import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getOAuthAuthRedirectUrl } from '@/utils/authRedirect';

import { createSessionFromAuthUrl } from './authSessionFromUrl';
import { supabase } from './client';
import type { GoogleSignInResult } from './googleAuth.types';

WebBrowser.maybeCompleteAuthSession();

const sessionResultFromCurrentAuth = async (): Promise<GoogleSignInResult | null> => {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  return {
    data: { session: data.session, user: data.session.user },
    error: null,
  };
};

/**
 * Android Custom Tabs can return "dismiss" while AuthContext is still exchanging
 * the same PKCE code from the deep link. A used code is success if a session exists.
 */
const recoverSessionAfterRedirect = async (
  previousAccessToken: string | null,
  timeoutMs = 400,
): Promise<GoogleSignInResult | null> => {
  const isNewSession = (result: GoogleSignInResult | null) =>
    Boolean(result?.data?.session?.access_token) &&
    result?.data?.session?.access_token !== previousAccessToken;

  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const current = await sessionResultFromCurrentAuth();

    if (isNewSession(current)) {
      return current;
    }

    if (Date.now() - started >= timeoutMs) {
      break;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }

  return null;
};

const getOAuthRedirectUrl = () => {
  if (Platform.OS === 'web') {
    return getOAuthAuthRedirectUrl();
  }

  return makeRedirectUri({
    path: 'auth/callback',
    scheme: 'bloodlink',
  });
};

/** Browser-based Google OAuth (web, Expo Go, or builds without native Google Sign-In). */
export const signInWithGoogleOAuth = async (): Promise<GoogleSignInResult> => {
  const { data: beforeAuth } = await supabase.auth.getSession();
  const previousAccessToken = beforeAuth.session?.access_token ?? null;
  const redirectTo = getOAuthRedirectUrl();

  if (__DEV__) {
    console.info('[auth] Google OAuth redirectTo:', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  if (!data.url) {
    return { data: null, error: new Error('Unable to start Google sign-in.') };
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(data.url);
    return { data: null, error: null };
  }

  try {
    await WebBrowser.warmUpAsync();
  } catch {
    // Best-effort; auth still works without warm-up.
  }

  // Stay in the same Android task. A new task relaunches the app at Welcome
  // and drops the in-progress login/signup screen.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    createTask: false,
    showInRecents: false,
  });

  try {
    await WebBrowser.coolDownAsync();
  } catch {
    // Best-effort cleanup.
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    const fromLaunch = await createSessionFromAuthUrl(await Linking.getInitialURL());
    const recovered = await recoverSessionAfterRedirect(
      previousAccessToken,
      fromLaunch.activated ? 1500 : 600,
    );

    if (recovered) {
      return recovered;
    }

    if (fromLaunch.error) {
      return { data: null, error: new Error(fromLaunch.error) };
    }

    return { cancelled: true, data: null, error: null };
  }

  if (result.type === 'success' && 'url' in result && result.url) {
    const created = await createSessionFromAuthUrl(result.url);

    if (created.activated) {
      const sessionResult = await sessionResultFromCurrentAuth();

      if (sessionResult) {
        return sessionResult;
      }
    }

    const recovered = await recoverSessionAfterRedirect(previousAccessToken);

    if (recovered) {
      return recovered;
    }

    if (created.error) {
      return { data: null, error: new Error(created.error) };
    }
  }

  const launchUrl = await Linking.getInitialURL();
  const fromLaunch = await createSessionFromAuthUrl(launchUrl);

  if (fromLaunch.activated) {
    const sessionResult = await sessionResultFromCurrentAuth();

    if (sessionResult && sessionResult.data?.session?.access_token !== previousAccessToken) {
      return sessionResult;
    }
  }

  const recovered = await recoverSessionAfterRedirect(previousAccessToken);

  if (recovered) {
    return recovered;
  }

  return {
    data: null,
    error: new Error('Google sign-in did not return a valid session.'),
  };
};
