/** What a pasted music link points at. */
export type MusicLink =
  | {kind: 'youtube'; videoId: string}
  | {kind: 'audio'; url: string};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const AUDIO_EXT = /\.(mp3|m4a|aac|flac|wav|ogg|oga|opus|weba|webm)(\?.*)?$/i;

/**
 * Understands the links people actually paste: music.youtube.com / youtube.com
 * watch links, youtu.be, shorts, embed, and direct audio file URLs. Returns
 * null for anything else (so ordinary text is still treated as a search).
 */
export const parseMusicLink = (input: string): MusicLink | null => {
  const text = input.trim();
  if (!/^https?:\/\//i.test(text) || /\s/.test(text)) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./i, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && YT_ID.test(id) ? {kind: 'youtube', videoId: id} : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && YT_ID.test(v)) {
      return {kind: 'youtube', videoId: v};
    }
    const [first, second] = url.pathname.split('/').filter(Boolean);
    if (['shorts', 'embed', 'live', 'v'].includes(first) && YT_ID.test(second ?? '')) {
      return {kind: 'youtube', videoId: second};
    }
    return null;
  }
  if (AUDIO_EXT.test(url.pathname + url.search)) {
    return {kind: 'audio', url: text};
  }
  return null;
};

/** A readable title for a direct audio URL, from its file name. */
export const titleFromUrl = (url: string): string => {
  try {
    const name = decodeURIComponent(
      new URL(url).pathname.split('/').filter(Boolean).pop() ?? '',
    );
    return (
      name
        .replace(/\.[A-Za-z0-9]{2,5}$/, '')
        .replace(/[_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled'
    );
  } catch {
    return 'Untitled';
  }
};
