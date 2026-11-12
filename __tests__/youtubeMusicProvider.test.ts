import {
  parseDuration,
  parsePlayerStatus,
  parseSearchResponse,
  parseSuggestions,
  pickAudioFormat,
  upscaleCover,
  urlExpiryMs,
} from '../src/lib/music/providers/youtubeMusic/parse';
import {
  clearStreamCacheForTests,
  resolveYoutubeStream,
  searchSongs,
  setFetchForTests,
} from '../src/lib/music/providers/youtubeMusic/innertube';

const runs = (...texts: string[]) => ({runs: texts.map(text => ({text}))});
const col = (r: ReturnType<typeof runs>) => ({
  musicResponsiveListItemFlexColumnRenderer: {text: r},
});

const songItem = {
  musicResponsiveListItemRenderer: {
    playlistItemData: {videoId: 'abc123DEF45'},
    thumbnail: {
      musicThumbnailRenderer: {
        thumbnail: {
          thumbnails: [
            {url: 'https://lh3.googleusercontent.com/x=w60-h60-l90-rj'},
            {url: 'https://lh3.googleusercontent.com/x=w120-h120-l90-rj'},
          ],
        },
      },
    },
    flexColumns: [
      col(runs('Blinding Lights')),
      {
        musicResponsiveListItemFlexColumnRenderer: {
          text: {
            runs: [
              {text: 'The Weeknd'},
              {text: ' • '},
              {
                text: 'After Hours',
                navigationEndpoint: {
                  browseEndpoint: {
                    browseEndpointContextSupportedConfigs: {
                      browseEndpointContextMusicConfig: {
                        pageType: 'MUSIC_PAGE_TYPE_ALBUM',
                      },
                    },
                  },
                },
              },
              {text: ' • '},
              {text: '3:20'},
            ],
          },
        },
      },
    ],
  },
};

const artistItem = {
  musicResponsiveListItemRenderer: {
    flexColumns: [col(runs('The Weeknd')), col(runs('Artist', ' • ', '30M subscribers'))],
  },
};

const videoItem = {
  musicResponsiveListItemRenderer: {
    overlay: {
      musicItemThumbnailOverlayRenderer: {
        content: {
          musicPlayButtonRenderer: {
            playNavigationEndpoint: {watchEndpoint: {videoId: 'vid987XYZ00'}},
          },
        },
      },
    },
    flexColumns: [
      col(runs('Live Session')),
      col(runs('Video', ' • ', 'Some Channel', ' • ', '1.2M views', ' • ', '1:02:10')),
    ],
  },
};

const searchJson = {
  responseContext: {visitorData: 'VISITOR123'},
  contents: {
    tabbedSearchResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [
                  {musicShelfRenderer: {contents: [songItem, artistItem, videoItem, songItem]}},
                ],
              },
            },
          },
        },
      ],
    },
  },
};

describe('youtube music parsing', () => {
  it('parses durations', () => {
    expect(parseDuration('3:20')).toBe(200000);
    expect(parseDuration('1:02:10')).toBe(3730000);
    expect(parseDuration('Song')).toBeNull();
  });

  it('upscales covers', () => {
    expect(upscaleCover('https://x/y=w60-h60-l90-rj')).toBe(
      'https://x/y=w544-h544-l90-rj',
    );
    expect(upscaleCover('https://x/plain.jpg')).toBe('https://x/plain.jpg');
  });

  it('turns a search response into tracks and drops non-tracks and duplicates', () => {
    const tracks = parseSearchResponse(searchJson);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      id: 'youtube-music:abc123DEF45',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      audio_path: '',
      audio_url: '',
      cover_url: 'https://lh3.googleusercontent.com/x=w544-h544-l90-rj',
      duration_ms: 200000,
      provider: 'youtube-music',
      provider_id: 'abc123DEF45',
    });
    // Video result: id comes from the play overlay, "plays/views" is not an artist.
    expect(tracks[1].provider_id).toBe('vid987XYZ00');
    expect(tracks[1].artist).toBe('Some Channel');
    expect(tracks[1].duration_ms).toBe(3730000);
  });

  it('parses suggestions', () => {
    const json = {
      contents: [
        {
          searchSuggestionsSectionRenderer: {
            contents: [
              {searchSuggestionRenderer: {suggestion: runs('blinding lights')}},
              {searchSuggestionRenderer: {suggestion: runs('blinding lights live')}},
            ],
          },
        },
      ],
    };
    expect(parseSuggestions(json)).toEqual([
      'blinding lights',
      'blinding lights live',
    ]);
  });
});

