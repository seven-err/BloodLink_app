import type { EmailOtpType } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { env } from '@/config/env';

const DEFAULT_WEB_REDIRECT = 'http://localhost:8081';
const EMAIL_CONFIRM_PATH = 'auth/email-confirmed';
const EMAIL_CONFIRM_QUERY = 'email_confirmed';
const PASSWORD_RECOVERY_PATH = 'auth/reset-password';
const PASSWORD_RECOVERY_QUERY = 'password_recovery';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

/**
 * Redirect for Supabase signup / email confirmation links.
 * - Native / Expo Go: app deep link (bloodlink:// or exp://) — never localhost
 * - Web: app origin root with a marker query (avoids /path 404s on Expo web)
 */
export const getAuthRedirectUrl = () => {
  if (Platform.OS !== 'web') {
    return Linking.createURL(EMAIL_CONFIRM_PATH);
  }

  const base = trimTrailingSlash(
    env.authRedirectUrl ||
      (typeof window !== 'undefined' ? window.location.origin : DEFAULT_WEB_REDIRECT),
  );

  return `${base}/?${EMAIL_CONFIRM_QUERY}=1`;
};

/** Redirect URL for Google / OAuth (separate from email confirmation). */
export const getOAuthAuthRedirectUrl = () => {
  if (Platform.OS !== 'web') {
    return Linking.createURL('auth/callback');
  }

  if (env.authRedirectUrl) {
    return trimTrailingSlash(env.authRedirectUrl);
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return DEFAULT_WEB_REDIRECT;
};

/** Redirect for password-recovery links. Keeps recovery separate from confirmation. */
export const getPasswordRecoveryRedirectUrl = () => {
  if (Platform.OS !== 'web') {
    return Linking.createURL(PASSWORD_RECOVERY_PATH);
  }

  const base = trimTrailingSlash(
    env.authRedirectUrl ||
      (typeof window !== 'undefined' ? window.location.origin : DEFAULT_WEB_REDIRECT),
  );

  return `${base}/?${PASSWORD_RECOVERY_QUERY}=1`;
};

const getUrlSearchParams = (url: string) => {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const params = new URLSearchParams();

  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : url.length;
    const query = new URLSearchParams(url.slice(queryIndex + 1, queryEnd));
    query.forEach((value, key) => params.set(key, value));
  }

  if (hashIndex >= 0) {
    const hash = new URLSearchParams(url.slice(hashIndex + 1));
    hash.forEach((value, key) => params.set(key, value));
  }

  return params;
};

export const parseAuthTokensFromUrl = (url: string) => {
  const params = getUrlSearchParams(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }

  return null;
};

/** PKCE auth code from OAuth redirect (query or hash). */
export const parseAuthCodeFromUrl = (url: string) => {
  const code = getUrlSearchParams(url).get('code');
  return code && code.length > 0 ? code : null;
};

/** Supabase token hash from email verification redirect. */
export const parseTokenHashFromUrl = (url: string) => {
  const params = getUrlSearchParams(url);
  const tokenHash = params.get('token_hash') || params.get('token');
  const type = params.get('type');

  if (tokenHash) {
    return {
      tokenHash,
      type: (type && AUTH_EMAIL_OTP_TYPES.has(type) ? type : 'signup') as EmailOtpType,
    };
  }

  return null;
};

/** Provider/OAuth error returned on the redirect URL. */
export const parseAuthErrorFromUrl = (url: string) => {
  const params = getUrlSearchParams(url);
  const error = params.get('error');
  const description = params.get('error_description') ?? params.get('error_code');

  if (!error && !description) {
    return null;
  }

  const message = [description, error].filter(Boolean).join(' — ');
  return message.replace(/\+/g, ' ');
};

/** Supabase `type` on email / magic-link redirects (e.g. signup, email, recovery). */
export const parseAuthRedirectType = (url: string) => {
  const type = getUrlSearchParams(url).get('type');
  return type && type.length > 0 ? type : null;
};

