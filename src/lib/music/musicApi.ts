import {supabase} from '../supabase';
import type {MusicTrack} from './types';

export const MUSIC_BUCKET = 'music';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface NewTrackInput {
  title: string;
  artist: string;
  album: string;
  audio: PickedFile;
  cover?: PickedFile | null;
}

const safeName = (name: string): string =>
  name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'file';

const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const fetchMusicTracks = async (): Promise<MusicTrack[]> => {
  const {data, error} = await supabase
    .from('music_tracks')
    .select('*')
    .order('created_at', {ascending: false})
    .limit(2000);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as MusicTrack[];
};

// FormData with a {uri} part streams the file from disk instead of loading it
// into JS memory, which matters for FLAC and long tracks on low-end phones.
const uploadFile = async (
  file: PickedFile,
  folder: string,
  fallbackType: string,
): Promise<{path: string; url: string}> => {
  const path = `${folder}/${randomId()}-${safeName(file.name)}`;
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: safeName(file.name),
    type: file.mimeType || fallbackType,
  } as unknown as Blob);
  const {error} = await supabase.storage.from(MUSIC_BUCKET).upload(path, form, {
    contentType: file.mimeType || fallbackType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
  const {data} = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path);
  return {path, url: data.publicUrl};
};

/** Admin only (storage + table RLS enforce it). */
export const addMusicTrack = async (
  input: NewTrackInput,
): Promise<MusicTrack> => {
  const audio = await uploadFile(input.audio, 'audio', 'audio/mpeg');
  let cover: {path: string; url: string} | null = null;
  try {
    if (input.cover) {
      cover = await uploadFile(input.cover, 'covers', 'image/jpeg');
    }
    const {data, error} = await supabase
      .from('music_tracks')
      .insert({
        title: input.title.trim(),
        artist: input.artist.trim(),
        album: input.album.trim(),
        audio_path: audio.path,
        audio_url: audio.url,
        cover_path: cover?.path ?? null,
        cover_url: cover?.url ?? null,
        mime_type: input.audio.mimeType ?? null,
        size_bytes: input.audio.size ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return data as MusicTrack;
  } catch (e) {
    // Do not leave orphaned files behind when the row could not be saved.
    await supabase.storage
      .from(MUSIC_BUCKET)
      .remove([audio.path, ...(cover ? [cover.path] : [])])
      .catch(() => {});
    throw e;
  }
};

/** Admin only. Removes the row first, then the files. */
export const deleteMusicTrack = async (track: MusicTrack): Promise<void> => {
  const {error} = await supabase
    .from('music_tracks')
    .delete()
    .eq('id', track.id);
  if (error) {
    throw new Error(error.message);
  }
  const paths = [track.audio_path, track.cover_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length) {
    await supabase.storage
      .from(MUSIC_BUCKET)
      .remove(paths)
      .catch(() => {});
  }
};

export interface NewLinkInput {
  /** A track resolved from a YouTube link, or null for a direct audio URL. */
  resolved: MusicTrack | null;
  /** Direct audio URL (used when `resolved` is null). */
  url?: string;
  title: string;
  artist: string;
  album: string;
}

/**
 * Admin only. Saves a link instead of a file: YouTube links keep only the
 * video id (the stream is resolved at play time), direct URLs are stored as is.
 * Needs supabase/music_links.sql.
 */
export const addMusicLink = async (
  input: NewLinkInput,
): Promise<MusicTrack> => {
  const r = input.resolved;
  const row: Record<string, unknown> = r
    ? {
        title: input.title.trim() || r.title,
        artist: input.artist.trim() || r.artist,
        album: input.album.trim(),
        audio_path: null,
        audio_url: '',
        cover_url: r.cover_url ?? null,
        duration_ms: r.duration_ms ?? null,
        provider: r.provider,
        provider_id: r.provider_id,
      }
    : {
        title: input.title.trim() || 'Untitled',
        artist: input.artist.trim(),
        album: input.album.trim(),
        audio_path: null,
        audio_url: input.url ?? '',
      };
  const {data, error} = await supabase
    .from('music_tracks')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    throw new Error(
      /provider|audio_path/i.test(error.message)
        ? `${error.message}. Run supabase/music_links.sql in the Supabase SQL Editor once.`
        : error.message,
    );
  }
  return data as MusicTrack;
};
