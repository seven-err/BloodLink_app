import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { animateModeHighlight, snapModeHighlight } from '@/components/common/modeSwitchMotion';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/services/supabase/profiles';

export type UserMode = 'donate' | 'request';

const FALLBACK_STORAGE_KEY = '@bloodlink/user_mode';

function getStorageKey(userId: string | undefined): string {
  return userId ? `@bloodlink/user_mode:${userId}` : FALLBACK_STORAGE_KEY;
}

type UserModeContextValue = {
  mode: UserMode;
  setMode: (nextMode: UserMode) => void;
};

const UserModeContext = createContext<UserModeContextValue | undefined>(undefined);

function getDefaultMode(profile: Profile): UserMode {
  return profile?.role === 'recipient' ? 'request' : 'donate';
}

function isValidMode(value: string | null | undefined): value is UserMode {
  return value === 'donate' || value === 'request';
}

export function UserModeProvider({ children }: PropsWithChildren) {
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const storageKey = getStorageKey(userId);
  const [mode, setModeState] = useState<UserMode>('donate');
  const [hydrated, setHydrated] = useState(false);
  const userSwitchRef = useRef(false);
  const hasStoredPreferenceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasStoredPreferenceRef.current = false;
    setHydrated(false);

    const hydrateMode = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(storageKey);

        if (cancelled) {
          return;
        }

        if (isValidMode(storedMode)) {
          hasStoredPreferenceRef.current = true;
          setModeState(storedMode);
        } else {
          hasStoredPreferenceRef.current = false;
        }
      } catch {
        if (!cancelled) {
          hasStoredPreferenceRef.current = false;
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void hydrateMode();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || hasStoredPreferenceRef.current) {
      return;
    }

    setModeState(getDefaultMode(profile));
  }, [hydrated, profile]);

  useEffect(() => {
    if (profile?.role === 'recipient' && mode === 'donate') {
      setModeState('request');
    }
  }, [mode, profile?.role]);

  useEffect(() => {
    if (userSwitchRef.current) {
      userSwitchRef.current = false;
      return;
    }

    snapModeHighlight(mode);
  }, [mode]);

  const setMode = useCallback(
    (nextMode: UserMode) => {
      // Recipients do not get donor features until they apply as a donor.
      if (profile?.role === 'recipient' && nextMode === 'donate') {
        return;
      }

      if (nextMode === mode) {
        return;
      }

      hasStoredPreferenceRef.current = true;
      userSwitchRef.current = true;
      animateModeHighlight(nextMode);
      setModeState(nextMode);
      void AsyncStorage.setItem(storageKey, nextMode);
    },
    [mode, profile?.role, storageKey],
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
    }),
    [mode, setMode],
  );

  return <UserModeContext.Provider value={value}>{children}</UserModeContext.Provider>;
}

export const useUserMode = () => {
  const context = useContext(UserModeContext);

  if (!context) {
    throw new Error('useUserMode must be used within UserModeProvider');
  }

  return context;
};
