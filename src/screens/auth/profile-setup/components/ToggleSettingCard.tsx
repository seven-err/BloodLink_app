import type { ReactNode } from 'react';
import { Switch, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { profileSetupStyles } from '../styles';

type ToggleSettingCardProps = {
  description: string;
  icon?: ReactNode;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
};

export function ToggleSettingCard({
  description,
  icon,
  onValueChange,
  title,
  value,
}: ToggleSettingCardProps) {
  return (
    <View style={profileSetupStyles.toggleCard}>
      {icon}
      <View style={profileSetupStyles.toggleCopy}>
        <Text style={profileSetupStyles.toggleTitle}>{title}</Text>
        <Text style={profileSetupStyles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        thumbColor={colors.primaryForeground}
        trackColor={{ false: colors.border, true: colors.success }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}
