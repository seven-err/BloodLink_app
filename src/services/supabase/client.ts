import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, hasRequiredEnv } from '@/config/env';
import type { Database } from '@/types/database';
import { ExpoSecureStoreAdapter } from './storage';

let supabaseClient: SupabaseClient<Database> | null = null;

const getSupabaseClient = (): SupabaseClient<Database> => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!hasRequiredEnv) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  supabaseClient = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });

  // Supabase recommends tying refresh work to the React Native app lifecycle.
  // This listener is registered once because the client itself is a singleton.
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabaseClient?.auth.startAutoRefresh();
      } else {
        supabaseClient?.auth.stopAutoRefresh();
      }
    });
  }

  return supabaseClient;
};

/** Lazy client so missing env shows ConfigErrorScreen instead of crashing at import. */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
