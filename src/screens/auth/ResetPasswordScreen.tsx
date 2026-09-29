import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { FormTextInput } from '@/components/forms/FormTextInput';
import { colors, radii, shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { updatePassword } from '@/services/supabase/auth';
import { signupPasswordSchema } from '@/utils/password';

import { AuthBrand } from './AuthBrand';
import { AuthIcon } from './icons';
import { authStyles } from './styles';

const schema = z.object({
  confirmPassword: z.string(),
  password: signupPasswordSchema,
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});
type FormValues = z.infer<typeof schema>;

export function ResetPasswordScreen() {
  const { acknowledgePasswordRecovery } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { confirmPassword: '', password: '' },
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ password }: FormValues) => {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setUpdated(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBrand />
          <View style={styles.card}>
            {updated ? <CheckCircle2 color={colors.success} size={42} /> : <KeyRound color={colors.info} size={42} />}
            <Text style={authStyles.title}>{updated ? 'Password updated' : 'Choose a new password'}</Text>
            <Text style={styles.subtitle}>
              {updated
                ? 'You can now use this email and your new BloodLink password to sign in.'
                : 'Create a strong password for email sign-in. Your Google sign-in will keep working too.'}
            </Text>
            {!updated ? (
              <>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <FormTextInput error={errors.password?.message} label="" leftIcon={<AuthIcon name="lock" />} onBlur={onBlur} onChangeText={onChange} placeholder="New password" secureTextEntry value={value} />
                  )}
                />
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <FormTextInput error={errors.confirmPassword?.message} label="" leftIcon={<AuthIcon name="lock" />} onBlur={onBlur} onChangeText={onChange} placeholder="Confirm new password" secureTextEntry value={value} />
                  )}
                />
                {error ? <Text style={authStyles.error}>{error}</Text> : null}
                <PrimaryButton loading={loading} title="Update password" onPress={handleSubmit(onSubmit)} />
              </>
            ) : (
              <PrimaryButton title="Continue to BloodLink" onPress={acknowledgePasswordRecovery} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.cardLg, gap: 16, padding: 24, ...shadows.card },
  content: { flexGrow: 1, gap: 24, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 34 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  screen: { flex: 1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
