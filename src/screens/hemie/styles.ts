import { Platform, StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/theme';

export const hemieStyles = StyleSheet.create({
  chatBody: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 0,
  },
  chatContent: {
    gap: 16,
    padding: 24,
    paddingBottom: 12,
  },
  errorText: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.card,
    color: colors.warningText,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerDisclaimer: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  disclaimer: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.borderAccent,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disclaimerLabel: {
    fontWeight: '700',
  },
  disclaimerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  disclaimerText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  headerInfoButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composerDock: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  footer: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    textAlignVertical: 'center',
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  suggestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestedLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  suggestedSection: {
    gap: 10,
  },
  typingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  typingText: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
