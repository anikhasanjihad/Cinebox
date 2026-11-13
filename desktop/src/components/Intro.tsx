import {useEffect, useState} from 'react';

/** Same timing as the mobile app's CinematicIntro (src/screens/auth/CinematicIntro.tsx). */
export const INTRO_MS = 1500;
const TITLE = 'CINEHUB';

/**
 * Netflix-style "ta-dum" opening: a red light pulse, the mark slams in, the
 * letters drop one by one, a red streak sweeps under the name, then the whole
 * thing zooms through into the app. Plays on every launch.
 */
export default function Intro() {
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), INTRO_MS); return () => clearTimeout(t); }, []);
  if (gone) return null;
  return (
    <div className="intro">
      <div className="intro-flash" />
      <div className="intro-wrap">
        <div className="intro-ring" />
        <div className="intro-ring r2" />
        <img className="intro-mark" src="/logo.png" alt="" />
        <div className="intro-title" aria-label="CineHub">
          {TITLE.split('').map((ch, i) => (
            <span key={i} className={i >= 4 ? 'red' : ''} style={{animationDelay: `${420 + i * 55}ms`}}>{ch}</span>
          ))}
        </div>
        <div className="intro-streak" />
      </div>
    </div>
  );
}
