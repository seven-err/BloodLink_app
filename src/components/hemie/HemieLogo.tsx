import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { FeDropShadow, Filter, Image as SvgImage } from 'react-native-svg';

import hemieImage from '@/assets/images/hemie.png';
import { colors } from '@/constants/theme';

/** Cropped Hemie mark aspect ratio (width / height). */
export const HEMIE_LOGO_ASPECT = 723 / 554;

const SHADOW_BLEED = 14;

let nextFilterId = 0;

type HemieLogoProps = {
  width: number;
  height: number;
};

export function HemieLogo({ width, height }: HemieLogoProps) {
  const filterId = useRef(`hemie-shadow-${++nextFilterId}`).current;
  const canvasWidth = width + SHADOW_BLEED * 2;
  const canvasHeight = height + SHADOW_BLEED * 2;

  return (
    <View style={[styles.frame, { height, width }]}>
      <Svg
        height={canvasHeight}
        style={styles.canvas}
        width={canvasWidth}
      >
        <Filter
          id={filterId}
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
        >
          <FeDropShadow
            dx={0}
            dy={1}
            stdDeviation={3}
            floodColor={colors.foreground}
            floodOpacity={0.2}
          />
        </Filter>
        <SvgImage
          filter={`url(#${filterId})`}
          height={height}
          href={hemieImage}
          preserveAspectRatio="xMidYMid meet"
          width={width}
          x={SHADOW_BLEED}
          y={SHADOW_BLEED}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    left: -SHADOW_BLEED,
    overflow: 'visible',
    position: 'absolute',
    top: -SHADOW_BLEED,
  },
  frame: {
    overflow: 'visible',
  },
});