const EMAIL_CONFIRMATION_TYPES = new Set(['signup', 'email', 'email_change', 'invite']);
const AUTH_EMAIL_OTP_TYPES = new Set([...EMAIL_CONFIRMATION_TYPES, 'magiclink', 'recovery']);

export const isPasswordRecoveryRedirect = (url: string) => {
  const params = getUrlSearchParams(url);

  if (params.get(PASSWORD_RECOVERY_QUERY) === '1' || parseAuthRedirectType(url) === 'recovery') {
    return true;
  }

  const path = (Linking.parse(url).path ?? '').replace(/^\/+/, '').toLowerCase();
  return path === PASSWORD_RECOVERY_PATH || path.endsWith('reset-password');
};

/** True when the redirect is an email confirmation (not Google OAuth / recovery). */
export const isEmailConfirmationRedirect = (url: string) => {
  const params = getUrlSearchParams(url);

  if (params.get(EMAIL_CONFIRM_QUERY) === '1') {
    return true;
  }

  const type = parseAuthRedirectType(url);

  if (type) {
    return EMAIL_CONFIRMATION_TYPES.has(type);
  }

  if (url.toLowerCase().includes('email-confirmed')) {
    return true;
  }

  const path = (Linking.parse(url).path ?? '').replace(/^\/+/, '').toLowerCase();
  return path === EMAIL_CONFIRM_PATH || path.endsWith('email-confirmed');
};

/** Open Gmail / native mail app from the app. */
export const openMailApp = async (email?: string): Promise<boolean> => {
  const isGmail = email ? email.toLowerCase().endsWith('@gmail.com') : true;

  try {
    if (Platform.OS === 'ios') {
      if (isGmail) {
        const gmailUrl = 'googlegmail://';
        const canOpenGmail = await Linking.canOpenURL(gmailUrl).catch(() => false);
        if (canOpenGmail) {
          await Linking.openURL(gmailUrl);
          return true;
        }
      }

      const defaultMailUrl = 'message://';
      const canOpenDefault = await Linking.canOpenURL(defaultMailUrl).catch(() => false);
      if (canOpenDefault) {
        await Linking.openURL(defaultMailUrl);
        return true;
      }

      await Linking.openURL('mailto:');
      return true;
    }

    if (Platform.OS === 'android') {
      if (isGmail) {
        const gmailUrl = 'googlegmail://';
        const canOpenGmail = await Linking.canOpenURL(gmailUrl).catch(() => false);
        if (canOpenGmail) {
          await Linking.openURL(gmailUrl);
          return true;
        }
      }

      const mailto = 'mailto:';
      const canOpenMailto = await Linking.canOpenURL(mailto).catch(() => false);
      if (canOpenMailto) {
        await Linking.openURL(mailto);
        return true;
      }

      await Linking.openURL('https://mail.google.com');
      return true;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (isGmail) {
        window.open('https://mail.google.com', '_blank');
        return true;
      }
      window.open('mailto:', '_blank');
      return true;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[authRedirect] openMailApp error:', error);
    }
  }

  return false;
};

/** Strip auth tokens from the browser URL after the session is activated. */
export const clearAuthParamsFromBrowserUrl = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  const { pathname, search } = window.location;
  const cleanSearch = new URLSearchParams(search);
  cleanSearch.delete('code');
  cleanSearch.delete('error');
  cleanSearch.delete('error_description');
  cleanSearch.delete('error_code');
  cleanSearch.delete(EMAIL_CONFIRM_QUERY);

  const nextSearch = cleanSearch.toString();
  const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  window.history.replaceState(window.history.state, '', nextUrl);
};

/** After the all-set screen, leave confirmation markers so refresh stays clean. */
export const resetBrowserPathAfterEmailConfirmation = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  window.history.replaceState(window.history.state, '', '/');
};

export const getDefaultWebRedirect = () => DEFAULT_WEB_REDIRECT;
