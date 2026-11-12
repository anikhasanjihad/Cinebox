import type {MusicProvider} from '../types';
import {parseMusicLink} from '../links';
import {
  invalidateYoutubeStream,
  lookupVideo,
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
  resolveLink: async (url, signal) => {
    const link = parseMusicLink(url);
    return link?.kind === 'youtube' ? lookupVideo(link.videoId, signal) : null;
  },
  invalidate: track => {
    if (track.provider_id) {
      invalidateYoutubeStream(track.provider_id);
    }
  },
};

export default youtubeMusicProvider;
