import type {MusicProvider} from '../types';
import {
  invalidateYoutubeStream,
  resolveYoutubeStream,
  searchSongs,
  searchSuggestions,
} from './innertube';
import {YTM_PROVIDER_ID} from './parse';

const youtubeMusicProvider: MusicProvider = {
  id: YTM_PROVIDER_ID,
  name: 'YouTube Music',
  icon: 'youtube',
  placeholder: 'Search YouTube Music',
  search: (query, signal) => searchSongs(query, signal),
  suggestions: (query, signal) => searchSuggestions(query, signal),
  resolveStream: (track, signal) => {
    if (!track.provider_id) {
      return Promise.reject(new Error('Track has no YouTube id'));
    }
    return resolveYoutubeStream(track.provider_id, signal);
  },
  invalidate: track => {
    if (track.provider_id) {
      invalidateYoutubeStream(track.provider_id);
    }
  },
};

export default youtubeMusicProvider;
