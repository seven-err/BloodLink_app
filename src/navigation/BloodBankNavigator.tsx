import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/constants/theme';
import { BloodBankDashboardScreen } from '@/screens/bloodbank/BloodBankDashboardScreen';
import { BloodBankProfileScreen } from '@/screens/bloodbank/BloodBankProfileScreen';
import { BloodBankResubmitScreen } from '@/screens/bloodbank/BloodBankResubmitScreen';
import { BloodBankSupportScreen } from '@/screens/bloodbank/BloodBankSupportScreen';
import { BloodBankVerificationStatusScreen } from '@/screens/bloodbank/BloodBankVerificationStatusScreen';
import type { BloodbankVerificationStatus } from '@/types/database';

export type BloodBankStackParamList = {
  BloodBankDashboard: undefined;
  BloodBankProfile: undefined;
  BloodBankResubmit: undefined;
  BloodBankSupport: undefined;
  BloodBankVerificationStatus: undefined;
};

const Stack = createNativeStackNavigator<BloodBankStackParamList>();

type BloodBankNavigatorProps = {
  verificationStatus: BloodbankVerificationStatus;
};

export function BloodBankNavigator({ verificationStatus }: BloodBankNavigatorProps) {
  const initialRouteName =
    verificationStatus === 'approved' ? 'BloodBankDashboard' : 'BloodBankVerificationStatus';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
      }}
    >
      <Stack.Screen
        component={BloodBankVerificationStatusScreen}
        name="BloodBankVerificationStatus"
        options={{ title: 'Verification' }}
      />
      <Stack.Screen
        component={BloodBankDashboardScreen}
        name="BloodBankDashboard"
        options={{ title: 'Blood Bank Dashboard' }}
      />
      <Stack.Screen
        component={BloodBankProfileScreen}
        name="BloodBankProfile"
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        component={BloodBankResubmitScreen}
        name="BloodBankResubmit"
        options={{ title: 'Resubmit Verification' }}
      />
      <Stack.Screen
        component={BloodBankSupportScreen}
        name="BloodBankSupport"
        options={{ title: 'Support' }}
      />
    </Stack.Navigator>
  );
}
