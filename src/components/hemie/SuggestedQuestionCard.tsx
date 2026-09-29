import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, shadows } from '@/constants/theme';

type SuggestedQuestionCardProps = {
  onPress: () => void;
  question: string;
};

export function SuggestedQuestionCard({ onPress, question }: SuggestedQuestionCardProps) {
  return (
    <Pressable
      accessibilityLabel={question}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      <Text style={styles.text}>{question}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    flexGrow: 1,
    flexShrink: 0,
    minWidth: '46%',
    paddingHorizontal: 14,
    paddingVertical: 16,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.92,
  },
  text: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
