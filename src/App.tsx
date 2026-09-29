import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { hasRequiredEnv } from '@/config/env';
import { useAppFonts } from '@/hooks/useAppFonts';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { ConfigErrorScreen } from '@/screens/ConfigErrorScreen';

import { AuthProvider } from '@/context/AuthContext';
import { UserModeProvider } from '@/context/UserModeContext';
import { RootNavigator } from '@/navigation/RootNavigator';

import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  // React Native Web 0.74+ / 0.76+ deprecation warnings
  '"shadow*" style props are deprecated. Use "boxShadow".',
  'props.pointerEvents is deprecated. Use style.pointerEvents',
  // Supabase background token refresh failure when no valid token exists
  '[AuthApiError: Invalid Refresh Token: Refresh Token Not Found]',
]);

function ConfiguredApp() {
  useNotificationHandler();

  // This hook handles web-specific font injection.
  useAppFonts();

  return (
    <AuthProvider>
      <UserModeProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </UserModeProvider>
    </AuthProvider>
  );
}

function AppContent() {
  useAutoUpdate();

  if (!hasRequiredEnv) {
    return (
      <>
        <ConfigErrorScreen />
        <StatusBar style="dark" />
      </>
    );
  }

  return <ConfiguredApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
