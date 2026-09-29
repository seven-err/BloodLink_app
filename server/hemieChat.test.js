const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  callHemieLlm,
  generateHemieReply,
  getLocalHemieReply,
  getGroundedHemieReply,
  getLlmConfig,
  isLlmConfigured,
  sanitizeContext,
  sanitizeMessages,
} = require('./hemieChat');

test('continues the donor guide when the user replies next', () => {
  const reply = getLocalHemieReply('next', { role: 'donor', bloodType: 'O-', birthdate: '1995-06-15', weightKg: 65 }, [
    { role: 'user', content: 'Am I eligible to donate?' },
    { role: 'assistant', content: 'You meet the basic eligibility checks.' },
    { role: 'user', content: 'next' },
  ]);

  assert.match(reply, /valid ID|healthy meal|water/i);
  assert.match(reply, /Reply "next"/);
  assert.doesNotMatch(reply, /universal donor/i);
});

test('answers donation preparation instead of blood type matching', () => {
  const reply = getLocalHemieReply('what to do before i can donate', {
    bloodType: 'O-',
    role: 'donor',
  });

  assert.match(reply, /valid ID|healthy meal|water/i);
  assert.doesNotMatch(reply, /universal|AB\+|red cells/i);
});

test('refuses questions outside blood donation and BloodLink', () => {
  const reply = getLocalHemieReply('What is the capital of France?');

  assert.match(reply, /only help with blood donation|BloodLink assistant/i);
  assert.doesNotMatch(reply, /Paris/i);
});

test('refuses off-topic questions locally', () => {
  const reply = getLocalHemieReply('What is the weather today?');

  assert.match(reply, /BloodLink assistant/i);
  assert.match(reply, /blood donation|eligibility|matching/i);
});

test('returns eligibility guidance from local replies', () => {
  const reply = getLocalHemieReply('Am I eligible to donate?');

  assert.match(reply, /eligibility/i);
  assert.match(reply, /50 kg|weight/i);
  assert.match(reply, /56/);
});

test('personalizes compatibility for donor blood type', () => {
  const reply = getLocalHemieReply('How does blood matching work?', {
    bloodType: 'A+',
    role: 'donor',
  });

  assert.match(reply, /A\+/);
  assert.match(reply, /AB\+/);
});

test('personalizes eligibility with donation interval wait', () => {
  const recentDonation = new Date();
  recentDonation.setDate(recentDonation.getDate() - 10);

  const reply = getLocalHemieReply('Can I donate blood?', {
    birthdate: '1995-06-15',
    weightKg: 65,
    lastDonationAt: recentDonation.toISOString().slice(0, 10),
  });

  assert.match(reply, /day/i);
  assert.match(reply, /56/);
});

test('matches bloodtypes without a space', () => {
  const grounded = getGroundedHemieReply('what are bloodtypes', {});

  assert.equal(grounded?.kind, 'grounded');
  assert.match(grounded.reply, /O-|AB\+|compatibility|universal/i);
});

test('matches explain bloodtypes phrasing', () => {
  const reply = getLocalHemieReply('explain bloodtypes', { bloodType: 'B+', role: 'donor' });

  assert.match(reply, /B\+/);
  assert.doesNotMatch(reply, /Try one of the suggested questions/i);
});

test('sanitizeMessages rejects bad input', () => {
  assert.equal(sanitizeMessages(null).error, 'Provide at least one chat message.');
  assert.equal(sanitizeMessages([]).error, 'Provide at least one chat message.');
  assert.equal(
    sanitizeMessages([{ role: 'system', content: 'hi' }]).error,
    'Message role must be user or assistant.',
  );
  assert.equal(
    sanitizeMessages([{ role: 'user', content: '   ' }]).error,
    'Message content cannot be empty.',
  );
  assert.equal(
    sanitizeMessages([{ role: 'assistant', content: 'Hello' }]).error,
    'The latest message must come from the user.',
  );
});

