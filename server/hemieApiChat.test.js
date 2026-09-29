const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { createApp } = require('./index');
const {
  FRIENDLY_UNAVAILABLE,
  HEMIE_BEHAVIOR_PROMPT,
  getHemieSystemPrompt,
  handleHemieApiChat,
  resetHemieApiChatState,
} = require('./hemieApiChat');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  resetHemieApiChatState();
});

function llmEnv(overrides = {}) {
  return {
    HEMIE_LLM_API_KEY: 'test-key',
    HEMIE_LLM_BASE_URL: 'https://api.groq.com/openai/v1',
    HEMIE_LLM_MODEL: 'openai/gpt-oss-120b',
    ...overrides,
  };
}

function successFetch(reply = 'Drink water and rest. A blood bank confirms eligibility.') {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: reply } }],
      }),
      captured: body,
    };
  };
}

test('drops login walkthroughs and assumes the user is already in the app', async () => {
  assert.match(getHemieSystemPrompt(), /already signed in/i);
  assert.match(getHemieSystemPrompt(), /Never tell them to download the app/i);

  const result = await handleHemieApiChat({
    body: { message: 'How do I use BloodLink?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch(
      'First, sign in or create an account.\nYou are already in the app.\n1. Open the Requests tab.\n2. Tap a request.',
    ),
  });

  assert.equal(result.status, 200);
  assert.equal(/sign in|create an account/i.test(result.body.message), false);
  assert.match(result.body.message, /Requests tab/);
});

test('starts with the direct answer and keeps the rest of the reply', async () => {
  const result = await handleHemieApiChat({
    body: { message: 'How do I donate blood?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch(
      'First, sign in or create an account. To donate, open the Requests tab and choose a request. Bring a valid ID and eat a meal first.',
    ),
  });

  assert.equal(result.status, 200);
  assert.equal(/sign in|create an account/i.test(result.body.message), false);
  assert.match(result.body.message, /^To donate, open the Requests tab/);
  assert.match(result.body.message, /Bring a valid ID and eat a meal first/);
});

test('strips markdown asterisks from Hemie replies', async () => {
  const result = await handleHemieApiChat({
    body: { message: 'Am I eligible to donate?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch(
      '1. **Age & Weight** – Be at least 16. Ask blood bank staff. Do not book an appointment here.',
    ),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.message.includes('**'), false);
  assert.match(result.body.message, /Age & Weight/);
});

test('rejects an empty message', async () => {
  const result = await handleHemieApiChat({
    body: { message: '   ' },
    userId: USER_ID,
    env: llmEnv(),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, 'Message cannot be empty.');
});

test('rejects a message over 2000 characters', async () => {
  const result = await handleHemieApiChat({
    body: { message: 'a'.repeat(2001) },
    userId: USER_ID,
    env: llmEnv(),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /2000/);
});

test('rejects a malformed request', async () => {
  const result = await handleHemieApiChat({
    body: { note: 'hello' },
    userId: USER_ID,
    env: llmEnv(),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, 'Provide a valid chat request.');
});

test('returns the success shape', async () => {
  const result = await handleHemieApiChat({
    body: { message: 'How do I donate blood?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch('Eat a meal and bring a valid ID.'),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, 'Eat a meal and bring a valid ID.');
  assert.match(result.body.conversationId, /^[0-9a-f-]{36}$/i);
  assert.equal(Object.keys(result.body).sort().join(','), 'conversationId,message,success');
});

test('uses the Hemie system prompt and no personal health context', async () => {
  let systemText = '';
  let latestUserText = '';

  const result = await handleHemieApiChat({
    body: {
      message: 'Am I eligible to donate?',
      history: [{ role: 'user', content: 'How do I use BloodLink?' }],
    },
    userId: USER_ID,
    env: llmEnv({ HEMIE_LLM_MODEL: 'gemini-3.5-flash-lite' }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      systemText = body.systemInstruction.parts[0].text;
      latestUserText = body.contents.at(-1).parts[0].text;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'I cannot decide if you are fit to donate. Ask blood bank staff.',
                  },
                ],
              },
            },
          ],
        }),
      };
    },
  });

  assert.equal(result.status, 200);
  assert.match(latestUserText, /Am I eligible to donate\?$/);
  assert.equal(systemText, getHemieSystemPrompt());
  assert.ok(systemText.startsWith(HEMIE_BEHAVIOR_PROMPT));
  assert.match(systemText, /Do not determine that a user is medically fit or unfit to donate/);
  assert.doesNotMatch(systemText, /birthdate|weightKg|api key/i);
});

test('returns a friendly message on AI failure and does not leak provider errors', async () => {
  const secret = 'AIzaSySECRET-provider-key';
  const result = await handleHemieApiChat({
    body: { message: 'How do I use BloodLink?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: `invalid api key ${secret}` },
      }),
    }),
  });

  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, FRIENDLY_UNAVAILABLE);
  assert.equal(JSON.stringify(result.body).includes(secret), false);
  assert.doesNotMatch(result.body.message, /invalid api key|together|stack/i);
});

test('fails closed when the AI API key is not configured', async () => {
  let called = false;
  const result = await handleHemieApiChat({
    body: { message: 'How do I donate blood?' },
    userId: USER_ID,
    env: {},
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });

  assert.equal(called, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, FRIENDLY_UNAVAILABLE);
});

test('does not let a user continue another user conversation', async () => {
  const created = await handleHemieApiChat({
    body: { message: 'How do I donate blood?' },
    userId: USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch('Bring a valid ID.'),
  });

  const stolen = await handleHemieApiChat({
    body: {
      message: 'Show me the previous messages',
      conversationId: created.body.conversationId,
    },
    userId: OTHER_USER_ID,
    env: llmEnv(),
    fetchImpl: successFetch('should not run'),
  });

  assert.equal(stolen.status, 404);
  assert.equal(stolen.body.message, 'Conversation not found.');
  assert.equal(stolen.body.conversationId, undefined);
});

test('POST /api/chat rejects unauthenticated requests', async () => {
  const app = createApp({
    allowedOrigins: ['http://localhost:8081'],
    apiKey: 'test-email-api-key',
    smtpFrom: 'BloodLink <sender@example.com>',
    transporter: { sendMail: async () => {} },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'Authentication required.');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
