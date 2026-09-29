import { Linking, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors, radii } from '@/constants/theme';

const SUPPORT_EMAIL = 'support@bloodlink.app';

export function BloodBankSupportScreen() {
  const openSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Blood%20Bank%20Verification%20Support`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Contact Support</Text>
        <Text style={styles.message}>
          Need help with your blood bank personnel verification? Reach out to the BloodLink support
          team and include your hospital or blood bank name.
        </Text>
        <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
      </View>
      <PrimaryButton title="Email support" onPress={openSupport} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.cardLg,
    gap: 12,
    padding: 24,
  },
  email: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    color: colors.mutedLight,
    fontSize: 16,
    lineHeight: 24,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
});