describe('picking a stream format', () => {
  const player = (adaptive: object[], muxed: object[] = []) => ({
    playabilityStatus: {status: 'OK'},
    streamingData: {adaptiveFormats: adaptive, formats: muxed},
  });

  it('prefers AAC, then Opus, and never uses cipher-only formats', () => {
    const f = pickAudioFormat(
      player([
        {itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 160000, url: 'https://o'},
        {itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 128000, url: 'https://a'},
        {itag: 141, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 256000, signatureCipher: 's=1'},
      ]),
    );
    expect(f?.itag).toBe(140);
    const opusOnly = pickAudioFormat(
      player([{itag: 251, mimeType: 'audio/webm; codecs="opus"', bitrate: 1, url: 'https://o'}]),
    );
    expect(opusOnly?.itag).toBe(251);
  });

  it('falls back to muxed itag 18 when no adaptive audio has a plain URL', () => {
    const f = pickAudioFormat(
      player(
        [{itag: 140, mimeType: 'audio/mp4', signatureCipher: 'x'}],
        [{itag: 18, mimeType: 'video/mp4; codecs="avc1, mp4a"', url: 'https://m'}],
      ),
    );
    expect(f?.itag).toBe(18);
    expect(pickAudioFormat(player([]))).toBeNull();
  });

  it('reads status and expiry', () => {
    expect(parsePlayerStatus({playabilityStatus: {status: 'LOGIN_REQUIRED', reason: 'Sign in'}})).toEqual({
      status: 'LOGIN_REQUIRED',
      reason: 'Sign in',
    });
    expect(urlExpiryMs('https://g/v?a=1&expire=1800000000&b=2')).toBe(1800000000000);
    expect(urlExpiryMs('https://g/v?a=1')).toBeUndefined();
  });
});

describe('stream resolver fallback chain', () => {
  const reply = (body: unknown, ok = true, status = 200) =>
    Promise.resolve({ok, status, json: () => Promise.resolve(body)} as Response);

  const okPlayer = (url: string) => ({
    playabilityStatus: {status: 'OK'},
    streamingData: {
      adaptiveFormats: [{itag: 140, mimeType: 'audio/mp4; codecs="mp4a.40.2"', bitrate: 128000, url}],
    },
  });

  beforeEach(() => clearStreamCacheForTests());
  afterAll(() => setFetchForTests(null));

  it('moves to the next client when the first needs a login or has no URL', async () => {
    const seen: string[] = [];
    setFetchForTests(((url: string, init: {body: string}) => {
      const client = JSON.parse(init.body).context.client.clientName;
      seen.push(client);
      if (client === 'VISIONOS') {
        return reply({playabilityStatus: {status: 'LOGIN_REQUIRED', reason: 'Sign in'}});
      }
      if (client === 'IOS') {
        return reply(okPlayer('https://rr.googlevideo.com/v?expire=4000000000'));
      }
      return reply({}, false, 500);
    }) as unknown as typeof fetch);

    const stream = await resolveYoutubeStream('abc123DEF45');
    expect(seen).toEqual(['VISIONOS', 'IOS']);
    expect(stream.url).toContain('googlevideo.com');
    expect(stream.expiresAt).toBe(4000000000000);
    expect(stream.headers?.['User-Agent']).toContain('com.google.ios.youtube');
  });

  it('caches a fresh stream and rejects when every client fails', async () => {
    let calls = 0;
    setFetchForTests((() => {
      calls++;
      return reply(okPlayer('https://rr.googlevideo.com/v?expire=4000000000'));
    }) as unknown as typeof fetch);
    await resolveYoutubeStream('cached00001');
    await resolveYoutubeStream('cached00001');
    expect(calls).toBe(1);

    setFetchForTests((() => reply({}, false, 403)) as unknown as typeof fetch);
    await expect(resolveYoutubeStream('broken00001')).rejects.toThrow('Could not get a stream');
  });

  it('shares the visitor id from search with later requests', async () => {
    const headers: Array<Record<string, string>> = [];
    setFetchForTests(((url: string, init: {headers: Record<string, string>}) => {
      headers.push(init.headers);
      return reply(searchJson);
    }) as unknown as typeof fetch);
    const tracks = await searchSongs('blinding lights');
    expect(tracks).toHaveLength(2);
    await searchSongs('again');
    expect(headers[1]['X-Goog-Visitor-Id']).toBe('VISITOR123');
  });
});
