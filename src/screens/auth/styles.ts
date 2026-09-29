import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const authStyles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.cardLg,
    gap: 18,
    padding: 20,
    ...shadows.card,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: colors.primary,
    fontSize: 14,
  },
  helper: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: colors.success,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
});
