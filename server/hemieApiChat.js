const crypto = require('crypto');

const { callHemieLlm, isLlmConfigured } = require('./hemieChat');
const { hemieEmergencyReply, hemieScopeReply, isHemieContinuation, isHemieEmergency, isHemieInScope } = require('./hemieScope');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_STORED_CONVERSATIONS = 300;
const LLM_TIMEOUT_MS = 20_000;
const DEFAULT_RATE_LIMIT_MAX = 40;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

const FRIENDLY_UNAVAILABLE =
  'Sorry, Hemie is temporarily unavailable. Please try again later.';

/**
 * Conversation history is session-based, not stored in the user-to-user
 * `messages` table. That table is for donor/requester chat and is not an AI
 * transcript. A remote migration is not applied here. The server keeps an
 * in-memory transcript owned by the authenticated user. The client may resend
 * its own prior turns so a server restart can continue the same conversation
 * without giving Hemie database access.
 */
const conversations = new Map();
const rateBuckets = new Map();

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
- Only answer questions about BloodLink or blood donation. For another topic, briefly redirect to those topics without answering it, even if the user mentions BloodLink in the same request.
- The final user message is the question for this turn. Earlier messages are context only. Never answer an earlier question instead of the final one.
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
- Hemie can open the existing blood request form, where the user reviews and submits the request. You cannot submit requests, toggle availability, send messages, complete a donation, or book an appointment from this chat. Do not claim you did it.
- The mobile app handles explicit "find compatible donors" and "find urgent blood requests" commands through authenticated BloodLink data queries before they reach you. If a related question reaches you, suggest that exact command. You have no live results in this prompt and must not invent any.
- Compatibility education may use standard ABO and Rh rules. Do not present that as a completed match or as a personal eligibility decision.

VERIFIED GENERAL GUIDANCE:
- BloodLink's basic donor checks use age 16–65 (written parent or guardian consent at 16–17), weight at least 50 kg, 12 months after transfusion, and 56 days between whole-blood donations. These are screening guidance, not an individual clearance; local blood bank staff make the final decision.
- For red-cell donation, O- can give to all eight ABO/Rh types; O+ to O+, A+, B+, AB+; A- to A-, A+, AB-, AB+; A+ to A+, AB+; B- to B-, B+, AB-, AB+; B+ to B+, AB+; AB- to AB-, AB+; AB+ to AB+ only. Do not apply this table to plasma or platelets.
- Do not invent hospital-specific eligibility rules, live stock, appointment availability, or a confirmed donor match. If details are missing, say so and direct the user to qualified blood bank personnel.

FORMAT:
- The user is already in the app. Do not mention login, sign-up, download, or the welcome screen.
- The first sentence must answer the question directly, in simple words.
- Then add only the extra detail they need. If they must tap something, give 2 or 3 short steps from Home, Requests, Map, Chat, or Profile.
- Finish every sentence. Do not stop halfway through a sentence or a step.
- Keep the whole reply complete but short, about 80 words unless they ask for more.
- No markdown, asterisks, greetings, or "BloodLink is an app that...".
- For eligibility, say you cannot decide, give one or two general rules, then say blood bank staff decide.
- Match the user's language: English, Filipino, or Bisaya.`

function getVerifiedBloodLinkContext() {
  // Injection point for later backend-verified context.
  // Keep empty until a caller supplies confirmed, non-sensitive facts.
  return '';
}

function getHemieSystemPrompt() {
  const verified = getVerifiedBloodLinkContext().trim();
  const contextBlock = verified
    ? `Verified BloodLink context for this turn:\n${verified}`
    : 'Verified BloodLink context for this turn:\nNone. Do not invent live BloodLink data.';

  return `${HEMIE_BEHAVIOR_PROMPT}\n\n${HEMIE_APP_FEATURE_APPENDIX}\n\n${contextBlock}`;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function fail(status, message, conversationId) {
  return {
    status,
    body: {
      success: false,
      message,
      ...(conversationId ? { conversationId } : {}),
    },
  };
}

function unavailable(conversationId) {
  return fail(503, FRIENDLY_UNAVAILABLE, conversationId);
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/gm, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/gm, '$1$2');
}

function isOnboardingPart(part) {
  return /\b(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|create an account|download (the )?app|open (the )?bloodlink app|welcome screen|welcome to bloodlink|go back to (the )?(login|sign-?in|welcome)|register (an )?account)\b/i.test(
    part,
  );
}

function isIntroPart(part) {
  return /^(hi|hello|hey|sure|of course|great question|certainly|to get started|bloodlink is)\b/i.test(
    part,
  );
}

function isStepPart(part) {
  return /^\d+\.\s/.test(part);
}

