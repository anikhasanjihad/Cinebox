import {useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {useAuth} from '../store/auth';
import {useServers} from '../store/servers';
import {DEFAULTS, SUB_FONTS, updateSettings, useSettings} from '../lib/settings';
import {fetchManifestProviders} from '../provider/manager';
import {fetchLiveSources, LIVE_KEY} from './LiveTv';
import {Cell, Group, Page, Pick, Range, Toggle} from '../components/Controls';
import {PLAYBACK_SPEEDS, PLAYER_CONTROLS} from './Player';
import WatchTogether from './WatchTogether';

const ACCENTS = ['#FFFFFF', '#FF6347', '#9E9E9E', '#2196F3', '#B2A4D4']; // same choices as the mobile app (White, Tomato, Gray, Blue, Lavender)
const AVATARS = ['#E50914', '#F5A623', '#46D369', '#00B8A9', '#2D9CDB', '#9B51E0', '#EB5757', '#8A8A8A'];
const CHEVRON = <span className="muted" style={{fontSize: 20}}>›</span>;

interface Profile { display_name: string | null; role: string; avatar_color?: string | null }
const useProfile = () => {
  const {session} = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const uid = session?.user.id;
  const reload = () => { if (uid) supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({data}) => setProfile(data as Profile | null)); };
  useEffect(reload, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  return {profile, reload, uid};
};
const Avatar = ({name, color, size = 44}: {name: string; color?: string | null; size?: number}) => (
  <span style={{width: size, height: size, borderRadius: '50%', background: color || '#E50914', display: 'inline-grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.42}}>{(name || '?').charAt(0).toUpperCase()}</span>
);

export default function Settings() {
  const {section} = useParams();
  const nav = useNavigate();
  const back = () => nav('/settings');
  if (section) {
    const P = {account: Account, appearance: Appearance, player: PlayerSettings, subtitles: Subtitles, controls: Controls, preferences: Preferences, about: About, admin: Admin, party: WatchTogether}[section];
    if (P) return <P back={back} />;
  }
  return <Index />;
}

function Index() {
  const nav = useNavigate();
  const {session} = useAuth();
  const {profile} = useProfile();
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const go = (s: string) => () => nav(`/settings/${s}`);
  const name = profile?.display_name || session?.user.email?.split('@')[0] || 'Profile';

  const clearCache = () => {
    Object.keys(localStorage).filter(k => k.startsWith('kv:') || k === 'providers-cache' || k.startsWith('live-tv')).forEach(k => localStorage.removeItem(k));
    setMsg('Cache cleared.');
  };
  const exportBackup = () => {
    const data: Record<string, unknown> = {};
    BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) data[k] = JSON.parse(v); });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({app: 'cinehub-desktop', version: 1, data}, null, 2)], {type: 'application/json'}));
    a.download = `cinehub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    setMsg('Backup saved to your Downloads folder.');
  };
  const importBackup = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      if ((j?.app !== 'cinehub-desktop' && j?.app !== 'cinebox-desktop') || typeof j.data !== 'object') throw new Error('This is not a CineHub desktop backup');
      if (!confirm('Restore backup? This replaces your settings, library and progress on this computer.')) return;
      BACKUP_KEYS.forEach(k => { if (k in j.data) localStorage.setItem(k, JSON.stringify(j.data[k])); });
      setMsg('Backup restored. Restarting…'); setTimeout(() => location.reload(), 700);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not restore backup'); }
  };
  const erase = () => {
    if (!confirm('Erase all local data? Library, progress, downloads list and settings on this computer will be removed.')) return;
    const keep: Record<string, string> = {};
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => { keep[k] = localStorage.getItem(k)!; });
    localStorage.clear(); Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v)); location.reload();
  };

  return (
    <Page title="Settings">
      <Group>
        <Cell label={name} hint={session?.user.email} onClick={go('account')}><Avatar name={name} color={profile?.avatar_color} />{CHEVRON}</Cell>
        {profile?.role === 'admin' && <Cell label="Admin Panel" hint="Add and manage servers" onClick={go('admin')}>{CHEVRON}</Cell>}
      </Group>
      <Group>
        <Cell label="Watch Together" hint="Watch in sync with friends" onClick={go('party')}>{CHEVRON}</Cell>
        <Cell label="Appearance" onClick={go('appearance')}>{CHEVRON}</Cell>
        <Cell label="Player settings" onClick={go('player')}>{CHEVRON}</Cell>
        <Cell label="Downloads" onClick={() => nav('/downloads')}>{CHEVRON}</Cell>
        <Cell label="Preferences" onClick={go('preferences')}>{CHEVRON}</Cell>
      </Group>
      <Group title="Data management">
        <Cell label="Clear Cache" hint="Clear temporary cache and images" onClick={clearCache} />
        <Cell label="Export backup" hint="Save settings, providers and library to a file" onClick={exportBackup} />
        <Cell label="Import backup" hint="Restore settings, providers and library from a file" onClick={() => file.current?.click()} />
        <Cell label="Erase all local data" hint="Erase all local data" danger onClick={erase} />
      </Group>
      <input ref={file} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && void importBackup(e.target.files[0])} />
      {msg && <p className="muted" style={{marginTop: -12}}>{msg}</p>}
      <Group title="About"><Cell label="About CineHub" onClick={go('about')}>{CHEVRON}</Cell></Group>
    </Page>
  );
}

const Account = ({back}: {back: () => void}) => {
  const {session} = useAuth();
  const {profile, reload, uid} = useProfile();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => setName(profile?.display_name ?? ''), [profile]);
  const save = async (patch: Record<string, unknown>) => {
    const {error} = await supabase.from('profiles').update(patch).eq('id', uid!);
    setMsg(error ? error.message : 'Saved'); reload();
  };
  return (
    <Page title="Profile" back={back}>
      <div style={{textAlign: 'center', marginBottom: 24}}><Avatar name={name || session?.user.email || ''} color={profile?.avatar_color} size={92} /></div>
      <Group title="Avatar colour"><div className="cell" style={{justifyContent: 'center', flexWrap: 'wrap'}}>
        {AVATARS.map(c => <button key={c} aria-label={c} className={`swatch${profile?.avatar_color === c ? ' on' : ''}`} style={{background: c}} onClick={() => void save({avatar_color: c})} />)}
      </div></Group>
      <Group>
        <Cell label="Email">{<span className="muted">{session?.user.email}</span>}</Cell>
        <Cell label="Display name"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /><button className="btn glass press" style={{height: 38, padding: '0 16px'}} onClick={() => void save({display_name: name.trim()})}>Save</button></Cell>
      </Group>
      {msg && <p className="muted">{msg}</p>}
      <Group><Cell label="Sign out" danger onClick={() => { if (confirm('Sign out?')) void supabase.auth.signOut(); }} /></Group>
    </Page>
  );
};

const Appearance = ({back}: {back: () => void}) => {
  const s = useSettings();
  return (
    <Page title="Appearance" back={back}>
      <Group title="Accent colour">
        <Cell label="Colour">{ACCENTS.map(c => <button key={c} aria-label={c} className={`swatch${s.accent === c ? ' on' : ''}`} style={{background: c}} onClick={() => updateSettings({accent: c})} />)}</Cell>
      </Group>
      <Group title="Motion"><Cell label="Reduce motion" hint="Turns off most animations"><Toggle value={s.reduceMotion} onChange={v => updateSettings({reduceMotion: v})} /></Cell></Group>
    </Page>
  );
};

const PlayerSettings = ({back}: {back: () => void}) => {
  const s = useSettings();
  const nav = useNavigate();
  return (
    <Page title="Player settings" back={back}>
      <Group title="Playback">
        <Cell label="Ask for local file first" hint="Before loading online streams, offer to play a video file from this computer"><Toggle value={s.askLocal} onChange={v => updateSettings({askLocal: v})} /></Cell>
        <Cell label="Notification media controls" hint="Use keyboard media keys and system media controls"><Toggle value={s.mediaKeys} onChange={v => updateSettings({mediaKeys: v})} /></Cell>
        <Cell label="Hide seek buttons"><Toggle value={s.hideSeek} onChange={v => updateSettings({hideSeek: v})} /></Cell>
        <Cell label="Seek interval" hint="Used by double click, seek buttons and arrow keys"><Pick value={s.seekInterval} onChange={v => updateSettings({seekInterval: v})} options={[[5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds']]} /></Cell>
        <Cell label="Auto play next episode" hint="Start the next episode after a short countdown"><Toggle value={s.autoPlayNext} onChange={v => updateSettings({autoPlayNext: v})} /></Cell>
        <Cell label="Swipe gestures" hint="Mouse wheel changes volume, double click skips and toggles full screen"><Toggle value={s.mouseGestures} onChange={v => updateSettings({mouseGestures: v})} /></Cell>
        <Cell label="Volume boost" hint="Allow volume up to 200% on streamed sources"><Toggle value={s.volumeBoost} onChange={v => updateSettings({volumeBoost: v})} /></Cell>
      </Group>
      <Group title="Picture and sound">
        <Cell label="Default video fit"><Pick value={s.resize} onChange={v => updateSettings({resize: v})} options={[['none', 'Fit'], ['cover', 'Cover'], ['stretch', 'Stretch'], ['contain', 'Contain']]} /></Cell>
        <Cell label="Default playback speed"><Pick value={s.playbackSpeed} onChange={v => updateSettings({playbackSpeed: v})} options={PLAYBACK_SPEEDS.map(x => [x, `${x}x`] as [number, string])} /></Cell>
        <Cell label="Resume where you left off"><Toggle value={s.rememberPosition} onChange={v => updateSettings({rememberPosition: v})} /></Cell>
        <Cell label="Ambient lighting" hint="A soft glow from the video colours"><Toggle value={s.ambient} onChange={v => updateSettings({ambient: v})} /></Cell>
      </Group>
      <Group>
        <Cell label="Player controls" hint="Choose, label and arrange the player buttons" onClick={() => nav('/settings/controls')}>{CHEVRON}</Cell>
        <Cell label="Subtitle style" onClick={() => nav('/settings/subtitles')}>{CHEVRON}</Cell>
      </Group>
      <p className="muted" style={{fontSize: 13}}>Shortcuts: Space play/pause · ← → seek · ↑ ↓ volume · F full screen · M mute · N next episode</p>
    </Page>
  );
};

const Controls = ({back}: {back: () => void}) => {
  const s = useSettings();
  const reset = () => updateSettings({hiddenControls: [], ctlLabels: 'full', ctlAlign: 'distributed', ctlBg: 0, ctlScale: 1, seekbarScale: 1, titleBg: false});
  return (
    <Page title="Player controls" back={back}>
      <Group title="Buttons">
        {PLAYER_CONTROLS.map(([id, label]) => (
          <Cell key={id} label={label}><Toggle value={!s.hiddenControls.includes(id)} onChange={on => updateSettings({hiddenControls: on ? s.hiddenControls.filter(x => x !== id) : [...s.hiddenControls, id]})} /></Cell>
        ))}
      </Group>
      <Group title="Appearance">
        <Cell label="Labels"><Pick value={s.ctlLabels} onChange={v => updateSettings({ctlLabels: v})} options={[['full', 'Full'], ['short', 'Short'], ['hidden', 'Icons only']]} /></Cell>
        <Cell label="Alignment"><Pick value={s.ctlAlign} onChange={v => updateSettings({ctlAlign: v})} options={[['distributed', 'Distributed'], ['center', 'Center'], ['left', 'Left'], ['right', 'Right']]} /></Cell>
        <Cell label="Background opacity"><Range value={s.ctlBg} min={0} max={1} step={0.1} fmt={v => `${Math.round(v * 100)}%`} onChange={v => updateSettings({ctlBg: v})} /></Cell>
        <Cell label="Control size"><Range value={s.ctlScale} min={0.8} max={1.4} step={0.1} fmt={v => `${v.toFixed(1)}x`} onChange={v => updateSettings({ctlScale: v})} /></Cell>
        <Cell label="Seek bar size"><Range value={s.seekbarScale} min={0.8} max={2} step={0.2} fmt={v => `${v.toFixed(1)}x`} onChange={v => updateSettings({seekbarScale: v})} /></Cell>
        <Cell label="Title background"><Toggle value={s.titleBg} onChange={v => updateSettings({titleBg: v})} /></Cell>
        <Cell label="Reset to defaults" onClick={reset} />
      </Group>
    </Page>
  );
};

const Subtitles = ({back}: {back: () => void}) => {
  const s = useSettings();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <Page title="Subtitle style" back={back}>
      <div className="sub-preview"><span>Subtitles will look like this</span></div>
      <Group>
        <Cell label="Font size" hint="Size in scaled pixels"><Range value={s.subSize} min={10} max={36} step={1} onChange={v => updateSettings({subSize: v})} /></Cell>
        <Cell label="Font style"><Pick value={s.subFont} onChange={v => updateSettings({subFont: v})} options={SUB_FONTS} /></Cell>
        <Cell label="Text color"><Pick value={s.subColor} onChange={v => updateSettings({subColor: v})} options={[['#ffffff', 'White'], ['#ffd60a', 'Yellow'], ['#30d158', 'Green'], ['#64d2ff', 'Cyan'], ['#ff6b73', 'Red'], ['#e5e5e5', 'Light gray']]} /></Cell>
        <Cell label="Edge & shadow effect"><Pick value={s.subEdge} onChange={v => updateSettings({subEdge: v})} options={[['outline', 'Outline — crisp border around text'], ['shadow', 'Shadow — soft shadow beneath text'], ['raised', 'Raised — embossed highlight'], ['depressed', 'Depressed — inset bevel'], ['none', 'None — flat text']]} /></Cell>
        <Cell label="Outline & shadow color"><Pick value={s.subEdgeColor} onChange={v => updateSettings({subEdgeColor: v})} options={[['#000000', 'Black'], ['#ffffff', 'White'], ['#ff0000', 'Red'], ['#0a84ff', 'Blue']]} /></Cell>
        <Cell label="Outline & shadow size" hint="Border and shadow thickness"><Range value={s.subEdgeSize} min={0} max={6} step={1} fmt={v => `${v}px`} onChange={v => updateSettings({subEdgeSize: v})} /></Cell>
        <Cell label="Text opacity" hint="Opacity of subtitle text and its outline"><Range value={s.subOpacity} min={0.2} max={1} step={0.1} fmt={pct} onChange={v => updateSettings({subOpacity: v})} /></Cell>
        <Cell label="Background opacity" hint="Opacity of subtitle background box"><Range value={s.subBg} min={0} max={1} step={0.1} fmt={pct} onChange={v => updateSettings({subBg: v})} /></Cell>
        <Cell label="Bottom elevation" hint="Distance from the bottom"><Range value={s.subBottom} min={0} max={40} step={1} onChange={v => updateSettings({subBottom: v})} /></Cell>
        <Cell label="Reset to defaults" hint="Font 16, White, Outline 2px, 100% text and background opacity, Elevation 10" onClick={() => updateSettings({subSize: DEFAULTS.subSize, subFont: DEFAULTS.subFont, subColor: DEFAULTS.subColor, subEdge: DEFAULTS.subEdge, subEdgeColor: DEFAULTS.subEdgeColor, subEdgeSize: DEFAULTS.subEdgeSize, subOpacity: DEFAULTS.subOpacity, subBg: DEFAULTS.subBg, subBottom: DEFAULTS.subBottom})} />
      </Group>
    </Page>
  );
};

const Preferences = ({back}: {back: () => void}) => {
  const s = useSettings();
  return (
    <Page title="Preferences" back={back}>
      <Group>
        <Cell label="Tab bar labels" hint="Show destination names below navigation icons"><Toggle value={s.sidebarLabels} onChange={v => updateSettings({sidebarLabels: v})} /></Cell>
        <Cell label="Hide downloads tab"><Toggle value={s.hideDownloads} onChange={v => updateSettings({hideDownloads: v})} /></Cell>
        <Cell label="Continue watching" hint="Show the Continue watching row on Home. Playback positions are still saved."><Toggle value={s.showContinue} onChange={v => updateSettings({showContinue: v})} /></Cell>
        <div style={{opacity: 0.45}}><Cell label="Skip in-app webview" hint="Web links always open in your default browser on desktop"><Toggle value={true} onChange={() => {}} /></Cell></div>
        <Cell label="Usage and crash reports" hint="CineHub Desktop does not collect diagnostics"><Toggle value={s.telemetry} onChange={v => updateSettings({telemetry: v})} /></Cell>
      </Group>
    </Page>
  );
};

const BACKUP_KEYS = ['library', 'progress', 'settings', 'active-provider', 'downloads', 'continue'];

const About = ({back}: {back: () => void}) => (
  <Page title="About" back={back}>
    <div style={{textAlign: 'center', padding: '10px 0 30px'}}>
      <img src="/logo.png" width={84} height={84} style={{borderRadius: 22, boxShadow: '0 12px 40px rgba(255,69,58,.35)'}} alt="" />
      <h2 className="title-l" style={{marginTop: 16}}>CineHub Desktop</h2>
      <p className="muted">Version 1.0.0</p>
    </div>
    <Group>
      <Cell label="Platform">{<span className="muted">{navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Desktop'}</span>}</Cell>
      <Cell label="Downloads folder">{<span className="muted">Downloads/CineHub</span>}</Cell>
    </Group>
  </Page>
);

interface AdminServer { id: string; label: string; source_url: string; manifest_url: string | null; provider_value: string | null; logo_url: string | null; position: number; enabled: boolean; hidden_providers?: string[] | null }
const blank = (): Partial<AdminServer> => ({label: '', source_url: '', manifest_url: '', provider_value: '', logo_url: '', enabled: true});

const Admin = ({back}: {back: () => void}) => {
  const {profile} = useProfile();
  const {reload: reloadServers} = useServers();
  const [servers, setServers] = useState<AdminServer[]>([]);
  const [edit, setEdit] = useState<Partial<AdminServer> | null>(null);
  const [live, setLive] = useState<Array<{id: string; label: string; url: string}>>([]);
  const [msg, setMsg] = useState('');
  const [provs, setProvs] = useState<Array<{value: string; name: string; type: string}> | null>(null);

  const load = () => {
    supabase.from('cinehub_servers').select('*').order('position', {ascending: true}).order('created_at', {ascending: true}).then(({data}) => setServers((data ?? []) as AdminServer[]));
    fetchLiveSources().then(setLive).catch(() => {});
  };
  useEffect(load, []);
  useEffect(() => {
    setProvs(null);
    if (edit?.source_url?.trim() && edit.id) fetchManifestProviders({source_url: edit.source_url, manifest_url: edit.manifest_url}).then(setProvs).catch(() => setProvs([]));
  }, [edit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (profile && profile.role !== 'admin') return <Page title="Admin Panel" back={back}><p className="muted">Only admins can open this.</p></Page>;

  const saveServer = async () => {
    if (!edit?.label?.trim() || !edit.source_url?.trim()) { setMsg('Name and source link are required'); return; }
    const row: Record<string, unknown> = {
      label: edit.label.trim(), source_url: edit.source_url.trim(), enabled: edit.enabled ?? true,
      manifest_url: edit.manifest_url?.trim() || null, provider_value: edit.provider_value?.trim() || null,
      hidden_providers: edit.hidden_providers ?? [],
    };
    if (edit.logo_url?.trim()) row.logo_url = edit.logo_url.trim(); else if (edit.id) row.logo_url = null;
    if (!edit.id) row.position = servers.length;
    const q = edit.id ? supabase.from('cinehub_servers').update(row).eq('id', edit.id) : supabase.from('cinehub_servers').insert(row);
    const {error} = await q;
    if (error) { setMsg(/logo_url/.test(error.message) ? `${error.message}. Run supabase/RUN_THIS_ONCE.sql once.` : error.message); return; }
    setEdit(null); setMsg('Saved'); load(); reloadServers();
  };
  const delServer = async (s: AdminServer) => {
    if (!confirm(`Delete server “${s.label}”?`)) return;
    const {error} = await supabase.from('cinehub_servers').delete().eq('id', s.id);
    setMsg(error ? error.message : 'Deleted'); load(); reloadServers();
  };
  const saveLive = async () => {
    const clean = live.map(s => ({id: s.id, label: s.label.trim(), url: s.url.trim()})).filter(s => s.url);
    const {error} = await supabase.from('app_settings').upsert({key: LIVE_KEY, value: JSON.stringify(clean)}, {onConflict: 'key'});
    setMsg(error ? error.message : 'Live TV links saved');
  };

  const f = (k: keyof AdminServer, ph: string) => (
    <input className="input" style={{flex: 1, width: 320}} placeholder={ph} value={String(edit?.[k] ?? '')} onChange={e => setEdit({...edit, [k]: e.target.value})} />
  );

  return (
    <Page title="Admin Panel" back={back}>
      {msg && <p className="ok">{msg}</p>}
      <Group title="Servers" footer="Each server is a provider source. The logo shows on the Home Servers row.">
        {servers.map(s => (
          <Cell key={s.id} label={s.label} hint={s.enabled ? s.source_url : `Disabled · ${s.source_url}`}>
            <button className="btn glass press" style={{height: 36, padding: '0 14px'}} onClick={() => setEdit(s)}>Edit</button>
            <button className="btn glass press" style={{height: 36, padding: '0 14px', color: 'var(--accent)'}} onClick={() => delServer(s)}>Delete</button>
          </Cell>
        ))}
        <Cell label="Add server" onClick={() => setEdit(blank())}><span className="muted" style={{fontSize: 20}}>+</span></Cell>
      </Group>
      {edit && (
        <Group title={edit.id ? 'Edit server' : 'New server'}>
          <Cell label="Name">{f('label', 'Server name')}</Cell>
          <Cell label="Source link">{f('source_url', 'https://github.com/…')}</Cell>
          <Cell label="Logo URL">{f('logo_url', 'https://…/logo.png')}</Cell>
          <Cell label="Manifest URL" hint="Optional">{f('manifest_url', '')}</Cell>
          <Cell label="Provider value" hint="Optional: use only this provider">{f('provider_value', '')}</Cell>
          <Cell label="Enabled"><Toggle value={edit.enabled ?? true} onChange={v => setEdit({...edit, enabled: v})} /></Cell>
          {edit.id && (
            <>
              <div className="group-title" style={{padding: '14px 20px 6px'}}>Disable providers</div>
              {provs === null && <div className="menu-empty">Loading providers…</div>}
              {provs?.length === 0 && <div className="menu-empty">No providers found for this source.</div>}
              {provs?.map(p => (
                <Cell key={p.value} label={p.name} hint={p.type || undefined}>
                  <Toggle value={!(edit.hidden_providers ?? []).includes(p.value)} onChange={on => { const cur = edit.hidden_providers ?? []; setEdit({...edit, hidden_providers: on ? cur.filter(x => x !== p.value) : [...cur, p.value]}); }} />
                </Cell>
              ))}
            </>
          )}
          <Cell label=""><button className="btn glass press" style={{height: 38}} onClick={() => setEdit(null)}>Cancel</button><button className="btn accent press" style={{height: 38}} onClick={saveServer}>Save</button></Cell>
        </Group>
      )}
      <Group title="Live TV links" footer="JSON or M3U links. Every signed-in user sees these channels.">
        {live.map((s, i) => (
          <Cell key={s.id} label="">
            <input className="input" placeholder="Label" style={{width: 130}} value={s.label} onChange={e => setLive(live.map((x, j) => (j === i ? {...x, label: e.target.value} : x)))} />
            <input className="input" placeholder="https://…" style={{width: 280}} value={s.url} onChange={e => setLive(live.map((x, j) => (j === i ? {...x, url: e.target.value} : x)))} />
            <button className="btn glass press" style={{height: 36, padding: '0 12px'}} onClick={() => setLive(live.filter((_, j) => j !== i))}>✕</button>
          </Cell>
        ))}
        <Cell label="Add link" onClick={() => setLive([...live, {id: `src${Date.now()}`, label: '', url: ''}])}><span className="muted" style={{fontSize: 20}}>+</span></Cell>
        <Cell label=""><button className="btn accent press" style={{height: 38}} onClick={saveLive}>Save links</button></Cell>
      </Group>
    </Page>
  );
};
