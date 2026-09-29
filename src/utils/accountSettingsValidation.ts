import { z } from 'zod';

import { isPhilippineMobile, normalizePhoneNumber, PH_MOBILE_ERROR } from '@/utils/phone';

export const accountSettingsSchema = z.object({
  email: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, {
      message: 'Enter a valid email address.',
    }),
  fullName: z.string().trim().min(2, 'Name is required.'),
  phone: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || isPhilippineMobile(value), {
      message: PH_MOBILE_ERROR,
    }),
});

export type AccountSettingsFormValues = z.infer<typeof accountSettingsSchema>;

export const normalizeAccountPhone = (phone: string) => {
  const trimmed = phone.trim();

  if (!trimmed) {
    return null;
  }

  return normalizePhoneNumber(trimmed);
};
