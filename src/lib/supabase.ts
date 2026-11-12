import 'react-native-url-polyfill/auto';
import {createClient, type Session} from '@supabase/supabase-js';
import Constants from 'expo-constants';
import {mainStorage} from './storage/StorageService';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const SUPABASE_URL = String(extra.supabaseUrl || '').trim();
export const SUPABASE_KEY = String(extra.supabaseKey || '').trim();

// Session is kept in the app's MMKV store so users stay signed in.
const SESSION_PREFIX = 'sb-session:';

/**
 * The session supabase-js saved on disk, read synchronously. Lets the app open
 * signed-in straight away instead of waiting for getSession(), which makes a
 * network call when the saved access token has expired.
 */
export const readStoredSession = (): Session | null => {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    const raw = mainStorage.getString(`${SESSION_PREFIX}sb-${ref}-auth-token`);
    if (!raw) {
      return null;
    }
    const stored = JSON.parse(raw);
    return stored?.access_token && stored?.refresh_token && stored?.user
      ? (stored as Session)
      : null;
  } catch {
    return null;
  }
};
const sessionStorageAdapter = {
  getItem: (key: string): string | null =>
    mainStorage.getString(SESSION_PREFIX + key) ?? null,
  setItem: (key: string, value: string): void =>
    mainStorage.setString(SESSION_PREFIX + key, value),
  removeItem: (key: string): void => mainStorage.delete(SESSION_PREFIX + key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: sessionStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type CineHubRole = 'user' | 'admin';

export interface CineHubProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
  role: CineHubRole;
  created_at: string;
}

export interface CineHubServer {
  id: string;
  label: string;
  source_url: string;
  manifest_url: string | null;
  provider_value: string | null;
  position: number;
  enabled: boolean;
  /** provider values the admin hides from users inside this server */
  hidden_providers?: string[] | null;
  created_at?: string;
}
