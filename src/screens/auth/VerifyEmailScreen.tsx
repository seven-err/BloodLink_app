import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Info,
  Mail,
  RefreshCw,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { OtpInput } from '@/components/forms/OtpInput';
import { colors, radii, shadows } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/types';
import {
  resendSignupConfirmation,
  verifyEmailOtp,
} from '@/services/supabase/auth';
import { openMailApp } from '@/utils/authRedirect';

import { AuthBackButton } from './AuthBackButton';
import { AuthBrand } from './AuthBrand';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_LENGTH = 8;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, resent = false } = route.params;
  const isGmail = email.toLowerCase().endsWith('@gmail.com');

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    resent ? `We resent a confirmation link and code to ${email}.` : null,
  );
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [openingMail, setOpeningMail] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    resent ? RESEND_COOLDOWN_SECONDS : 0,
  );

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const onOpenMail = async () => {
    setOpeningMail(true);
    try {
      await openMailApp(email);
    } finally {
      setOpeningMail(false);
    }
  };

  const onVerifyCode = async (otpCode = code) => {
    if (otpCode.length < EMAIL_OTP_LENGTH) {
      setError(
        `Please enter the full ${EMAIL_OTP_LENGTH}-digit code sent to your email.`,
      );
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { error: authError } = await verifyEmailOtp(email, otpCode);

      if (authError) {
        setError(authError.message);
        return;
      }
      // On success, Supabase auth state change will trigger in AuthContext and show EmailConfirmedScreen
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'Unable to verify email code.',
      );
    } finally {
      setLoading(false);
    }
  };

  const onCodeChange = (nextCode: string) => {
    setCode(nextCode);
    if (nextCode.length === EMAIL_OTP_LENGTH) {
      void onVerifyCode(nextCode);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || resendLoading) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setResendLoading(true);

    try {
      const { error: resendError } = await resendSignupConfirmation(email);

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setCode('');
      setSuccessMessage(`A fresh confirmation link & code was sent to ${email}.`);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (resendErr) {
      setError(
        resendErr instanceof Error
          ? resendErr.message
          : 'Unable to resend confirmation email.',
      );
    } finally {
      setResendLoading(false);
    }
  };

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
        <AuthBackButton onPress={() => navigation.navigate('Login')} />
        <AuthBrand />

        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            <Mail color={colors.info} size={36} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>
            {isGmail ? 'Check your Gmail' : 'Check your email'}
          </Text>

          <Text style={styles.subtitle}>
            We sent a verification link and {EMAIL_OTP_LENGTH}-digit confirmation
            code to:
          </Text>

          <View style={styles.emailBadge}>
            <Mail color={colors.muted} size={15} />
            <Text numberOfLines={1} style={styles.emailText}>
              {email}
            </Text>
          </View>

          {successMessage ? (
            <View style={styles.bannerSuccess}>
              <CheckCircle2 color={colors.success} size={18} />
              <Text style={styles.bannerSuccessText}>{successMessage}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.bannerError}>
              <Info color={colors.primary} size={18} />
              <Text style={styles.bannerErrorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Open email app"
            accessibilityRole="button"
            disabled={openingMail}
            style={({ pressed }) => [
              styles.openMailBtn,
              pressed ? styles.openMailBtnPressed : null,
            ]}
            onPress={() => void onOpenMail()}
          >
            <Mail color={colors.card} size={18} />
            <Text style={styles.openMailBtnText}>
              {isGmail ? 'Open Gmail App' : 'Open Mail App'}
            </Text>
            <ExternalLink color={colors.card} size={16} />
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>
              OR ENTER {EMAIL_OTP_LENGTH}-DIGIT CODE
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.otpSection}>
            <OtpInput
              error={error ?? undefined}
              length={EMAIL_OTP_LENGTH}
              value={code}
              onChange={onCodeChange}
            />

            <PrimaryButton
              disabled={code.length < EMAIL_OTP_LENGTH}
              loading={loading}
              title="Verify Code"
              onPress={() => void onVerifyCode()}
            />
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoIconWrap}>
              <Info color={colors.info} size={16} />
            </View>
            <Text style={styles.infoText}>
              Clicking the confirmation button in your email will automatically
              redirect back to BloodLink.
            </Text>
          </View>

          <View style={styles.resendContainer}>
            {secondsLeft > 0 ? (
              <Text style={styles.resendCountdown}>
                Resend email in {secondsLeft}s
              </Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={resendLoading}
                style={styles.resendBtn}
                onPress={() => void onResend()}
              >
                <RefreshCw
                  color={colors.foreground}
                  size={14}
                  style={resendLoading ? styles.spinning : null}
                />
                <Text style={styles.resendLinkText}>
                  {resendLoading ? 'Sending…' : 'Resend confirmation email'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <Pressable
          accessibilityLabel="Back to login"
          accessibilityRole="button"
          style={styles.backToLogin}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.backToLoginText}>
            Already confirmed? <Text style={styles.backToLoginBold}>Log In</Text>
          </Text>
          <ArrowRight color={colors.muted} size={16} />
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backToLogin: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  backToLoginBold: {
    color: colors.foreground,
    fontWeight: '700',
  },
  backToLoginText: {
    color: colors.muted,
    fontSize: 14,
  },
  bannerError: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderAccent,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  bannerErrorText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerSuccess: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  bannerSuccessText: {
    color: colors.success,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  content: {
    flexGrow: 1,
    gap: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  dividerLabel: {
    color: colors.mutedLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4,
    width: '100%',
  },
  emailBadge: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.borderAccent,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emailText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.cardLg,
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
    ...shadows.card,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.infoSoft,
    borderColor: colors.borderAccent,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    height: 76,
    justifyContent: 'center',
    marginBottom: 4,
    width: 76,
  },
  infoBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  infoIconWrap: {
    marginTop: 2,
  },
  infoText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  openMailBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    elevation: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    width: '100%',
  },
  openMailBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  openMailBtnText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
  otpSection: {
    gap: 14,
    width: '100%',
  },
  resendBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    padding: 6,
  },
  resendContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  resendCountdown: {
    color: colors.mutedLight,
    fontSize: 13,
    fontWeight: '500',
  },
  resendLinkText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
});
