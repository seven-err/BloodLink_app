import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const createBloodRequestStyles = StyleSheet.create({
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodTypeOption: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: '22.5%',
  },
  bloodTypeOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
  },
  bloodTypeText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
  },
  bloodTypeTextSelected: {
    color: colors.primary,
  },
  cooldownText: {
    color: colors.warningText,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
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
  heroBanner: {
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    ...shadows.card,
  },
  heroBannerIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroBannerText: {
    flex: 1,
    gap: 4,
  },
  heroBannerTitle: {
    color: colors.primaryForeground,
    fontSize: 17,
    fontWeight: '800',
  },
  heroBannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputShell: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  inputShellError: {
    borderColor: '#94a3b8',
  },
  inputShellWithIcon: {
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 12,
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  locationButtonText: {
    color: colors.muted,
    flex: 1,
    fontSize: 15,
  },
  locationButtonTextActive: {
    color: colors.foreground,
  },
  locationIcon: {
    marginTop: 2,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    padding: 20,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepperButtonText: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  stepperValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 60,
    textAlign: 'center',
  },
  stepperUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
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
  uploadBox: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    gap: 8,
    justifyContent: 'center',
    minHeight: 100,
    padding: 16,
  },
  uploadBoxPressed: {
    opacity: 0.92,
  },
  uploadHint: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadName: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  urgencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  urgencyOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    width: '47.5%',
  },
  urgencyOptionCriticalSelected: {
    backgroundColor: colors.criticalSoft,
    borderColor: colors.border,
  },
  urgencyOptionHighSelected: {
    backgroundColor: colors.orangeSoft,
    borderColor: colors.border,
  },
  urgencyOptionLowSelected: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
  },
  urgencyOptionMediumSelected: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.border,
  },
  urgencyText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  urgencyTextCriticalSelected: {
    color: colors.critical,
  },
  urgencyTextHighSelected: {
    color: colors.orangeText,
  },
  urgencyTextLowSelected: {
    color: colors.infoText,
  },
  urgencyTextMediumSelected: {
    color: colors.warningText,
  },
});
