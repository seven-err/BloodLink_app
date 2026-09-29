import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { sendViaPhilSms } from '../_shared/philsms.ts';

/**
 * Admin emergency alert send.
 * 1. Creates in-app notifications via broadcast_emergency_alert (caller JWT).
 * 2. Sends SMS to opted-in donors with a phone number.
 * 3. Sends Expo push to donors with push enabled and a registered token.
 *
 * SMS webhook on notification INSERT is suppressed so donors are not texted twice.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SMS_MAX = 300;

type Json = Record<string, unknown>;

const jsonResponse = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(value) as unknown;
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : [];
  return list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function smsText(title: string, body: string): string {
  const combined = `BloodLink: ${title}. ${body}`.replace(/\s+/g, ' ').trim();
  if (combined.length <= SMS_MAX) return combined;
  return `${combined.slice(0, SMS_MAX - 1)}…`;
}

function isExpoToken(token: string): boolean {
  return (
    (token.startsWith('ExponentPushToken[') && token.endsWith(']'))
    || (token.startsWith('ExpoPushToken[') && token.endsWith(']'))
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  let payload: Json;
  try {
    payload = (await req.json()) as Json;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = asString(payload.title).slice(0, 120);
  const body = asString(payload.body).slice(0, 500);
  const hospitalName = asString(payload.hospital_name).slice(0, 160);
  const targetTypes = asStringArray(payload.target_blood_types).slice(0, 8);

  if (!title || !body || !hospitalName || targetTypes.length === 0) {
    return jsonResponse({ error: 'Title, body, hospital, and blood types are required.' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const { data: broadcast, error: broadcastError } = await userClient.rpc(
    'broadcast_emergency_alert',
    {
      p_title: title,
      p_body: body,
      p_hospital_name: hospitalName,
      p_target_blood_types: targetTypes,
      p_suppress_sms_webhook: true,
    },
  );

  if (broadcastError) {
    return jsonResponse({ error: broadcastError.message || 'Alert send failed.' }, 400);
  }

  const result = (broadcast ?? {}) as Json;
  if (result.status === 'already_sent') {
    return jsonResponse({
      status: 'already_sent',
      notified: 0,
      sms_sent: 0,
      push_sent: 0,
      hospital_name: hospitalName,
      message: asString(result.message) || 'An emergency alert was sent in the last 2 minutes.',
    });
  }

  const recipientIds = asStringArray(result.recipient_ids);
  const notified = Number(result.notified) || 0;
  if (recipientIds.length === 0) {
    return jsonResponse({
      status: 'sent',
      notified,
      sms_sent: 0,
      push_sent: 0,
      skipped_preference: Number(result.skipped_preference) || 0,
      hospital_name: hospitalName,
      message: notified === 0
        ? 'No eligible donors with emergency alerts enabled.'
        : undefined,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: prefs }, { data: profiles }, { data: tokens }] = await Promise.all([
    admin
      .from('notification_preferences')
      .select('user_id, sms_enabled, push_enabled')
      .in('user_id', recipientIds),
    admin
      .from('profiles')
      .select('id, phone')
      .in('id', recipientIds),
    admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', recipientIds),
  ]);

  const smsEnabled = new Set(
    (prefs ?? [])
      .filter((row) => row.sms_enabled === true)
      .map((row) => row.user_id as string),
  );
  const pushDisabled = new Set(
    (prefs ?? [])
      .filter((row) => row.push_enabled === false)
      .map((row) => row.user_id as string),
  );

  const message = smsText(title, body);
  let smsSent = 0;
  let smsFailed = 0;
  const smsReady = Boolean(Deno.env.get('PHILSMS_API_TOKEN')?.trim());

  if (smsReady) {
    for (const row of profiles ?? []) {
      const userId = row.id as string;
      const phone = asString(row.phone);
      if (!smsEnabled.has(userId) || !phone) continue;
      try {
        await sendViaPhilSms(phone, message);
        smsSent += 1;
      } catch (error) {
        smsFailed += 1;
        console.error('Emergency SMS failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  const pushMessages = (tokens ?? [])
    .filter((row) => !pushDisabled.has(row.user_id as string))
    .map((row) => asString(row.token))
    .filter(isExpoToken)
    .map((token) => ({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'bloodlink-default',
      data: {
        category: 'emergency_shortage',
        hospital_name: hospitalName,
        urgency: 'critical',
      },
    }));

  let pushSent = 0;
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  for (let i = 0; i < pushMessages.length; i += 100) {
    const chunk = pushMessages.slice(i, i + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      if (response.ok) {
        pushSent += chunk.length;
      } else {
        console.error('Expo push failed:', response.status);
      }
    } catch (error) {
      console.error('Expo push request failed:', error instanceof Error ? error.message : error);
    }
  }

  return jsonResponse({
    status: 'sent',
    notified,
    sms_sent: smsSent,
    sms_failed: smsFailed,
    sms_configured: smsReady,
    push_sent: pushSent,
    skipped_preference: Number(result.skipped_preference) || 0,
    hospital_name: hospitalName,
  });
});
