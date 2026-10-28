import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MaterialIcons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {SettingsStackParamList} from '../../App';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {supabase, CineHubServer} from '../../lib/supabase';
import useAuthStore from '../../lib/zustand/authStore';
import {showAppDialog} from '../../lib/zustand/appDialogStore';
import {
  fetchServers,
  syncServers,
  testServerSource,
} from '../../lib/services/serverSync';

type Props = NativeStackScreenProps<SettingsStackParamList, 'AdminPanel'>;

interface Draft {
  id?: string;
  label: string;
  source_url: string;
  manifest_url: string;
  provider_value: string;
  enabled: boolean;
}

const EMPTY: Draft = {
  label: '',
  source_url: '',
  manifest_url: '',
  provider_value: '',
  enabled: true,
};

const RED = '#E50914';

const Field = ({
  label,
  hint,
  value,
  onChangeText,
  colors,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: ReturnType<typeof useM3Colors>;
}) => (
  <View style={{marginBottom: 12}}>
    <Text style={{color: colors.onSurfaceVariant, fontSize: 12, marginBottom: 6}}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      selectionColor={RED}
      cursorColor={RED}
      placeholder={hint}
      placeholderTextColor={colors.outline}
      style={{
        color: colors.onSurface,
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: isTV ? 14 : 11,
        fontSize: isTV ? 18 : 15,
      }}
    />
  </View>
);

const Btn = ({
  title,
  icon,
  onPress,
  primary,
  danger,
  disabled,
  small,
}: {
  title?: string;
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
}) => (
  <TVFocusable
    onPress={onPress}
    disabled={disabled}
    borderRadius={12}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: small ? 12 : 18,
      paddingVertical: small ? 8 : 12,
      borderRadius: 12,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: primary ? RED : danger ? 'rgba(255,90,99,0.16)' : 'rgba(255,255,255,0.09)',
      opacity: disabled ? 0.5 : 1,
    }}>
    {icon && (
      <MaterialIcons
        name={icon}
        size={small ? 18 : 20}
        color={danger ? '#ff6b73' : '#fff'}
        style={{marginRight: title ? 6 : 0}}
      />
    )}
    {title ? (
      <Text style={{color: danger ? '#ff6b73' : '#fff', fontWeight: '700', fontSize: small ? 13 : 14.5}}>
        {title}
      </Text>
    ) : null}
  </TVFocusable>
);

