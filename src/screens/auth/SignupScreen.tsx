import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Circle, Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import { LegalAgreementText } from '@/components/common/LegalAgreementText';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { consumePendingAuthError, rememberAuthEntry } from '@/navigation/authReturnRoute';
import type { AuthStackParamList } from '@/navigation/types';
import {
  getSignupErrorMessage,
  isDuplicateEmailSignup,
  resendSignupConfirmation,
  signUpWithEmail,
} from '@/services/supabase/auth';
import { getLoginErrorMessage } from '@/utils/loginErrors';
import { normalizePhoneNumber, PH_MOBILE_PLACEHOLDER, philippineMobileSchema } from '@/utils/phone';
import {
  getPasswordRequirementStatus,
  signupPasswordSchema,
} from '@/utils/password';
import { AuthBrand } from './AuthBrand';
import { AuthDivider } from './AuthDivider';
import { AuthIcon, MutedIcon, SocialIcon } from './icons';
import { AuthTabs } from './AuthTabs';
import { SocialButton } from './SocialButton';
import { authStyles } from './styles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const schema = z
  .object({
    confirmPassword: z.string(),
    email: z.string().email('Enter a valid email address.'),
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    password: signupPasswordSchema,
    phone: philippineMobileSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type SignupValues = z.infer<typeof schema>;

export function SignupScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const {
    error: googleError,
    loading: googleLoading,
    setError: setGoogleError,
    signIn: signInWithGooglePress,
  } = useGoogleSignIn({ disabled: loading });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    defaultValues: {
      confirmPassword: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      phone: '',
    },
    resolver: zodResolver(schema),
  });

  const passwordValue = useWatch({ control, name: 'password' }) ?? '';
  const passwordRequirements = getPasswordRequirementStatus(passwordValue);
  const showPasswordGuide = passwordValue.length > 0;
  const displayError = error ?? googleError;

  useEffect(() => {
    rememberAuthEntry('Signup');
    const pending = consumePendingAuthError();

    if (pending) {
      setError(getLoginErrorMessage(pending));
    }
  }, []);

  const onSubmit = async ({
    email,
    firstName,
    lastName,
    password,
    phone,
  }: SignupValues) => {
    setError(null);
    setGoogleError(null);
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      const { data, error: signupError } = await signUpWithEmail(
        email,
        password,
        fullName,
        normalizePhoneNumber(phone),
      );

      if (signupError) {
        setError(getSignupErrorMessage(signupError.message));
        return;
      }

      if (isDuplicateEmailSignup(data.user)) {
        const { error: resendError } = await resendSignupConfirmation(email);

        if (resendError) {
          setError(
            'An account with this email already exists. Log in instead, or use Forgot Password if you need access.',
          );
          return;
        }

        navigation.navigate('VerifyEmail', { email, resent: true });
        return;
      }

      if (!data.session) {
        navigation.navigate('VerifyEmail', { email, resent: false });
        return;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
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
        <AuthBrand />
        <View style={styles.heading}>
          <Text style={authStyles.title}>Create your account</Text>
          <Text style={authStyles.subtitle}>Join BloodLink and be a hero today.</Text>
        </View>
        <AuthTabs
          active="signup"
          onLogin={() => navigation.navigate('Login')}
          onSignup={() => undefined}
        />
        <View style={styles.socials}>
          <SocialButton
            disabled={googleLoading || loading}
            icon={<Phone color={colors.foreground} size={20} />}
            title="Continue with Phone number"
            onPress={() => navigation.navigate('EnterPhone', { mode: 'signup' })}
          />
          <SocialButton
            disabled={googleLoading || loading}
            icon={<SocialIcon name="google" />}
            loading={googleLoading}
            title="Continue with Google"
            onPress={() => void signInWithGooglePress()}
          />
        </View>
        <AuthDivider />
        <View style={styles.form}>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                autoComplete="given-name"
                error={errors.firstName?.message}
                label=""
                leftIcon={<AuthIcon name="user" />}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="First name"
                value={value}
              />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                autoComplete="family-name"
                error={errors.lastName?.message}
                label=""
                leftIcon={<AuthIcon name="user" />}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Last name"
                value={value}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email?.message}
                keyboardType="email-address"
                label=""
                leftIcon={<AuthIcon name="email" />}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="you.email@example.com"
                value={value}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                autoComplete="tel"
                error={errors.phone?.message}
                keyboardType="phone-pad"
                label=""
                leftIcon={<AuthIcon name="phone" />}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={PH_MOBILE_PLACEHOLDER}
                value={value}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                error={errors.password?.message}
                label=""
                leftIcon={<AuthIcon name="lock" />}
                onBlur={onBlur}
                onChangeText={onChange}
                onRightIconPress={() => setPasswordVisible((visible) => !visible)}
                placeholder="Create password"
                rightIcon={<MutedIcon name={passwordVisible ? 'eye' : 'eye-off'} />}
                secureTextEntry={!passwordVisible}
                value={value}
              />
            )}
          />
          {showPasswordGuide ? (
            <View style={styles.passwordGuide}>
              <Text style={styles.passwordGuideTitle}>Password must include:</Text>
              {passwordRequirements.map((requirement) => (
                <View key={requirement.id} style={styles.requirementRow}>
                  {requirement.met ? (
                    <Check color={colors.success} size={16} strokeWidth={2.5} />
                  ) : (
                    <Circle color={colors.mutedLight} size={16} strokeWidth={2} />
                  )}
                  <Text
                    style={[
                      styles.requirementText,
                      requirement.met ? styles.requirementMet : null,
                    ]}
                  >
                    {requirement.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.passwordHint}>
              Use at least 8 characters with upper and lowercase letters and a number.
            </Text>
          )}
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onBlur, onChange, value } }) => (
              <FormTextInput
                error={errors.confirmPassword?.message}
                label=""
                leftIcon={<AuthIcon name="lock" />}
                onBlur={onBlur}
                onChangeText={onChange}
                onRightIconPress={() => setConfirmVisible((visible) => !visible)}
                placeholder="Confirm password"
                rightIcon={<MutedIcon name={confirmVisible ? 'eye' : 'eye-off'} />}
                secureTextEntry={!confirmVisible}
                value={value}
              />
            )}
          />
          {displayError ? <Text style={authStyles.error}>{displayError}</Text> : null}
          <PrimaryButton
            disabled={googleLoading}
            loading={loading}
            title="Sign Up"
            onPress={handleSubmit(onSubmit)}
          />
        </View>
        <LegalAgreementText
          leadIn="By signing up, you agree to our"
          onOpen={(document) => navigation.navigate('LegalDocument', { document })}
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
  form: {
    gap: 12,
  },
  heading: {
    alignItems: 'center',
    gap: 8,
  },
  socials: {
    gap: 14,
  },
  passwordGuide: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordGuideTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  passwordHint: {
    color: colors.mutedLight,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  requirementMet: {
    color: colors.success,
    fontWeight: '600',
  },
  requirementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  requirementText: {
    color: colors.mutedLight,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
