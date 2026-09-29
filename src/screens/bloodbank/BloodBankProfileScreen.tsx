import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';
import type { BloodBankStackParamList } from '@/navigation/BloodBankNavigator';
import { formatRoleLabel } from '@/utils/profileDisplay';

type Props = NativeStackScreenProps<BloodBankStackParamList, 'BloodBankProfile'>;

export function BloodBankProfileScreen({ navigation }: Props) {
  const { bloodbankVerification, profile } = useAuth();
  const { cancelSignOut, confirmSignOut, confirmVisible, performSignOut, signingOut } =
    useSignOut();

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>Profile Information</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <Text style={styles.value}>{profile?.full_name ?? '—'}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{formatRoleLabel(profile?.role)}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{profile?.phone ?? '—'}</Text>
        {bloodbankVerification ? (
          <>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{bloodbankVerification.position}</Text>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>{bloodbankVerification.employee_id}</Text>
            <Text style={styles.label}>Hospital / Blood Bank</Text>
            <Text style={styles.value}>{bloodbankVerification.hospital_name}</Text>
            <Text style={styles.label}>Branch / Location</Text>
            <Text style={styles.value}>{bloodbankVerification.branch_location}</Text>
            <Text style={styles.label}>Work Email</Text>
            <Text style={styles.value}>{bloodbankVerification.work_email}</Text>
            <Text style={styles.label}>Verification Status</Text>
            <Text style={styles.value}>{bloodbankVerification.status}</Text>
          </>
        ) : null}
      </View>
      {bloodbankVerification?.status === 'rejected' ? (
        <PrimaryButton
          title="Resubmit verification"
          onPress={() => navigation.navigate('BloodBankResubmit')}
        />
      ) : null}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 6,
    padding: 20,
  },
  content: {
    gap: 16,
    padding: 24,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
  value: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '600',
  },
});
