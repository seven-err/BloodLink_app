import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { colors } from '@/constants/theme';
import type { AppStackParamList } from '@/navigation/types';
import { authStyles } from '@/screens/auth/styles';
import { settingsStyles } from '@/screens/profile/settingsStyles';
import {
  REPORT_REASON_OPTIONS,
  submitReport,
  type ReportReasonOption,
} from '@/services/supabase/reports';
import type { ReportType } from '@/types/database';

type Props = NativeStackScreenProps<AppStackParamList, 'ReportSafety'>;

export function ReportSafetyScreen({ navigation, route }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const {
    reportedUserId,
    reportedDisplayName,
    bloodRequestId,
    messageId,
    donationId,
    defaultType,
  } = route.params ?? {};

  const reportType: ReportType = useMemo(() => {
    if (defaultType) return defaultType;
    if (messageId) return 'message';
    if (donationId) return 'donation';
    if (bloodRequestId && !reportedUserId) return 'blood_request';
    return 'user';
  }, [bloodRequestId, defaultType, donationId, messageId, reportedUserId]);

  const [reason, setReason] = useState<ReportReasonOption | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!reason) {
      setError('Please select a reason.');
      return;
    }
    if (!reportedUserId && !bloodRequestId && !messageId && !donationId) {
      setError('This report is missing a valid target.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitReport({
      type: reportType,
      reason,
      details: details.trim() || null,
      reportedUserId: reportedUserId ?? null,
      bloodRequestId: bloodRequestId ?? null,
      messageId: messageId ?? null,
      donationId: donationId ?? null,
    });

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    Alert.alert(
      'Report submitted',
      'Thank you. BloodLink administrators will review this report.',
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  return (
    <View style={settingsStyles.screen}>
      <SettingsScreenHeader
        title="Report a concern"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomInset + 32,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
          {reportedDisplayName
            ? `Report activity involving ${reportedDisplayName}. Reports are reviewed by administrators.`
            : 'Describe unsafe or abusive BloodLink activity. Reports are reviewed by administrators.'}
        </Text>

        <Text style={settingsStyles.sectionTitle}>Reason</Text>
        <View style={{ gap: 8 }}>
          {REPORT_REASON_OPTIONS.map((option) => {
            const selected = reason === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setReason(option)}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? colors.info : colors.border,
                  backgroundColor: selected ? colors.infoSoft : colors.card,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.infoText : colors.foreground,
                    fontSize: 14,
                    fontWeight: selected ? '600' : '400',
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={settingsStyles.sectionTitle}>Details (optional)</Text>
        <TextInput
          multiline
          value={details}
          onChangeText={setDetails}
          placeholder="Add context that helps moderators review this report"
          placeholderTextColor={colors.muted}
          style={{
            minHeight: 110,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            textAlignVertical: 'top',
            color: colors.foreground,
            backgroundColor: colors.card,
          }}
          maxLength={2000}
        />

        {error ? <Text style={authStyles.error}>{error}</Text> : null}

        {submitting ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <PrimaryButton title="Submit report" onPress={() => void onSubmit()} />
        )}
      </ScrollView>
    </View>
  );
}
