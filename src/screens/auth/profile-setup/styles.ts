import { StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/theme';

export const profileSetupStyles = StyleSheet.create({
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  bloodTypeButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    width: '22%',
  },
  bloodTypeButtonSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
  },
  bloodTypeText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  bloodTypeTextSelected: {
    color: colors.primary,
  },
  callout: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  calloutItem: {
    color: colors.infoText,
    fontSize: 14,
    lineHeight: 20,
  },
  calloutTitle: {
    color: colors.infoText,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    backgroundColor: colors.card,
    flexGrow: 1,
    gap: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 16,
  },
  documentChip: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  documentChipText: {
    color: colors.foreground,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  documentList: {
    gap: 8,
  },
  heading: {
    gap: 8,
  },
  infoCallout: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  infoCalloutText: {
    color: colors.warningText,
    fontSize: 14,
    lineHeight: 20,
  },
  infoCalloutTitle: {
    color: colors.warningText,
    fontSize: 16,
    fontWeight: '700',
  },
  photoCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 96,
    justifyContent: 'center',
    marginBottom: 8,
    width: 96,
  },
  progressSegment: {
    backgroundColor: colors.foreground,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: colors.border,
    height: 3,
    marginBottom: 16,
    marginTop: 8,
    width: '100%',
  },
  readOnlyField: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyLabel: {
    color: colors.mutedLight,
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyValue: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
  roleList: {
    gap: 12,
  },
  screen: {
    backgroundColor: colors.card,
    flex: 1,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  stepSubtitle: {
    color: colors.mutedLight,
    fontSize: 15,
  },
  stepTitle: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: '800',
  },
  toggleCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleDescription: {
    color: colors.mutedLight,
    fontSize: 13,
    lineHeight: 18,
  },
  toggleTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  uploadButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  uploadButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
});
