import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';
import type { BloodBankStackParamList } from '@/navigation/BloodBankNavigator';

type Props = NativeStackScreenProps<BloodBankStackParamList, 'BloodBankVerificationStatus'>;

export function BloodBankVerificationStatusScreen({ navigation }: Props) {
  const { bloodbankVerification } = useAuth();
  const { cancelSignOut, confirmSignOut, confirmVisible, performSignOut, signingOut } =
    useSignOut();
  const status = bloodbankVerification?.status ?? 'pending';

  const title =
    status === 'rejected' ? 'Verification failed' : 'Your account is under review';

  const message =
    status === 'rejected'
      ? 'Verification failed. Please resubmit valid documents so BloodLink administrators can review your affiliation again.'
      : 'Your Blood Bank Personnel account is under review. BloodLink administrators will verify your submitted information before granting access to blood bank features.';

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text
          style={[
            styles.eyebrow,
            status !== 'rejected' ? { color: colors.warningText } : null,
          ]}
        >
          {status === 'rejected' ? 'Action required' : 'Verification pending'}
        </Text>
        <Text style={[styles.title, status !== 'rejected' ? { color: colors.foreground } : null]}>
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {bloodbankVerification ? (
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Hospital / Blood Bank</Text>
            <Text style={styles.metaValue}>{bloodbankVerification.hospital_name}</Text>
            <Text style={styles.metaLabel}>Submitted</Text>
            <Text style={styles.metaValue}>
              {new Date(bloodbankVerification.created_at).toLocaleDateString()}
            </Text>
          </View>
        ) : null}
      </View>
      {status === 'rejected' ? (
        <PrimaryButton
          title="Resubmit verification"
          onPress={() => navigation.navigate('BloodBankResubmit')}
        />
      ) : null}
      <PrimaryButton
        title="View profile"
        variant="secondary"
        onPress={() => navigation.navigate('BloodBankProfile')}
      />
      <PrimaryButton
        title="Contact support"
        variant="secondary"
        onPress={() => navigation.navigate('BloodBankSupport')}
      />
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
    color: colors.primaryDark,
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 4,
    marginTop: 8,
    paddingTop: 12,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '600',
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
