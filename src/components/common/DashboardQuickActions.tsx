import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/constants/theme';

export type DashboardQuickAction = {
  accessibilityLabel: string;
  badge?: number;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
};

type DashboardQuickActionsProps = {
  actions: DashboardQuickAction[];
};

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  return (
    <View style={styles.row}>
      {actions.map(({ accessibilityLabel, badge, icon: Icon, label, onPress }) => (
        <Pressable
          key={label}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          onPress={onPress}
        >
          <View style={styles.iconSurface}>
            <Icon color={colors.foreground} size={22} strokeWidth={2.1} />
            {badge && badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.label}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 19,
    minWidth: 19,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -6,
    top: -7,
  },
  badgeText: {
    color: colors.primaryForeground,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  iconSurface: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    ...typography.styles.caption1,
    color: colors.muted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
