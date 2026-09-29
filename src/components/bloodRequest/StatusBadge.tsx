import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { BloodRequestStatus, DonorMatchStatus } from '@/types/database';

type StatusValue = BloodRequestStatus | DonorMatchStatus | string;

type StatusStyle = {
  backgroundColor: string;
  color: string;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  accepted: {
    backgroundColor: colors.successSoft,
    color: '#166534',
  },
  cancelled: {
    backgroundColor: '#f3f4f6',
    color: colors.mutedLight,
  },
  completed: {
    backgroundColor: colors.successSoft,
    color: '#166534',
  },
  declined: {
    backgroundColor: '#f3f4f6',
    color: colors.mutedLight,
  },
  draft: {
    backgroundColor: '#f3f4f6',
    color: colors.mutedLight,
  },
  expired: {
    backgroundColor: '#f3f4f6',
    color: colors.mutedLight,
  },
  fulfilled: {
    backgroundColor: colors.successSoft,
    color: '#166534',
  },
  matched: {
    backgroundColor: colors.infoSoft,
    color: colors.infoText,
  },
  open: {
    backgroundColor: colors.infoSoft,
    color: colors.infoText,
  },
  pending: {
    backgroundColor: colors.warningSoft,
    color: colors.warningText,
  },
};

const DEFAULT_STYLE: StatusStyle = {
  backgroundColor: colors.background,
  color: colors.muted,
};

type StatusBadgeProps = {
  status: StatusValue;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const palette = STATUS_STYLES[status] ?? DEFAULT_STYLE;

  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
