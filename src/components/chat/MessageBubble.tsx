import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { AppMessage } from '@/services/supabase/messages';

type MessageBubbleProps = {
  message: AppMessage;
  isOwnMessage: boolean;
  showReadState: boolean;
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });

export function MessageBubble({ isOwnMessage, message, showReadState }: MessageBubbleProps) {
  const isRead = message.status === 'read';

  return (
    <View
      style={[
        styles.row,
        isOwnMessage ? styles.rowOwn : styles.rowOther,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
        ]}
      >
        <Text
          style={[
            styles.body,
            isOwnMessage ? styles.bodyOwn : styles.bodyOther,
          ]}
        >
          {message.body}
        </Text>
        <View style={styles.metaRow}>
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.timestampOwn : styles.timestampOther,
            ]}
          >
            {formatTimestamp(message.created_at)}
          </Text>
          {showReadState && isOwnMessage ? (
            <Text style={styles.readState}>{isRead ? 'Read' : 'Sent'}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  bodyOther: {
    color: colors.foreground,
  },
  bodyOwn: {
    color: colors.primaryForeground,
  },
  bubble: {
    borderRadius: 18,
    gap: 6,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderColor: colors.borderAccent,
    borderWidth: 1,
  },
  bubbleOwn: {
    backgroundColor: colors.foreground,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  readState: {
    color: colors.borderAccent,
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 11,
  },
  timestampOther: {
    color: colors.mutedLight,
  },
  timestampOwn: {
    color: colors.borderAccent,
  },
});
