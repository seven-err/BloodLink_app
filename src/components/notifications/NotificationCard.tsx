import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';
import type { AppNotification } from '@/services/supabase/notifications';
import { formatRelativeTime } from '@/utils/relativeTime';
import { getNotificationVisual } from '@/utils/notificationDisplay';

type NotificationCardProps = {
  notification: AppNotification;
  onPress: () => void;
};

export function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const visual = getNotificationVisual(notification);
  const isUnread = notification.read_at === null;
  const Icon = visual.Icon;
  const timeLabel = formatRelativeTime(notification.created_at);

  return (
    <Pressable
      accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${notification.title}. ${visual.label}. ${timeLabel}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        isUnread && !visual.isHighPriority ? styles.cardUnread : null,
        visual.isHighPriority ? styles.cardPriority : null,
        pressed ? styles.cardPressed : null,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: visual.iconBackground }]}>
        <Icon color={visual.iconColor} size={18} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>
            {notification.title}
          </Text>
          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{visual.label}</Text>
          <Text style={styles.metaSeparator}>·</Text>
          <Text style={styles.meta}>{timeLabel}</Text>
          {visual.isHighPriority ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>High priority</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.body}>{notification.body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.94,
  },
  cardPriority: {
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
  },
  cardUnread: {
    borderLeftColor: colors.info,
    borderLeftWidth: 3,
  },
  copy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  meta: {
    color: colors.mutedLight,
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaSeparator: {
    color: colors.border,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.foreground,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  unreadDot: {
    backgroundColor: colors.info,
    borderRadius: 999,
    height: 8,
    marginTop: 5,
    width: 8,
  },
});
