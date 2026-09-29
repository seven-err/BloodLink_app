import { Pressable, StyleSheet } from 'react-native';

import { HEMIE_LOGO_ASPECT, HemieLogo } from '@/components/hemie/HemieLogo';

type HemieFloatingButtonProps = {
  onPress: () => void;
};

const LOGO_WIDTH = 55;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH / HEMIE_LOGO_ASPECT);

export function HemieFloatingButton({ onPress }: HemieFloatingButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Open Hemie AI assistant"
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      <HemieLogo height={LOGO_HEIGHT} width={LOGO_WIDTH} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    bottom: 20,
    overflow: 'visible',
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.96 }],
  },
});
