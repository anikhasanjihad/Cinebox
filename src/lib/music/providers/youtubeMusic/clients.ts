/**
 * Innertube client identities used to ask YouTube for a playable stream.
 *
 * THIS FILE IS THE ONE PLACE THAT GOES STALE. YouTube changes which clients
 * hand out plain URLs (and which ones demand a proof-of-origin "PO" token) every
 * few months. The order below reflects what was reported working in Oct-Nov
 * 2026; if tracks stop playing with "no stream", update this list first.
 *
 *  - VISIONOS: reported to need no PO token and no player script, and to
 *    return AAC (itag 140) and Opus (itag 251) with plain URLs.
 *  - IOS: plain AAC URLs for many videos; some require a PO token.
 *  - ANDROID_VR: as of late 2026 yt-dlp marks every format except the muxed
 *    itag 18 as needing a PO token, so it is the last resort.
 *
 * The VISIONOS version/device values are best effort (third-party reports give
 * 1.02 / client id 101 but not the full device string) and are untested against
 * the live service from this build environment.
 */
export interface InnertubeClient {
  id: string;
  /** Numeric id sent as X-YouTube-Client-Name. */
  nameId: string;
  context: Record<string, unknown>;
  userAgent: string;
}

export const WEB_REMIX_VERSION = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `1.${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}.01.00`;
};

export const PLAYER_CLIENTS: InnertubeClient[] = [
  {
    id: 'VISIONOS',
    nameId: '101',
    userAgent:
      'com.google.visionos.youtube/1.02 (RealityDevice14,1; U; CPU OS 1_3 like Mac OS X)',
    context: {
      clientName: 'VISIONOS',
      clientVersion: '1.02',
      deviceMake: 'Apple',
      deviceModel: 'RealityDevice14,1',
      osName: 'visionOS',
      osVersion: '1.3.21O771',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    id: 'IOS',
    nameId: '5',
    userAgent:
      'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    context: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    id: 'ANDROID_VR',
    nameId: '28',
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    context: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.60.19',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      hl: 'en',
      gl: 'US',
    },
  },
];

export const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
