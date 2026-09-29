import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const nearbyDonorDetailStyles = StyleSheet.create({
  avatarShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: '800',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 16,
    padding: 20,
    ...shadows.card,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  detailGrid: {
    gap: 0,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  detailRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  detailValue: {
    color: colors.foreground,
    flex: 2,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '800',
  },
  name: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '800',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  noticeCard: {
    backgroundColor: colors.infoSoft,
    borderRadius: radii.card,
    gap: 8,
    padding: 16,
  },
  noticeText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  noticeTitle: {
    color: colors.infoText,
    fontSize: 15,
    fontWeight: '800',
  },
  actionHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    padding: 24,
    paddingBottom: 32,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    ...shadows.card,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillAvailable: {
    backgroundColor: colors.successSoft,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPillTextAvailable: {
    color: colors.success,
  },
  statusPillTextUnavailable: {
    color: colors.muted,
  },
  statusPillUnavailable: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
