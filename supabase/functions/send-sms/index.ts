import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

import { sendViaPhilSms } from '../_shared/philsms.ts';

type SendSmsPayload = {
  user: {
    phone: string;
  };
  sms: {
    otp: string;
  };
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { http_code: 405, message: 'Method not allowed' } }, 405);
  }

  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!hookSecret) {
    return jsonResponse(
      { error: { http_code: 500, message: 'SEND_SMS_HOOK_SECRET is not configured.' } },
      500,
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const base64Secret = hookSecret.replace(/^v1,whsec_/, '');
  const wh = new Webhook(base64Secret);

  try {
    const { user, sms } = wh.verify(payload, headers) as SendSmsPayload;
    const message = `Your BloodLink code is ${sms.otp}. Do not share this code with anyone.`;

    await sendViaPhilSms(user.phone, message);

    return jsonResponse({});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('send-sms hook failed:', message);

    return jsonResponse(
      {
        error: {
          http_code: 500,
          message: `Failed to send SMS: ${message}`,
        },
      },
      500,
    );
  }
});
