import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import Hls from 'hls.js';
import {useServers} from '../store/servers';
import {providerApi} from '../provider/manager';
import type {Stream} from '../provider/types';
import {appFetch} from '../lib/http';
import {load, save} from '../lib/storage';
import {getSettings, updateSettings, useSettings} from '../lib/settings';
import {makeNativeLoader} from '../player/hlsLoader';
import {cueAt, parseSubtitles, type Cue} from '../player/subtitles';
import {IconBack, IconBack10, IconFull, IconFwd10, IconPause, IconPlay} from '../components/Icons';
import {DelayControl, ICON, Sheet, SheetRow, SectionLabel} from '../player/ui';
import {Toggle} from '../components/Controls';

interface QueueItem { title: string; link: string; type: string }
interface State {
  providerKey?: string; link?: string; type?: string; title: string; back: string; image?: string; infoLink?: string;
  queue?: QueueItem[]; index?: number;
  direct?: {url: string; headers?: Record<string, string>; live?: boolean};
  local?: {url: string};
}
type Tab = 'audio' | 'subtitle' | 'speed' | 'server' | 'resize' | 'sleep' | 'more' | 'volume' | null;

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(x).padStart(2, '0')}`;
};
const inTauri = () => '__TAURI_INTERNALS__' in window;

// Same controls, order and labels as the phone player.
export const PLAYER_CONTROLS: Array<[string, string]> = [
  ['sleep', 'Sleep timer'], ['lock', 'Lock player'], ['audio', 'Audio'], ['subtitle', 'Subtitles'], ['speed', 'Playback speed'],
  ['pip', 'Picture in picture'], ['server', 'Server and quality'], ['resize', 'Video fit'], ['episodes', 'Episodes'], ['next', 'Next episode'], ['settings', 'Settings'],
];
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.35, 1.5, 1.75, 2];
export const FIT_MODES = [['none', 'Fit'], ['cover', 'Cover'], ['stretch', 'Stretch'], ['contain', 'Contain']] as const;
const FIT_CSS = {none: 'scale-down', cover: 'cover', stretch: 'fill', contain: 'contain'} as const;
const MAX_SLEEP_MINUTES = 120;
const INTRO_MUTE_SECONDS = 5;

const langName = (code?: string, fallback = 'Auto') => {
  if (!code) return fallback;
  try { return new Intl.DisplayNames(['en'], {type: 'language'}).of(code) || code; } catch { return code; }
};
const shortLang = (code?: string, fallback = 'Auto') => (code ? code.slice(0, 3).toUpperCase() : fallback);

export default function Player() {
  const st = useLocation().state as State | null;
  const nav = useNavigate();
  const {byKey} = useServers();
  const settings = useSettings();
  const provider = st?.providerKey ? byKey(st.providerKey) : undefined;
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const audio = useRef<{ctx: AudioContext; gain: GainNode; delay: DelayNode} | null>(null);
  const idleTimer = useRef<number>();
  const sleepTimer = useRef<number>();
  const fileInput = useRef<HTMLInputElement>(null);

  const live = Boolean(st?.direct?.live);
  const progressId = st ? (st.link ? `${st.providerKey}|${st.link}` : st.direct?.url ?? st.local?.url ?? '') : '';

  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [idle, setIdle] = useState(false);
  const [tab, setTab] = useState<Tab>(null);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState(false);
  const [full, setFull] = useState(false);
  const [toast, setToast] = useState('');
  const [hover, setHover] = useState<{x: number; t: number} | null>(null);
  const [speed, setSpeed] = useState(settings.playbackSpeed);
  const [levels, setLevels] = useState<number[]>([]);
  const [level, setLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<Array<{name: string; lang?: string}>>([]);
  const [audioIdx, setAudioIdx] = useState(0);
  const [audioDelay, setAudioDelayMs] = useState(0);
  const [subIdx, setSubIdx] = useState(-1);
  const [cues, setCues] = useState<Cue[]>([]);
  const [subDelay, setSubDelayMs] = useState(0);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepEnd, setSleepEnd] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [boostOk, setBoostOk] = useState(false);
  // Same rule as the mobile player: the first 5 seconds of every video (not Live TV) play
  // without sound. It follows the playback position, so seeking back to the start mutes
  // again, and the viewer cannot override it.
  const [introMuted, setIntroMuted] = useState(true);
  const [glow, setGlow] = useState('');
  const [askLocal, setAskLocal] = useState(false);
  const localPick = useRef<HTMLInputElement>(null);
  const pickedLocal = useRef('');

  const q = st?.queue; const qi = st?.index ?? 0;
  const next = q && qi + 1 < q.length ? q[qi + 1] : undefined;
  const hidden = new Set(settings.hiddenControls);
  const say = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(t => (t === m ? '' : t)), 2200); }, []);

  // ---- audio graph (volume boost + audio delay); only for streamed (blob) sources ----
  const ensureAudio = useCallback(() => {
    const el = video.current;
    if (audio.current || !el) return audio.current;
    try {
      const ctx = new AudioContext(); const src = ctx.createMediaElementSource(el);
      const delay = ctx.createDelay(10); const gain = ctx.createGain();
      src.connect(delay).connect(gain).connect(ctx.destination);
      audio.current = {ctx, gain, delay};
    } catch { return null; }
    return audio.current;
  }, []);

  useEffect(() => { setIntroMuted(true); if (video.current) video.current.muted = true; }, [progressId]);
  useEffect(() => {
    const el = video.current;
    const silent = introMuted && !live;
    if (el) el.muted = silent || muted;
    if (audio.current) audio.current.gain.gain.value = silent ? 0 : Math.max(1, vol);
  }, [introMuted, muted, live, streams, idx, vol]);

  const exitFull = useCallback(async () => {
    if (inTauri()) { try { await (await import('@tauri-apps/api/window')).getCurrentWindow().setFullscreen(false); } catch { /* ignore */ } }
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setFull(false);
  }, []);
  const toggleFull = useCallback(async () => {
    const want = !full;
    if (inTauri()) { try { await (await import('@tauri-apps/api/window')).getCurrentWindow().setFullscreen(want); setFull(want); return; } catch { /* fall back */ } }
    if (want) await wrap.current?.requestFullscreen().catch(() => {}); else await document.exitFullscreen().catch(() => {});
    setFull(want);
  }, [full]);
  const goBack = useCallback(() => { void exitFull(); nav(st?.back ?? '/', {replace: true}); }, [nav, st, exitFull]);
  const goTo = useCallback((i: number) => {
    if (!q?.[i] || !st) return;
    nav('/watch', {replace: true, state: {...st, link: q[i].link, type: q[i].type, title: q[i].title, index: i}});
    setPanel(false); setCountdown(null);
  }, [q, st, nav]);

  // ---- streams ----
  useEffect(() => {
    if (!st || (pickedLocal.current && pickedLocal.current === st.link)) return;
    let dead = false;
    setStreams(null); setError(''); setBusy(true); setIdx(0); setSubIdx(-1); setCues([]); setAudioDelayMs(0); setSubDelayMs(0);
    if (st.direct) {
      setStreams([{server: live ? 'Live' : 'Video', link: st.direct.url, type: /\.mpd/i.test(st.direct.url) ? 'mpd' : /\.(mp4|mkv|webm)(\?|$)/i.test(st.direct.url) ? 'mp4' : 'm3u8', headers: st.direct.headers}]);
    } else if (st.local) {
      setStreams([{server: 'Downloaded', link: st.local.url, type: 'mp4'}]);
    } else if (provider && st.link) {
      if (askLocal) { setBusy(false); return; }
      providerApi.streams(provider, st.link, st.type ?? 'movie').then(list => {
        if (dead) return;
        const ok = list.filter(s => s?.link);
        if (!ok.length) throw new Error('No playable source was found for this title');
        setStreams(ok);
      }).catch(e => { if (!dead) { setError(e instanceof Error ? e.message : 'Could not get a stream'); setBusy(false); } });
    }
    return () => { dead = true; };
  }, [st?.link, st?.direct?.url, st?.local?.url, provider, askLocal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAskLocal(getSettings().askLocal && !st?.direct && !st?.local && Boolean(st?.link)); }, [st?.link]); // eslint-disable-line react-hooks/exhaustive-deps

  const stream = streams?.[idx];

  // ---- attach source ----
  useEffect(() => {
    const el = video.current;
    if (!el || !stream) return;
    setBusy(true); setError(''); setLevels([]); setLevel(-1); setAudioTracks([]); setAudioIdx(0);
    hls.current?.destroy(); hls.current = null;
    const saved = settings.rememberPosition && !live ? load<Record<string, {t: number; d: number}>>('progress', {})[progressId] : undefined;
    const resume = () => { if (saved && saved.d - saved.t > 20 && saved.t > 5) el.currentTime = saved.t; el.playbackRate = speed; };
    const isHls = /m3u8/i.test(stream.type) || /\.m3u8(\?|$)/i.test(stream.link);
    if (isHls && Hls.isSupported()) {
      const h = new Hls({loader: makeNativeLoader(stream.headers as Record<string, string> | undefined) as never, lowLatencyMode: live, maxBufferLength: 40});
      hls.current = h;
      h.loadSource(stream.link);
      h.attachMedia(el);
      h.on(Hls.Events.MANIFEST_PARSED, (_e, d) => { setLevels(d.levels.map(l => l.height || 0)); resume(); el.play().catch(() => {}); });
      h.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => setAudioTracks(h.audioTracks.map((t, i) => ({name: t.name || `Audio track ${i + 1}`, lang: t.lang}))));
      h.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && live) { h.startLoad(); return; }
        setError('This source could not be played. Try another server from the menu.'); setBusy(false);
      });
      setBoostOk(true);
    } else {
      el.src = stream.link;
      el.addEventListener('loadedmetadata', resume, {once: true});
      el.play().catch(() => {});
      setBoostOk(false);
    }
    return () => { hls.current?.destroy(); hls.current = null; };
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- subtitles ----
  const loadSubs = useCallback(async (i: number) => {
    setSubIdx(i); setTab(null);
    if (i < 0) { setCues([]); return; }
    const s = stream?.subtitles?.[i];
    if (!s) return;
    try {
      const r = await appFetch(s.uri);
      const c = parseSubtitles(await r.text());
      if (!c.length) throw new Error('empty');
      setCues(c);
    } catch { say('Could not load that subtitle'); setCues([]); }
  }, [stream, say]);
  const subFromFile = async (f: File) => {
    const c = parseSubtitles(await f.text());
    if (!c.length) { say('Could not read that subtitle file'); return; }
    setCues(c); setSubIdx(-2); setTab(null);
  };
  const cue = cues.length ? cueAt(cues, time - subDelay / 1000) : null;

  // ---- controls ----
  const toggle = useCallback(() => { const v = video.current; if (v) v.paused ? v.play().catch(() => {}) : v.pause(); }, []);
  const seekBy = useCallback((d: number) => { const v = video.current; if (v && !live) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); }, [live]);
  const wake = useCallback(() => { setIdle(false); clearTimeout(idleTimer.current); idleTimer.current = window.setTimeout(() => setIdle(true), 10000); }, []);

  const applyVolume = useCallback((v: number) => {
    const el = video.current; if (!el) return;
    const n = Math.max(0, Math.min(boostOk && getSettings().volumeBoost ? 2 : 1, v));
    setVol(n);
    if (n > 1) { if (!ensureAudio()) { setVol(1); return; } el.volume = 1; void audio.current?.ctx.resume(); }
    else el.volume = n;
  }, [boostOk, ensureAudio]);

  const setRate = (r: number) => { const n = Math.max(0.25, Math.min(2, Math.round(r / 0.05) * 0.05)); setSpeed(n); if (video.current) video.current.playbackRate = n; };
  const startSleep = (m: number, end = false) => {
    clearTimeout(sleepTimer.current); setSleepMin(m); setSleepEnd(end);
    if (m > 0 && !end) sleepTimer.current = window.setTimeout(() => { video.current?.pause(); setSleepMin(0); say('Sleep timer ended'); }, m * 60000);
  };
  const setAudioDelay = (ms: number) => {
    if (!boostOk) { say('Audio delay works with streamed sources'); return; }
    const a = ensureAudio(); if (!a) return;
    setAudioDelayMs(ms); a.delay.delayTime.value = Math.max(0, ms) / 1000; void a.ctx.resume();
  };
  const pip = async () => { try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.current?.requestPictureInPicture(); } catch { say('Picture in picture is not available'); } };
  const cycleFit = () => { const i = FIT_MODES.findIndex(m => m[0] === settings.resize); updateSettings({resize: FIT_MODES[(i + 1) % FIT_MODES.length][0]}); };

  useEffect(() => {
    wake();
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      wake();
      if (locked) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (tab || panel) { setTab(null); setPanel(false); } else if (full) void exitFull(); else goBack(); return; }
      if (tab) return;
      if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
      else if (k === 'arrowright') seekBy(getSettings().seekInterval);
      else if (k === 'arrowleft') seekBy(-getSettings().seekInterval);
      else if (k === 'arrowup') { e.preventDefault(); applyVolume(vol + 0.05); }
      else if (k === 'arrowdown') { e.preventDefault(); applyVolume(vol - 0.05); }
      else if (k === 'f') void toggleFull();
      else if (k === 'm') setMuted(m => !m);
      else if (k === 'n' && next) goTo(qi + 1);
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); clearTimeout(idleTimer.current); };
  }, [wake, toggle, seekBy, applyVolume, toggleFull, exitFull, goBack, goTo, vol, locked, tab, panel, full, next, qi]);

  // ---- progress + continue watching ----
  useEffect(() => {
    if (live || !st?.link) return;
    const t = setInterval(() => {
      const v = video.current;
      if (!v?.duration || v.paused) return;
      const all = load<Record<string, {t: number; d: number}>>('progress', {});
      all[progressId] = {t: v.currentTime, d: v.duration};
      save('progress', all);
      if (st.infoLink && st.providerKey) {
        let list = load<Array<{key: string; providerKey: string; link: string; title: string; image: string}>>('continue', []);
        list = list.filter(x => x.key !== progressId);
        if (v.currentTime / v.duration < 0.95) list.unshift({key: progressId, providerKey: st.providerKey, link: st.infoLink, title: st.title, image: st.image ?? ''});
        save('continue', list.slice(0, 20));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [progressId, live, st]);

  // ---- ambient glow ----
  useEffect(() => {
    if (!settings.ambient) { setGlow(''); return; }
    const c = document.createElement('canvas'); c.width = 8; c.height = 5;
    const g = c.getContext('2d', {willReadFrequently: true});
    const t = setInterval(() => {
      const v = video.current; if (!v || !g || v.paused || v.readyState < 2) return;
      try {
        g.drawImage(v, 0, 0, 8, 5);
        const d = g.getImageData(0, 0, 8, 5).data; let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4; setGlow(`${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)}`);
      } catch { clearInterval(t); }
    }, 600);
    return () => clearInterval(t);
  }, [settings.ambient, stream]);

  // ---- media keys / system media controls (the desktop version of notification controls) ----
  useEffect(() => {
    if (!settings.mediaKeys || !('mediaSession' in navigator) || !st) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({title: st.title, artist: 'CineHub', artwork: st.image ? [{src: st.image}] : []});
    ms.setActionHandler('play', () => video.current?.play().catch(() => {}));
    ms.setActionHandler('pause', () => video.current?.pause());
    ms.setActionHandler('seekbackward', () => seekBy(-getSettings().seekInterval));
    ms.setActionHandler('seekforward', () => seekBy(getSettings().seekInterval));
    ms.setActionHandler('nexttrack', next ? () => goTo(qi + 1) : null);
    return () => { for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'nexttrack'] as const) ms.setActionHandler(a, null); };
  }, [settings.mediaKeys, st, next, qi, goTo, seekBy]);

  // ---- next episode countdown ----
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) { goTo(qi + 1); return; }
    const t = setTimeout(() => setCountdown(c => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, goTo, qi]);
  useEffect(() => () => { clearTimeout(sleepTimer.current); void audio.current?.ctx.close().catch(() => {}); }, []);

  if (!st) return <Navigate to="/" replace />;

  const subs = stream?.subtitles ?? [];
  const fit = FIT_CSS[settings.resize];
  const fitLabel = FIT_MODES.find(m => m[0] === settings.resize)?.[1] ?? 'Fit';
  const qualityLabel = level >= 0 && levels[level] ? `${levels[level]}p` : stream?.quality ? `${stream.quality}p` : 'Auto';
  const activeAudio = audioTracks[audioIdx];
  const subLabel = subIdx === -1 || !cues.length ? 'None' : subs[subIdx] ? shortLang(subs[subIdx].language, 'On') : 'On';
  const scale = settings.ctlScale;

  interface Ctl { id: string; title: string; label: string; short?: string; visible: boolean; on?: boolean; click: () => void }
  const controls: Ctl[] = [
    {id: 'audio', title: 'Audio', label: langName(activeAudio?.lang, activeAudio?.name ?? 'Auto'), short: shortLang(activeAudio?.lang, 'Auto'), visible: true, click: () => setTab('audio')},
    {id: 'subtitle', title: 'Subtitles', label: subLabel === 'None' ? 'None' : langName(subs[subIdx]?.language, 'On'), short: subLabel, visible: true, on: cues.length > 0, click: () => setTab('subtitle')},
    {id: 'speed', title: 'Playback speed', label: `${speed === 1 ? '1.0' : Number(speed.toFixed(2))}x`, visible: !live, on: speed !== 1, click: () => setTab('speed')},
    {id: 'pip', title: 'Picture in picture', label: 'PIP', visible: 'pictureInPictureEnabled' in document, click: () => void pip()},
    {id: 'server', title: 'Server and quality', label: qualityLabel, visible: true, click: () => setTab('server')},
    {id: 'resize', title: 'Video fit', label: fitLabel, visible: true, click: () => setTab('resize')},
    {id: 'episodes', title: 'Episodes', label: 'Episodes', visible: Boolean(q && q.length > 1), on: panel, click: () => setPanel(p => !p)},
    {id: 'next', title: 'Next episode', label: 'Next', visible: Boolean(next), click: () => goTo(qi + 1)},
    {id: 'settings', title: 'Settings', label: 'Settings', visible: true, click: () => setTab('more')},
  ];
  const top: Ctl[] = [
    {id: 'sleep', title: 'Sleep timer', label: sleepEnd ? 'End of episode' : sleepMin ? `${sleepMin} min` : 'Sleep', visible: true, on: sleepMin > 0 || sleepEnd, click: () => setTab('sleep')},
    {id: 'lock', title: 'Lock player', label: 'Lock', visible: true, click: () => { setLocked(true); setTab(null); wake(); }},
  ];
  const vis = (list: Ctl[]) => list.filter(c => c.visible && !hidden.has(c.id));
  const justify = settings.ctlAlign === 'left' ? 'flex-start' : settings.ctlAlign === 'right' ? 'flex-end' : settings.ctlAlign === 'center' ? 'center' : 'space-between';

  if (locked) {
    return (
      <div ref={wrap} className="player" onMouseMove={wake} style={{cursor: idle ? 'none' : undefined}}>
        <video ref={video} style={{objectFit: fit, background: 'transparent'}} />
        <button className={`pbtn lock-fab press${idle ? ' hide' : ''}`} onClick={() => { setLocked(false); wake(); }} aria-label="Unlock">{ICON.unlock}</button>
      </div>
    );
  }

  return (
    <div ref={wrap} className={`player${idle && playing && !tab && !panel ? ' idle' : ''}`} onMouseMove={wake}
      style={glow ? {background: `radial-gradient(ellipse at center, rgba(${glow},.55), #000 72%)`} : undefined}
      onWheel={e => { if (!settings.mouseGestures) return; applyVolume(vol + (e.deltaY < 0 ? 0.05 : -0.05)); wake(); }}
      onDoubleClick={e => {
        if (!settings.mouseGestures) { void toggleFull(); return; }
        const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width;
        if (x < 0.33) seekBy(-settings.seekInterval); else if (x > 0.67) seekBy(settings.seekInterval); else void toggleFull();
      }}>
      <video
        ref={video}
        style={{objectFit: fit, background: 'transparent'}}
        onClick={() => { if (tab) setTab(null); else toggle(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBusy(true)}
        onPlaying={() => setBusy(false)}
        onCanPlay={() => setBusy(false)}
        onSeeking={e => { if (e.currentTarget.currentTime < INTRO_MUTE_SECONDS) { e.currentTarget.muted = true; setIntroMuted(true); } }}
        onTimeUpdate={e => { setIntroMuted(e.currentTarget.currentTime < INTRO_MUTE_SECONDS); setTime(e.currentTarget.currentTime); const b = e.currentTarget.buffered; if (b.length) setBuf(b.end(b.length - 1)); }}
        onDurationChange={e => setDur(e.currentTarget.duration)}
        onEnded={() => {
          if (sleepEnd) { setSleepEnd(false); say('Sleep timer ended'); return; }
          if (getSettings().autoPlayNext && next) setCountdown(5);
        }}
        onError={() => { if (stream && !/m3u8/i.test(stream.link) && !/m3u8/i.test(stream.type)) { setError('This source could not be played. Try another server from the menu.'); setBusy(false); } }}
      />

      {cue && <div className="subline" style={{bottom: 'var(--sub-bottom, 40px)'}}><span>{cue.text}</span></div>}
      {busy && !error && <div className="center-msg"><div className="spin" /></div>}
      {error && (
        <div className="center-msg" style={{pointerEvents: 'auto'}}>
          <div><h2 className="title-l">Can’t play this</h2><p className="muted" style={{maxWidth: 420}}>{error}</p>
            <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
              {streams && idx + 1 < streams.length && <button className="btn accent press" onClick={() => setIdx(idx + 1)}>Try next server</button>}
              <button className="btn glass press" onClick={goBack}>Go back</button></div></div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {askLocal && (
        <div className="center-msg" style={{pointerEvents: 'auto', background: 'rgba(0,0,0,.7)', zIndex: 15}}>
          <div className="card" style={{width: 400}}>
            <h2 className="title-l" style={{marginBottom: 8}}>Play a file from this computer?</h2>
            <p className="muted" style={{fontSize: 14}}>Choose a video file, or continue with the online stream.</p>
            <button className="btn primary press" style={{width: '100%', justifyContent: 'center', margin: '10px 0'}} onClick={() => localPick.current?.click()}>Choose file</button>
            <button className="btn glass press" style={{width: '100%', justifyContent: 'center'}} onClick={() => setAskLocal(false)}>Use online stream</button>
            <input ref={localPick} type="file" accept="video/*,.mkv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { pickedLocal.current = st.link ?? ''; setStreams([{server: 'Local file', link: URL.createObjectURL(f), type: 'mp4'}]); setBusy(true); setAskLocal(false); } }} />
          </div>
        </div>
      )}
      {countdown != null && next && (
        <div className="upnext" onClick={e => e.stopPropagation()}>
          <div className="muted" style={{fontSize: 12}}>Next episode in {countdown}</div>
          <div style={{fontWeight: 650, margin: '2px 0 10px'}}>{next.title}</div>
          <div style={{display: 'flex', gap: 8}}>
            <button className="btn primary press" style={{height: 36}} onClick={() => goTo(qi + 1)}>Play now</button>
            <button className="btn glass press" style={{height: 36}} onClick={() => setCountdown(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="pl-top2" onClick={e => e.stopPropagation()}>
        <button className="round press" onClick={goBack} aria-label="Back"><IconBack /></button>
        <div style={{flex: 1, minWidth: 0, ...(settings.titleBg ? {background: 'rgba(0,0,0,.55)', borderRadius: 16, padding: '6px 14px'} : {})}}>
          <div style={{fontWeight: 650, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{st.title}</div>
          {live && <div className="live-badge"><i /> LIVE</div>}
        </div>
        <div className="cap-top" style={{background: `rgba(0,0,0,${settings.ctlBg})`, gap: 8 * scale}}>
          {vis(top).map(c => (
            <button key={c.id} className={`cbtn press${c.on ? ' on' : ''}`} style={{padding: 8 * scale}} onClick={c.click} title={c.title} aria-label={c.title}>{ICON[c.id]}</button>
          ))}
        </div>
      </div>

      {!settings.hideSeek && (
        <div className="center-ctl" onClick={e => e.stopPropagation()}>
          {!live && <button className="round sk press" onClick={() => seekBy(-settings.seekInterval)} aria-label="Back"><IconBack10 /></button>}
          <button className="round xl press" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <IconPause /> : <IconPlay />}</button>
          {!live && <button className="round sk press" onClick={() => seekBy(settings.seekInterval)} aria-label="Forward"><IconFwd10 /></button>}
        </div>
      )}

      <div className="pl-bot" onClick={e => e.stopPropagation()}>
        {!live && (
          <div className="ctrl">
            <span className="time">{fmt(time)}</span>
            <div className="bar" style={{height: 5 * settings.seekbarScale}}
              onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); setHover({x: p * 100, t: p * dur}); }}
              onMouseLeave={() => setHover(null)}
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (video.current && dur) video.current.currentTime = ((e.clientX - r.left) / r.width) * dur; }}>
              <div className="buf" style={{width: `${dur ? (buf / dur) * 100 : 0}%`}} />
              <div className="fill" style={{width: `${dur ? (time / dur) * 100 : 0}%`, background: 'var(--accent)'}} />
              {hover && <div className="tip" style={{left: `${hover.x}%`}}>{fmt(hover.t)}</div>}
            </div>
            <span className="time" style={{textAlign: 'right'}}>{fmt(dur)}</span>
            <button className="pbtn press" style={{width: 36, height: 36}} onClick={() => setTab('volume')} title="Volume" aria-label="Volume" onContextMenu={e => { e.preventDefault(); setMuted(m => !m); }}>{muted || vol === 0 ? ICON.mute : ICON.volume}</button>
            <button className="pbtn press" style={{width: 36, height: 36}} onClick={() => void toggleFull()} title="Full screen" aria-label="Full screen"><IconFull /></button>
          </div>
        )}
        <div className="cap-bar" style={{background: `rgba(0,0,0,${settings.ctlBg})`, borderRadius: 28 * scale}}>
          <div className="cap-row" style={{justifyContent: vis(controls).length === 1 ? 'center' : justify, columnGap: 20 * scale}}>
            {vis(controls).map(c => (
              <button key={c.id} className={`cbtn press${c.on ? ' on' : ''}`} style={{minHeight: Math.max(44, 44 * scale)}} onClick={c.click} title={c.title} aria-label={`${c.title}, ${c.label}`}>
                <span style={{display: 'inline-flex', width: 24 * scale, height: 24 * scale}}>{ICON[c.id]}</span>
                {settings.ctlLabels !== 'hidden' && <span style={{fontSize: 12 * scale}}>{settings.ctlLabels === 'short' ? c.short ?? c.label : c.label}</span>}
              </button>
            ))}
          </div>
        </div>
        {live && (
          <div className="ctrl" style={{justifyContent: 'flex-end'}}>
            <button className="pbtn press" style={{width: 36, height: 36}} onClick={() => setTab('volume')} aria-label="Volume">{muted || vol === 0 ? ICON.mute : ICON.volume}</button>
            <button className="pbtn press" style={{width: 36, height: 36}} onClick={() => void toggleFull()} aria-label="Full screen"><IconFull /></button>
          </div>
        )}
      </div>

      {tab === 'audio' && <Sheet title="Audio" onClose={() => setTab(null)}>
        <DelayControl title="Audio delay" later="Sound plays later" earlier="Sound plays earlier" ms={audioDelay} onChange={setAudioDelay} minMs={0} />
        {!boostOk && <div className="menu-empty">Audio delay works with streamed sources.</div>}
        {audioTracks.length === 0 && <div className="menu-empty">{stream ? 'This video has one audio track.' : 'Loading audio tracks...'}</div>}
        {audioTracks.map((t, i) => <SheetRow key={i} title={langName(t.lang, t.name)} detail={t.name} selected={audioIdx === i} onClick={() => { if (hls.current) hls.current.audioTrack = i; setAudioIdx(i); setTab(null); }} />)}
      </Sheet>}
      {tab === 'subtitle' && <Sheet title="Subtitle" onClose={() => setTab(null)}>
        {cues.length > 0 && <DelayControl title="Subtitle delay" later="Text shows later" earlier="Text shows earlier" ms={subDelay} onChange={setSubDelayMs} />}
        <SheetRow title="None" selected={subIdx === -1} onClick={() => void loadSubs(-1)} />
        {subs.map((s, i) => <SheetRow key={i} title={langName(s.language, s.title)} detail={s.title} selected={subIdx === i} onClick={() => void loadSubs(i)} />)}
        <SheetRow title="Load from file…" selected={subIdx === -2} onClick={() => fileInput.current?.click()} />
      </Sheet>}
      {tab === 'speed' && <Sheet title="Playback speed" wide onClose={() => setTab(null)}>
        <div className="speed-big">{speed.toFixed(2)}x</div>
        <input className="wide-range" type="range" min={0.25} max={2} step={0.05} value={speed} onChange={e => setRate(Number(e.target.value))} />
        <div className="chips-row">{PLAYBACK_SPEEDS.map(r => <button key={r} className={speed === r ? 'on' : ''} onClick={() => setRate(r)}>{r === 1 ? '1.0' : r}x</button>)}</div>
      </Sheet>}
      {tab === 'sleep' && <Sheet title="Sleep timer" wide onClose={() => setTab(null)}>
        <div className="speed-big">{sleepEnd ? 'End of episode' : sleepMin ? `${sleepMin} min` : 'Off'}</div>
        <input className="wide-range" type="range" min={0} max={MAX_SLEEP_MINUTES} step={5} value={sleepMin} onChange={e => startSleep(Number(e.target.value))} />
        <div className="chips-row">
          <button className={!sleepMin && !sleepEnd ? 'on' : ''} onClick={() => startSleep(0)}>Off</button>
          {[15, 30, 45, 60].map(m => <button key={m} className={sleepMin === m ? 'on' : ''} onClick={() => startSleep(m)}>{m} min</button>)}
          <button className={sleepEnd ? 'on' : ''} onClick={() => startSleep(0, true)}>End of episode</button>
        </div>
      </Sheet>}
      {tab === 'server' && <Sheet title="Server and quality" onClose={() => setTab(null)}>
        <SectionLabel>Server</SectionLabel>
        {streams?.map((s, i) => <SheetRow key={i} title={s.server || `Server ${i + 1}`} detail={s.quality ? `${s.quality}p` : s.type} selected={idx === i} onClick={() => { setIdx(i); setTab(null); }} />)}
        <SectionLabel>Quality</SectionLabel>
        <SheetRow title="Auto" selected={level === -1} onClick={() => { if (hls.current) hls.current.currentLevel = -1; setLevel(-1); setTab(null); }} />
        {levels.map((h, i) => ({h, i})).reverse().map(({h, i}) => <SheetRow key={i} title={h ? `${h}p` : `Level ${i + 1}`} selected={level === i} onClick={() => { if (hls.current) hls.current.currentLevel = i; setLevel(i); setTab(null); }} />)}
        {!levels.length && <div className="menu-empty">This source has a single quality.</div>}
      </Sheet>}
      {tab === 'resize' && <Sheet title="Video fit" wide onClose={() => setTab(null)}>
        {FIT_MODES.map(([v, l]) => <SheetRow key={v} title={l} selected={settings.resize === v} onClick={() => { updateSettings({resize: v}); setTab(null); }} />)}
      </Sheet>}
      {tab === 'volume' && <Sheet title="Volume" wide onClose={() => setTab(null)}>
        <div className="speed-big">{muted ? 'Muted' : `${Math.round(vol * 100)}%`}</div>
        <input className="wide-range" type="range" min={0} max={boostOk && settings.volumeBoost ? 2 : 1} step={0.02} value={vol} onChange={e => applyVolume(Number(e.target.value))} />
        {introMuted && !live && <div className="menu-empty">The first 5 seconds play without sound.</div>}
        {!boostOk && <div className="menu-empty">Volume boost works with streamed sources.</div>}
      </Sheet>}
      {tab === 'more' && <Sheet title="Settings" onClose={() => setTab(null)}>
        <SectionLabel>Playback</SectionLabel>
        <div className="srow"><span className="srow-t"><b>Auto play next episode</b></span><Toggle value={settings.autoPlayNext} onChange={v => updateSettings({autoPlayNext: v})} /></div>
        <div className="srow"><span className="srow-t"><b>Hide seek buttons</b></span><Toggle value={settings.hideSeek} onChange={v => updateSettings({hideSeek: v})} /></div>
        <div className="srow"><span className="srow-t"><b>Volume boost</b></span><Toggle value={settings.volumeBoost} onChange={v => updateSettings({volumeBoost: v})} /></div>
        <div className="srow"><span className="srow-t"><b>Ambient lighting</b></span><Toggle value={settings.ambient} onChange={v => updateSettings({ambient: v})} /></div>
        <SectionLabel>Control labels</SectionLabel>
        {(['full', 'short', 'hidden'] as const).map(v => <SheetRow key={v} title={v === 'full' ? 'Full labels' : v === 'short' ? 'Short labels' : 'Icons only'} selected={settings.ctlLabels === v} onClick={() => updateSettings({ctlLabels: v})} />)}
      </Sheet>}
      <input ref={fileInput} type="file" accept=".srt,.vtt,text/vtt" hidden onChange={e => e.target.files?.[0] && void subFromFile(e.target.files[0])} />

      {panel && q && (
        <aside className="ep-panel" onClick={e => e.stopPropagation()}>
          <div className="menu-title">Episodes</div>
          <div className="menu-list" style={{maxHeight: 'none'}}>
            {q.map((e, i) => <SheetRow key={e.link + i} title={`${i + 1}. ${e.title}`} selected={i === qi} onClick={() => goTo(i)} />)}
          </div>
        </aside>
      )}
    </div>
  );
}
