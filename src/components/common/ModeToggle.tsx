import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Droplet, HeartHandshake } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { modeHighlightProgress } from '@/components/common/modeSwitchMotion';
import { colors, radii, shadows } from '@/constants/theme';
import { useUserMode, type UserMode } from '@/context/UserModeContext';

type ModeOption = {
  icon: typeof Droplet;
  label: string;
  mode: UserMode;
};

const MODE_OPTIONS: ModeOption[] = [
  { icon: Droplet, label: 'Donate', mode: 'donate' },
  { icon: HeartHandshake, label: 'Request', mode: 'request' },
];

type ModeToggleProps = {
  showHint?: boolean;
};

export function ModeToggle({ showHint = false }: ModeToggleProps) {
  const { mode, setMode } = useUserMode();
  const segmentWidth = useSharedValue(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) {
      segmentWidth.value = (width - 6) / 2;
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: segmentWidth.value > 0 ? 1 : 0,
    width: segmentWidth.value,
    transform: [{ translateX: modeHighlightProgress.value * segmentWidth.value }],
  }));

  const donateActiveStyle = useAnimatedStyle(() => ({ opacity: 1 - modeHighlightProgress.value }));
  const donateInactiveStyle = useAnimatedStyle(() => ({ opacity: modeHighlightProgress.value }));
  const requestActiveStyle = useAnimatedStyle(() => ({ opacity: modeHighlightProgress.value }));
  const requestInactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - modeHighlightProgress.value }));

  return (
    <View style={styles.wrap}>
      <View
        accessibilityLabel="Switch between donate and request mode"
        accessibilityRole="tablist"
        onLayout={handleLayout}
        style={styles.container}
      >
        {/* Animated Sliding Pill Background */}
        <Animated.View pointerEvents="none" style={[styles.slidingIndicator, indicatorStyle]} />

        {MODE_OPTIONS.map(({ icon: Icon, label, mode: optionMode }) => {
          const isSelected = mode === optionMode;
          const activeStyle = optionMode === 'donate' ? donateActiveStyle : requestActiveStyle;
          const inactiveStyle = optionMode === 'donate' ? donateInactiveStyle : requestInactiveStyle;

          return (
            <Pressable
              key={optionMode}
              accessibilityLabel={`${label} mode`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              style={styles.segment}
              onPress={() => setMode(optionMode)}
            >
              <Animated.View pointerEvents="none" style={[styles.segmentContent, inactiveStyle]}>
                <Icon color={colors.muted} size={16} strokeWidth={2.25} />
                <Text style={styles.labelInactive}>{label}</Text>
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={[styles.segmentContent, styles.segmentContentAbsolute, activeStyle]}
              >
                <Icon color={colors.primaryForeground} size={16} strokeWidth={2.5} />
                <Text style={styles.labelActive}>{label}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>

      {showHint ? (
        <Text style={styles.hint}>
          {mode === 'donate'
            ? 'Donate mode shows nearby blood requests you can help with.'
            : 'Request mode lets you create requests and find compatible donors.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    flexDirection: 'row',
    height: 44,
    padding: 3,
    position: 'relative',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  labelActive: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '700',
  },
  labelInactive: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.pill,
    flex: 1,
    height: 38,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  segmentContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  segmentContentAbsolute: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  slidingIndicator: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    bottom: 3,
    left: 3,
    position: 'absolute',
    top: 3,
    zIndex: 1,
    ...shadows.card,
  },
  wrap: {
    width: '100%',
  },
});
