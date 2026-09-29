import { Info, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { hemieStyles } from '@/screens/hemie/styles';
import { HEMIE_DISCLAIMER } from '@/utils/hemieResponses';

type HemieEmergencyDisclaimerProps = {
  onDismiss: () => void;
};

export const HEMIE_EMERGENCY_DISCLAIMER_TEXT = HEMIE_DISCLAIMER;

export function HemieEmergencyDisclaimer({ onDismiss }: HemieEmergencyDisclaimerProps) {
  return (
    <View style={hemieStyles.disclaimer}>
      <View style={hemieStyles.disclaimerRow}>
        <Info color={colors.primary} size={18} />
        <Text style={hemieStyles.disclaimerText}>
          {HEMIE_EMERGENCY_DISCLAIMER_TEXT}
        </Text>
        <Pressable
          accessibilityLabel="Hide disclaimer"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
        >
          <X color={colors.muted} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
