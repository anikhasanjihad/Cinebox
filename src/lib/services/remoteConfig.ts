import {supabase} from '../supabase';
import {settingsStorage} from '../storage';
import useRemoteConfigStore, {resolveTmdbKey} from '../zustand/remoteConfigStore';

export const TMDB_SETTING_KEY = 'tmdb_api_key';

/** Pulls admin-controlled settings (TMDB key) so every user gets them. */
export const syncRemoteConfig = async (): Promise<void> => {
  const {data, error} = await supabase
    .from('app_settings')
    .select('key,value')
    .eq('key', TMDB_SETTING_KEY)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  // No row yet = admin has not set a key; keep whatever the build ships with.
  const key = String(data?.value ?? '').trim();
  settingsStorage.setRemoteTmdbApiKey(key);
  useRemoteConfigStore.getState().setTmdbApiKey(resolveTmdbKey());
};

/** Admin only. Saves the key for all users (RLS enforces admin). */
export const saveTmdbApiKey = async (apiKey: string): Promise<void> => {
  const value = apiKey.trim();
  const {error} = await supabase
    .from('app_settings')
    .upsert({key: TMDB_SETTING_KEY, value}, {onConflict: 'key'});
  if (error) {
    throw new Error(error.message);
  }
  settingsStorage.setRemoteTmdbApiKey(value);
  useRemoteConfigStore.getState().setTmdbApiKey(resolveTmdbKey());
};

/** Admin only: what is stored on the server right now. */
export const fetchTmdbApiKeyForAdmin = async (): Promise<string> => {
  const {data, error} = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', TMDB_SETTING_KEY)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return String(data?.value ?? '');
};
