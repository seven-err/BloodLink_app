import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const recipientStyles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 12,
    padding: 20,
    ...shadows.card,
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  donorName: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  donorTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  centerContent: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  createHeaderButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  createHeaderButtonPressed: {
    opacity: 0.92,
  },
  createHeaderButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '700',
  },
  // Detail screen
  detailSection: {
    gap: 12,
  },
  detailSectionTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  detailGrid: {
    gap: 0,
  },
  detailRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  // Hero card (detail screen top)
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    gap: 14,
    padding: 20,
    ...shadows.card,
  },
  heroCardTitle: {
    color: colors.primaryForeground,
    fontSize: 20,
    fontWeight: '800',
  },
  heroCardSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Donor response card
  donorResponseCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 10,
    padding: 16,
    ...shadows.card,
  },
  donorResponseMeta: {
    color: colors.mutedLight,
    fontSize: 13,
    lineHeight: 19,
  },
  donorResponseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  donorResponseMetaChip: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  donorResponseMetaChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  donorResponseActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  // Empty / error
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 12,
    padding: 28,
    ...shadows.card,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 99,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  emptyText: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoBanner: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  infoBannerText: {
    color: colors.infoText,
    fontSize: 14,
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 8,
    padding: 16,
    ...shadows.card,
  },
  listContent: {
    gap: 12,
    padding: 20,
    paddingBottom: 40,
  },
  meta: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 20,
  },
  optionGroup: {
    gap: 8,
  },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
  },
  pillText: {
    color: colors.foreground,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pillTextSelected: {
    color: colors.primaryForeground,
  },
  requestTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  sectionIntro: {
    gap: 6,
  },
  sectionWrapper: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 21,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  tabHeader: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 24,
  },
  tabHeaderTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
  urgencyPillCritical: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
  },
  urgencyPillNormal: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
  },
  urgencyPillTextCritical: {
    color: colors.primaryForeground,
  },
  urgencyPillTextNormal: {
    color: colors.infoText,
  },
  urgencyPillTextUrgent: {
    color: colors.orangeText,
  },
  urgencyPillUrgent: {
    backgroundColor: colors.orangeSoft,
    borderColor: colors.border,
  },
  // Filter chips (horizontal scroll)
  filterChipsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    gap: 0,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  statItem: {
    alignItems: 'center',
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 14,
  },
  statItemLast: {
    borderRightWidth: 0,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
