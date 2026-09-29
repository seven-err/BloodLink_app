import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { ProfileCompletionScreen } from '@/screens/auth/ProfileCompletionScreen';
import { DonorPreScreeningScreen } from '@/screens/donor/DonorPreScreeningScreen';

export type ProfileSetupStackParamList = {
  ProfileCompletion: undefined;
  DonorPreScreening: undefined;
};

const Stack = createNativeStackNavigator<ProfileSetupStackParamList>();

export function ProfileSetupNavigator() {
  const { profile } = useAuth();
  const needsDonorPreScreening = Boolean(
    profile?.role === 'donor'
      && profile.onboarding_completed === false
      && profile.blood_type
      && profile.birthdate
      && profile.weight_kg,
  );

  return (
    <Stack.Navigator
      initialRouteName={needsDonorPreScreening ? 'DonorPreScreening' : 'ProfileCompletion'}
      screenOptions={{
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerShown: false,
      }}
    >
      <Stack.Screen component={ProfileCompletionScreen} name="ProfileCompletion" />
      <Stack.Screen component={DonorPreScreeningScreen} name="DonorPreScreening" />
    </Stack.Navigator>
  );
}
