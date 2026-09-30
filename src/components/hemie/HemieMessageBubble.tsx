import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HemieAvatar } from '@/components/hemie/HemieAvatar';
import { colors, radii } from '@/constants/theme';

type HemieMessageBubbleProps = {
  actionLabel?: string;
  isUser?: boolean;
  onAction?: () => void;
  text: string;
};

function formatHemieReply(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/gm, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/gm, '$1$2');

  const parts = plain
    .split(/\n+|(?<=[.!?])\s+(?=\d+\.\s|[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (
        !/\b(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|create an account|download (the )?app|open (the )?bloodlink app|welcome screen|welcome to bloodlink)\b/i.test(
          line,
        ) &&
        !/^(hi|hello|hey|sure|of course|great question|certainly|bloodlink is)\b/i.test(line)
      ) {
        return line;
      }

      return line
        .replace(
          /\b(first[, ]*)?(please )?(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|create an account|download (the )?app|open (the )?bloodlink app)[^,.?!]*/gi,
          '',
        )
        .replace(/^(then|next|after that|and)\s*,?\s*/i, '')
        .replace(/^[,.\s]+/, '')
        .trim();
    })
    .filter((line) => line.length > 0 && !/^(hi|hello|hey|sure|of course|great question|certainly|to get started|bloodlink is)\b/i.test(line));

  if (parts.length === 0) {
    return plain.trim();
  }

  const steps = parts.filter((line) => /^\d+\.\s/.test(line));
  const answer = parts.filter((line) => !/^\d+\.\s/.test(line));

  return [...answer, ...steps].join('\n').trim();
}

export function HemieMessageBubble({ actionLabel, isUser = false, onAction, text }: HemieMessageBubbleProps) {
  const displayText = isUser ? text : formatHemieReply(text);

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <HemieAvatar size={44} />
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{displayText}</Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
  },
  assistantBubble: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 10,
  },
  assistantText: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  userBubble: {
    backgroundColor: colors.foreground,
    borderRadius: radii.card,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userRow: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  userText: {
    color: colors.primaryForeground,
    fontSize: 15,
    lineHeight: 22,
  },
});
