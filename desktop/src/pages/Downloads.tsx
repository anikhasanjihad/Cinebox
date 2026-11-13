import {useNavigate} from 'react-router-dom';
import {cancelDownload, clearFinished, fileUrl, openFile, removeDownload, revealFile, useDownloads, type DownloadItem} from '../lib/downloads';
import {Message} from '../components/Parts';
import {IconPlay} from '../components/Icons';

const mb = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : `${(n / 1e6).toFixed(1)} MB`);

export default function Downloads() {
  const items = useDownloads();
  const nav = useNavigate();

  const play = async (d: DownloadItem) => {
    if (!d.path) return;
    if (d.ext === 'mp4' || d.ext === 'webm' || d.ext === 'm4v') nav('/watch', {state: {local: {url: await fileUrl(d.path)}, title: d.title, back: '/downloads'}});
    else await openFile(d.path).catch(() => {});
  };

  return (
    <div className="page">
      <div style={{padding: '44px 40px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <h1 className="title-xl">Downloads</h1>
        {items.some(i => i.status !== 'downloading') && <button className="btn glass press" onClick={clearFinished}>Clear finished</button>}
      </div>
      {items.length === 0 && <Message title="No downloads" text="Open a title and press Download. Files are saved in your Downloads/Cinebox folder." />}
      <div className="eps" style={{padding: '0 40px 50px', maxWidth: 820}}>
        {items.map(d => (
          <div key={d.id} className="dl">
            <div className="dl-img" style={d.image ? {backgroundImage: `url("${d.image}")`} : undefined} />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{d.title}</div>
              <div className="muted" style={{fontSize: 12.5, margin: '3px 0 8px'}}>
                {d.status === 'downloading' && `Downloading · ${mb(d.bytes)}${d.progress ? ` · ${Math.round(d.progress * 100)}%` : ''}`}
                {d.status === 'done' && `Saved · ${mb(d.bytes)} · .${d.ext}`}
                {d.status === 'error' && <span style={{color: '#ff6961'}}>{d.error}</span>}
                {d.status === 'canceled' && (d.error ?? 'Canceled')}
              </div>
              {d.status === 'downloading' && <div className="bar" style={{height: 5, cursor: 'default'}}><div className="fill" style={{width: `${Math.max(3, d.progress * 100)}%`, background: 'var(--accent)'}} /></div>}
            </div>
            <div style={{display: 'flex', gap: 8}}>
              {d.status === 'done' && <button className="round press" onClick={() => play(d)} aria-label="Play"><IconPlay /></button>}
              {d.status === 'done' && d.path && <button className="btn glass press" style={{height: 40}} onClick={() => revealFile(d.path!).catch(() => {})}>Show</button>}
              {d.status === 'downloading' && <button className="btn glass press" style={{height: 40}} onClick={() => cancelDownload(d.id)}>Cancel</button>}
              {d.status !== 'downloading' && <button className="btn glass press" style={{height: 40}} onClick={() => removeDownload(d.id, d.status === 'done')}>{d.status === 'done' ? 'Delete' : 'Remove'}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
