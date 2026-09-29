import { Info } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import type { BloodRequestUrgency } from '@/types/database';
import { URGENCY_LABELS } from '@/constants/bloodRequestUrgency';

type UrgencyStyle = {
  backgroundColor: string;
  color: string;
};

const URGENCY_STYLES: Record<BloodRequestUrgency, UrgencyStyle> = {
  critical: {
    backgroundColor: colors.criticalSoft,
    color: colors.critical,
  },
  normal: {
    backgroundColor: colors.infoSoft,
    color: colors.infoText,
  },
  urgent: {
    backgroundColor: colors.orangeSoft,
    color: colors.orangeText,
  },
};

type UrgencyBadgeProps = {
  label?: string;
  showIcon?: boolean;
  urgency: BloodRequestUrgency;
  variant?: 'default' | 'pill';
};

export function UrgencyBadge({
  label,
  showIcon = false,
  urgency,
  variant = 'default',
}: UrgencyBadgeProps) {
  const palette = URGENCY_STYLES[urgency];
  const displayLabel = label ?? URGENCY_LABELS[urgency];

  return (
    <View
      style={[
        styles.badge,
        variant === 'pill' ? styles.badgePill : null,
        { backgroundColor: palette.backgroundColor },
      ]}
    >
      {showIcon ? <Info color={palette.color} size={12} /> : null}
      <Text style={[styles.text, { color: palette.color }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
