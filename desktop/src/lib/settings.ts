import {useSyncExternalStore} from 'react';
import {load, save} from './storage';

export interface Settings {
  accent: string;
  reduceMotion: boolean;
  seekInterval: number;
  autoPlayNext: boolean;
  playbackSpeed: number;
  rememberPosition: boolean;
  // Subtitle style: same options and defaults as the phone (Font 16, White, Outline 2px, 100%, elevation 10)
  subSize: number;
  subFont: string;
  subColor: string;
  subEdge: 'outline' | 'shadow' | 'raised' | 'depressed' | 'none';
  subEdgeColor: string;
  subEdgeSize: number;
  subOpacity: number;
  subBg: number;
  subBottom: number;
  askLocal: boolean;
  mediaKeys: boolean;
  mouseGestures: boolean;
  telemetry: boolean;
  showContinue: boolean;
  hideDownloads: boolean;
  sidebarLabels: boolean;
  resize: 'none' | 'cover' | 'stretch' | 'contain';
  ctlLabels: 'full' | 'short' | 'hidden';
  ctlAlign: 'distributed' | 'center' | 'left' | 'right';
  ctlBg: number;
  ctlScale: number;
  seekbarScale: number;
  titleBg: boolean;
  hideSeek: boolean;
  volumeBoost: boolean;
  ambient: boolean;
  hiddenControls: string[];
  /** HLS decoding: auto, system player (hardware when available) or hls.js (software). */
  decoder: 'auto' | 'hardware' | 'software';
}

export const DEFAULTS: Settings = {
  accent: '#FFFFFF',
  reduceMotion: false,
  seekInterval: 10,
  autoPlayNext: true,
  playbackSpeed: 1,
  rememberPosition: true,
  subSize: 16,
  subFont: 'system',
  subColor: '#ffffff',
  subEdge: 'outline',
  subEdgeColor: '#000000',
  subEdgeSize: 2,
  subOpacity: 1,
  subBg: 1,
  subBottom: 10,
  askLocal: false,
  mediaKeys: true,
  mouseGestures: true,
  telemetry: false,
  showContinue: true,
  hideDownloads: false,
  sidebarLabels: true,
  resize: 'none',
  ctlLabels: 'full',
  ctlAlign: 'distributed',
  ctlBg: 0,
  ctlScale: 1,
  seekbarScale: 1,
  titleBg: false,
  hideSeek: false,
  volumeBoost: true,
  ambient: true,
  hiddenControls: [],
  decoder: 'auto',
};

let state: Settings = {...DEFAULTS, ...load<Partial<Settings>>('settings', {})};
const listeners = new Set<() => void>();

const FONTS: Record<string, string> = {
  system: "-apple-system, 'Segoe UI', Inter, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Consolas, 'DejaVu Sans Mono', monospace",
  rounded: "'Arial Rounded MT Bold', 'Nunito', system-ui, sans-serif",
  casual: "'Comic Sans MS', 'Chalkboard SE', cursive",
};
export const SUB_FONTS: Array<[string, string]> = [['system', 'System'], ['serif', 'Serif'], ['mono', 'Monospace'], ['rounded', 'Rounded'], ['casual', 'Casual']];

const hexA = (hex: string, a: number) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : hex;
};
export const subtitleShadow = (s: Settings) => {
  const c = hexA(s.subEdgeColor, s.subOpacity), n = s.subEdgeSize;
  switch (s.subEdge) {
    case 'outline': return [[-n, -n], [n, -n], [-n, n], [n, n], [0, -n], [0, n], [-n, 0], [n, 0]].map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(',');
    case 'shadow': return `${n}px ${n}px ${n * 2}px ${c}`;
    case 'raised': return `-${n / 2}px -${n / 2}px 0 rgba(255,255,255,.55), ${n}px ${n}px ${n}px ${c}`;
    case 'depressed': return `${n / 2}px ${n / 2}px 0 rgba(255,255,255,.4), -${n}px -${n}px ${n}px ${c}`;
    default: return 'none';
  }
};

export const applySettings = (s: Settings = state) => {
  const r = document.documentElement.style;
  r.setProperty('--accent', s.accent);
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s.accent);
  const lum = m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 0;
  r.setProperty('--on-accent', lum > 0.6 ? '#000000' : '#FFFFFF');
  r.setProperty('--sub-px', `${s.subSize}`);
  r.setProperty('--sub-font', FONTS[s.subFont] ?? FONTS.system);
  r.setProperty('--sub-color', hexA(s.subColor, s.subOpacity));
  r.setProperty('--sub-bg', `rgba(0,0,0,${s.subBg === 1 ? 0 : s.subBg})`);
  r.setProperty('--sub-bottom', `${s.subBottom * 4}px`);
  r.setProperty('--sub-shadow', subtitleShadow(s));
  document.body.classList.toggle('reduce-motion', s.reduceMotion);
};

export const getSettings = () => state;
export const updateSettings = (patch: Partial<Settings>) => {
  state = {...state, ...patch};
  save('settings', state);
  applySettings();
  listeners.forEach(l => l());
};
export const resetSettings = () => { state = {...DEFAULTS}; save('settings', state); applySettings(); listeners.forEach(l => l()); };
export const useSettings = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
