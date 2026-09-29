import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail, Phone, UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsScreenHeader } from '@/components/settings/SettingsScreenHeader';
import { RequestFormField } from '@/components/forms/RequestFormField';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import type { AppStackParamList } from '@/navigation/types';
import {
  getAccountUpdateErrorMessage,
  updateAccountEmail,
  updateAccountMetadata,
} from '@/services/supabase/auth';
import { updateAccountContact } from '@/services/supabase/profiles';
import {
  accountSettingsSchema,
  normalizeAccountPhone,
  type AccountSettingsFormValues,
} from '@/utils/accountSettingsValidation';
import { PH_MOBILE_PLACEHOLDER } from '@/utils/phone';
import { editProfileStyles } from './editProfileStyles';

type Props = NativeStackScreenProps<AppStackParamList, 'AccountSettings'>;

const getDefaultValues = (
  fullName: string | null | undefined,
  email: string | null | undefined,
  phone: string | null | undefined,
): AccountSettingsFormValues => ({
  email: email ?? '',
  fullName: fullName?.trim() ?? '',
  phone: phone?.trim() ?? '',
});

export function AccountSettingsScreen({ navigation }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { profile, refreshProfile, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initialEmail = session?.user.email?.trim() ?? '';
  const initialPhone = profile?.phone?.trim() || session?.user.phone?.trim() || '';
  const defaultValues = useMemo(
    () => getDefaultValues(profile?.full_name, initialEmail, initialPhone),
    [initialEmail, initialPhone, profile?.full_name],
  );

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    reset,
  } = useForm<AccountSettingsFormValues>({
    defaultValues,
    resolver: zodResolver(accountSettingsSchema),
  });

  const { allowExit } = useUnsavedChangesGuard({ enabled: isDirty });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = async (values: AccountSettingsFormValues) => {
    if (loading || !session?.user.id || !profile) {
      return;
    }

    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const normalizedPhone = normalizeAccountPhone(values.phone);
      const trimmedEmail = values.email.trim();
      const emailChanged =
        trimmedEmail.length > 0 && trimmedEmail.toLowerCase() !== initialEmail.toLowerCase();
      const nameChanged = values.fullName.trim() !== (profile.full_name?.trim() ?? '');
      const phoneChanged = (normalizedPhone ?? '') !== (initialPhone || '');

      if (!nameChanged && !phoneChanged && !emailChanged) {
        setInfoMessage('No changes to save.');
        return;
      }

      if (nameChanged || phoneChanged) {
        const { error: profileError } = await updateAccountContact({
          fullName: values.fullName,
          phone: normalizedPhone,
          userId: session.user.id,
        });

        if (profileError) {
          throw profileError;
        }

        const { error: metadataError } = await updateAccountMetadata({
          full_name: values.fullName.trim(),
          phone: normalizedPhone,
        });

        if (metadataError) {
          throw metadataError;
        }
      }

      if (emailChanged) {
        const { error: emailError } = await updateAccountEmail(trimmedEmail);

        if (emailError) {
          throw emailError;
        }

        setInfoMessage('Profile updated. Check your inbox to confirm your new email address.');
      }

      await refreshProfile();
      reset(getDefaultValues(values.fullName, emailChanged ? initialEmail : trimmedEmail, normalizedPhone));

      if (!emailChanged) {
        allowExit();
        navigation.goBack();
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? getAccountUpdateErrorMessage(submitError.message)
          : 'Unable to update account settings.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <View style={editProfileStyles.screen}>
        <SettingsScreenHeader title="Account Settings" onBack={() => navigation.goBack()} />
        <View style={editProfileStyles.scrollContent}>
          <View style={editProfileStyles.unavailableCard}>
            <Text style={editProfileStyles.unavailableTitle}>Account unavailable</Text>
            <Text style={editProfileStyles.subtitle}>
              Sign in again to manage your account details.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={editProfileStyles.screen}
    >
      <SettingsScreenHeader title="Account Settings" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={editProfileStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={editProfileStyles.subtitle}>
          Update your name, email, and phone number. These details are used for account access and
          coordination.
        </Text>

        <View style={editProfileStyles.sectionCard}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.fullName?.message}
                label="Full Name"
                leftIcon={<UserRound color={colors.mutedLight} size={18} />}
                placeholder="Enter your full name"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email?.message}
                keyboardType="email-address"
                label={initialEmail ? 'Email' : 'Add Email'}
                leftIcon={<Mail color={colors.mutedLight} size={18} />}
                placeholder="Enter your email address"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onBlur, onChange, value } }) => (
              <RequestFormField
                error={errors.phone?.message}
                keyboardType="phone-pad"
                label={initialPhone ? 'Philippine mobile number' : 'Add Philippine mobile number'}
                leftIcon={<Phone color={colors.mutedLight} size={18} />}
                placeholder={PH_MOBILE_PLACEHOLDER}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />

          <Text style={editProfileStyles.helperText}>
            {initialPhone
              ? 'Changing your phone updates the number shown on your BloodLink profile.'
              : 'Add a phone number so recipients and donors can reach you during coordination.'}
          </Text>
        </View>

        {error ? <Text style={editProfileStyles.errorText}>{error}</Text> : null}
        {infoMessage ? <Text style={editProfileStyles.helperText}>{infoMessage}</Text> : null}
      </ScrollView>

      <View style={[editProfileStyles.footer, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          style={({ pressed }) => [
            editProfileStyles.submitButton,
            loading ? editProfileStyles.submitButtonDisabled : null,
            pressed && !loading ? editProfileStyles.submitButtonPressed : null,
          ]}
          onPress={handleSubmit(onSubmit)}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={editProfileStyles.submitButtonText}>Save Account Settings</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
