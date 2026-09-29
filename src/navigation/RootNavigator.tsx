import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { EmailConfirmedScreen } from '@/screens/auth/EmailConfirmedScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { AuthProfileErrorScreen } from '@/screens/AuthProfileErrorScreen';
import { RestrictedAccessScreen } from '@/screens/RestrictedAccessScreen';
import { isAdminRole, isBloodbankRole, isMobileAppRole } from '@/utils/roles';
import { AuthNavigator } from './AuthNavigator';
import { navigationRef } from './navigationRef';

/**
 * Heavy role navigators (maps, reanimated skeletons, chat) stay behind require()
 * so the logged-out Welcome path never evaluates MapLibre / app tabs at import time.
 */
function loadAppNavigator() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./AppNavigator').AppNavigator as typeof import('./AppNavigator').AppNavigator;
}

function loadBloodBankNavigator() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./BloodBankNavigator')
    .BloodBankNavigator as typeof import('./BloodBankNavigator').BloodBankNavigator;
}

function loadProfileSetupNavigator() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./ProfileSetupNavigator')
    .ProfileSetupNavigator as typeof import('./ProfileSetupNavigator').ProfileSetupNavigator;
}

function BootSplash() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.muted} size="large" />
    </View>
  );
}

export function RootNavigator() {
  const {
    authError,
    bloodbankVerification,
    emailJustConfirmed,
    initializing,
    passwordRecovery,
    profile,
    profileComplete,
    profileLoading,
    session,
  } = useAuth();

  if (initializing) {
    return <BootSplash />;
  }

  const profilePending = Boolean(session && profileLoading && !profile);
  const showDonorRecipientApp = Boolean(
    session && (profilePending || (profileComplete && isMobileAppRole(profile?.role))),
  );
  const showBloodBankApp = Boolean(session && profile && isBloodbankRole(profile.role));
  const showRestrictedAccess = Boolean(session && profile && isAdminRole(profile.role));
  const showProfileSetup = Boolean(
    session && profile && !profileComplete && isMobileAppRole(profile.role),
  );

  if (session && passwordRecovery) {
    return <ResetPasswordScreen />;
  }

  if (authError) {
    return <AuthProfileErrorScreen />;
  }

  if (session && emailJustConfirmed) {
    return <EmailConfirmedScreen />;
  }

  if (!session) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  if (showRestrictedAccess) {
    return <RestrictedAccessScreen />;
  }

  const BloodBankNavigator = loadBloodBankNavigator();
  const ProfileSetupNavigator = loadProfileSetupNavigator();
  const AppNavigator = loadAppNavigator();

  return (
    <NavigationContainer ref={navigationRef}>
      {showBloodBankApp ? (
        <BloodBankNavigator verificationStatus={bloodbankVerification?.status ?? 'pending'} />
      ) : showProfileSetup ? (
        <ProfileSetupNavigator />
      ) : showDonorRecipientApp ? (
        <AppNavigator />
      ) : (
        <ProfileSetupNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
