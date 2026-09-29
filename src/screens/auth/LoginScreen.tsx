import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { consumePendingAuthError, rememberAuthEntry } from '@/navigation/authReturnRoute';
import type { AuthStackParamList } from '@/navigation/types';
import { signInWithEmail } from '@/services/supabase/auth';
import { getLoginErrorMessage } from '@/utils/loginErrors';
import { loginPasswordSchema } from '@/utils/password';
import { AuthBrand } from './AuthBrand';
import { AuthDivider } from './AuthDivider';
import { AuthIcon, MutedIcon, SocialIcon } from './icons';
import { AuthTabs } from './AuthTabs';
import { SocialButton } from './SocialButton';
import { authStyles } from './styles';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: loginPasswordSchema,
});

type FormValues = z.infer<typeof schema>;

export function LoginScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
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
      email: '',
      password: '',
    },
    resolver: zodResolver(schema),
  });

  const displayError = error ?? googleError;

  useEffect(() => {
    rememberAuthEntry('Login');
    const pending = consumePendingAuthError();

    if (pending) {
      setError(getLoginErrorMessage(pending));
    }
  }, []);

  const onSubmit = async ({ email, password }: FormValues) => {
    setError(null);
    setGoogleError(null);
    setLoading(true);

    try {
      const { error: loginError } = await signInWithEmail(email, password);

      if (loginError) {
        setError(getLoginErrorMessage(loginError.message));
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to log in.');
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
          <Text style={authStyles.title}>Welcome back!</Text>
          <Text style={authStyles.subtitle}>Log in to continue saving lives.</Text>
        </View>
        <AuthTabs
          active="login"
          onLogin={() => undefined}
          onSignup={() => navigation.navigate('Signup')}
        />
        <View style={styles.socials}>
          <SocialButton
            disabled={googleLoading || loading}
            icon={<Phone color={colors.foreground} size={20} />}
            title="Continue with Phone number"
            onPress={() => navigation.navigate('EnterPhone', { mode: 'login' })}
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
                placeholder="Email address"
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
                placeholder="Password"
                rightIcon={<MutedIcon name={passwordVisible ? 'eye' : 'eye-off'} />}
                secureTextEntry={!passwordVisible}
                value={value}
              />
            )}
          />
          <Pressable
            style={styles.forgotContainer}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgot}>Forgot Password?</Text>
          </Pressable>
          {displayError ? <Text style={authStyles.error}>{displayError}</Text> : null}
          <PrimaryButton
            disabled={googleLoading}
            loading={loading}
            title="Login"
            onPress={handleSubmit(onSubmit)}
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
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
    marginTop: -4,
  },
  forgot: {
    color: colors.foreground,
    fontSize: 13,
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
