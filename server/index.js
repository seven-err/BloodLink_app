require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
  override: true,
});

const crypto = require('crypto');
const cors = require('cors');
const express = require('express');
const nodemailer = require('nodemailer');
const { handleHemieApiChat } = require('./hemieApiChat');
const {
  generateHemieReply,
  getLlmConfig,
  isLlmConfigured,
  sanitizeContext,
  sanitizeMessages,
  verifySupabaseAccessToken,
} = require('./hemieChat');
const {
  getUserPushTokens,
  sendExpoPushNotifications,
} = require('./pushService');

const port = Number(process.env.PORT || 3001);
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_HEMIE_RATE_LIMIT_MAX = 40;
const MIN_API_KEY_LENGTH = 16;

const emailTemplates = {
  welcome: ({ name } = {}) => {
    const displayName = typeof name === 'string' && name.trim() ? name.trim() : 'there';
    const safeName = escapeHtml(displayName);

    return {
      subject: 'Welcome to BloodLink',
      text: `Hi ${displayName}, welcome to BloodLink. Thank you for joining a community built around safe blood donation.`,
      html: `<p>Hi ${safeName},</p><p>Welcome to BloodLink. Thank you for joining a community built around safe blood donation.</p>`,
    };
  },
};

const allowedEmailRequestFields = new Set(['data', 'template', 'to']);

const requireEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const parseAllowedOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function timingSafeEqualString(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return (
    valueBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

function createRateLimiter({
  max = DEFAULT_RATE_LIMIT_MAX,
  windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  message = 'Too many email requests. Try again later.',
} = {}) {
  const buckets = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (bucket.count >= max) {
      return res.status(429).json({
        message,
      });
    }

    bucket.count += 1;
    return next();
  };
}

function requireEmailApiKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length < MIN_API_KEY_LENGTH) {
    throw new Error('EMAIL_API_KEY must be at least 16 characters long.');
  }

  return (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const headerToken = req.get('x-email-api-key') || bearerToken;

    if (!headerToken || !timingSafeEqualString(headerToken, apiKey)) {
      return res.status(401).json({
        message: 'Email API authorization failed.',
      });
    }

    return next();
  };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildEmailFromTemplate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      error: 'Provide a valid email request.',
    };
  }

  const unsupportedFields = Object.keys(body).filter(
    (field) => !allowedEmailRequestFields.has(field),
  );

  if (unsupportedFields.length > 0) {
    return {
      error: 'Email request contains unsupported fields.',
    };
  }

  const { data, template, to } = body || {};
  const recipient = typeof to === 'string' ? to.trim() : '';

  if (!emailPattern.test(recipient)) {
    return {
      error: 'Provide a valid recipient email address.',
    };
  }

  if (!template || !emailTemplates[template]) {
    return {
      error: 'Provide a supported email template.',
    };
  }

  if (data !== undefined && (typeof data !== 'object' || data === null || Array.isArray(data))) {
    return {
      error: 'Template data must be an object.',
    };
  }

  const templateData = data ?? {};
  const email = emailTemplates[template](templateData);

  return {
    email: {
      ...email,
      to: recipient,
    },
  };
}

function createTransporter() {
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
    },
  });
}