test('sanitizeContext accepts lastDonationAt and isAvailable', () => {
  const context = sanitizeContext({
    role: 'donor',
    bloodType: 'o+',
    lastDonationAt: '2026-01-15',
    isAvailable: true,
    weightKg: 70,
  });

  assert.equal(context.bloodType, 'O+');
  assert.equal(context.lastDonationAt, '2026-01-15');
  assert.equal(context.isAvailable, true);
  assert.equal(context.weightKg, 70);
});

test('isLlmConfigured rejects an empty or Ollama placeholder key', () => {
  assert.equal(isLlmConfigured({}), false);
  assert.equal(isLlmConfigured({ HEMIE_LLM_API_KEY: 'ollama' }), false);
  assert.equal(isLlmConfigured({ HEMIE_LLM_API_KEY: 'test-key' }), true);
});

test('getLlmConfig defaults to Groq GPT-OSS 120B', () => {
  const config = getLlmConfig({
    HEMIE_LLM_API_KEY: 'test-key',
  });

  assert.equal(config.provider, 'groq');
  assert.equal(config.baseUrl, 'https://api.groq.com/openai/v1');
  assert.equal(config.models[0], 'openai/gpt-oss-120b');
  assert.ok(config.models.includes('openai/gpt-oss-20b'));
  assert.equal(config.models.some((model) => model.startsWith('gemini-')), false);
});

test('getLlmConfig replaces Ollama placeholders with Groq defaults', () => {
  const config = getLlmConfig({
    HEMIE_LLM_API_KEY: 'test-key',
    HEMIE_LLM_BASE_URL: 'http://127.0.0.1:11434/v1',
    HEMIE_LLM_MODEL: 'llama3.1',
    HEMIE_LLM_FALLBACK_MODELS: 'gemini-3.5-flash,llama3',
  });

  assert.equal(config.provider, 'groq');
  assert.equal(config.baseUrl, 'https://api.groq.com/openai/v1');
  assert.equal(config.models[0], 'openai/gpt-oss-120b');
  assert.equal(config.models.includes('llama3.1'), false);
  assert.equal(config.models.includes('gemini-3.5-flash'), false);
  assert.ok(config.models.includes('openai/gpt-oss-20b'));
});

test('getLlmConfig keeps an explicit Gemini override', () => {
  const config = getLlmConfig({
    HEMIE_LLM_API_KEY: 'test-key',
    HEMIE_LLM_MODEL: 'gemini-3.5-flash-lite',
  });

  assert.equal(config.provider, 'gemini');
  assert.equal(config.models[0], 'gemini-3.5-flash-lite');
  assert.ok(config.models.includes('gemini-3.1-flash-lite'));
});

test('generateHemieReply uses grounded source when no API key', async () => {
  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'How does blood matching work?' }],
    context: { bloodType: 'O-', role: 'donor' },
    env: {},
  });

  assert.equal(result.source, 'grounded');
  assert.match(result.reply, /O-/);
  assert.match(result.reply, /all types|universal/i);
});

test('known answers stay grounded even when an LLM is configured', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => ({}) };
  };

  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'what to do before i can donate' }],
    context: { bloodType: 'O-', role: 'donor' },
    env: { HEMIE_LLM_API_KEY: 'test-key' },
    fetchImpl,
  });

  assert.equal(called, false);
  assert.equal(result.source, 'grounded');
  assert.match(result.reply, /valid ID|healthy meal/i);
  assert.doesNotMatch(result.reply, /universal|red cells/i);
});

test('generateHemieReply calls Groq chat completions when configured', async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.temperature, 0.2);
    assert.equal(body.messages[0].role, 'system');
    assert.match(body.messages[0].content, /Hemie/);
    assert.equal(options.headers.Authorization, 'Bearer test-key');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '<think>hidden</think> Llama says donate safely with screening.',
            },
          },
        ],
      }),
    };
  };

  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'Does drinking coffee affect a blood donation?' }],
    context: { bloodType: 'O-', role: 'donor' },
    env: {
      HEMIE_LLM_API_KEY: 'test-key',
    },
    fetchImpl,
  });

  assert.equal(result.source, 'llm');
  assert.match(result.reply, /Llama says donate safely/);
  assert.doesNotMatch(result.reply, /hidden|think/i);
});

