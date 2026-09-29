import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Hemie chat for the installed APK.
 *
 * The phone already reaches this Supabase project over HTTPS. This function
 * replaces POST /api/chat so Hemie does not depend on a laptop localhost server.
 * The Groq key stays in HEMIE_LLM_API_KEY. A signed-in user JWT is required.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRIENDLY_UNAVAILABLE =
  'Sorry, Hemie is temporarily unavailable. Please try again later.';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;
const LLM_TIMEOUT_MS = 20_000;
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b'];

const HEMIE_BEHAVIOR_PROMPT = `You are Hemie, the AI assistant of BloodLink, a blood donation and blood management system.

Your role is to assist BloodLink users by providing clear, concise, and helpful information about blood donation, blood recipients, blood types, donation procedures, and the use of the BloodLink application.

PERSONALITY:
- Friendly, calm, and professional.
- Use simple language.
- Respond in English, Filipino, or Bisaya according to the user's language.
- Keep responses concise unless the user requests more detail.
- Avoid unnecessary medical terminology.

BLOODLINK SCOPE:
You may help users with:
1. General blood donation information.
2. Basic blood type information.
3. General blood compatibility information.
4. General donor eligibility requirements.
5. General preparation before blood donation.
6. General after-donation care.
7. Explaining BloodLink features.
8. Guiding donors through BloodLink.
9. Guiding recipients through BloodLink.
10. Explaining bloodbank-related processes available in BloodLink.

SAFETY:
- You are not a doctor.
- Do not diagnose diseases or medical conditions.
- Do not determine that a user is medically fit or unfit to donate.
- Do not replace assessment by qualified healthcare personnel.
- If a question requires individual medical assessment, advise the user to consult qualified healthcare personnel or bloodbank staff.
- If the user describes an emergency or potentially life-threatening condition, advise them to seek immediate emergency medical care.

DATA:
- Only provide current BloodLink information when it is supplied by the backend.
- Never invent blood stock levels, donor availability, blood requests, bloodbank schedules, locations, or user information.
- Do not expose private, sensitive, authentication, or administrative information.
- If required system information is unavailable, tell the user that the information is currently unavailable.

GENERAL BEHAVIOR:
- Answer the user's actual question first.
- If the question is unclear, ask a short clarification question.
- Do not hallucinate BloodLink features.
- Do not claim to have performed an action unless the backend confirms it.
- Hemie provides informational assistance only.
- Final medical decisions and donor eligibility decisions belong to qualified healthcare personnel.`;

const HEMIE_APP_FEATURE_APPENDIX = `WHERE THE USER IS:
- The user is already signed in and already inside the BloodLink app. Hemie is open on their screen.
- Never tell them to download the app, open the app, create an account, sign up, log in, or go back to the welcome or login screen.
- Do not explain BloodLink from the beginning. Do not start with what BloodLink is.
- Guide them from the tabs they already see at the bottom: Home, Requests, Map, Chat, and Profile.

APP FEATURES THAT EXIST (describe only these; do not invent others):
- Home: donor or recipient status, availability, and urgent items.
- Requests: donors browse open requests. Recipients create or view a blood request (blood type, units, urgency, hospital or location).
- Map: nearby donors and request locations.
- Chat: messages. Hemie is the assistant already open here.
- Profile: blood type, account settings, report a safety concern, and apply as a donor.
- Donors can set availability and use donation or profile QR codes. Recipients can browse nearby compatible donors.
- Blood bank personnel use a separate verified area. Do not describe inventory counts, schedules, or locations that are not in the verified context block.
- You cannot create requests, toggle availability, send messages, complete a donation, or book an appointment from this chat. Name the tab. Do not claim you did it.
- Compatibility education may use standard ABO and Rh rules. Do not present that as a completed match or as a personal eligibility decision.

FORMAT:
- The user is already in the app. Do not mention login, sign-up, download, or the welcome screen.
- The first sentence must answer the question directly, in simple words.
- Then add only the extra detail they need. If they must tap something, give 2 or 3 short steps from Home, Requests, Map, Chat, or Profile.
- Finish every sentence. Do not stop halfway through a sentence or a step.
- Keep the whole reply complete but short, about 80 words unless they ask for more.
- No markdown, asterisks, greetings, or "BloodLink is an app that...".
- For eligibility, say you cannot decide, give one or two general rules, then say blood bank staff decide.
- Match the user's language: English, Filipino, or Bisaya.`;

