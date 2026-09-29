import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';

export function BloodBankDashboardScreen() {
  const { bloodbankVerification } = useAuth();
  const { cancelSignOut, confirmSignOut, confirmVisible, performSignOut, signingOut } =
    useSignOut();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Blood bank personnel</Text>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.message}>
          Your account has been approved. Full blood bank personnel features will appear here as
          they are rolled out on mobile.
        </Text>
        {bloodbankVerification ? (
          <Text style={styles.meta}>
            {bloodbankVerification.hospital_name} · {bloodbankVerification.branch_location}
          </Text>
        ) : null}
      </View>
      <PrimaryButton
        loading={signingOut}
        title="Sign out"
        variant="secondary"
        onPress={confirmSignOut}
      />
      <SignOutConfirmModal
        loading={signingOut}
        visible={confirmVisible}
        onCancel={cancelSignOut}
        onConfirm={() => {
          void performSignOut();
        }}
      />
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
  eyebrow: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.mutedLight,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
});
