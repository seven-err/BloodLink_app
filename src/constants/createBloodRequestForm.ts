import type { BloodRequestUrgency } from '@/types/database';

export type FormUrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export const FORM_URGENCY_OPTIONS: {
  id: FormUrgencyLevel;
  label: string;
  value: BloodRequestUrgency;
}[] = [
  { id: 'low', label: 'Low', value: 'normal' },
  { id: 'medium', label: 'Medium', value: 'normal' },
  { id: 'high', label: 'High', value: 'urgent' },
  { id: 'critical', label: 'Critical', value: 'critical' },
];

export const mapFormUrgencyToDb = (level: FormUrgencyLevel): BloodRequestUrgency => {
  const option = FORM_URGENCY_OPTIONS.find((item) => item.id === level);
  return option?.value ?? 'normal';
};

export const mapDbUrgencyToForm = (urgency: BloodRequestUrgency): FormUrgencyLevel => {
  if (urgency === 'critical') {
    return 'critical';
  }

  if (urgency === 'urgent') {
    return 'high';
  }

  return 'medium';
};
