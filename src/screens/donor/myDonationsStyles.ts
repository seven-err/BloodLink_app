import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const myDonationsStyles = StyleSheet.create({
  badgeGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  bloodBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bloodBadgeGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bloodBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  detailsGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 8,
    padding: 12,
  },
  donationCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 14,
    padding: 16,
    ...shadows.card,
  },
  emptyActionBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyActionText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 10,
    padding: 28,
    ...shadows.card,
  },
  emptyDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
    width: 56,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  facilityIconWrap: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  facilityInfo: {
    flex: 1,
    gap: 2,
  },
  facilityLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  facilityName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  facilitySection: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  headerTitle: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
  infoBanner: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 6,
    padding: 18,
    ...shadows.card,
  },
  listContent: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  qrActionBtn: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  qrActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  refRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  refText: {
    color: colors.mutedLight,
    fontSize: 11,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 30,
    width: 1,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  statValue: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  statValuePrimary: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  statValueSuccess: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '800',
  },
  statsCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    ...shadows.card,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeCompleted: {
    backgroundColor: colors.successSoft,
  },
  statusBadgePending: {
    backgroundColor: colors.infoSoft,
  },
  statusBadgeWarning: {
    backgroundColor: colors.warningSoft,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusBadgeTextCompleted: {
    color: colors.success,
  },
  statusBadgeTextPending: {
    color: colors.infoText,
  },
  statusBadgeTextWarning: {
    color: colors.warningText,
  },
  unitsText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  urgencyBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  urgencyBadgeCritical: {
    backgroundColor: colors.criticalSoft,
  },
  urgencyBadgeNormal: {
    backgroundColor: '#f1f5f9',
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  urgencyBadgeTextCritical: {
    color: colors.critical,
  },
  urgencyBadgeTextNormal: {
    color: colors.muted,
  },
  urgencyBadgeTextUrgent: {
    color: colors.orangeText,
  },
  urgencyBadgeUrgent: {
    backgroundColor: colors.orangeSoft,
  },
});
