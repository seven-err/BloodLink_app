import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/common/PrimaryButton';
import { colors, radii, shadows } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

import { AuthBrand } from './AuthBrand';

export function EmailConfirmedScreen() {
  const { acknowledgeEmailConfirmation, session } = useAuth();
  const userEmail = session?.user?.email;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <AuthBrand />

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <CheckCircle2 color={colors.success} size={42} strokeWidth={2.4} />
          </View>

          <View style={styles.eyebrowWrap}>
            <Sparkles color={colors.success} size={14} />
            <Text style={styles.eyebrow}>Email verified</Text>
          </View>

          <Text style={styles.title}>You&apos;re all set!</Text>

          {userEmail ? (
            <View style={styles.emailPill}>
              <ShieldCheck color={colors.success} size={15} />
              <Text numberOfLines={1} style={styles.emailText}>
                {userEmail}
              </Text>
            </View>
          ) : null}

          <Text style={styles.subtitle}>
            Your email address has been successfully verified. Continue to complete your BloodLink profile and start connecting with donors.
          </Text>
        </View>

        <PrimaryButton title="Continue to Profile Setup" onPress={acknowledgeEmailConfirmation} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.cardLg,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 32,
    ...shadows.card,
  },
  content: {
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emailPill: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  emailText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  eyebrowWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    height: 76,
    justifyContent: 'center',
    marginBottom: 4,
    width: 76,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
});