const SYSTEM_PROMPT = `${HEMIE_BEHAVIOR_PROMPT}\n\n${HEMIE_APP_FEATURE_APPENDIX}\n\nVerified BloodLink context for this turn:\nNone. Do not invent live BloodLink data.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/gm, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/gm, '$1$2');
}

function sanitizeReply(text: string): string {
  return stripMarkdown(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sanitizeHistory(rawHistory: unknown): ChatMessage[] | { error: string } {
  if (rawHistory == null) {
    return [];
  }
  if (!Array.isArray(rawHistory)) {
    return { error: 'History must be a list of messages.' };
  }

  const messages: ChatMessage[] = [];
  for (const entry of rawHistory.slice(-MAX_HISTORY_MESSAGES)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Each history message must be an object.' };
    }
    const record = entry as { role?: unknown; content?: unknown };
    const role = record.role === 'assistant' || record.role === 'user' ? record.role : null;
    const content = typeof record.content === 'string' ? record.content.replace(/\s+/g, ' ').trim() : '';
    if (!role || !content) {
      continue;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
    }
    messages.push({ role, content });
  }
  return messages;
}

function extractReply(payload: {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | Array<{ text?: string }> };
  }>;
}): { text: string; truncated: boolean } {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content.map((part) => part?.text || '').filter(Boolean).join('\n');
  }
  return {
    text: sanitizeReply(text),
    truncated: choice?.finish_reason === 'length',
  };
}

async function callGroq(messages: ChatMessage[], signal: AbortSignal): Promise<string> {
  const apiKey = (Deno.env.get('HEMIE_LLM_API_KEY') || '').trim();
  if (!apiKey || apiKey.toLowerCase() === 'ollama') {
    throw new Error('llm-unconfigured');
  }

  const baseUrl = (Deno.env.get('HEMIE_LLM_BASE_URL') || DEFAULT_GROQ_BASE_URL)
    .trim()
    .replace(/\/$/, '');
  const configuredModel = (Deno.env.get('HEMIE_LLM_MODEL') || '').trim();
  const fallbacks = (Deno.env.get('HEMIE_LLM_FALLBACK_MODELS') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const models = [...new Set([configuredModel || DEFAULT_GROQ_MODEL, ...fallbacks, ...DEFAULT_GROQ_FALLBACK_MODELS])];

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const reasoning = /^openai\/gpt-oss-/i.test(model);
      let lastReply = '';

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: (reasoning ? 2048 : 512) * (attempt + 1),
            ...(reasoning ? { reasoning_effort: 'low' } : {}),
            stream: false,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = payload?.error?.message || payload?.message || `status ${response.status}`;
          const error = new Error(String(message));
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }

        const extracted = extractReply(payload ?? {});
        if (extracted.text) {
          lastReply = extracted.text;
        }
        if (extracted.text && !extracted.truncated) {
          return extracted.text;
        }
      }

      if (lastReply) {
        return lastReply;
      }
      throw new Error('empty reply');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (lastError as Error & { status?: number }).status;
      const retryable = status === 404 || status === 429 || status === 503 || status == null;
      if (!retryable && status !== 400) {
        break;
      }
    }
  }

  throw lastError ?? new Error('All Hemie models failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Provide a valid chat request.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, message: 'Authentication required.' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ success: false, message: 'Authentication required.' }, 401);
  }

  let body: { conversationId?: unknown; history?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, message: 'Provide a valid chat request.' }, 400);
  }

  if (!body || typeof body !== 'object' || typeof body.message !== 'string') {
    return jsonResponse({ success: false, message: 'Provide a valid chat request.' }, 400);
  }

  const message = body.message.trim();
  if (!message) {
    return jsonResponse({ success: false, message: 'Message cannot be empty.' }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(
      { success: false, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      400,
    );
  }
  if (body.conversationId != null && !isUuid(body.conversationId)) {
    return jsonResponse({ success: false, message: 'Provide a valid chat request.' }, 400);
  }

  const history = sanitizeHistory(body.history);
  if (!Array.isArray(history)) {
    return jsonResponse({ success: false, message: history.error }, 400);
  }

  const conversationId = isUuid(body.conversationId) ? body.conversationId : crypto.randomUUID();
  const transcript = [...history];
  const last = transcript[transcript.length - 1];
  if (!(last && last.role === 'user' && last.content === message)) {
    transcript.push({ role: 'user', content: message });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const reply = await callGroq(transcript.slice(-MAX_HISTORY_MESSAGES), controller.signal);
    if (!reply) {
      return jsonResponse(
        { success: false, message: FRIENDLY_UNAVAILABLE, conversationId },
        503,
      );
    }
    return jsonResponse({ success: true, message: reply, conversationId });
  } catch (error) {
    console.error('Hemie chat failed:', error instanceof Error ? error.name : 'Error');
    return jsonResponse(
      { success: false, message: FRIENDLY_UNAVAILABLE, conversationId },
      503,
    );
  } finally {
    clearTimeout(timer);
  }
});
