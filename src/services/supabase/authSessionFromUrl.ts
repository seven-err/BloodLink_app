import {
  isEmailConfirmationRedirect,
  isPasswordRecoveryRedirect,
  parseAuthCodeFromUrl,
  parseAuthErrorFromUrl,
  parseAuthTokensFromUrl,
  parseTokenHashFromUrl,
} from '@/utils/authRedirect';

import { supabase } from './client';

const collectAuthUrls = (url: string) => {
  const urls = new Set<string>([url]);

  try {
    const parsed = new URL(url);
    const nested = parsed.searchParams.get('url');

    if (nested) {
      urls.add(nested);
      try {
        urls.add(decodeURIComponent(nested));
      } catch {
        // Already decoded.
      }
    }
  } catch {
    // Custom schemes are still searchable as raw strings.
  }

  const embedded = url.match(/((?:bloodlink|exp(?:\+bloodlink)?):\/\/[^\s'"]+)/gi) ?? [];

  for (const match of embedded) {
    urls.add(match);
    try {
      urls.add(decodeURIComponent(match));
    } catch {
      // Ignore malformed encodings.
    }
  }

  return [...urls];
};

const hasActiveSession = async () => {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
};

export type AuthUrlResult = {
  activated: boolean;
  emailConfirmed: boolean;
  error: string | null;
  passwordRecovery: boolean;
};

/** Turn an OAuth or email-confirmation deep link into a Supabase session. */
export const createSessionFromAuthUrl = async (url: string | null): Promise<AuthUrlResult> => {
  if (!url) {
    return { activated: false, emailConfirmed: false, error: null, passwordRecovery: false };
  }

  let lastError: string | null = null;
  let emailConfirmed = false;
  let passwordRecovery = false;

  for (const candidate of collectAuthUrls(url)) {
    emailConfirmed = emailConfirmed || isEmailConfirmationRedirect(candidate);
    passwordRecovery = passwordRecovery || isPasswordRecoveryRedirect(candidate);

    const oauthError = parseAuthErrorFromUrl(candidate);

    if (
      oauthError &&
      !parseAuthCodeFromUrl(candidate) &&
      !parseAuthTokensFromUrl(candidate) &&
      !parseTokenHashFromUrl(candidate)
    ) {
      lastError = oauthError;
      continue;
    }

    const tokens = parseAuthTokensFromUrl(candidate);

    if (tokens) {
      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (!error || (await hasActiveSession())) {
        return { activated: true, emailConfirmed, error: null, passwordRecovery };
      }

      lastError = error.message;
      continue;
    }

    const tokenHashData = parseTokenHashFromUrl(candidate);

    if (tokenHashData) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHashData.tokenHash,
        type: tokenHashData.type,
      });

      if (!error || (await hasActiveSession())) {
        return {
          activated: true,
          emailConfirmed: emailConfirmed && !passwordRecovery,
          error: null,
          passwordRecovery,
        };
      }

      lastError = error.message;
      continue;
    }

    const code = parseAuthCodeFromUrl(candidate);

    if (!code) {
      continue;
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error || (await hasActiveSession())) {
      return { activated: true, emailConfirmed, error: null, passwordRecovery };
    }

    lastError = error.message;
  }

  if (await hasActiveSession()) {
    return { activated: true, emailConfirmed, error: null, passwordRecovery };
  }

  return { activated: false, emailConfirmed, error: lastError, passwordRecovery };
};
