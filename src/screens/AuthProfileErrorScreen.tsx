import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SignOutConfirmModal } from '@/components/common/SignOutConfirmModal';
import { colors, radii, shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSignOut } from '@/hooks/useSignOut';

export function AuthProfileErrorScreen() {
  const { authError, authRetrying, retryAuth, session } = useAuth();
  const { cancelSignOut, confirmSignOut, confirmVisible, performSignOut, signingOut } =
    useSignOut();

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Something went wrong</Text>
        <Text style={styles.title}>Unable to continue</Text>
        <Text style={styles.subtitle}>
          {authError ?? 'We could not verify your account right now. Please try again.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton loading={authRetrying} title="Try again" onPress={retryAuth} />
        {session ? (
          <PrimaryButton
            loading={signingOut}
            title="Sign out"
            variant="secondary"
            onPress={confirmSignOut}
          />
        ) : null}
      </View>

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
  actions: {
    gap: 12,
  },
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
