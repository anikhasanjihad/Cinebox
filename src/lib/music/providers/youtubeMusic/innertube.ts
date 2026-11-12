import {MusicProviderError} from '../types';
import {
  PLAYER_CLIENTS,
  WEB_REMIX_VERSION,
  WEB_USER_AGENT,
  type InnertubeClient,
} from './clients';
import {
  parsePlayerStatus,
  parseSearchResponse,
  parseSuggestions,
  pickAudioFormat,
  readVisitorData,
  urlExpiryMs,
} from './parse';
import type {MusicTrack} from '../../types';
import type {ResolvedStream} from '../types';

const MUSIC_API = 'https://music.youtube.com/youtubei/v1';
const PLAYER_API = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
/** "Songs" filter for YouTube Music search (same value ytmusicapi uses). */
const SONGS_FILTER = 'EgWKAQIIAUICCAFqDBAOEAoQAxAEEAkQBQ%3D%3D';
const TIMEOUT_MS = 12000;

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...args) => fetch(...args);
/** Test hook: replaces the network layer. */
export const setFetchForTests = (f: Fetch | null): void => {
  fetchImpl = f ?? ((...args) => fetch(...args));
};

let visitorData: string | undefined;

const postJson = async (
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...headers},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new MusicProviderError('network', `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof MusicProviderError) {
      throw e;
    }
    throw new MusicProviderError(
      'network',
      e instanceof Error ? e.message : 'Network request failed',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};

const webRemixContext = () => ({
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: WEB_REMIX_VERSION(),
    hl: 'en',
    gl: 'US',
  },
  user: {},
});

const webHeaders = (): Record<string, string> => ({
  'User-Agent': WEB_USER_AGENT,
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  ...(visitorData ? {'X-Goog-Visitor-Id': visitorData} : {}),
});

export const searchSongs = async (
  query: string,
  signal?: AbortSignal,
): Promise<MusicTrack[]> => {
  const json = await postJson(
    `${MUSIC_API}/search?prettyPrint=false`,
    {context: webRemixContext(), query, params: SONGS_FILTER},
    webHeaders(),
    signal,
  );
  visitorData = readVisitorData(json) ?? visitorData;
  return parseSearchResponse(json);
};

export const searchSuggestions = async (
  query: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const json = await postJson(
    `${MUSIC_API}/music/get_search_suggestions?prettyPrint=false`,
    {context: webRemixContext(), input: query},
    webHeaders(),
    signal,
  );
  return parseSuggestions(json);
};

const askPlayer = (
  client: InnertubeClient,
  videoId: string,
  signal?: AbortSignal,
): Promise<any> =>
  postJson(
    PLAYER_API,
    {
      context: {client: client.context},
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      playbackContext: {
        contentPlaybackContext: {html5Preference: 'HTML5_PREF_WANTS'},
      },
    },
    {
      'User-Agent': client.userAgent,
      'X-YouTube-Client-Name': client.nameId,
      'X-YouTube-Client-Version': String(
        (client.context as {clientVersion?: string}).clientVersion ?? '',
      ),
      ...(visitorData ? {'X-Goog-Visitor-Id': visitorData} : {}),
    },
    signal,
  );

const cache = new Map<string, ResolvedStream>();
const inflight = new Map<string, Promise<ResolvedStream>>();
const SAFETY_MS = 60_000;

const fresh = (s: ResolvedStream): boolean =>
  s.expiresAt === undefined || s.expiresAt - Date.now() > SAFETY_MS;

const resolveUncached = async (
  videoId: string,
  signal?: AbortSignal,
): Promise<ResolvedStream> => {
  const problems: string[] = [];
  let unavailable = false;
  for (const client of PLAYER_CLIENTS) {
    if (signal?.aborted) {
      throw new MusicProviderError('network', 'Cancelled');
    }
    try {
      const json = await askPlayer(client, videoId, signal);
      visitorData = readVisitorData(json) ?? visitorData;
      const status = parsePlayerStatus(json);
      if (status.status !== 'OK') {
        // LOGIN_REQUIRED / UNPLAYABLE: another client may still be allowed.
        problems.push(`${client.id}: ${status.status} ${status.reason}`.trim());
        if (status.status === 'ERROR') {
          unavailable = true;
        }
        continue;
      }
      const format = pickAudioFormat(json);
      if (!format?.url) {
        problems.push(`${client.id}: no plain-URL audio format`);
        continue;
      }
      return {
        url: format.url,
        mimeType: format.mimeType?.split(';')[0],
        headers: {'User-Agent': client.userAgent},
        expiresAt: urlExpiryMs(format.url),
      };
    } catch (e) {
      problems.push(
        `${client.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  throw new MusicProviderError(
    unavailable ? 'unavailable' : 'no-stream',
    `Could not get a stream (${problems.join('; ')})`,
  );
};

export const resolveYoutubeStream = (
  videoId: string,
  signal?: AbortSignal,
): Promise<ResolvedStream> => {
  const hit = cache.get(videoId);
  if (hit && fresh(hit)) {
    return Promise.resolve(hit);
  }
  const pending = inflight.get(videoId);
  if (pending) {
    return pending;
  }
  const job = resolveUncached(videoId, signal)
    .then(stream => {
      cache.set(videoId, stream);
      return stream;
    })
    .finally(() => inflight.delete(videoId));
  inflight.set(videoId, job);
  return job;
};

export const invalidateYoutubeStream = (videoId: string): void => {
  cache.delete(videoId);
};

export const clearStreamCacheForTests = (): void => {
  cache.clear();
  inflight.clear();
  visitorData = undefined;
};
