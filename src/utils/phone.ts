import { z } from 'zod';

/** Philippine mobile numbers used for signup, OTP, and profile contact. */
export const PH_MOBILE_PLACEHOLDER = '0917 123 4567';
export const PH_MOBILE_ERROR = 'Enter a Philippine mobile number, like 0917 123 4567.';

const PH_MOBILE_LOCAL = /^9\d{9}$/;

const digitsOnly = (phone: string) => phone.replace(/\D/g, '');

/** Returns +639XXXXXXXXX, or null if the value is not a PH mobile number. */
export const toPhilippineMobileE164 = (phone: string) => {
  const digits = digitsOnly(phone);

  let local = digits;

  if (digits.startsWith('63')) {
    local = digits.slice(2);
  } else if (digits.startsWith('0')) {
    local = digits.slice(1);
  }

  if (!PH_MOBILE_LOCAL.test(local)) {
    return null;
  }

  return `+63${local}`;
};

export const isPhilippineMobile = (phone: string) => toPhilippineMobileE164(phone) !== null;

export const philippineMobileSchema = z
  .string()
  .trim()
  .refine((value) => isPhilippineMobile(value), { message: PH_MOBILE_ERROR });

export const formatPhoneDisplay = (phone: string) => {
  const e164 = toPhilippineMobileE164(phone);

  if (!e164) {
    return phone;
  }

  const local = e164.slice(3);
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
};

/** Stores Philippine mobiles as +639XXXXXXXXX. Non-PH values are left unchanged. */
export const normalizePhoneNumber = (phone: string) => {
  const trimmed = phone.trim();
  return toPhilippineMobileE164(trimmed) ?? trimmed;
};
