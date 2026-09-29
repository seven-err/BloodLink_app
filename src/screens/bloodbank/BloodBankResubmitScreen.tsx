import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { BloodBankStackParamList } from '@/navigation/BloodBankNavigator';
import { submitBloodbankVerification } from '@/services/supabase/bloodbankVerifications';
import type { LocalDocument } from '@/services/supabase/storageUpload';
import { DocumentPickerField } from '@/screens/auth/profile-setup/components/DocumentPickerField';
import { authStyles } from '@/screens/auth/styles';
import {
  isPhilippineMobile,
  normalizePhoneNumber,
  PH_MOBILE_ERROR,
  PH_MOBILE_PLACEHOLDER,
} from '@/utils/phone';

type Props = NativeStackScreenProps<BloodBankStackParamList, 'BloodBankResubmit'>;

export function BloodBankResubmitScreen({ navigation }: Props) {
  const { bloodbankVerification, profile, refreshProfile, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [position, setPosition] = useState(bloodbankVerification?.position ?? '');
  const [employeeId, setEmployeeId] = useState(bloodbankVerification?.employee_id ?? '');
  const [hospitalName, setHospitalName] = useState(bloodbankVerification?.hospital_name ?? '');
  const [branchLocation, setBranchLocation] = useState(
    bloodbankVerification?.branch_location ?? '',
  );
  const [workEmail, setWorkEmail] = useState(bloodbankVerification?.work_email ?? '');
  const [workPhone, setWorkPhone] = useState(
    bloodbankVerification?.work_phone ?? profile?.phone ?? '',
  );

  const onSubmit = async () => {
    if (!session?.user.id || !profile?.full_name || loading) {
      return;
    }

    if (workPhone.trim() && !isPhilippineMobile(workPhone)) {
      setError(PH_MOBILE_ERROR);
      return;
    }

    if (!documents.length) {
      setError('Upload at least one proof of affiliation document.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await submitBloodbankVerification({
        branchLocation,
        documents,
        employeeId,
        fullName: profile.full_name,
        hospitalName,
        phone: profile.phone ?? (workPhone.trim() ? normalizePhoneNumber(workPhone) : workPhone),
        position,
        userId: session.user.id,
        workEmail,
        workPhone: workPhone.trim() ? normalizePhoneNumber(workPhone) : workPhone,
      });

      if (submitError) {
        setError(submitError.message);
        return;
      }

      await refreshProfile();
      navigation.navigate('BloodBankVerificationStatus');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to resubmit verification.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>Resubmit verification</Text>
      <Text style={styles.subtitle}>
        Update your work details and upload valid proof of affiliation.
      </Text>
      <FormTextInput
        label="Position / Role"
        value={position}
        onChangeText={setPosition}
      />
      <FormTextInput label="Employee / Staff ID" value={employeeId} onChangeText={setEmployeeId} />
      <FormTextInput
        label="Hospital / Blood Bank Name"
        value={hospitalName}
        onChangeText={setHospitalName}
      />
      <FormTextInput
        label="Branch / Location"
        value={branchLocation}
        onChangeText={setBranchLocation}
      />
      <FormTextInput
        autoCapitalize="none"
        keyboardType="email-address"
        label="Work Email Address"
        value={workEmail}
        onChangeText={setWorkEmail}
      />
      <FormTextInput
        keyboardType="phone-pad"
        label="Philippine mobile number"
        placeholder={PH_MOBILE_PLACEHOLDER}
        value={workPhone}
        onChangeText={setWorkPhone}
      />
      <DocumentPickerField documents={documents} onChange={setDocuments} />
      {error ? <Text style={authStyles.error}>{error}</Text> : null}
      <PrimaryButton loading={loading} title="Submit for review" onPress={onSubmit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 24,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  subtitle: {
    color: colors.mutedLight,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
  },
});
