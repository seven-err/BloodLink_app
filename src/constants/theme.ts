export const colors = {
  background: '#f9fafb',
  backgroundTint: '#fef2f2',
  border: '#e2e8f0',
  borderAccent: '#e2e8f0',
  card: '#ffffff',
  foreground: '#1a1a1a',
  muted: '#64748b',
  mutedLight: '#6b7280',
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryForeground: '#ffffff',
  primarySoft: '#fee2e2',
  primaryTint: '#fff7f7',
  /** Donate / respond. Same red as Request Blood so help actions share one color. */
  donate: '#dc2626',
  /** Critical urgency label. Deeper rose so it is not the same red as action buttons. */
  critical: '#9f1239',
  criticalSoft: '#ffe4e6',
  success: '#10b981',
  successSoft: '#dcfce7',
  warning: '#f59e0b',
  warningSoft: '#fef3c7',
  warningBorder: '#e2e8f0',
  warningText: '#92400e',
  info: '#3b82f6',
  infoSoft: '#dbeafe',
  infoText: '#1e40af',
  orangeSoft: '#ffedd5',
  orangeText: '#c2410c',
} as const;

export const radii = {
  card: 16,
  cardLg: 24,
  pill: 999,
} as const;

export const shadows = {
  card: {
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.015,
    shadowRadius: 8,
  },
} as const;

export { fontFamilies, typography } from './typography';
