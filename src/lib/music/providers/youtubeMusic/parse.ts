import type {MusicTrack} from '../../types';

export const YTM_PROVIDER_ID = 'youtube-music';

type Json = any;

/** Depth-first search for every object stored under `key`, wherever it nests. */
export const collectByKey = (root: Json, key: string): Json[] => {
  const found: Json[] = [];
  const stack: Json[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') {
      continue;
    }
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        stack.push(node[i]);
      }
      continue;
    }
    for (const k of Object.keys(node)) {
      const value = node[k];
      if (k === key && value && typeof value === 'object') {
        found.push(value);
      }
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return found;
};

const runsText = (runs: Json): string =>
  Array.isArray(runs) ? runs.map(r => r?.text ?? '').join('') : '';

/** "3:45" or "1:02:10" to milliseconds; null when it is not a duration. */
export const parseDuration = (text: string): number | null => {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) {
    return null;
  }
  const [, h, min, s] = m;
  return ((Number(h ?? 0) * 60 + Number(min)) * 60 + Number(s)) * 1000;
};

/** Asks for a square cover of a usable size instead of the tiny default. */
export const upscaleCover = (url: string, size = 544): string =>
  /=w\d+-h\d+/.test(url)
    ? url.replace(/=w\d+-h\d+[^&?]*/, `=w${size}-h${size}-l90-rj`)
    : url;

const TYPE_WORDS = new Set([
  'song',
  'video',
  'songs',
  'videos',
  'single',
  'ep',
  'album',
]);

const isAlbumRun = (run: Json): boolean =>
  run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
    ?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ALBUM';

const SEPARATOR = '•';

const splitGroups = (runs: Json[]): Json[][] => {
  const groups: Json[][] = [[]];
  for (const run of runs) {
    if ((run?.text ?? '').trim() === SEPARATOR) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(run);
    }
  }
  return groups.filter(g => g.length > 0);
};

const findVideoId = (item: Json): string | null => {
  const direct = item?.playlistItemData?.videoId;
  if (typeof direct === 'string' && direct) {
    return direct;
  }
  const watch = collectByKey(item?.overlay ?? item, 'watchEndpoint')[0];
  return typeof watch?.videoId === 'string' ? watch.videoId : null;
};

/** One `musicResponsiveListItemRenderer` to a track; null for artists, albums, playlists. */
export const parseListItem = (item: Json): MusicTrack | null => {
  const videoId = findVideoId(item);
  if (!videoId) {
    return null;
  }
  const columns: Json[] = Array.isArray(item?.flexColumns)
    ? item.flexColumns
    : [];
  const column = (i: number): Json[] =>
    columns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];

  const title = runsText(column(0)).trim();
  if (!title) {
    return null;
  }

  let artist = '';
  let album = '';
  let durationMs: number | null = null;
  for (const group of splitGroups(column(1))) {
    const text = runsText(group).trim();
    const asDuration = parseDuration(text);
    if (asDuration !== null) {
      durationMs = asDuration;
    } else if (group.some(isAlbumRun)) {
      album = text;
    } else if (/\b(plays|views)\b/i.test(text) || TYPE_WORDS.has(text.toLowerCase())) {
      continue;
    } else if (!artist) {
      artist = text;
    }
  }

  const thumbs: Json[] =
    item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const cover = thumbs.length ? thumbs[thumbs.length - 1]?.url : undefined;

  return {
    id: `${YTM_PROVIDER_ID}:${videoId}`,
    title,
    artist,
    album,
    audio_path: '',
    audio_url: '',
    cover_url: cover ? upscaleCover(cover) : null,
    duration_ms: durationMs,
    provider: YTM_PROVIDER_ID,
    provider_id: videoId,
  };
};

export const parseSearchResponse = (json: Json): MusicTrack[] => {
  const seen = new Set<string>();
  const tracks: MusicTrack[] = [];
  for (const item of collectByKey(json, 'musicResponsiveListItemRenderer')) {
    const track = parseListItem(item);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  }
  return tracks;
};

export const parseSuggestions = (json: Json): string[] => {
  const out: string[] = [];
  for (const r of collectByKey(json, 'searchSuggestionRenderer')) {
    const text = runsText(r?.suggestion?.runs).trim();
    if (text && !out.includes(text)) {
      out.push(text);
    }
  }
  return out.slice(0, 8);
};

export interface PlayerFormat {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  averageBitrate?: number;
  signatureCipher?: string;
  cipher?: string;
  audioQuality?: string;
  contentLength?: string;
}

export interface PlayerStatus {
  status: string;
  reason: string;
}

export const parsePlayerStatus = (json: Json): PlayerStatus => ({
  status: String(json?.playabilityStatus?.status ?? 'UNKNOWN'),
  reason: String(
    json?.playabilityStatus?.reason ??
      json?.playabilityStatus?.messages?.[0] ??
      '',
  ),
});

const bitrateOf = (f: PlayerFormat): number =>
  f.averageBitrate ?? f.bitrate ?? 0;

/**
 * Best format that can be played from a plain URL. Formats that only carry a
 * `signatureCipher` need the player script to decode and are skipped.
 *
 * Order: AAC audio (plays everywhere, seeks cleanly), then Opus audio, then the
 * muxed itag 18 file (video + audio; wasteful but needs no token), so a track
 * still plays when a client only exposes that.
 */
export const pickAudioFormat = (json: Json): PlayerFormat | null => {
  const streaming = json?.streamingData ?? {};
  const adaptive: PlayerFormat[] = streaming.adaptiveFormats ?? [];
  const muxed: PlayerFormat[] = streaming.formats ?? [];
  const playable = (f: PlayerFormat) => typeof f.url === 'string' && f.url;
  const audio = adaptive.filter(
    f => playable(f) && String(f.mimeType ?? '').startsWith('audio/'),
  );
  const byBitrate = (a: PlayerFormat, b: PlayerFormat) =>
    bitrateOf(b) - bitrateOf(a);
  const aac = audio
    .filter(f => String(f.mimeType).startsWith('audio/mp4'))
    .sort(byBitrate);
  const opus = audio
    .filter(f => !String(f.mimeType).startsWith('audio/mp4'))
    .sort(byBitrate);
  const fallback = muxed
    .filter(f => playable(f) && String(f.mimeType ?? '').startsWith('video/mp4'))
    .sort((a, b) => (a.itag === 18 ? -1 : b.itag === 18 ? 1 : byBitrate(a, b)));
  return aac[0] ?? opus[0] ?? fallback[0] ?? null;
};

/** Epoch ms from the `expire` query parameter googlevideo URLs carry. */
export const urlExpiryMs = (url: string): number | undefined => {
  const m = /[?&]expire=(\d+)/.exec(url);
  return m ? Number(m[1]) * 1000 : undefined;
};

/** `responseContext.visitorData`, reused so later requests look like one session. */
export const readVisitorData = (json: Json): string | undefined => {
  const v = json?.responseContext?.visitorData;
  return typeof v === 'string' && v ? v : undefined;
};
