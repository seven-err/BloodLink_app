import { Image, StyleSheet } from 'react-native';

import hemieImage from '@/assets/images/hemie.png';
import { colors } from '@/constants/theme';

/** Cropped Hemie  mark aspect ratio (width / height). */
const LOGO_ASPECT = 723 / 554;

type HemieAvatarProps = {
  size?: number;
};

export function HemieAvatar({ size = 48 }: HemieAvatarProps) {
  const width = size;
  const height = Math.round(size / LOGO_ASPECT);

  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={hemieImage}
      style={[styles.logo, { height, width }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    shadowColor: colors.foreground,
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
});
