import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { OtpInput } from '@/components/forms/OtpInput';
import { colors } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/types';
import { requestPhoneOtp, verifyPhoneOtp } from '@/services/supabase/auth';
import { formatPhoneDisplay } from '@/utils/phone';
import { AuthBackButton } from './AuthBackButton';
import { AuthBrand } from './AuthBrand';
import { authStyles } from './styles';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>;

const RESEND_SECONDS = 60;

export function VerifyOtpScreen({ navigation, route }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const onVerify = async () => {
    if (code.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await verifyPhoneOtp(route.params.phone, code);

      if (authError) {
        setError(authError.message);
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'Unable to verify your phone.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || resendLoading) {
      return;
    }

    setError(null);
    setResendLoading(true);

    try {
      const { error: resendError } = await requestPhoneOtp(route.params.phone);

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setCode('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (resendErr) {
      setError(resendErr instanceof Error ? resendErr.message : 'Unable to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  const formattedPhone = formatPhoneDisplay(route.params.phone);

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <AuthBackButton onPress={() => navigation.goBack()} />
        <AuthBrand />
        <View style={styles.heading}>
          <Text style={authStyles.title}>Verify Your Phone</Text>
          <Text style={styles.instruction}>
            We&apos;ve sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{formattedPhone}</Text>
          </Text>
        </View>
        <OtpInput error={error ?? undefined} value={code} onChange={setCode} />
        <View style={styles.resendRow}>
          {secondsLeft > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {secondsLeft}s</Text>
          ) : (
            <Pressable disabled={resendLoading} onPress={() => void onResend()}>
              <Text style={styles.resendLink}>{resendLoading ? 'Sending…' : 'Resend code'}</Text>
            </Pressable>
          )}
        </View>
        <PrimaryButton
          disabled={code.length < 6}
          loading={loading}
          title="Verify"
          onPress={onVerify}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 24,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  heading: {
    alignItems: 'center',
    gap: 12,
  },
  instruction: {
    color: colors.mutedLight,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  phone: {
    color: colors.foreground,
    fontWeight: '700',
  },
  resendLink: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: -8,
  },
  resendTimer: {
    color: colors.mutedLight,
    fontSize: 14,
    textAlign: 'center',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
