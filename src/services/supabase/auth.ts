import type { EmailOtpType, User } from '@supabase/supabase-js';

import { getAuthRedirectUrl, getPasswordRecoveryRedirectUrl } from '@/utils/authRedirect';

import { supabase } from './client';
import {
  signInWithGooglePlatform,
  signOutGooglePlatform,
  type GoogleSignInResult,
} from './googleAuth';

export type { GoogleSignInResult };

export const signUpWithEmail = (
  email: string,
  password: string,
  fullName: string,
  phone?: string,
) => {
  const emailRedirectTo = getAuthRedirectUrl();

  if (__DEV__) {
    console.info('[auth] signup emailRedirectTo:', emailRedirectTo);
  }

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
      },
      emailRedirectTo,
    },
  });
};

/** True when Supabase accepted signup but did not create a new user (email already registered). */
export const isDuplicateEmailSignup = (user: User | null) =>
  Boolean(user && user.identities?.length === 0);

export const getSignupErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('database error saving new user') ||
    normalized.includes('profiles_phone_key')
  ) {
    return 'This mobile number is already linked to another account. Log in with that account, or use a different number.';
  }

  return message;
};

export const resendSignupConfirmation = (email: string) => {
  const emailRedirectTo = getAuthRedirectUrl();

  if (__DEV__) {
    console.info('[auth] resend emailRedirectTo:', emailRedirectTo);
  }

  return supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo,
    },
  });
};

export const verifyEmailOtp = (email: string, token: string, type: EmailOtpType = 'signup') =>
  supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type,
  });

export const verifyOtpWithTokenHash = (
  token_hash: string,
  type: EmailOtpType = 'signup',
) =>
  supabase.auth.verifyOtp({
    token_hash,
    type,
  });

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const requestPasswordReset = (email: string) =>
  supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordRecoveryRedirectUrl(),
  });

export const updatePassword = (password: string) =>
  supabase.auth.updateUser({ password });

/**
 * Continue with Google.
 * Android and web: browser OAuth (no Android SHA-1 required).
 * iOS: native account picker when configured, otherwise the same OAuth flow.
 */
export const signInWithGoogle = (): Promise<GoogleSignInResult> => signInWithGooglePlatform();

export const requestPhoneOtp = (phone: string) =>
  supabase.auth.signInWithOtp({
    phone,
    options: {
      data: {
        phone,
      },
    },
  });

export const verifyPhoneOtp = (phone: string, token: string) =>
  supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

export const getCurrentSession = () => supabase.auth.getSession();

export const getCurrentUser = () => supabase.auth.getUser();

export const signOut = async () => {
  await signOutGooglePlatform();
  return supabase.auth.signOut();
};

export const updateAccountEmail = (email: string) =>
  supabase.auth.updateUser({
    email: email.trim(),
  });

export const updateAccountMetadata = (data: { full_name?: string; phone?: string | null }) =>
  supabase.auth.updateUser({
    data: {
      ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
    },
  });

const DUPLICATE_PHONE_PATTERN = /profiles_phone_key|duplicate key.*phone/i;

export const getAccountUpdateErrorMessage = (message: string) => {
  if (DUPLICATE_PHONE_PATTERN.test(message)) {
    return 'This phone number is already linked to another account.';
  }

  if (message.toLowerCase().includes('email change requires reauthentication')) {
    return 'For security, sign out and sign in again before changing your email.';
  }

  return message;
};
