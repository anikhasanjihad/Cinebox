import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Cell, Group, Page, Toggle} from '../components/Controls';
import {normalizeCode, partyApi, useParty} from '../lib/party';

export default function WatchTogether({back}: {back: () => void}) {
  const p = useParty();
  const nav = useNavigate();
  const [join, setJoin] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({top: log.current.scrollHeight}); }, [p.chat.length]);

  const run = async (kind: 'create' | 'join') => {
    if (busy) return;
    setError(''); setBusy(kind);
    try { if (kind === 'create') await partyApi.createRoom(); else await partyApi.joinRoom(join); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };
  const copy = () => {
    if (!p.code) return;
    void navigator.clipboard.writeText(`Watch with me on CineHub! Open Settings → Watch Together → Join and enter this code: ${p.code}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };
  const sendChat = () => { partyApi.sendChat(text); setText(''); };

  if (p.status !== 'connected') {
    return (
      <Page title="Watch Together" back={back}>
        <Group footer="Everyone in the room needs CineHub. The host picks what to watch; play, pause and seek stay in sync.">
          <Cell label="Create a room" hint="You are the host"><button className="btn accent press" style={{height: 38}} disabled={busy !== null} onClick={() => void run('create')}>{busy === 'create' ? 'Creating…' : 'Create'}</button></Cell>
          <Cell label="Join a room" hint="Enter the 6 character code">
            <input className="input" style={{width: 130, textAlign: 'center', letterSpacing: 3, textTransform: 'uppercase'}} maxLength={6} placeholder="ABC123" value={join} onChange={e => setJoin(normalizeCode(e.target.value))} onKeyDown={e => e.key === 'Enter' && void run('join')} />
            <button className="btn glass press" style={{height: 38}} disabled={busy !== null || join.length !== 6} onClick={() => void run('join')}>{busy === 'join' ? 'Joining…' : 'Join'}</button>
          </Cell>
        </Group>
        {error && <p style={{color: 'var(--accent)'}}>{error}</p>}
      </Page>
    );
  }

  return (
    <Page title="Watch Together" back={back}>
      <div style={{textAlign: 'center', margin: '4px 0 24px'}}>
        <div className="muted" style={{fontSize: 13}}>Room code</div>
        <div style={{fontSize: 44, fontWeight: 800, letterSpacing: 10, margin: '4px 0 12px'}}>{p.code}</div>
        <button className="btn glass press" style={{height: 38}} onClick={copy}>{copied ? 'Copied' : 'Copy invite'}</button>
      </div>
      <Group title={`In the room · ${p.members.length}`}>
        {p.members.map(m => <Cell key={m.key} label={m.name} hint={m.host ? 'Host' : undefined} />)}
      </Group>
      {p.isHost ? (
        <Group footer="Open any title and press play. It opens on everyone's screen.">
          <Cell label="Only the host controls playback"><Toggle value={p.hostOnly} onChange={partyApi.setHostOnly} /></Cell>
          <Cell label="Choose something to watch" onClick={() => nav('/')}><span className="muted" style={{fontSize: 20}}>›</span></Cell>
        </Group>
      ) : (
        <Group footer={p.hostOnly ? 'Only the host controls playback.' : undefined}>
          <Cell label={p.content ? p.content.title : 'Waiting for the host to pick something…'} hint={p.content ? 'Now playing' : undefined}>
            {p.content && <button className="btn accent press" style={{height: 36}} onClick={() => nav('/watch', {state: {...p.content!.params, back: '/settings/party'}})}>Open player</button>}
          </Cell>
        </Group>
      )}
      <Group title="Chat">
        <div ref={log} className="party-log">
          {p.chat.length === 0 && <div className="muted" style={{padding: 12}}>Say hello 👋</div>}
          {p.chat.map(c => <div key={c.id} className={`party-msg${c.mine ? ' mine' : ''}`}><b>{c.mine ? 'You' : c.name}</b> {c.text}</div>)}
        </div>
        <Cell label=""><input className="input" style={{flex: 1, width: 320}} placeholder="Message" value={text} maxLength={300} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} /><button className="btn glass press" style={{height: 38}} onClick={sendChat}>Send</button></Cell>
      </Group>
      <Group><Cell label="Leave room" danger onClick={() => void partyApi.leaveRoom()} /></Group>
    </Page>
  );
}
