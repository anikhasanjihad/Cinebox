import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import ScreenSafeArea from '../../components/ui/ScreenSafeArea';
import AppText from '../../components/ui/Text';
import SearchField from '../../components/ui/SearchField';
import {TVFocusGuide} from '../../components/tv';
import TrackRow from '../../components/music/TrackRow';
import MiniPlayer from '../../components/music/MiniPlayer';
import FullPlayer from '../../components/music/FullPlayer';
import MusicButton from '../../components/music/MusicButton';
import SegmentedControl, {
  type SegmentOption,
} from '../../components/music/SegmentedControl';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {showAppDialog} from '../../lib/zustand/appDialogStore';
import useMusicStore, {currentTrack} from '../../lib/zustand/musicStore';
import useMusicOfflineStore, {
  cancelTrackDownload,
  downloadTrack,
  reconcileOfflineTracks,
  removeOfflineTrack,
} from '../../lib/music/musicOffline';
import {matchesQuery, type MusicTrack} from '../../lib/music/types';
import {MUSIC_PROVIDERS, getMusicProvider} from '../../lib/music/providers/registry';
import {useProviderSearch} from '../../lib/music/providers/useProviderSearch';

/** 'all' = the Library, 'offline' = saved copies, anything else = a provider id. */
type Tab = string;

