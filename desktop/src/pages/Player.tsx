import {useCallback, useEffect, useRef, useState} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import Hls from 'hls.js';
import {useServers} from '../store/servers';
import {providerApi} from '../provider/manager';
import type {Stream} from '../provider/types';
import {getProgress, setProgress} from '../lib/storage';
import {IconBack, IconBack10, IconFull, IconFwd10, IconPause, IconPlay, IconVolume} from '../components/Icons';

interface State { providerKey: string; link: string; type: string; title: string; back: string }

const fmt = (s: number) => {
  if (!isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(x).padStart(2, '0')}`;
};

export default function Player() {
  const st = useLocation().state as State | null;
  const nav = useNavigate();
  const {byKey} = useServers();
  const provider = st ? byKey(st.providerKey) : undefined;
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);

  const [streams, setStreams] = useState<Stream[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [vol, setVol] = useState(1);
  const [idle, setIdle] = useState(false);
  const [sub, setSub] = useState(-1);
  const idleTimer = useRef<number>();
  const progressId = st ? `${st.providerKey}|${st.link}` : '';

  const goBack = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    nav(st?.back ?? '/', {replace: true});
  }, [nav, st]);

  useEffect(() => {
    if (!provider || !st) return;
    let dead = false;
    setStreams(null); setError(''); setBusy(true);
    providerApi.streams(provider, st.link, st.type)
      .then(list => {
        if (dead) return;
        const ok = list.filter(s => s?.link);
        if (!ok.length) throw new Error('No playable source was found for this title');
        setStreams(ok); setIdx(0);
      })
      .catch(e => { if (!dead) { setError(e instanceof Error ? e.message : 'Could not get a stream'); setBusy(false); } });
    return () => { dead = true; };
  }, [provider, st]);

  const stream = streams?.[idx];
  useEffect(() => {
    const el = video.current;
    if (!el || !stream) return;
    setBusy(true); setError('');
    hls.current?.destroy();
    hls.current = null;
    const start = getProgress(progressId);
    const resume = () => { if (start && start.d - start.t > 20 && start.t > 5) el.currentTime = start.t; };
    const isHls = /m3u8/i.test(stream.type) || /\.m3u8(\?|$)/i.test(stream.link);
    if (isHls && Hls.isSupported()) {
      const h = new Hls({
        xhrSetup: xhr => {
          // Some headers (Referer, User-Agent) are forbidden in a web view and are ignored.
          for (const [k, v] of Object.entries(stream.headers ?? {})) { try { xhr.setRequestHeader(k, String(v)); } catch { /* ignore */ } }
        },
      });
      hls.current = h;
      h.loadSource(stream.link);
      h.attachMedia(el);
      h.on(Hls.Events.MANIFEST_PARSED, () => { resume(); el.play().catch(() => {}); });
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { setError('This source could not be played. Try another server from the menu.'); setBusy(false); } });
    } else {
      el.src = stream.link;
      el.addEventListener('loadedmetadata', resume, {once: true});
      el.play().catch(() => {});
    }
    return () => { hls.current?.destroy(); hls.current = null; };
  }, [stream, progressId]);

  const toggle = useCallback(() => { const v = video.current; if (v) v.paused ? v.play().catch(() => {}) : v.pause(); }, []);
  const seekBy = useCallback((d: number) => { const v = video.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); }, []);
  const fullscreen = useCallback(() => { document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen().catch(() => {}); }, []);
  const wake = useCallback(() => { setIdle(false); clearTimeout(idleTimer.current); idleTimer.current = window.setTimeout(() => setIdle(true), 2800); }, []);

  useEffect(() => {
    wake();
    const key = (e: KeyboardEvent) => {
      wake();
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') seekBy(10);
      else if (e.key === 'ArrowLeft') seekBy(-10);
      else if (e.key === 'ArrowUp') setVol(v => { const n = Math.min(1, v + 0.1); if (video.current) video.current.volume = n; return n; });
      else if (e.key === 'ArrowDown') setVol(v => { const n = Math.max(0, v - 0.1); if (video.current) video.current.volume = n; return n; });
      else if (e.key === 'f') fullscreen();
      else if (e.key === 'm') { if (video.current) video.current.muted = !video.current.muted; }
      else if (e.key === 'Escape' && !document.fullscreenElement) goBack();
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); clearTimeout(idleTimer.current); };
  }, [wake, toggle, seekBy, fullscreen, goBack]);

  useEffect(() => {
    const t = setInterval(() => { const v = video.current; if (v && v.duration && !v.paused) setProgress(progressId, v.currentTime, v.duration); }, 5000);
    return () => clearInterval(t);
  }, [progressId]);

  if (!st) return <Navigate to="/" replace />;

  const subs = stream?.subtitles ?? [];
  return (
    <div ref={wrap} className={`player${idle && playing ? ' idle' : ''}`} onMouseMove={wake} onDoubleClick={fullscreen}>
      <video
        ref={video}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBusy(true)}
        onPlaying={() => setBusy(false)}
        onCanPlay={() => setBusy(false)}
        onTimeUpdate={e => { setTime(e.currentTarget.currentTime); const b = e.currentTarget.buffered; if (b.length) setBuf(b.end(b.length - 1)); }}
        onDurationChange={e => setDur(e.currentTarget.duration)}
        onError={() => { if (stream && !/m3u8/i.test(stream.link)) { setError('This source could not be played. Try another server from the menu.'); setBusy(false); } }}
        crossOrigin="anonymous">
        {sub >= 0 && subs[sub] && <track key={subs[sub].uri} kind="subtitles" src={subs[sub].uri} srcLang={subs[sub].language} default />}
      </video>

      {busy && !error && <div className="center-msg"><div className="spin" /></div>}
      {error && (
        <div className="center-msg" style={{pointerEvents: 'auto'}}>
          <div><h2 className="title-l">Can’t play this</h2><p className="muted" style={{maxWidth: 420}}>{error}</p>
            <button className="btn glass press" onClick={goBack}>Go back</button></div>
        </div>
      )}

      <div className="pl-top">
        <button className="round press" onClick={goBack} aria-label="Back"><IconBack /></button>
        <div style={{fontWeight: 650, fontSize: 17, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{st.title}</div>
        {streams && streams.length > 1 && (
          <select className="select" value={idx} onChange={e => setIdx(Number(e.target.value))}>
            {streams.map((s, i) => <option key={i} value={i}>{s.server}{s.quality ? ` · ${s.quality}p` : ''}</option>)}
          </select>
        )}
        {subs.length > 0 && (
          <select className="select" value={sub} onChange={e => setSub(Number(e.target.value))}>
            <option value={-1}>Subtitles off</option>
            {subs.map((s, i) => <option key={i} value={i}>{s.title}</option>)}
          </select>
        )}
      </div>

      <div className="pl-bot">
        <div className="ctrl">
          <span className="time">{fmt(time)}</span>
          <div className="bar" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (video.current && dur) video.current.currentTime = ((e.clientX - r.left) / r.width) * dur; }}>
            <div className="buf" style={{width: `${dur ? (buf / dur) * 100 : 0}%`}} />
            <div className="fill" style={{width: `${dur ? (time / dur) * 100 : 0}%`}} />
          </div>
          <span className="time" style={{textAlign: 'right'}}>{fmt(dur)}</span>
        </div>
        <div className="ctrl">
          <button className="round press" onClick={() => seekBy(-10)} aria-label="Back 10 seconds"><IconBack10 /></button>
          <button className="round big press" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <IconPause /> : <IconPlay />}</button>
          <button className="round press" onClick={() => seekBy(10)} aria-label="Forward 10 seconds"><IconFwd10 /></button>
          <div style={{flex: 1}} />
          <IconVolumeWrap />
          <input className="vol" type="range" min={0} max={1} step={0.02} value={vol} onChange={e => { const n = Number(e.target.value); setVol(n); if (video.current) video.current.volume = n; }} />
          <button className="round press" onClick={fullscreen} aria-label="Full screen"><IconFull /></button>
        </div>
      </div>
    </div>
  );
}

const IconVolumeWrap = () => <span style={{width: 22, height: 22, display: 'inline-flex'}}><IconVolume /></span>;
