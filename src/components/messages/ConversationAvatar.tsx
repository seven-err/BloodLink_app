import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

type ConversationAvatarProps = {
  initials: string;
  showOnline?: boolean;
};

export function ConversationAvatar({ initials, showOnline = false }: ConversationAvatarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      {showOnline ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  initials: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '800',
  },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.card,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    right: 0,
    width: 12,
  },
  wrap: {
    height: 48,
    position: 'relative',
    width: 48,
  },
});
