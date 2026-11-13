import {useSyncExternalStore} from 'react';
import {appFetch} from './http';
import {load, save} from './storage';
import {providerApi} from '../provider/manager';
import type {Provider, Stream} from '../provider/types';

export type DownloadStatus = 'downloading' | 'done' | 'error' | 'canceled';
export interface DownloadItem {
  id: string;
  title: string;
  image?: string;
  providerKey: string;
  link: string;
  type: string;
  status: DownloadStatus;
  progress: number; // 0..1
  bytes: number;
  path?: string;
  ext?: string;
  error?: string;
  createdAt: number;
}

const inTauri = () => '__TAURI_INTERNALS__' in window;
let items: DownloadItem[] = load<DownloadItem[]>('downloads', []).map(d =>
  d.status === 'downloading' ? {...d, status: 'canceled' as const, error: 'Interrupted when the app closed'} : d,
);
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();
const emit = () => { save('downloads', items); listeners.forEach(l => l()); };
const patch = (id: string, p: Partial<DownloadItem>) => { items = items.map(d => (d.id === id ? {...d, ...p} : d)); emit(); };
export const useDownloads = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => items);
export const getDownloads = () => items;

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'video';

const absUrl = (base: string, ref: string) => { try { return new URL(ref, base).toString(); } catch { return ref; } };

const pickStream = (list: Stream[]) => list.find(s => !/m3u8/i.test(s.type) && !/\.m3u8/i.test(s.link)) ?? list[0];

interface Sink { write(b: Uint8Array): Promise<void>; close(): Promise<void> }

const openSink = async (title: string, ext: string): Promise<{sink: Sink; path: string}> => {
  const {downloadDir, join} = await import('@tauri-apps/api/path');
  const fs = await import('@tauri-apps/plugin-fs');
  const dir = await join(await downloadDir(), 'CineHub');
  await fs.mkdir(dir, {recursive: true}).catch(() => {});
  let path = await join(dir, `${safe(title)}.${ext}`);
  if (await fs.exists(path).catch(() => false)) path = await join(dir, `${safe(title)} ${Date.now()}.${ext}`);
  const file = await fs.open(path, {write: true, create: true, truncate: true});
  return {path, sink: {write: b => file.write(b).then(() => {}), close: () => file.close()}};
};

const run = async (id: string, provider: Provider, signal: AbortSignal) => {
  const it = items.find(d => d.id === id)!;
  const streams = (await providerApi.streams(provider, it.link, it.type)).filter(s => s?.link);
  if (!streams.length) throw new Error('No downloadable source was found');
  const s = pickStream(streams);
  const headers = s.headers as Record<string, string> | undefined;
  const isHls = /m3u8/i.test(s.type) || /\.m3u8(\?|$)/i.test(s.link);
  const get = async (url: string) => {
    const r = await appFetch(url, {headers, signal});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  };

  if (!isHls) {
    const ext = (/\.(mp4|mkv|webm|m4v|mov|avi)(\?|$)/i.exec(s.link)?.[1] ?? 'mp4').toLowerCase();
    const res = await get(s.link);
    const total = Number(res.headers.get('content-length')) || 0;
    const {sink, path} = await openSink(it.title, ext);
    patch(id, {path, ext});
    const reader = res.body!.getReader();
    let got = 0, last = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        await sink.write(value);
        got += value.length;
        if (Date.now() - last > 400) { last = Date.now(); patch(id, {bytes: got, progress: total ? got / total : 0}); }
      }
    } finally { await sink.close(); }
    patch(id, {status: 'done', progress: 1, bytes: got});
    return;
  }

  // HLS: choose the best variant, then save the segments one after another as .ts
  let url = s.link;
  let text = await (await get(url)).text();
  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split(/\r?\n/);
    let best = {bw: -1, uri: ''};
    lines.forEach((l, i) => {
      if (l.startsWith('#EXT-X-STREAM-INF')) {
        const bw = Number(/BANDWIDTH=(\d+)/.exec(l)?.[1] ?? 0);
        const uri = lines.slice(i + 1).find(x => x && !x.startsWith('#'));
        if (uri && bw > best.bw) best = {bw, uri};
      }
    });
    if (!best.uri) throw new Error('Empty playlist');
    url = absUrl(url, best.uri);
    text = await (await get(url)).text();
  }
  if (/#EXT-X-KEY:.*METHOD=(?!NONE)/.test(text)) throw new Error('This stream is encrypted and cannot be saved yet');
  const segs = text.split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => absUrl(url, l));
  if (!segs.length) throw new Error('Empty playlist');
  const {sink, path} = await openSink(it.title, 'ts');
  patch(id, {path, ext: 'ts'});
  let bytes = 0;
  try {
    for (let i = 0; i < segs.length; i += 4) {
      const batch = await Promise.all(segs.slice(i, i + 4).map(async u => new Uint8Array(await (await get(u)).arrayBuffer())));
      for (const b of batch) { await sink.write(b); bytes += b.length; }
      patch(id, {bytes, progress: Math.min(1, (i + 4) / segs.length)});
    }
  } finally { await sink.close(); }
  patch(id, {status: 'done', progress: 1, bytes});
};

export const startDownload = (provider: Provider, meta: {title: string; image?: string; link: string; type: string}) => {
  const id = `${provider.key}|${meta.link}`;
  const existing = items.find(d => d.id === id);
  if (existing && existing.status === 'downloading') return;
  const item: DownloadItem = {id, ...meta, providerKey: provider.key, status: 'downloading', progress: 0, bytes: 0, createdAt: Date.now()};
  items = [item, ...items.filter(d => d.id !== id)];
  emit();
  if (!inTauri()) { patch(id, {status: 'error', error: 'Downloads need the desktop app'}); return; }
  const ctl = new AbortController();
  controllers.set(id, ctl);
  run(id, provider, ctl.signal)
    .catch(e => patch(id, ctl.signal.aborted ? {status: 'canceled'} : {status: 'error', error: e instanceof Error ? e.message : String(e)}))
    .finally(() => controllers.delete(id));
};

export const cancelDownload = (id: string) => controllers.get(id)?.abort();

export const removeDownload = async (id: string, deleteFile: boolean) => {
  cancelDownload(id);
  const it = items.find(d => d.id === id);
  if (deleteFile && it?.path && inTauri()) {
    try { await (await import('@tauri-apps/plugin-fs')).remove(it.path); } catch { /* already gone */ }
  }
  items = items.filter(d => d.id !== id);
  emit();
};

export const clearFinished = () => { items = items.filter(d => d.status === 'downloading'); emit(); };

export const openFile = async (path: string) => { await (await import('@tauri-apps/plugin-opener')).openPath(path); };
export const revealFile = async (path: string) => { await (await import('@tauri-apps/plugin-opener')).revealItemInDir(path); };
export const fileUrl = async (path: string) => (await import('@tauri-apps/api/core')).convertFileSrc(path);
