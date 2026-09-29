const PHILSMS_API_URL = 'https://dashboard.philsms.com/api/v3/sms/send';

/**
 * Normalize Philippine mobiles for PhilSMS (`639XXXXXXXXX`).
 * Accepts +63…, 63…, 09…, or bare 9XXXXXXXXX.
 */
export const normalizePhilSmsNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Phone number is empty.');
  }

  if (digits.startsWith('63') && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length >= 11) {
    return `63${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('9')) {
    return `63${digits}`;
  }

  throw new Error(`Unsupported phone number format for PhilSMS: ${phone}`);
};

export type PhilSmsSendResult = Record<string, unknown>;

/**
 * Send an SMS via PhilSMS API v3 (JSON + Bearer token).
 * Docs: https://dashboard.philsms.com/developers/docs
 */
export const sendViaPhilSms = async (
  to: string,
  message: string,
): Promise<PhilSmsSendResult> => {
  const apiToken = Deno.env.get('PHILSMS_API_TOKEN')?.trim();
  const senderId = Deno.env.get('PHILSMS_SENDER_ID')?.trim() || 'PhilSMS';

  if (!apiToken) {
    throw new Error('PHILSMS_API_TOKEN is not configured.');
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('SMS message is empty.');
  }

  if (senderId.length > 11) {
    throw new Error('PHILSMS_SENDER_ID must be at most 11 characters.');
  }

  const recipient = normalizePhilSmsNumber(to);

  const response = await fetch(PHILSMS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      recipient,
      sender_id: senderId,
      type: 'plain',
      message: trimmed,
    }),
  });

  const text = await response.text();
  let data: PhilSmsSendResult = {};

  try {
    data = text ? (JSON.parse(text) as PhilSmsSendResult) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data.status === 'error') {
    const detail =
      typeof data.message === 'string'
        ? data.message
        : typeof data === 'object'
          ? JSON.stringify(data)
          : text;
    throw new Error(`PhilSMS request failed (${response.status}): ${detail}`);
  }

  return data;
};

export const isPhilSmsConfigured = (): boolean =>
  Boolean(Deno.env.get('PHILSMS_API_TOKEN')?.trim());
