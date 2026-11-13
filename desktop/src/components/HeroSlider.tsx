import {useCallback, useEffect, useRef, useState} from 'react';
import type {Post} from '../provider/types';
import {IconPlay} from './Icons';

const AUTO_MS = 7000;
const SWIPE_PX = 60;

/**
 * Hero banner that slides between titles: auto-advances, pauses on hover, and can be
 * dragged, clicked (arrows / dots) or stepped with the keyboard. Slides always move the
 * short way round, so going from the last title to the first never rewinds across the page.
 */
export default function HeroSlider({posts, label, onOpen}: {posts: Post[]; label?: string; onOpen: (p: Post) => void}) {
  // Two slides would have to jump over each other, so they are doubled.
  const slides = posts.length === 2 ? [...posts, ...posts] : posts;
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const prevIndex = useRef(0);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [dx, setDx] = useState<number | null>(null);
  const start = useRef<number | null>(null);
  const firstLink = posts[0]?.link;

  useEffect(() => { setIndex(0); prevIndex.current = 0; }, [firstLink]);
  useEffect(() => { prevIndex.current = index; });
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const go = useCallback((d: 1 | -1) => setIndex(i => (i + d + n) % n), [n]);
  const running = n > 1 && !hover && !hidden && dx === null;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(1), AUTO_MS);
    return () => clearTimeout(t);
  }, [running, index, go]);

  if (n === 0) return null;
  const half = Math.floor(n / 2);
  const offset = (i: number, c: number) => ((i - c + n + half) % n) - half;
  const active = index % n;

  const down = (e: React.PointerEvent) => {
    if (n < 2 || (e.target as HTMLElement).closest('button')) return;
    start.current = e.clientX; setDx(0);
  };
  const move = (e: React.PointerEvent) => { if (start.current != null) setDx(e.clientX - start.current); };
  const up = () => {
    if (start.current == null) return;
    const d = dx ?? 0;
    start.current = null; setDx(null);
    if (Math.abs(d) > SWIPE_PX) go(d < 0 ? 1 : -1);
  };

  return (
    <header className="hero" role="region" aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); up(); }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="hero-track">
        {slides.map((p, i) => {
          const off = offset(i, index);
          const jumped = Math.abs(off - offset(i, prevIndex.current)) > 1;
          const dragging = dx !== null;
          return (
            <div key={i} className={`hero-slide${i === index ? ' active' : ''}`} aria-hidden={i !== index}
              style={{transform: `translate3d(calc(${off * 100}% + ${dragging ? dx : 0}px), 0, 0)`, transition: jumped || dragging ? 'none' : undefined}}>
              <div className="hero-bg" style={{backgroundImage: `url("${p.image}")`}} />
              <div className="hero-body">
                <div className="muted" style={{fontWeight: 600, marginBottom: 8}}>{label}</div>
                <h1 className="title-xl">{p.title}</h1>
                <div style={{display: 'flex', gap: 12, marginTop: 22}}>
                  <button className="btn primary press" tabIndex={i === index ? 0 : -1} onClick={() => onOpen(p)}><IconPlay /> Play</button>
                  <button className="btn glass press" tabIndex={i === index ? 0 : -1} onClick={() => onOpen(p)}>More info</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <>
          <button className="hero-nav left" aria-label="Previous" onClick={() => go(-1)}>‹</button>
          <button className="hero-nav right" aria-label="Next" onClick={() => go(1)}>›</button>
          <div className="hero-dots">
            {posts.map((_, i) => {
              const on = i === active % posts.length;
              return (
                <button key={i} className={`hero-dot${on ? ' on' : ''}`} aria-label={`Show title ${i + 1}`} onClick={() => setIndex(i)}>
                  {on && running && <i key={index} style={{animationDuration: `${AUTO_MS}ms`}} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </header>
  );
}
