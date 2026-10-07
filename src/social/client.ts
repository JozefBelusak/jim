import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { fetchWithTimeout } from './network';
import { Database } from './types';
import { readAuthCallback, recoverySessionMatcher } from './authCallback';

export const consumeInitialRecoverySession = recoverySessionMatcher(typeof window === 'undefined' ? 'https://local.invalid/' : window.location.href);

export function consumeAuthCallbackError() {
  if (typeof window === 'undefined') return null;
  const callback = readAuthCallback(window.location.href);
  if (callback.error) {
    // Keep existing sessions and unrelated URL parameters, including valid auth tokens.
    window.history.replaceState(window.history.state, '', callback.cleanUrl);
  }
  return callback.error;
}
export const initialAuthCallbackError = consumeAuthCallbackError();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const socialClient = url && key ? createClient<Database>(url, key, {
  global: { fetch: fetchWithTimeout },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web',
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}) },
}) : null;
export function authRedirectUrl() {
  return typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}?account=1`;
}
