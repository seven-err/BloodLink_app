import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AppTabNavigator } from '@/navigation/AppTabNavigator';
import type { AppStackParamList } from '@/navigation/types';
import { DonationQrScreen } from '@/screens/donor/DonationQrScreen';
import { DonorRequestDetailScreen } from '@/screens/donor/DonorRequestDetailScreen';
import { DonorPreScreeningScreen } from '@/screens/donor/DonorPreScreeningScreen';
import { MyDonationsScreen } from '@/screens/donor/MyDonationsScreen';
import { NearbyDonorDetailScreen } from '@/screens/donor/NearbyDonorDetailScreen';
import { HemieAIScreen } from '@/screens/hemie/HemieAIScreen';
import { ApplyDonorScreen } from '@/screens/profile/ApplyDonorScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { ProfileQrScreen } from '@/screens/profile/ProfileQrScreen';
import { AccountSettingsScreen } from '@/screens/profile/AccountSettingsScreen';
import { ProfilePictureScreen } from '@/screens/profile/ProfilePictureScreen';
import { ReportSafetyScreen } from '@/screens/profile/ReportSafetyScreen';
import { SettingsDetailScreen } from '@/screens/profile/SettingsDetailScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { BloodRequestDetailScreen } from '@/screens/recipient/BloodRequestDetailScreen';
import { CreateBloodRequestScreen } from '@/screens/recipient/CreateBloodRequestScreen';
import { MyBloodRequestsScreen } from '@/screens/recipient/MyBloodRequestsScreen';
import { ChatThreadScreen } from '@/screens/ChatThreadScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { RestrictedAccessScreen } from '@/screens/RestrictedAccessScreen';
import { isMobileAppRole } from '@/utils/roles';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  const { profile } = useAuth();

  if (profile && !isMobileAppRole(profile.role)) {
    return <RestrictedAccessScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName="AppTabs"
      screenOptions={{
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: colors.foreground,
      }}
    >
      <Stack.Screen
        component={AppTabNavigator}
        name="AppTabs"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={HemieAIScreen}
        name="HemieAI"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        component={EditProfileScreen}
        name="EditProfile"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ApplyDonorScreen}
        name="ApplyDonor"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SettingsScreen}
        name="Settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={AccountSettingsScreen}
        name="AccountSettings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ProfilePictureScreen}
        name="ProfilePicture"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ReportSafetyScreen}
        name="ReportSafety"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SettingsDetailScreen}
        name="SettingsDetail"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={DonorRequestDetailScreen}
        name="DonorRequestDetail"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={DonorPreScreeningScreen}
        name="DonorPreScreening"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={MyDonationsScreen}
        name="MyDonations"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={DonationQrScreen}
        name="DonationQr"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ProfileQrScreen}
        name="ProfileQr"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={MyBloodRequestsScreen}
        name="MyBloodRequests"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={CreateBloodRequestScreen}
        name="CreateBloodRequest"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={BloodRequestDetailScreen}
        name="BloodRequestDetail"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ChatThreadScreen}
        name="ChatThread"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={NotificationsScreen}
        name="Notifications"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={NearbyDonorDetailScreen}
        name="NearbyDonorDetail"
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
