export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  audio_path: string;
  audio_url: string;
  cover_path?: string | null;
  cover_url?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  duration_ms?: number | null;
  created_at?: string;
  /**
   * Set for tracks that come from an external music provider (for example
   * `youtube-music`). Library tracks leave it undefined, so every existing code
   * path that reads `audio_url` keeps working unchanged. Provider tracks have an
   * empty `audio_url`; the stream is resolved just before playback.
   */
  provider?: string;
  /** The provider's own id for the track (a YouTube video id, ...). */
  provider_id?: string;
}

export const isProviderTrack = (track: MusicTrack): boolean =>
  Boolean(track.provider && track.provider_id);

export type RepeatMode = 'off' | 'all' | 'one';

export const formatTime = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export const matchesQuery = (track: MusicTrack, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return `${track.title} ${track.artist} ${track.album}`
    .toLowerCase()
    .includes(q);
};