const AdminPanel = ({navigation}: Props) => {
  const colors = useM3Colors();
  const isAdmin = useAuthStore(s => s.isAdmin);

  const [servers, setServers] = useState<CineHubServer[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isTV) {
        return;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (draft) {
          setDraft(null);
        } else {
          navigation.goBack();
        }
        return true;
      });
      return () => sub.remove();
    }, [navigation, draft]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await fetchServers(true));
      const {count} = await supabase
        .from('profiles')
        .select('id', {count: 'exact', head: true});
      setUserCount(count ?? null);
    } catch (e) {
      ToastAndroid.show(
        e instanceof Error ? e.message : 'Could not load servers',
        ToastAndroid.LONG,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void load();
    }
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <MaterialIcons name="lock-outline" size={44} color={colors.onSurfaceVariant} />
        <Text style={{color: colors.onSurface, marginTop: 12, fontSize: 16}}>
          Admins only
        </Text>
      </View>
    );
  }

  const startAdd = () => {
    setTestResult('');
    setDraft({...EMPTY, label: `Server ${servers.length + 1}`});
  };

  const startEdit = (s: CineHubServer) => {
    setTestResult('');
    setDraft({
      id: s.id,
      label: s.label,
      source_url: s.source_url,
      manifest_url: s.manifest_url ?? '',
      provider_value: s.provider_value ?? '',
      enabled: s.enabled,
    });
  };

  const runTest = async () => {
    if (!draft?.source_url.trim()) {
      setTestResult('Enter the source URL first.');
      return;
    }
    setTesting(true);
    setTestResult('');
    try {
      const list = await testServerSource(draft.source_url, draft.manifest_url);
      setTestResult(
        list.length === 0
          ? 'Reached the source, but the manifest is empty.'
          : `✓ Found ${list.length} provider${list.length > 1 ? 's' : ''}: ${list
              .map(p => p.value)
              .join(', ')}`,
      );
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : 'Source not reachable'}`);
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!draft) {
      return;
    }
    if (!draft.label.trim() || !draft.source_url.trim()) {
      ToastAndroid.show('Label and Source URL are required', ToastAndroid.SHORT);
      return;
    }
    setSaving(true);
    const row = {
      label: draft.label.trim(),
      source_url: draft.source_url.trim(),
      manifest_url: draft.manifest_url.trim() || null,
      provider_value: draft.provider_value.trim() || null,
      enabled: draft.enabled,
    };
    const result = draft.id
      ? await supabase.from('cinehub_servers').update(row).eq('id', draft.id)
      : await supabase
          .from('cinehub_servers')
          .insert({...row, position: servers.length});
    setSaving(false);
    if (result.error) {
      ToastAndroid.show(result.error.message, ToastAndroid.LONG);
      return;
    }
    setDraft(null);
    await load();
    ToastAndroid.show('Saved. Users get it on next app start.', ToastAndroid.SHORT);
    void syncServers().catch(() => {});
  };

  const toggle = async (s: CineHubServer, enabled: boolean) => {
    setServers(prev => prev.map(x => (x.id === s.id ? {...x, enabled} : x)));
    const {error} = await supabase
      .from('cinehub_servers')
      .update({enabled})
      .eq('id', s.id);
    if (error) {
      ToastAndroid.show(error.message, ToastAndroid.LONG);
      await load();
    } else {
      void syncServers().catch(() => {});
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= servers.length) {
      return;
    }
    const a = servers[index];
    const b = servers[other];
    const next = [...servers];
    next[index] = {...b, position: index};
    next[other] = {...a, position: other};
    setServers(next);
    const results = await Promise.all([
      supabase.from('cinehub_servers').update({position: other}).eq('id', a.id),
      supabase.from('cinehub_servers').update({position: index}).eq('id', b.id),
    ]);
    if (results.some(r => r.error)) {
      ToastAndroid.show('Could not reorder', ToastAndroid.SHORT);
    }
    void syncServers().catch(() => {});
  };

  const remove = (s: CineHubServer) => {
    showAppDialog({
      title: `Delete "${s.label}"?`,
      message: 'Users will lose this server on their next app start.',
      variant: 'error',
      actions: [
        {label: 'Cancel'},
        {
          label: 'Delete',
          variant: 'destructive',
          onPress: async () => {
            const {error} = await supabase
              .from('cinehub_servers')
              .delete()
              .eq('id', s.id);
            if (error) {
              ToastAndroid.show(error.message, ToastAndroid.LONG);
              return;
            }
            await load();
            void syncServers().catch(() => {});
          },
        },
      ],
    });
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await syncServers();
      ToastAndroid.show(
        r.errors.length
          ? `Synced with ${r.errors.length} error(s): ${r.errors[0]}`
          : `Synced ${r.providers} provider(s) from ${r.servers} server(s)`,
        ToastAndroid.LONG,
      );
    } catch (e) {
      ToastAndroid.show(e instanceof Error ? e.message : 'Sync failed', ToastAndroid.LONG);
    } finally {
      setSyncing(false);
    }
  };

  const card = {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  } as const;

  return (
    <TVFocusGuide autoFocus trapFocusRight style={{flex: 1}}>
      <ScrollView
        focusable={false}
        style={{backgroundColor: colors.background}}
        contentContainerStyle={{padding: 20, paddingBottom: 60}}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 18}}>
          <TVFocusable onPress={() => navigation.goBack()} borderRadius={22} style={{padding: 8, marginRight: 8}}>
            <MaterialIcons name="arrow-back" size={26} color={colors.onBackground} />
          </TVFocusable>
          <View style={{flex: 1}}>
            <Text style={{color: colors.onBackground, fontSize: 24, fontWeight: '800'}}>
              Admin Panel
            </Text>
            <Text style={{color: colors.onSurfaceVariant, fontSize: 13}}>
              Manage the servers your users see
            </Text>
          </View>
        </View>

        <View style={{flexDirection: 'row', marginBottom: 12}}>
          <View style={[card, {flex: 1, marginRight: 10, marginBottom: 0}]}>
            <Text style={{color: colors.onSurfaceVariant, fontSize: 12}}>Servers</Text>
            <Text style={{color: colors.onSurface, fontSize: 26, fontWeight: '800'}}>
              {servers.length}
            </Text>
          </View>
          <View style={[card, {flex: 1, marginBottom: 0}]}>
            <Text style={{color: colors.onSurfaceVariant, fontSize: 12}}>Users</Text>
            <Text style={{color: colors.onSurface, fontSize: 26, fontWeight: '800'}}>
              {userCount ?? '–'}
            </Text>
          </View>
        </View>

        <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8}}>
          <Btn primary icon="add" title="Add server" onPress={startAdd} />
          <Btn
            icon="sync"
            title={syncing ? 'Syncing…' : 'Sync now'}
            disabled={syncing}
            onPress={syncNow}
          />
          <Btn icon="refresh" title="Reload" onPress={load} />
        </View>

        {draft && (
          <View style={[card, {borderWidth: 1, borderColor: 'rgba(229,9,20,0.5)'}]}>
            <Text style={{color: colors.onSurface, fontSize: 17, fontWeight: '800', marginBottom: 12}}>
              {draft.id ? 'Edit server' : 'New server'}
            </Text>
            <Field
              colors={colors}
              label="Name users will see"
              hint="Server 1"
              value={draft.label}
              onChangeText={v => setDraft({...draft, label: v})}
            />
            <Field
              colors={colors}
              label="Provider source URL"
              hint="https://github.com/you/your-providers"
              value={draft.source_url}
              onChangeText={v => setDraft({...draft, source_url: v})}
            />
            <Field
              colors={colors}
              label="Manifest URL (optional)"
              hint="only if manifest.json is somewhere else"
              value={draft.manifest_url}
              onChangeText={v => setDraft({...draft, manifest_url: v})}
            />
            <Field
              colors={colors}
              label="Only this provider (optional)"
              hint="provider value from manifest, blank = all"
              value={draft.provider_value}
              onChangeText={v => setDraft({...draft, provider_value: v})}
            />
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
              <Switch
                value={draft.enabled}
                onValueChange={v => setDraft({...draft, enabled: v})}
                trackColor={{true: RED, false: '#555'}}
                thumbColor="#fff"
              />
              <Text style={{color: colors.onSurface, marginLeft: 10}}>Visible to users</Text>
            </View>
            {!!testResult && (
              <Text
                style={{
                  color: testResult.startsWith('✓') ? '#46d369' : '#ff6b73',
                  marginBottom: 12,
                  fontSize: 13,
                }}>
                {testResult}
              </Text>
            )}
            <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
              <Btn primary title={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={save} />
              <Btn
                icon="bolt"
                title={testing ? 'Testing…' : 'Test source'}
                disabled={testing}
                onPress={runTest}
              />
              <Btn title="Cancel" onPress={() => setDraft(null)} />
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={RED} style={{marginTop: 30}} />
        ) : servers.length === 0 ? (
          <View style={[card, {alignItems: 'center', paddingVertical: 30}]}>
            <MaterialIcons name="dns" size={40} color={colors.onSurfaceVariant} />
            <Text style={{color: colors.onSurfaceVariant, marginTop: 10, textAlign: 'center'}}>
              No servers yet. Tap “Add server” to add your first provider source.
            </Text>
          </View>
        ) : (
          servers.map((s, i) => (
            <View key={s.id} style={[card, {opacity: s.enabled ? 1 : 0.6}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: RED,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                  <Text style={{color: '#fff', fontWeight: '800'}}>{i + 1}</Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={{color: colors.onSurface, fontSize: 16, fontWeight: '800'}}>
                    {s.label}
                  </Text>
                  <Text numberOfLines={1} style={{color: colors.onSurfaceVariant, fontSize: 12}}>
                    {s.source_url}
                  </Text>
                  {!!s.provider_value && (
                    <Text style={{color: colors.onSurfaceVariant, fontSize: 12}}>
                      only: {s.provider_value}
                    </Text>
                  )}
                </View>
                <Switch
                  value={s.enabled}
                  onValueChange={v => toggle(s, v)}
                  trackColor={{true: RED, false: '#555'}}
                  thumbColor="#fff"
                />
              </View>
              <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 12}}>
                <Btn small icon="edit" title="Edit" onPress={() => startEdit(s)} />
                <Btn small icon="arrow-upward" disabled={i === 0} onPress={() => move(i, -1)} />
                <Btn
                  small
                  icon="arrow-downward"
                  disabled={i === servers.length - 1}
                  onPress={() => move(i, 1)}
                />
                <Btn small danger icon="delete-outline" title="Delete" onPress={() => remove(s)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </TVFocusGuide>
  );
};

export default AdminPanel;
