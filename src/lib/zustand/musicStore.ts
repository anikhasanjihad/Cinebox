import {create} from 'zustand';
import {fetchMusicTracks} from '../music/musicApi';
import useMusicOfflineStore, {localUriFor} from '../music/musicOffline';
import type {MusicTrack, RepeatMode} from '../music/types';

interface MusicState {
  tracks: MusicTrack[];
  loading: boolean;
  error: string | null;
  loadedOnce: boolean;

  queue: MusicTrack[];
  index: number;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  buffering: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Bumped on every seek so the player host reacts even to the same value. */
  seek: {ms: number; nonce: number} | null;
  playerOpen: boolean;

  loadTracks: (force?: boolean) => Promise<void>;
  playQueue: (list: MusicTrack[], startIndex: number) => void;
  toggle: () => void;
  pause: () => void;
  next: (fromEnd?: boolean) => void;
  previous: () => void;
  seekTo: (ms: number) => void;
  setProgress: (positionMs: number, durationMs?: number) => void;
  setBuffering: (value: boolean) => void;
  setPlaying: (value: boolean) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  openPlayer: (open: boolean) => void;
  stop: () => void;
}

const nextRepeat: Record<RepeatMode, RepeatMode> = {
  off: 'all',
  all: 'one',
  one: 'off',
};

const useMusicStore = create<MusicState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,
  loadedOnce: false,

  queue: [],
  index: 0,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  buffering: false,
  repeat: 'off',
  shuffle: false,
  seek: null,
  playerOpen: false,

  loadTracks: async (force = false) => {
    if (get().loading || (get().loadedOnce && !force)) {
      return;
    }
    set({loading: true, error: null});
    try {
      const tracks = await fetchMusicTracks();
      set({tracks, loading: false, loadedOnce: true});
    } catch (e) {
      // Offline: the Offline tab still works from the saved copies.
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Could not load music',
      });
    }
  },

  playQueue: (list, startIndex) => {
    if (!list.length) {
      return;
    }
    const index = Math.min(Math.max(startIndex, 0), list.length - 1);
    set({
      queue: list,
      index,
      playing: true,
      positionMs: 0,
      durationMs: list[index].duration_ms ?? 0,
      buffering: true,
      seek: null,
    });
  },

  toggle: () => {
    if (get().queue.length) {
      set(state => ({playing: !state.playing}));
    }
  },
  pause: () => set({playing: false}),

  next: (fromEnd = false) => {
    const {queue, index, repeat, shuffle} = get();
    if (!queue.length) {
      return;
    }
    if (fromEnd && repeat === 'one') {
      set({positionMs: 0, seek: {ms: 0, nonce: Date.now()}, playing: true});
      return;
    }
    let nextIndex = index + 1;
    if (shuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === index);
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all' || !fromEnd) {
        nextIndex = 0;
      } else {
        // Reached the end of the queue: stop on the last track.
        set({playing: false, positionMs: 0, seek: {ms: 0, nonce: Date.now()}});
        return;
      }
    }
    set({
      index: nextIndex,
      playing: true,
      positionMs: 0,
      durationMs: queue[nextIndex].duration_ms ?? 0,
      buffering: true,
      seek: null,
    });
  },

  previous: () => {
    const {queue, index, positionMs} = get();
    if (!queue.length) {
      return;
    }
    // Like every music app: restart the track first, go back only near its start.
    if (positionMs > 3000) {
      set({positionMs: 0, seek: {ms: 0, nonce: Date.now()}});
      return;
    }
    const prev = index === 0 ? queue.length - 1 : index - 1;
    set({
      index: prev,
      playing: true,
      positionMs: 0,
      durationMs: queue[prev].duration_ms ?? 0,
      buffering: true,
      seek: null,
    });
  },

  seekTo: ms => set({positionMs: ms, seek: {ms, nonce: Date.now()}}),
  setProgress: (positionMs, durationMs) =>
    set(state => ({
      positionMs,
      durationMs:
        durationMs !== undefined && durationMs > 0
          ? durationMs
          : state.durationMs,
    })),
  setBuffering: value => set({buffering: value}),
  setPlaying: value => set({playing: value}),
  cycleRepeat: () => set(state => ({repeat: nextRepeat[state.repeat]})),
  toggleShuffle: () => set(state => ({shuffle: !state.shuffle})),
  openPlayer: open => set({playerOpen: open}),
  stop: () =>
    set({
      queue: [],
      index: 0,
      playing: false,
      positionMs: 0,
      durationMs: 0,
      buffering: false,
      playerOpen: false,
    }),
}));

export default useMusicStore;

export const currentTrack = (state: MusicState): MusicTrack | null =>
  state.queue[state.index] ?? null;

/** Saved copy when there is one, otherwise the stream URL. */
export const sourceUriFor = (track: MusicTrack): string => {
  const entry = useMusicOfflineStore.getState().entries[track.id];
  return entry ? localUriFor(entry) : track.audio_url;
};
