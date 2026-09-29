import { Easing, makeMutable, withTiming, type SharedValue } from 'react-native-reanimated';

/** Pill travel only. Dashboard content swaps immediately. */
export const MODE_HIGHLIGHT_MS = 520;

/** Glide with a long ease-out and no bounce. */
export const modeHighlightEasing = Easing.bezier(0.16, 1, 0.3, 1);

/** 0 = Donate (left), 1 = Request (right). Survives screen remounts. */
export const modeHighlightProgress: SharedValue<number> = makeMutable(0);

export function animateModeHighlight(mode: 'donate' | 'request') {
  modeHighlightProgress.value = withTiming(mode === 'request' ? 1 : 0, {
    duration: MODE_HIGHLIGHT_MS,
    easing: modeHighlightEasing,
  });
}

export function snapModeHighlight(mode: 'donate' | 'request') {
  modeHighlightProgress.value = mode === 'request' ? 1 : 0;
}
