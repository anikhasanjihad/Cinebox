import {useEffect, useRef, type ReactNode} from 'react';

const Svg = ({children}: {children: ReactNode}) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>);
// Same set of controls and icons as the phone player (Material Community names in brackets).
export const ICON: Record<string, ReactNode> = {
  audio: <Svg><path d="M4 12v0M8 8v8M12 4v16M16 8v8M20 12v0" /></Svg>,                     // waveform
  subtitle: <Svg><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 11h3M13 11h4M7 15h5M15 15h2" /></Svg>, // subtitles-outline
  speed: <Svg><path d="M12 13.5 16 9" /><path d="M3.6 17a9 9 0 1 1 16.8 0" /><circle cx="12" cy="13.5" r="1" fill="currentColor" /></Svg>, // speedometer
  pip: <Svg><rect x="3" y="5" width="18" height="14" rx="3" /><rect x="12" y="12" width="6" height="4" rx="1" /></Svg>, // picture-in-picture-bottom-right-outline
  server: <Svg><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="1.7" fill="currentColor" /><circle cx="15" cy="12" r="1.7" fill="currentColor" /><circle cx="8" cy="17" r="1.7" fill="currentColor" /></Svg>,
  resize: <Svg><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /><rect x="8" y="9" width="8" height="6" rx="1" /></Svg>, // fit-to-screen-outline
  episodes: <Svg><path d="M4 6h12M4 11h12M4 16h8" /><path d="m16 14 5 3-5 3z" fill="currentColor" /></Svg>, // playlist-play
  next: <Svg><path d="M6 5l9 7-9 7z" /><path d="M18 5v14" /></Svg>, // skip-next-outline
  settings: <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>, // cog-outline
  sleep: <Svg><path d="M12 3v8" /><path d="M7.5 6.5a8 8 0 1 0 9 0" /></Svg>, // power-sleep
  lock: <Svg><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></Svg>, // lock-open-outline
  unlock: <Svg><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></Svg>,
  volume: <Svg><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></Svg>,
  mute: <Svg><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m16 9 5 6M21 9l-5 6" /></Svg>,
  cast: <Svg><path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /><path d="M3 12a8 8 0 0 1 8 8M3 16a4 4 0 0 1 4 4" /><circle cx="3.5" cy="20" r="1" fill="currentColor" /></Svg>, // cast
  decoder: <Svg><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></Svg>, // chip
  party: <Svg><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2a5 5 0 0 1 5 5.3" /></Svg>, // account-group
  check: <Svg><path d="m5 12 5 5 9-10" /></Svg>,
};

/** Bottom sheet exactly like the phone player: slides up, dark, rounded top, centred title. */
export const Sheet = ({title, wide, onClose, children}: {title: string; wide?: boolean; onClose: () => void; children: ReactNode}) => (
  <div className="sheet-back" onClick={e => { e.stopPropagation(); onClose(); }}>
    <div className={`sheet${wide ? ' wide' : ''}`} onClick={e => e.stopPropagation()}>
      <div className="sheet-title">{title}</div>
      <div className="sheet-body">{children}</div>
    </div>
  </div>
);

export const SheetRow = ({title, detail, selected, onClick, icon}: {title: string; detail?: string; selected?: boolean; onClick: () => void; icon?: ReactNode}) => (
  <button className={`srow press${selected ? ' on' : ''}`} onClick={onClick}>
    {icon && <span className="srow-ic">{icon}</span>}
    <span className="srow-t"><b>{title}</b>{detail && <i>{detail}</i>}</span>
    {selected && <span className="srow-ck">{ICON.check}</span>}
  </button>
);

export const SectionLabel = ({children}: {children: ReactNode}) => <div className="sheet-sec">{children}</div>;

/** Delay stepper: 0.05 s per press, holding repeats faster (same as the phone). */
export const DelayControl = ({title, later, earlier, ms, onChange, minMs = -10000, maxMs = 10000}: {title: string; later: string; earlier: string; ms: number; onChange: (v: number) => void; minMs?: number; maxMs?: number}) => {
  const timer = useRef<number>();
  const msRef = useRef(ms);
  msRef.current = ms;
  const stop = () => { window.clearInterval(timer.current); };
  useEffect(() => stop, []);
  const hold = (dir: 1 | -1) => {
    let count = 0;
    const step = () => {
      count += 1;
      const amount = count > 20 ? 250 : count > 8 ? 100 : 50;
      onChange(Math.max(minMs, Math.min(maxMs, msRef.current + dir * amount)));
    };
    step();
    stop();
    timer.current = window.setInterval(step, 120);
  };
  return (
    <div className="delay-ctl">
      <div className="delay-info">
        <b>{title}</b>
        <i>{ms === 0 ? 'In sync' : ms > 0 ? later : earlier}</i>
      </div>
      <button className="round press" disabled={ms <= minMs} onMouseDown={() => hold(-1)} onMouseUp={stop} onMouseLeave={stop}>−</button>
      <button className="delay-val" onClick={() => onChange(0)} title="Reset">{ms > 0 ? '+' : ''}{(ms / 1000).toFixed(2)}s</button>
      <button className="round press" disabled={ms >= maxMs} onMouseDown={() => hold(1)} onMouseUp={stop} onMouseLeave={stop}>+</button>
    </div>
  );
};
