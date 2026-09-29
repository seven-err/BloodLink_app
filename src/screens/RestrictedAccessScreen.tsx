import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { colors, radii, shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';

export function RestrictedAccessScreen() {
  const { profile } = useAuth();
  const { cancelSignOut, confirmSignOut, confirmVisible, performSignOut, signingOut } =
    useSignOut();
  const roleLabel = profile?.role === 'admin' ? 'Administrator' : 'staff';

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Mobile access restricted</Text>
        <Text style={styles.title}>Use the web dashboard</Text>
        <Text style={styles.subtitle}>
          Administrator tools stay on the BloodLink web dashboard. As {roleLabel}, sign in on web
          to manage users, verifications, and operations.
        </Text>
        <Text style={styles.helper}>
          Blood bank personnel who already have a verified staff account can use the mobile blood
          bank workspace. New staff accounts are still created from the web product flow.
        </Text>
      </View>

      <PrimaryButton
        loading={signingOut}
        title="Sign out"
        variant="secondary"
        onPress={confirmSignOut}
      />
      <SignOutConfirmModal
        loading={signingOut}
        visible={confirmVisible}
        onCancel={cancelSignOut}
        onConfirm={() => {
          void performSignOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.cardLg,
    gap: 10,
    padding: 24,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  helper: {
    color: colors.mutedLight,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 24,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '800',
  },
});
