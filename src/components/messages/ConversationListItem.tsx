import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BloodTypeBadge } from '@/components/bloodRequest/BloodTypeBadge';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import { colors } from '@/constants/theme';
import type { ConversationPreview } from '@/services/supabase/messages';
import { formatRelativeTime } from '@/utils/relativeTime';

type ConversationListItemProps = {
  conversation: ConversationPreview;
  onPress: () => void;
  onLongPress: () => void;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export function ConversationListItem({
  conversation,
  onPress,
  onLongPress,
}: ConversationListItemProps) {
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable
      accessibilityHint="Long press to archive or delete this conversation"
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      <ConversationAvatar initials={getInitials(conversation.displayName)} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {conversation.displayName}
            </Text>
            {conversation.bloodType ? (
              <View style={styles.badgeWrap}>
                <BloodTypeBadge bloodType={conversation.bloodType} size="md" />
              </View>
            ) : null}
          </View>
          <Text style={styles.time}>{formatRelativeTime(conversation.lastMessageAt)}</Text>
        </View>

        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={[styles.snippet, hasUnread ? styles.snippetUnread : null]}>
            {conversation.lastMessageBody}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    transform: [{ scale: 0.72 }],
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.foreground,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  snippet: {
    color: colors.mutedLight,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  snippetUnread: {
    color: colors.foreground,
    fontWeight: '600',
  },
  time: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unreadBadge: {
    alignItems: 'center',
    backgroundColor: colors.info,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  unreadText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
});
