import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import type { AuthStackParamList } from '@/navigation/types';
import { requestPhoneOtp } from '@/services/supabase/auth';
import { normalizePhoneNumber, PH_MOBILE_PLACEHOLDER, philippineMobileSchema } from '@/utils/phone';
import { AuthBackButton } from './AuthBackButton';
import { AuthBrand } from './AuthBrand';
import { AuthDivider } from './AuthDivider';
import { AuthIcon, SocialIcon } from './icons';
import { SocialButton } from './SocialButton';
import { authStyles } from './styles';

type Props = NativeStackScreenProps<AuthStackParamList, 'EnterPhone'>;

const schema = z.object({
  phone: philippineMobileSchema,
});

type FormValues = z.infer<typeof schema>;

export function EnterPhoneScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
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
  } = useForm<FormValues>({
    defaultValues: {
      phone: '',
    },
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ phone }: FormValues) => {
    setGoogleError(null);
    setPhoneError(null);
    setLoading(true);

    const normalizedPhone = normalizePhoneNumber(phone);

    try {
      const { error } = await requestPhoneOtp(normalizedPhone);

      if (error) {
        setPhoneError(error.message);
        return;
      }

      navigation.navigate('VerifyOtp', {
        mode: route.params.mode,
        phone: normalizedPhone,
      });
    } catch (submitError) {
      setPhoneError(
        submitError instanceof Error ? submitError.message : 'Unable to send verification code.',
      );
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
        <AuthBackButton onPress={() => navigation.goBack()} />
        <AuthBrand />
        <View style={styles.heading}>
          <Text style={authStyles.title}>
            {route.params.mode === 'signup' ? 'Sign up with phone' : 'Continue with phone'}
          </Text>
          <Text style={authStyles.subtitle}>
            Enter your Philippine mobile number and we&apos;ll send a one-time verification code.
          </Text>
        </View>
        <View style={styles.socials}>
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
          {phoneError ? <Text style={authStyles.error}>{phoneError}</Text> : null}
          {googleError ? <Text style={authStyles.error}>{googleError}</Text> : null}
          <PrimaryButton
            disabled={googleLoading}
            loading={loading}
            title="Continue"
            onPress={handleSubmit((values) => void onSubmit(values))}
          />
          <PrimaryButton
            disabled={googleLoading}
            title={route.params.mode === 'signup' ? 'Sign up with email' : 'Login with email'}
            variant="secondary"
            onPress={() =>
              navigation.navigate(route.params.mode === 'signup' ? 'Signup' : 'Login')
            }
          />
        </View>
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
    gap: 14,
  },
  heading: {
    alignItems: 'center',
    gap: 8,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  socials: {
    gap: 14,
  },
});
