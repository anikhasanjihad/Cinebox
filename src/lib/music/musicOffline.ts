import * as RNFS from '@dr.pogodin/react-native-fs';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {createZustandStorage} from '../storage/StorageService';
import type {MusicTrack} from './types';

export interface OfflineEntry {
  track: MusicTrack;
  /** Absolute path of the saved audio file. */
  path: string;
  size: number;
  savedAt: number;
}

interface MusicOfflineState {
  entries: Record<string, OfflineEntry>;
  /** trackId → 0..1 while a download runs. */
  progress: Record<string, number>;
  errors: Record<string, string>;
  setEntry: (entry: OfflineEntry) => void;
  removeEntry: (id: string) => void;
  setProgress: (id: string, value: number | null) => void;
  setError: (id: string, message: string | null) => void;
}

const useMusicOfflineStore = create<MusicOfflineState>()(
  persist(
    set => ({
      entries: {},
      progress: {},
      errors: {},
      setEntry: entry =>
        set(state => ({entries: {...state.entries, [entry.track.id]: entry}})),
      removeEntry: id =>
        set(state => {
          const {[id]: _removed, ...rest} = state.entries;
          return {entries: rest};
        }),
      setProgress: (id, value) =>
        set(state => {
          const next = {...state.progress};
          if (value === null) {
            delete next[id];
          } else {
            next[id] = value;
          }
          return {progress: next};
        }),
      setError: (id, message) =>
        set(state => {
          const next = {...state.errors};
          if (message === null) {
            delete next[id];
          } else {
            next[id] = message;
          }
          return {errors: next};
        }),
    }),
    {
      name: 'cinehub-music-offline',
      storage: createJSONStorage(() => createZustandStorage()),
      // Progress and errors only describe a running session.
      partialize: state => ({entries: state.entries}),
    },
  ),
);

export default useMusicOfflineStore;

const MUSIC_DIR = `${RNFS.DocumentDirectoryPath}/music`;
const jobs = new Map<string, number>();

const extensionOf = (track: MusicTrack): string => {
  const fromPath = /\.([A-Za-z0-9]{2,5})$/.exec(track.audio_path)?.[1];
  return (fromPath ?? 'mp3').toLowerCase();
};

export const localUriFor = (entry: OfflineEntry): string =>
  entry.path.startsWith('file://') ? entry.path : `file://${entry.path}`;

export const isDownloading = (id: string): boolean => jobs.has(id);

export const downloadTrack = async (track: MusicTrack): Promise<void> => {
  const store = useMusicOfflineStore.getState();
  if (jobs.has(track.id) || store.entries[track.id]) {
    return;
  }
  store.setError(track.id, null);
  store.setProgress(track.id, 0);

  const finalPath = `${MUSIC_DIR}/${track.id}.${extensionOf(track)}`;
  // Download to a temp name so a killed app never leaves a half file that looks complete.
  const tempPath = `${finalPath}.part`;
  try {
    await RNFS.mkdir(MUSIC_DIR);
    if (await RNFS.exists(tempPath)) {
      await RNFS.unlink(tempPath);
    }
    const job = RNFS.downloadFile({
      fromUrl: track.audio_url,
      toFile: tempPath,
      background: true,
      progressDivider: 2,
      progress: res => {
        if (res.contentLength > 0) {
          useMusicOfflineStore
            .getState()
            .setProgress(track.id, res.bytesWritten / res.contentLength);
        }
      },
    });
    jobs.set(track.id, job.jobId);
    const result = await job.promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`Server returned ${result.statusCode}`);
    }
    if (await RNFS.exists(finalPath)) {
      await RNFS.unlink(finalPath);
    }
    await RNFS.moveFile(tempPath, finalPath);
    const stat = await RNFS.stat(finalPath);
    useMusicOfflineStore.getState().setEntry({
      track,
      path: finalPath,
      size: Number(stat.size) || 0,
      savedAt: Date.now(),
    });
  } catch (e) {
    try {
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath);
      }
    } catch {}
    // A cancelled download is not an error to show.
    if (jobs.has(track.id)) {
      useMusicOfflineStore
        .getState()
        .setError(
          track.id,
          e instanceof Error ? e.message : 'Download failed',
        );
    }
  } finally {
    jobs.delete(track.id);
    useMusicOfflineStore.getState().setProgress(track.id, null);
  }
};

export const cancelTrackDownload = (id: string): void => {
  const jobId = jobs.get(id);
  if (jobId !== undefined) {
    jobs.delete(id);
    try {
      RNFS.stopDownload(jobId);
    } catch {}
  }
};

export const removeOfflineTrack = async (id: string): Promise<void> => {
  const entry = useMusicOfflineStore.getState().entries[id];
  if (!entry) {
    return;
  }
  try {
    if (await RNFS.exists(entry.path)) {
      await RNFS.unlink(entry.path);
    }
  } catch {}
  useMusicOfflineStore.getState().removeEntry(id);
};

/** Drops entries whose file was cleared by the system or by "clear storage". */
export const reconcileOfflineTracks = async (): Promise<void> => {
  const {entries, removeEntry} = useMusicOfflineStore.getState();
  for (const entry of Object.values(entries)) {
    try {
      if (!(await RNFS.exists(entry.path))) {
        removeEntry(entry.track.id);
      }
    } catch {}
  }
};
