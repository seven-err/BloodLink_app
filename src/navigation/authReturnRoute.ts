import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_ENTRY_KEY = 'bloodlink.auth-entry';

export type AuthEntryRoute = 'Welcome' | 'Login' | 'Signup';

const ENTRY_ROUTES = new Set<AuthEntryRoute>(['Welcome', 'Login', 'Signup']);

let cachedEntry: AuthEntryRoute = 'Welcome';
let pendingAuthError: string | null = null;

export const getAuthEntry = () => cachedEntry;

export const rememberAuthEntry = (route: AuthEntryRoute) => {
  if (route === 'Welcome') {
    return;
  }

  cachedEntry = route;
  void AsyncStorage.setItem(AUTH_ENTRY_KEY, route);
};

export const loadAuthEntry = async () => {
  try {
    const stored = await AsyncStorage.getItem(AUTH_ENTRY_KEY);

    if (stored && ENTRY_ROUTES.has(stored as AuthEntryRoute) && stored !== 'Welcome') {
      cachedEntry = stored as AuthEntryRoute;
    }
  } catch {
    // Keep the in-memory route if storage is unavailable.
  }

  return cachedEntry;
};

export const clearAuthEntry = () => {
  cachedEntry = 'Welcome';
  pendingAuthError = null;
  void AsyncStorage.removeItem(AUTH_ENTRY_KEY);
};

export const setPendingAuthError = (message: string | null) => {
  pendingAuthError = message;
};

export const consumePendingAuthError = () => {
  const message = pendingAuthError;
  pendingAuthError = null;
  return message;
};
