import type {MusicTrack} from '../types';

/** A playable audio URL for one track, plus anything the player must send with it. */
export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  mimeType?: string;
  /** Epoch ms after which the URL stops working; absent when unknown. */
  expiresAt?: number;
}

/**
 * An external music source for the Music tab (the same idea as an Echo
 * extension). A provider turns a search into tracks and, because many
 * providers hand out short-lived links, turns a track into a playable stream
 * right before it plays.
 */
export interface MusicProvider {
  /** Stable id, stored on every track it returns (`MusicTrack.provider`). */
  id: string;
  /** Name shown in the Music tab. */
  name: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  placeholder: string;
  search(query: string, signal?: AbortSignal): Promise<MusicTrack[]>;
  suggestions?(query: string, signal?: AbortSignal): Promise<string[]>;
  resolveStream(track: MusicTrack, signal?: AbortSignal): Promise<ResolvedStream>;
  /** Forget a cached stream, e.g. after playback failed because the link expired. */
  invalidate?(track: MusicTrack): void;
}

export class MusicProviderError extends Error {
  code: 'network' | 'unavailable' | 'no-stream' | 'bad-response';
  constructor(
    code: MusicProviderError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'MusicProviderError';
    this.code = code;
  }
}
