import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors, radii, shadows } from '@/constants/theme';
import type { AuthStackParamList } from '@/navigation/types';
import { requestPasswordReset } from '@/services/supabase/auth';

import { AuthBackButton } from './AuthBackButton';
import { AuthBrand } from './AuthBrand';
import { AuthIcon } from './icons';
import { authStyles } from './styles';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const schema = z.object({ email: z.string().email('Enter a valid email address.') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '' },
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: FormValues) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await requestPasswordReset(email);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send the reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthBackButton onPress={() => navigation.goBack()} />
        <AuthBrand />
        <View style={styles.card}>
          <MailCheck color={colors.info} size={38} />
          <Text style={authStyles.title}>{sent ? 'Check your email' : 'Reset your password'}</Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'We sent a secure password-reset link. Open it on this device to choose a new BloodLink password.'
              : 'Enter the email connected to your BloodLink account.'}
          </Text>
          {!sent ? (
            <>
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
              {error ? <Text style={authStyles.error}>{error}</Text> : null}
              <PrimaryButton loading={loading} title="Send reset link" onPress={handleSubmit(onSubmit)} />
            </>
          ) : (
            <PrimaryButton title="Back to Login" onPress={() => navigation.navigate('Login')} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.cardLg, gap: 16, padding: 24, ...shadows.card },
  content: { flexGrow: 1, gap: 24, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 34 },
  screen: { backgroundColor: colors.background, flex: 1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
