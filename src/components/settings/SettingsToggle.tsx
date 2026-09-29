import { Switch } from 'react-native';

import { colors } from '@/constants/theme';

type SettingsToggleProps = {
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function SettingsToggle({ disabled = false, onValueChange, value }: SettingsToggleProps) {
  return (
    <Switch
      disabled={disabled}
      thumbColor={colors.card}
      trackColor={{ false: colors.border, true: colors.success }}
      value={value}
      onValueChange={onValueChange}
    />
  );
}
