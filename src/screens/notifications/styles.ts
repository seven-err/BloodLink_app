import { StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

export const notificationStyles = StyleSheet.create({
  emptyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 20,
    ...shadows.card,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  filterContainer: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  filterCount: {
    color: colors.mutedLight,
    fontSize: 12,
    fontWeight: '700',
  },
  filterCountActive: {
    color: colors.foreground,
  },
  filterTab: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 8,
  },
  filterTabActive: {
    backgroundColor: colors.background,
  },
  filterTabLabel: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabLabelActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  },
  itemSpacer: {
    height: 12,
  },
  listContent: {
    padding: 24,
    paddingBottom: 32,
  },
  listHeader: {
    gap: 12,
    marginBottom: 18,
  },
  sectionCount: {
    color: colors.mutedLight,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionSpacer: {
    height: 18,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryAction: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryActionDisabled: {
    opacity: 0.45,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