function createApp({
  allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  apiKey = requireEnv('EMAIL_API_KEY'),
  rateLimit = {
    max: parsePositiveInteger(process.env.EMAIL_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    windowMs: parsePositiveInteger(
      process.env.EMAIL_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
  },
  smtpFrom = requireEnv('SMTP_FROM'),
  transporter = createTransporter(),
} = {}) {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', (_req, res) => {
    const llm = getLlmConfig(process.env);

    res.json({
      status: 'ok',
      hemie: {
        llmConfigured: isLlmConfigured(process.env),
        provider: isLlmConfigured(process.env) ? llm.provider : null,
        model: isLlmConfigured(process.env) ? llm.models[0] : null,
      },
    });
  });

  const hemieRateLimit = {
    max: parsePositiveInteger(process.env.HEMIE_RATE_LIMIT_MAX, DEFAULT_HEMIE_RATE_LIMIT_MAX),
    windowMs: parsePositiveInteger(
      process.env.HEMIE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    message: 'Too many Hemie chat requests. Try again later.',
  };

  app.post('/hemie/chat', createRateLimiter(hemieRateLimit), async (req, res) => {
    const authorization = req.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    if (!accessToken) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    try {
      await verifySupabaseAccessToken(accessToken);
    } catch (error) {
      const status = Number(error?.status) || 401;
      return res.status(status).json({
        message: error?.message || 'Authentication failed.',
      });
    }

    const { error: messagesError, messages } = sanitizeMessages(req.body?.messages);
    if (messagesError) {
      return res.status(400).json({
        message: messagesError,
      });
    }

    const context = sanitizeContext(req.body?.context);

    try {
      const result = await generateHemieReply({ messages, context });
      return res.json({
        reply: result.reply,
        source: result.source,
      });
    } catch (error) {
      console.error('Hemie chat failed:', error);
      return res.status(500).json({
        message: 'Hemie is temporarily unavailable. Please try again.',
      });
    }
  });

  app.post('/api/chat', createRateLimiter(hemieRateLimit), async (req, res) => {
    const authorization = req.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    let user;

    try {
      user = await verifySupabaseAccessToken(accessToken);
    } catch (error) {
      const status = Number(error?.status) || 401;
      return res.status(status === 401 ? 401 : 503).json({
        success: false,
        message:
          status === 401
            ? 'Authentication required.'
            : 'Sorry, Hemie is temporarily unavailable. Please try again later.',
      });
    }

    try {
      const result = await handleHemieApiChat({
        body: req.body,
        userId: user.id,
      });
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('Hemie API chat failed:', error?.name || 'Error');
      return res.status(503).json({
        success: false,
        message: 'Sorry, Hemie is temporarily unavailable. Please try again later.',
      });
    }
  });

  app.post('/push/send', createRateLimiter(rateLimit), async (req, res) => {
    const authorization = req.get('authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const providedApiKey = req.get('x-email-api-key') || req.get('x-api-key');

    let isAuthorized = false;

    if (providedApiKey && apiKey && providedApiKey === apiKey) {
      isAuthorized = true;
    } else if (accessToken) {
      try {
        await verifySupabaseAccessToken(accessToken);
        isAuthorized = true;
      } catch (error) {
        const status = Number(error?.status) || 401;
        return res.status(status).json({
          message: error?.message || 'Authentication failed.',
        });
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const { body, data, title, tokens: explicitTokens, userId, userIds } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Notification title is required.',
      });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({
        message: 'Notification body is required.',
      });
    }

    let targetTokens = Array.isArray(explicitTokens) ? [...explicitTokens] : [];

    const targetUserIds = [
      ...(Array.isArray(userIds) ? userIds : []),
      ...(userId && typeof userId === 'string' ? [userId] : []),
    ];

    if (targetUserIds.length > 0) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({
          message: 'Supabase is not configured on the server to query push tokens.',
        });
      }

      try {
        for (const uid of targetUserIds) {
          const userTokens = await getUserPushTokens(uid, {
            apiKey: supabaseKey,
            accessToken: process.env.SUPABASE_SERVICE_ROLE_KEY ? undefined : accessToken,
            supabaseUrl,
          });
          targetTokens.push(...userTokens);
        }
      } catch (error) {
        console.error('Failed to resolve target user push tokens:', error);
        return res.status(500).json({
          message: 'Failed to retrieve push tokens for target user(s).',
        });
      }
    }

    // Deduplicate tokens
    targetTokens = Array.from(new Set(targetTokens));

    if (targetTokens.length === 0) {
      return res.json({
        count: 0,
        message: 'No push tokens found for recipient(s).',
        success: true,
      });
    }

    const messages = targetTokens.map((token) => ({
      body: body.trim(),
      channelId: 'bloodlink-default',
      data: data && typeof data === 'object' ? data : {},
      priority: 'high',
      sound: 'default',
      title: title.trim(),
      to: token,
    }));

    try {
      const result = await sendExpoPushNotifications(messages, {
        expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
      });

      return res.json({
        count: targetTokens.length,
        success: true,
        tickets: result?.data || [],
      });
    } catch (error) {
      console.error('Expo push dispatch failed:', error);
      return res.status(500).json({
        message: error?.message || 'Failed to dispatch push notifications.',
      });
    }
  });

  app.post(
    '/email/send',
    createRateLimiter(rateLimit),
    requireEmailApiKey(apiKey),
    async (req, res) => {
      const { email, error } = buildEmailFromTemplate(req.body);

      if (error) {
        return res.status(400).json({
          message: error,
        });
      }

      try {
        await transporter.sendMail({
          from: smtpFrom,
          ...email,
        });

        return res.json({ success: true });
      } catch (error) {
        console.error('Failed to send email:', error);

        return res.status(500).json({
          message: 'Email failed to send.',
        });
      }
    },
  );

  app.post('/send-email', (_req, res) => {
    res.status(410).json({
      message: 'Use the authenticated /email/send template endpoint.',
    });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(port, () => {
    console.log(`BloodLink email server running on http://localhost:${port}`);
  });
}

module.exports = {
  buildEmailFromTemplate,
  createApp,
};