const Music = () => {
  const colors = useM3Colors();
  const tracks = useMusicStore(s => s.tracks);
  const loading = useMusicStore(s => s.loading);
  const error = useMusicStore(s => s.error);
  const activeTrack = useMusicStore(currentTrack);
  const playing = useMusicStore(s => s.playing);
  const hasPlayer = useMusicStore(s => s.queue.length > 0);
  const entries = useMusicOfflineStore(s => s.entries);
  const progress = useMusicOfflineStore(s => s.progress);
  const errors = useMusicOfflineStore(s => s.errors);

  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const provider = getMusicProvider(tab);
  const search = useProviderSearch(provider, query);

  useEffect(() => {
    void useMusicStore.getState().loadTracks();
    void reconcileOfflineTracks();
  }, []);

  const segments = useMemo<SegmentOption[]>(
    () => [
      {key: 'all', label: 'Library', icon: 'music-note'},
      ...MUSIC_PROVIDERS.map(p => ({
        key: p.id,
        label: p.name,
        icon: p.icon as SegmentOption['icon'],
      })),
      {key: 'offline', label: 'Offline', icon: 'download-circle-outline'},
    ],
    [],
  );

  const offlineTracks = useMemo(
    () =>
      Object.values(entries)
        .sort((a, b) => b.savedAt - a.savedAt)
        .map(entry => entry.track),
    [entries],
  );

  const visible = useMemo(() => {
    if (provider) {
      return search.tracks;
    }
    return (tab === 'all' ? tracks : offlineTracks).filter(t =>
      matchesQuery(t, query),
    );
  }, [provider, search.tracks, tab, tracks, offlineTracks, query]);

  const onPlay = useCallback(
    (track: MusicTrack) => {
      const store = useMusicStore.getState();
      if (store.queue[store.index]?.id === track.id) {
        store.openPlayer(true);
        return;
      }
      const index = visible.findIndex(t => t.id === track.id);
      store.playQueue(visible, index);
    },
    [visible],
  );

  const onDownloadPress = useCallback((track: MusicTrack) => {
    const offline = useMusicOfflineStore.getState();
    if (offline.entries[track.id]) {
      showAppDialog({
        title: 'Remove offline copy?',
        message: `“${track.title}” will be deleted from this device. You can still stream it.`,
        variant: 'warning',
        actions: [
          {label: 'Cancel'},
          {
            label: 'Remove',
            variant: 'destructive',
            onPress: () => void removeOfflineTrack(track.id),
          },
        ],
      });
    } else if (offline.progress[track.id] !== undefined) {
      cancelTrackDownload(track.id);
    } else {
      void downloadTrack(track);
    }
  }, []);

  const renderItem = useCallback(
    ({item}: {item: MusicTrack}) => (
      <TrackRow
        track={item}
        active={activeTrack?.id === item.id}
        playing={playing}
        saved={Boolean(entries[item.id])}
        progress={progress[item.id]}
        failed={Boolean(errors[item.id])}
        onPlay={onPlay}
        onDownloadPress={onDownloadPress}
      />
    ),
    [activeTrack?.id, playing, entries, progress, errors, onPlay, onDownloadPress],
  );

  const providerBusy = Boolean(provider) && search.loading;
  const providerError = provider ? search.error : null;
  const emptyIcon = provider
    ? providerError
      ? 'cloud-off-outline'
      : 'magnify'
    : tab === 'offline'
      ? 'download-off-outline'
      : 'music-off';
  const emptyTitle = provider
    ? providerBusy
      ? 'Searching…'
      : providerError
        ? 'Could not search'
        : search.committed
          ? 'No songs found'
          : `Search ${provider.name}`
    : loading
      ? 'Loading music…'
      : query
        ? 'No songs match your search'
        : tab === 'offline'
          ? 'No offline songs yet'
          : error
            ? 'Could not load music'
            : 'No music has been added yet';
  const emptyBody = provider
    ? providerError
      ? providerError
      : search.committed
        ? 'Try a different spelling or another artist.'
        : 'Type a song, artist or album to start listening.'
    : tab === 'offline' && !query
      ? 'Tap the download icon next to a song to listen without internet.'
      : error && !query
        ? error
        : '';

  const empty = (
    <View style={{alignItems: 'center', paddingHorizontal: 32, paddingTop: 64}}>
      {providerBusy ? (
        <ActivityIndicator size="large" color={colors.onSurfaceVariant} />
      ) : (
        <MaterialCommunityIcons
          name={emptyIcon}
          size={56}
          color={colors.onSurfaceVariant}
        />
      )}
      <AppText
        role="titleMedium"
        style={{color: colors.onSurface, marginTop: 12, textAlign: 'center'}}>
        {emptyTitle}
      </AppText>
      {emptyBody ? (
        <AppText
          role="bodyMedium"
          style={{
            color: colors.onSurfaceVariant,
            marginTop: 6,
            textAlign: 'center',
          }}>
          {emptyBody}
        </AppText>
      ) : null}
      {provider && providerError ? (
        <MusicButton
          onPress={search.retry}
          label="Try again"
          borderRadius={18}
          style={{
            backgroundColor: colors.surfaceContainerHighest,
            borderRadius: 18,
            marginTop: 16,
            paddingHorizontal: 18,
            paddingVertical: 10,
          }}>
          <AppText role="labelLargeEmphasized" style={{color: colors.onSurface}}>
            Try again
          </AppText>
        </MusicButton>
      ) : null}
    </View>
  );

  const suggestionList =
    provider && search.suggestions.length > 0 ? (
      <View style={{paddingBottom: 4}}>
        {search.suggestions.map(text => (
          <MusicButton
            key={text}
            label={`Search ${text}`}
            borderRadius={10}
            onPress={() => {
              setQuery(text);
              search.submit(text);
            }}
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingVertical: 11,
            }}>
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={colors.onSurfaceVariant}
            />
            <AppText
              role="bodyLarge"
              numberOfLines={1}
              style={{color: colors.onSurface, marginLeft: 12}}>
              {text}
            </AppText>
          </MusicButton>
        ))}
      </View>
    ) : null;

  return (
    <ScreenSafeArea style={{backgroundColor: colors.background}}>
      <TVFocusGuide autoFocus style={{flex: 1}}>
        <View style={{paddingHorizontal: 16, paddingTop: 12}}>
          <AppText
            role="headlineMediumEmphasized"
            style={{color: colors.onSurface}}>
            Music
          </AppText>
          <View style={{marginTop: 12}}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              onSubmit={text => {
                setQuery(text);
                if (provider) {
                  search.submit(text);
                }
              }}
              onClear={() => setQuery('')}
              placeholder={
                provider ? provider.placeholder : 'Search songs, artists, albums'
              }
            />
          </View>
          <View style={{marginBottom: 8, marginTop: 12}}>
            <SegmentedControl
              options={segments.map(o =>
                o.key === 'offline' && offlineTracks.length
                  ? {...o, label: `Offline (${offlineTracks.length})`}
                  : o,
              )}
              value={tab}
              onChange={setTab}
            />
          </View>
        </View>
        {suggestionList}
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={empty}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          windowSize={9}
          contentContainerStyle={{paddingBottom: 12}}
          refreshControl={
            tab === 'all' ? (
              <RefreshControl
                refreshing={loading && tracks.length > 0}
                onRefresh={() => void useMusicStore.getState().loadTracks(true)}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        />
        {hasPlayer ? <MiniPlayer /> : null}
      </TVFocusGuide>
      <FullPlayer />
    </ScreenSafeArea>
  );
};

export default Music;
