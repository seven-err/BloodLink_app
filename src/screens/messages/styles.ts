import { StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/theme';

export const messagesStyles = StyleSheet.create({
  emptyCard: {
    gap: 16,
    marginHorizontal: 24,
    marginTop: 16,
    padding: 20,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  header: {
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 16,
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  list: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  skeletonList: {
    gap: 0,
    paddingTop: 8,
  },
  skeletonRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  filterRow: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  filterTab: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  filterTabActive: {
    backgroundColor: colors.card,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  hint: {
    color: colors.mutedLight,
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
});
