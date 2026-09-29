import { Platform, StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/theme';

export const chatStyles = StyleSheet.create({
  chatBody: {
    backgroundColor: colors.background,
    flex: 1,
  },
  chatContent: {
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  composerDock: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  disclaimer: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.borderAccent,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: 8,
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
    color: colors.infoText,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyHint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
    paddingTop: 24,
    textAlign: 'center',
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
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  headerInfoButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
  inlineError: {
    paddingHorizontal: 24,
    textAlign: 'center',
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
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
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
});
