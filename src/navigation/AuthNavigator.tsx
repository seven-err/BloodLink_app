import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/constants/theme';
import { getAuthEntry, rememberAuthEntry } from '@/navigation/authReturnRoute';
import type { AuthStackParamList } from '@/navigation/types';
import { EnterPhoneScreen } from '@/screens/auth/EnterPhoneScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { LegalDocumentScreen } from '@/screens/auth/LegalDocumentScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignupScreen } from '@/screens/auth/SignupScreen';
import { VerifyEmailScreen } from '@/screens/auth/VerifyEmailScreen';
import { VerifyOtpScreen } from '@/screens/auth/VerifyOtpScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={getAuthEntry()}
      screenListeners={{
        state: (event) => {
          const state = event.data.state;
          const route = state.routes[state.index];

          if (route?.name === 'Login' || route?.name === 'Signup') {
            rememberAuthEntry(route.name);
          }
        },
      }}
      screenOptions={{
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerShown: false,
        headerTintColor: colors.foreground,
      }}
    >
      <Stack.Screen
        component={WelcomeScreen}
        name="Welcome"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={EnterPhoneScreen}
        name="EnterPhone"
        options={{ title: 'Phone verification' }}
      />
      <Stack.Screen
        component={VerifyOtpScreen}
        name="VerifyOtp"
        options={{ title: 'Verify OTP' }}
      />
      <Stack.Screen component={LoginScreen} name="Login" options={{ title: 'Login' }} />
      <Stack.Screen
        component={ForgotPasswordScreen}
        name="ForgotPassword"
        options={{ title: 'Reset password' }}
      />
      <Stack.Screen
        component={LegalDocumentScreen}
        name="LegalDocument"
        options={{ animation: 'slide_from_right', title: 'Legal' }}
      />
      <Stack.Screen
        component={SignupScreen}
        name="Signup"
        options={{ title: 'Sign Up' }}
      />
      <Stack.Screen
        component={VerifyEmailScreen}
        name="VerifyEmail"
        options={{ title: 'Verify Email' }}
      />
    </Stack.Navigator>
  );
}
