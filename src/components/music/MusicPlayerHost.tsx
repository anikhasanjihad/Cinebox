import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {isProviderTrack} from '../../lib/music/types';
import {getMusicProvider} from '../../lib/music/providers/registry';
import type {ResolvedStream} from '../../lib/music/providers/types';

interface Resolved {
  trackId: string;
  stream: ResolvedStream;
}

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
  const fromProvider = track ? isProviderTrack(track) : false;

  // Provider tracks (YouTube Music, ...) have no stored URL: the stream is
  // resolved right before playback and kept for this track only.
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const retriedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!track || !fromProvider) {
      setResolved(null);
      return;
    }
    const provider = getMusicProvider(track.provider);
    if (!provider) {
      useMusicStore.getState().setPlaying(false);
      useMusicStore.getState().setBuffering(false);
      ToastAndroid.show('This music source is not available', ToastAndroid.SHORT);
      return;
    }
    const controller = new AbortController();
    setResolved(null);
    provider
      .resolveStream(track, controller.signal)
      .then(stream => {
        if (!controller.signal.aborted) {
          setResolved({trackId: track.id, stream});
        }
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        const store = useMusicStore.getState();
        store.setPlaying(false);
        store.setBuffering(false);
        ToastAndroid.show('Could not load this song', ToastAndroid.SHORT);
      });
    return () => controller.abort();
    // Re-resolve only when the track changes or a retry was requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, fromProvider, retryNonce]);

  const source = useMemo(() => {
    if (!track) {
      return undefined;
    }
    const metadata = {
      title: track.title,
      artist: track.artist || undefined,
      subtitle: track.album || undefined,
      imageUri: track.cover_url || undefined,
    };
    if (fromProvider) {
      if (!resolved || resolved.trackId !== track.id) {
        return undefined;
      }
      return {
        uri: resolved.stream.url,
        headers: resolved.stream.headers,
        metadata,
      };
    }
    return {uri: sourceUriFor(track), metadata};
    // The source only needs to change when the track changes or its saved
    // copy appears; progress updates must never reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, hasOffline, fromProvider, resolved]);

  useEffect(() => {
    if (seek) {
      videoRef.current?.seek(seek.ms / 1000);
    }
  }, [seek]);

  const onLoad = useCallback((data: OnLoadData) => {
    // Loaded fine: a later expiry may retry once again.
    retriedFor.current = null;
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
    // A provider link can expire while the app sits paused. Fetch a fresh
    // one once for this track before giving up.
    if (track && fromProvider && retriedFor.current !== track.id) {
      retriedFor.current = track.id;
      getMusicProvider(track.provider)?.invalidate?.(track);
      setResolved(null);
      setRetryNonce(n => n + 1);
      return;
    }
    const store = useMusicStore.getState();
    store.setPlaying(false);
    store.setBuffering(false);
    ToastAndroid.show('Could not play this track', ToastAndroid.SHORT);
  }, [track, fromProvider]);

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
