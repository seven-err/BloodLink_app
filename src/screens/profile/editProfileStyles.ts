import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const editProfileStyles = StyleSheet.create({
  errorText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: colors.card,
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    color: colors.mutedLight,
    fontSize: 13,
    lineHeight: 18,
  },
  locationIcon: {
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roleBadgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    padding: 24,
    paddingBottom: 24,
  },
  section: {
    gap: 14,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 16,
    padding: 16,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonPressed: {
    opacity: 0.92,
  },
  submitButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  unavailableCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 12,
    padding: 20,
    ...shadows.card,
  },
  unavailableTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  contactLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  contactLink: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  contactRow: {
    gap: 4,
  },
  contactValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  profilePictureAction: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  profilePictureActionText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  profilePictureHintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  profilePicturePreview: {
    borderRadius: 999,
    height: 128,
    width: 128,
  },
  profilePicturePreviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  profilePictureRemoveAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  profilePictureRemoveText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 16,
    padding: 16,
    ...shadows.card,
  },
});
