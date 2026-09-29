import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendViaPhilSms } from '../_shared/philsms.ts';

const EMERGENCY_TYPES = new Set(['blood_request', 'donor_match', 'donation']);
const BLOOD_REQUEST_SMS_URGENCIES = new Set(['critical', 'high']);
const MAX_MESSAGE_LENGTH = 300;

type NotificationRecord = {
  user_id?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: NotificationRecord;
  /** Some webhook payloads nest the row under `payload.record`. */
  payload?: {
    record?: NotificationRecord;
  };
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const buildAlertMessage = (title: string, body: string): string => {
  const combined = `BloodLink: ${title}. ${body}`.replace(/\s+/g, ' ').trim();
  if (combined.length <= MAX_MESSAGE_LENGTH) {
    return combined;
  }
  return `${combined.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
};

const getRecord = (payload: WebhookPayload): NotificationRecord | null =>
  payload.record ?? payload.payload?.record ?? null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', skipped: true }, 405);
  }

  const expectedSecret = Deno.env.get('ALERT_SMS_SECRET')?.trim();
  if (!expectedSecret) {
    console.error('ALERT_SMS_SECRET is not configured.');
    return jsonResponse({ error: 'Alert SMS is not configured.', skipped: true }, 500);
  }

  const providedSecret = req.headers.get('x-alert-sms-secret')?.trim();
  if (!providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized', skipped: true }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', skipped: true }, 400);
  }

  const record = getRecord(payload);
  if (!record?.user_id || !record.type) {
    return jsonResponse({ skipped: true, reason: 'missing_record' });
  }

  // Database Webhooks may fire for UPDATE/DELETE if misconfigured — only INSERT.
  const eventType = (payload.type ?? '').toUpperCase();
  if (eventType && eventType !== 'INSERT') {
    return jsonResponse({ skipped: true, reason: 'not_insert' });
  }

  if (!EMERGENCY_TYPES.has(record.type)) {
    return jsonResponse({ skipped: true, reason: 'type_not_emergency' });
  }

  const suppressSms = record.data?.suppress_sms_webhook;
  if (suppressSms === true || suppressSms === 'true') {
    return jsonResponse({ skipped: true, reason: 'sms_suppressed' });
  }

  if (record.type === 'blood_request') {
    const urgency = String(record.data?.urgency ?? '').toLowerCase();
    if (!BLOOD_REQUEST_SMS_URGENCIES.has(urgency)) {
      return jsonResponse({ skipped: true, reason: 'urgency_not_eligible' });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase service credentials are not configured on send-alert-sms.');
    return jsonResponse({ error: 'Server misconfigured', skipped: true }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('sms_enabled')
      .eq('user_id', record.user_id)
      .maybeSingle();

    if (prefsError) {
      console.error('Failed to load notification preferences:', prefsError.message);
      return jsonResponse({ error: 'Failed to load preferences', skipped: true }, 500);
    }

    if (!prefs?.sms_enabled) {
      return jsonResponse({ skipped: true, reason: 'sms_disabled' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', record.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load profile phone:', profileError.message);
      return jsonResponse({ error: 'Failed to load phone', skipped: true }, 500);
    }

    const phone = profile?.phone?.trim();
    if (!phone) {
      return jsonResponse({ skipped: true, reason: 'no_phone' });
    }

    const title = (record.title ?? 'Alert').trim() || 'Alert';
    const body = (record.body ?? '').trim();
    const message = buildAlertMessage(title, body);

    await sendViaPhilSms(phone, message);

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('send-alert-sms failed:', message);
    return jsonResponse({ error: 'Failed to send alert SMS', skipped: true }, 500);
  }
});
