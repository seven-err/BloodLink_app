import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

type RoleSelectionCardProps = {
  description: string;
  icon: ReactNode;
  iconBackground?: string;
  onPress: () => void;
  selected: boolean;
  title: string;
};

export function RoleSelectionCard({
  description,
  icon,
  iconBackground = colors.background,
  onPress,
  selected,
  title,
}: RoleSelectionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.card, selected ? styles.cardSelected : null]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  cardSelected: {
    backgroundColor: '#f8fafc',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  description: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 20,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
});