test('generateHemieReply uses LLM when configured', async () => {
  const fetchImpl = async (url, options) => {
    assert.match(String(url), /generateContent/);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.ok(body.systemInstruction.parts[0].text.includes('Hemie'));

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'LLM says donate safely with screening.' }] } }],
      }),
    };
  };

  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'Does drinking coffee affect a blood donation?' }],
    context: { bloodType: 'O-', role: 'donor' },
    env: {
      HEMIE_LLM_API_KEY: 'test-key',
      HEMIE_LLM_MODEL: 'gemini-3.5-flash-lite',
    },
    fetchImpl,
  });

  assert.equal(result.source, 'llm');
  assert.match(result.reply, /LLM says donate safely/);
});

test('callHemieLlm falls back to next model on quota errors', async () => {
  const calls = [];

  const fetchImpl = async (url) => {
    calls.push(String(url));

    if (calls.length === 1) {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'quota exceeded' } }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Fallback model reply' }] } }],
      }),
    };
  };

  const reply = await callHemieLlm({
    messages: [{ role: 'user', content: 'What should I bring before donating?' }],
    context: {},
    env: {
      HEMIE_LLM_API_KEY: 'test-key',
      HEMIE_LLM_MODEL: 'gemini-3.5-flash-lite',
      HEMIE_LLM_FALLBACK_MODELS: 'gemini-3.1-flash-lite',
    },
    fetchImpl,
  });

  assert.equal(reply, 'Fallback model reply');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /gemini-3\.5-flash-lite:generateContent/);
  assert.match(calls[1], /gemini-3\.1-flash-lite:generateContent/);
});

test('generateHemieReply uses local source when no API key for open questions', async () => {
  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'Tell me something useful about donating safely today' }],
    context: {},
    env: {},
  });

  assert.equal(result.source, 'local');
  assert.match(result.reply, /eligibility|BloodLink|donation/i);
});

test('detects Filipino eligibility phrasing for grounded replies', () => {
  const grounded = getGroundedHemieReply('Pwede ba akong mag-donate?', {});

  assert.equal(grounded?.kind, 'grounded');
  assert.match(grounded.reply, /eligibility|pasok ka sa basic eligibility/i);
});

test('detects informal Tagalog eligibility phrasing', () => {
  const grounded = getGroundedHemieReply('pwede ba kong mag donate?', {
    birthdate: '1995-06-15',
    weightKg: 65,
  });

  assert.equal(grounded?.kind, 'grounded');
  assert.match(grounded.reply, /pasok ka sa basic eligibility|meet the basic eligibility/i);
});

test('detects Cebuano help cue and replies in Filipino', () => {
  const reply = getLocalHemieReply('tabang');

  assert.match(reply, /Hemie|BloodLink/i);
  assert.match(reply, /Magtanong|eligibility/i);
  assert.doesNotMatch(reply, /Try one of the suggested questions/i);
});

test('system prompt instructs multilingual replies', async () => {
  let systemText = '';

  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    systemText = body.systemInstruction.parts[0].text;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Oo, maaari mong tingnan ang eligibility mo.' }] } }],
      }),
    };
  };

  const result = await generateHemieReply({
    messages: [{ role: 'user', content: 'Paano ako aalertuhan kung nagbago ang donation status?' }],
    context: {},
    env: {
      HEMIE_LLM_API_KEY: 'test-key',
      HEMIE_LLM_MODEL: 'gemini-3.5-flash-lite',
    },
    fetchImpl,
  });

  assert.equal(result.source, 'llm');
  assert.match(systemText, /Detect the language/i);
  assert.match(systemText, /Reply in that same language/i);
  assert.match(result.reply, /eligibility|maaari/i);
});
