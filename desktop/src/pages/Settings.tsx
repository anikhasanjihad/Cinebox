import {supabase} from '../lib/supabase';
import {useAuth} from '../store/auth';
import {useServers} from '../store/servers';

export default function Settings() {
  const {session} = useAuth();
  const {providers, active, reload} = useServers();
  return (
    <div className="page">
      <div style={{padding: '48px 40px 24px'}}><h1 className="title-xl">Settings</h1></div>
      <div className="group">
        <div className="cell"><span>Account</span><span className="muted">{session?.user.email}</span></div>
        <div className="cell"><span>Active server</span><span className="muted">{active?.name ?? '—'}</span></div>
        <div className="cell"><span>Servers available</span><span className="muted">{providers.length}</span></div>
      </div>
      <div className="group">
        <button className="cell press" style={{width: '100%'}} onClick={reload}><span>Refresh servers</span></button>
        <button className="cell press" style={{width: '100%', color: 'var(--accent)'}} onClick={() => supabase.auth.signOut()}><span>Sign out</span></button>
      </div>
      <p className="muted" style={{margin: '0 40px', fontSize: 13}}>Cinebox Desktop 1.0</p>
    </div>
  );
}
