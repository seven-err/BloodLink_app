import type { PressableProps } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';

type PrimaryButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'donate';
};

export function PrimaryButton({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={[
        styles.button,
        variant === 'secondary'
          ? styles.secondary
          : variant === 'donate'
            ? styles.donate
            : styles.primary,
        isDisabled ? styles.disabled : null,
        typeof style === 'function' ? undefined : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.foreground : colors.primaryForeground} />
      ) : (
        <Text
          style={[
            styles.title,
            variant === 'secondary' ? styles.secondaryTitle : styles.primaryTitle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.65,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryTitle: {
    color: colors.primaryForeground,
  },
  donate: {
    backgroundColor: colors.donate,
  },
  secondary: {
    backgroundColor: colors.border,
  },
  secondaryTitle: {
    color: colors.foreground,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