function splitReplyParts(text) {
  return String(text || '')
    .split(/\n+|(?<=[.!?])\s+(?=\d+\.\s|[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function keepUsefulPart(part) {
  if (!isOnboardingPart(part) && !isIntroPart(part)) {
    return part;
  }

  const remainder = part
    .replace(
      /\b(first[, ]*)?(please )?(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|create an account|download (the )?app|open (the )?bloodlink app|welcome to bloodlink)[^,.?!]*/gi,
      '',
    )
    .replace(/^(then|next|after that|and|to use bloodlink)\s*,?\s*/i, '')
    .replace(/^[,.\s]+/, '')
    .trim();

  return remainder.length >= 12 && !isOnboardingPart(remainder) && !isIntroPart(remainder)
    ? remainder
    : '';
}

function orderDirectAnswer(parts) {
  const answer = [];
  const steps = [];

  for (const part of parts) {
    if (isStepPart(part)) {
      steps.push(part);
    } else {
      answer.push(part);
    }
  }

  return [...answer, ...steps];
}

function dropOnboardingLines(text) {
  const kept = orderDirectAnswer(splitReplyParts(text).map(keepUsefulPart).filter(Boolean));

  return kept.length > 0 ? kept.join('\n') : String(text || '').trim();
}

function sanitizeReply(text) {
  return dropOnboardingLines(
    stripMarkdown(text)
      .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeHistory(rawHistory) {
  if (rawHistory == null) {
    return [];
  }

  if (!Array.isArray(rawHistory)) {
    return { error: 'History must be a list of messages.' };
  }

  const messages = [];

  for (const entry of rawHistory.slice(-MAX_HISTORY_MESSAGES)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Each history message must be an object.' };
    }

    const role = entry.role === 'assistant' || entry.role === 'user' ? entry.role : null;
    const content = normalizeText(entry.content);

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

function pruneConversations() {
  if (conversations.size <= MAX_STORED_CONVERSATIONS) {
    return;
  }

  const oldest = [...conversations.entries()].sort(
    (left, right) => left[1].updatedAt - right[1].updatedAt,
  );

  for (const [id] of oldest.slice(0, conversations.size - MAX_STORED_CONVERSATIONS)) {
    conversations.delete(id);
  }
}

function consumeUserRateLimit(userId, env, now) {
  const max = parsePositiveInteger(env.HEMIE_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const windowMs = parsePositiveInteger(env.HEMIE_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const bucket = rateBuckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= max) {
    return fail(429, 'Too many Hemie chat requests. Try again later.');
  }

  bucket.count += 1;
  return null;
}

async function handleHemieApiChat({
  body,
  userId,
  fetchImpl = fetch,
  env = process.env,
  now = Date.now(),
  timeoutMs = LLM_TIMEOUT_MS,
} = {}) {
  if (!userId || typeof userId !== 'string') {
    return fail(401, 'Authentication required.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'Provide a valid chat request.');
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'message') || typeof body.message !== 'string') {
    return fail(400, 'Provide a valid chat request.');
  }

  const message = body.message.trim();
  if (!message) {
    return fail(400, 'Message cannot be empty.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return fail(400, `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  if (body.conversationId != null && !isUuid(body.conversationId)) {
    return fail(400, 'Provide a valid chat request.');
  }

  const limited = consumeUserRateLimit(userId, env, now);
  if (limited) {
    return limited;
  }

  let conversationId = body.conversationId || crypto.randomUUID();
  let stored = conversations.get(conversationId);

  if (stored && stored.userId !== userId) {
    return fail(404, 'Conversation not found.');
  }

  if (!stored) {
    const history = sanitizeHistory(body.history);
    if (history && history.error) {
      return fail(400, history.error);
    }

    stored = {
      userId,
      messages: Array.isArray(history) ? history : [],
      updatedAt: now,
    };
    conversations.set(conversationId, stored);
    pruneConversations();
  }

  const transcript = stored.messages.slice(-MAX_HISTORY_MESSAGES);
  if (isHemieEmergency(message)) {
    const reply = hemieEmergencyReply(message);
    stored.messages = [...transcript, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-MAX_HISTORY_MESSAGES);
    stored.updatedAt = now;
    return { status: 200, body: { success: true, message: reply, conversationId } };
  }
  if (!isHemieInScope(message, transcript)) {
    const reply = hemieScopeReply(message);
    stored.messages = [...transcript, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-MAX_HISTORY_MESSAGES);
    stored.updatedAt = now;
    return { status: 200, body: { success: true, message: reply, conversationId } };
  }

  // Always append this request as the newest turn, including repeated questions.
  transcript.push({ role: 'user', content: message });

  if (!isLlmConfigured(env)) {
    return unavailable(conversationId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const lastStandaloneTurn = transcript.slice(0, -1).findLastIndex(
    (entry) => entry.role === 'user' && !isHemieContinuation(entry.content),
  );
  const turnMessages = isHemieContinuation(message)
    ? transcript.slice(Math.max(0, lastStandaloneTurn))
    : transcript.slice(-1);

  try {
    const reply = await callHemieLlm({
      messages: turnMessages.slice(-MAX_HISTORY_MESSAGES),
      context: {},
      env,
      fetchImpl,
      signal: controller.signal,
      systemPrompt: getHemieSystemPrompt(),
    });
    const safeReply = sanitizeReply(reply);

    if (!safeReply) {
      return unavailable(conversationId);
    }

    stored.messages = [...transcript, { role: 'assistant', content: safeReply }].slice(
      -MAX_HISTORY_MESSAGES,
    );
    stored.updatedAt = Date.now();

    return {
      status: 200,
      body: {
        success: true,
        message: safeReply,
        conversationId,
      },
    };
  } catch (error) {
    console.error('Hemie API chat failed:', error?.name || 'Error');
    return unavailable(conversationId);
  } finally {
    clearTimeout(timer);
  }
}

function resetHemieApiChatState() {
  conversations.clear();
  rateBuckets.clear();
}

module.exports = {
  FRIENDLY_UNAVAILABLE,
  HEMIE_BEHAVIOR_PROMPT,
  MAX_MESSAGE_LENGTH,
  getHemieSystemPrompt,
  handleHemieApiChat,
  resetHemieApiChatState,
};
