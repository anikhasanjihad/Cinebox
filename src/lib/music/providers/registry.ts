import type {MusicProvider} from './types';
import youtubeMusicProvider from './youtubeMusic/provider';

/**
 * External providers shown next to the built-in Library in the Music tab.
 * To add another source, implement `MusicProvider` and add it here.
 */
export const MUSIC_PROVIDERS: MusicProvider[] = [youtubeMusicProvider];

export const getMusicProvider = (id: string | undefined): MusicProvider | null =>
  MUSIC_PROVIDERS.find(p => p.id === id) ?? null;
