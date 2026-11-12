import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, RefreshControl, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import ScreenSafeArea from '../../components/ui/ScreenSafeArea';
import AppText from '../../components/ui/Text';
import SearchField from '../../components/ui/SearchField';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import TrackRow from '../../components/music/TrackRow';
import MiniPlayer from '../../components/music/MiniPlayer';
import FullPlayer from '../../components/music/FullPlayer';
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

type Tab = 'all' | 'offline';

const Chip = ({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  selected: boolean;
  onPress: () => void;
}) => {
  const colors = useM3Colors();
  return (
    <TVFocusable
      onPress={onPress}
      borderRadius={18}
      accessibilityRole="button"
      accessibilityState={{selected}}
      style={{
        alignItems: 'center',
        backgroundColor: selected
          ? colors.secondaryContainer
          : colors.surfaceContainerHigh,
        borderRadius: 18,
        flexDirection: 'row',
        height: 36,
        paddingHorizontal: 14,
      }}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant}
      />
      <AppText
        role="labelLarge"
        style={{
          color: selected ? colors.onSecondaryContainer : colors.onSurface,
          marginLeft: 6,
        }}>
        {label}
      </AppText>
    </TVFocusable>
  );
};

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

  useEffect(() => {
    void useMusicStore.getState().loadTracks();
    void reconcileOfflineTracks();
  }, []);

  const offlineTracks = useMemo(
    () =>
      Object.values(entries)
        .sort((a, b) => b.savedAt - a.savedAt)
        .map(entry => entry.track),
    [entries],
  );

  const visible = useMemo(
    () =>
      (tab === 'all' ? tracks : offlineTracks).filter(t =>
        matchesQuery(t, query),
      ),
    [tab, tracks, offlineTracks, query],
  );

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

  const empty = (
    <View style={{alignItems: 'center', paddingHorizontal: 32, paddingTop: 64}}>
      <MaterialCommunityIcons
        name={tab === 'offline' ? 'download-off-outline' : 'music-off'}
        size={56}
        color={colors.onSurfaceVariant}
      />
      <AppText
        role="titleMedium"
        style={{color: colors.onSurface, marginTop: 12, textAlign: 'center'}}>
        {loading
          ? 'Loading music…'
          : query
            ? 'No songs match your search'
            : tab === 'offline'
              ? 'No offline songs yet'
              : error
                ? 'Could not load music'
                : 'No music has been added yet'}
      </AppText>
      <AppText
        role="bodyMedium"
        style={{
          color: colors.onSurfaceVariant,
          marginTop: 6,
          textAlign: 'center',
        }}>
        {tab === 'offline' && !query
          ? 'Tap the download icon next to a song to listen without internet.'
          : error && !query
            ? error
            : ''}
      </AppText>
    </View>
  );

  return (
    <ScreenSafeArea style={{backgroundColor: colors.background}}>
      <TVFocusGuide autoFocus style={{flex: 1}}>
        <View style={{paddingHorizontal: 16, paddingTop: 12}}>
          <AppText role="headlineMediumEmphasized" style={{color: colors.onSurface}}>
            Music
          </AppText>
          <View style={{marginTop: 12}}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              onSubmit={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search songs, artists, albums"
            />
          </View>
          <View style={{flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 12}}>
            <Chip
              label="All songs"
              icon="music-note"
              selected={tab === 'all'}
              onPress={() => setTab('all')}
            />
            <Chip
              label={`Offline${offlineTracks.length ? ` (${offlineTracks.length})` : ''}`}
              icon="download-circle-outline"
              selected={tab === 'offline'}
              onPress={() => setTab('offline')}
            />
          </View>
        </View>
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
