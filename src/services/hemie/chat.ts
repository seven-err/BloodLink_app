import { env } from '@/config/env';

export type HemieChatRole = 'user' | 'assistant';

export type HemieChatMessage = {
  role: HemieChatRole;
  content: string;
};

export type AskHemieParams = {
  accessToken: string;
  conversationId?: string | null;
  history?: HemieChatMessage[];
  message: string;
};

export type HemieApiChatResult = {
  conversationId: string;
  message: string;
};

export const HEMIE_UNAVAILABLE_MESSAGE =
  'Sorry, Hemie is temporarily unavailable. Please try again later.';

const REQUEST_TIMEOUT_MS = 25_000;

const PRIVATE_HOST = /localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i;

/**
 * Phones cannot reach a laptop localhost API. When EXPO_PUBLIC_API_URL is missing
 * or local, Hemie uses the Supabase edge function, which the APK can already reach.
 */
export function resolveHemieChatUrl(apiBaseUrl: string, supabaseUrl: string): string {
  const api = apiBaseUrl.replace(/\/$/, '');
  const supabase = supabaseUrl.replace(/\/$/, '');
  const publicHttps = api.startsWith('https://') && !PRIVATE_HOST.test(api);

  if (publicHttps) {
    return `${api}/api/chat`;
  }

  if (supabase.startsWith('https://')) {
    return `${supabase}/functions/v1/hemie-chat`;
  }

  return `${api}/api/chat`;
}

export async function askHemie({
  accessToken,
  conversationId,
  history,
  message,
}: AskHemieParams): Promise<HemieApiChatResult> {
  if (!accessToken.trim()) {
    throw new Error('Sign in to chat with Hemie.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const chatUrl = resolveHemieChatUrl(env.apiBaseUrl, env.supabaseUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (chatUrl.includes('/functions/v1/')) {
    headers.apikey = env.supabaseAnonKey;
  }

  try {
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        conversationId: conversationId || undefined,
        history,
        message,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; conversationId?: string }
      | null;

    if (!response.ok || payload?.success === false) {
      throw new Error(
        response.status === 401
          ? 'Sign in to chat with Hemie.'
          : payload?.message || HEMIE_UNAVAILABLE_MESSAGE,
      );
    }

    const reply = typeof payload?.message === 'string' ? payload.message.trim() : '';
    const nextConversationId =
      typeof payload?.conversationId === 'string' ? payload.conversationId : '';

    if (!reply || !nextConversationId) {
      throw new Error(HEMIE_UNAVAILABLE_MESSAGE);
    }

    return {
      conversationId: nextConversationId,
      message: reply,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Sign in to chat with Hemie.') {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(HEMIE_UNAVAILABLE_MESSAGE);
    }

    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error(HEMIE_UNAVAILABLE_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}
