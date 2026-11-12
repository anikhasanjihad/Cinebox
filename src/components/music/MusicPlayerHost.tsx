import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {ToastAndroid, View} from 'react-native';
import Video, {
  type OnBufferData,
  type OnLoadData,
  type OnPlaybackRateChangeData,
  type OnProgressData,
  type VideoRef,
} from 'react-native-video';
import useMusicStore, {currentTrack, sourceUriFor} from '../../lib/zustand/musicStore';
import useMusicOfflineStore from '../../lib/music/musicOffline';

/**
 * The one audio player for the Music tab. It stays mounted for the app
 * lifetime so playback continues when the user leaves the Music tab or the
 * app, and so the notification controls keep working.
 */
const MusicPlayerHost = () => {
  const track = useMusicStore(currentTrack);
  const playing = useMusicStore(s => s.playing);
  const seek = useMusicStore(s => s.seek);
  const videoRef = useRef<VideoRef>(null);
  const offlineEntries = useMusicOfflineStore(s => s.entries);

  const trackId = track?.id;
  const hasOffline = trackId ? Boolean(offlineEntries[trackId]) : false;

  const source = useMemo(() => {
    if (!track) {
      return undefined;
    }
    return {
      uri: sourceUriFor(track),
      metadata: {
        title: track.title,
        artist: track.artist || undefined,
        subtitle: track.album || undefined,
        imageUri: track.cover_url || undefined,
      },
    };
    // The source only needs to change when the track changes or its saved
    // copy appears; progress updates must never reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, hasOffline]);

  useEffect(() => {
    if (seek) {
      videoRef.current?.seek(seek.ms / 1000);
    }
  }, [seek]);

  const onLoad = useCallback((data: OnLoadData) => {
    const store = useMusicStore.getState();
    store.setProgress(0, Math.round((data.duration || 0) * 1000));
    store.setBuffering(false);
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    useMusicStore.getState().setProgress(Math.round(data.currentTime * 1000));
  }, []);

  const onBuffer = useCallback((data: OnBufferData) => {
    useMusicStore.getState().setBuffering(data.isBuffering);
  }, []);

  const onEnd = useCallback(() => {
    useMusicStore.getState().next(true);
  }, []);

  const onError = useCallback(() => {
    const store = useMusicStore.getState();
    store.setPlaying(false);
    store.setBuffering(false);
    ToastAndroid.show('Could not play this track', ToastAndroid.SHORT);
  }, []);

  // Play/pause from the notification or headset buttons.
  const onPlaybackRateChange = useCallback(
    (data: OnPlaybackRateChangeData) => {
      const store = useMusicStore.getState();
      if (store.buffering) {
        return;
      }
      const isPlaying = data.playbackRate > 0;
      if (isPlaying !== store.playing) {
        store.setPlaying(isPlaying);
      }
    },
    [],
  );

  if (!track || !source) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{height: 1, opacity: 0, position: 'absolute', width: 1}}>
      <Video
        ref={videoRef}
        source={source}
        paused={!playing}
        repeat={false}
        playInBackground
        playWhenInactive
        ignoreSilentSwitch="ignore"
        showNotificationControls
        progressUpdateInterval={500}
        onLoad={onLoad}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onEnd={onEnd}
        onError={onError}
        onPlaybackRateChange={onPlaybackRateChange}
        style={{height: 1, width: 1}}
      />
    </View>
  );
};

export default MusicPlayerHost;
