import { Platform, TurboModuleRegistry } from 'react-native';

import { env } from '@/config/env';

import { supabase } from './client';
import { signInWithGoogleOAuth } from './googleAuthOAuth';
import type { GoogleSignInResult } from './googleAuth.types';

export type { GoogleSignInResult } from './googleAuth.types';

type NativeGoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let configured = false;
let nativeModule: NativeGoogleSignInModule | null | undefined;

/** True when the native RNGoogleSignin TurboModule is linked in this binary. */
const isNativeGoogleSignInAvailable = () =>
  TurboModuleRegistry.get('RNGoogleSignin') != null;

const loadNativeGoogleSignIn = (): NativeGoogleSignInModule | null => {
  if (nativeModule !== undefined) {
    return nativeModule;
  }

  if (!isNativeGoogleSignInAvailable()) {
    nativeModule = null;
    return null;
  }

  // Lazy require so binaries without the module never hit getEnforcing at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nativeModule = require('@react-native-google-signin/google-signin') as NativeGoogleSignInModule;
  return nativeModule;
};

const ensureGoogleSignInConfigured = (GoogleSignin: NativeGoogleSignInModule['GoogleSignin']) => {
  if (configured) {
    return;
  }

  if (!env.googleWebClientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Use the Web client ID from Google Cloud Console (required for the ID token).',
    );
  }

  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
    offlineAccess: false,
  });

  configured = true;
};

const isDeveloperConfigError = (
  error: unknown,
  isErrorWithCode: NativeGoogleSignInModule['isErrorWithCode'],
) => {
  if (!isErrorWithCode(error)) {
    return false;
  }

  return (
    error.code === 'DEVELOPER_ERROR' ||
    error.code === '10' ||
    (typeof error.message === 'string' &&
      (error.message.toUpperCase().includes('DEVELOPER_ERROR') ||
        error.message.toLowerCase().includes('sha-1') ||
        error.message.toLowerCase().includes('sha1')))
  );
};

/**
 * Native Google account picker on Android and iOS.
 * Web (and binaries that never linked RNGoogleSignin) still use browser OAuth.
 * Android requires an OAuth client whose package is com.sevenerr.BloodLink and
 * whose SHA-1 matches the keystore that signed this APK.
 */
export const signInWithGooglePlatform = async (): Promise<GoogleSignInResult> => {
  const native = loadNativeGoogleSignIn();

  if (!native || (Platform.OS === 'ios' && !env.googleIosClientId)) {
    return signInWithGoogleOAuth();
  }

  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = native;

  try {
    ensureGoogleSignInConfigured(GoogleSignin);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { cancelled: true, data: null, error: null };
    }

    const idToken = response.data.idToken;

    if (!idToken) {
      return {
        data: null,
        error: new Error(
          'Google did not return an ID token. Confirm EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the Web client ID.',
        ),
      };
    }

    const sessionResult = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    return {
      data: sessionResult.data,
      error: sessionResult.error ? new Error(sessionResult.error.message) : null,
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { cancelled: true, data: null, error: null };
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        return { data: null, error: new Error('Google sign-in is already in progress.') };
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          data: null,
          error: new Error('Google Play Services is missing or outdated on this device.'),
        };
      }

      if (isDeveloperConfigError(error, isErrorWithCode)) {
        return {
          data: null,
          error: new Error(
            'Google Sign-In developer error. Add this APK signing SHA-1 to an Android OAuth client for com.sevenerr.BloodLink.',
          ),
        };
      }
    }

    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes('sha-1') ||
        error.message.toLowerCase().includes('sha1') ||
        error.message.toUpperCase().includes('DEVELOPER_ERROR'))
    ) {
      return {
        data: null,
        error: new Error(
          'Google Sign-In developer error. Add this APK signing SHA-1 to an Android OAuth client for com.sevenerr.BloodLink.',
        ),
      };
    }

    const message =
      error instanceof Error ? error.message : 'Unable to sign in with Google.';
    return { data: null, error: new Error(message) };
  }
};

export const signOutGooglePlatform = async () => {
  const native = loadNativeGoogleSignIn();

  if (!native) {
    return;
  }

  try {
    ensureGoogleSignInConfigured(native.GoogleSignin);
    await native.GoogleSignin.signOut();
  } catch {
    // Best-effort; Supabase sign-out still proceeds.
  }
};
