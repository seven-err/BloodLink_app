export const colors = {
  background: '#f7f8fa',
  backgroundTint: '#fef2f2',
  border: '#e8ebf0',
  borderAccent: '#e8ebf0',
  card: '#ffffff',
  foreground: '#171a21',
  muted: '#737b89',
  mutedLight: '#737b89',
  primary: '#d92d32',
  primaryDark: '#b92328',
  primaryForeground: '#ffffff',
  primarySoft: '#fcebec',
  primaryTint: '#fff7f7',
  /** Donate / respond. Same red as Request Blood so help actions share one color. */
  donate: '#d92d32',
  /** Critical urgency label. Deeper rose so it is not the same red as action buttons. */
  critical: '#9f1239',
  criticalSoft: '#ffe4e6',
  success: '#1fad74',
  successSoft: '#e8f8f1',
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
