import {useSyncExternalStore} from 'react';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from './supabase';

/**
 * Watch Together (desktop). Same idea and channel name as the phone app: a room is a
 * Supabase Realtime broadcast channel, no tables needed. The host's title opens on every
 * device and play / pause / seek stay in sync.
 */

export interface PartyMember { key: string; name: string; color?: string | null; host: boolean }
export interface PartyChat { id: string; name: string; text: string; mine: boolean }
export interface PartyPlayback { playing: boolean; position: number; receivedAt: number; seq: number; kind: 'play' | 'tick' }
export type PartyParams = Record<string, unknown>;
interface PartyContent { params: PartyParams; title: string }
type Status = 'idle' | 'connecting' | 'connected';

export interface PartyState {
  code: string | null;
  status: Status;
  isHost: boolean;
  hostOnly: boolean;
  members: PartyMember[];
  content: PartyContent | null;
  remote: PartyPlayback | null;
  chat: PartyChat[];
}

const IDLE: PartyState = {code: null, status: 'idle', isHost: false, hostOnly: false, members: [], content: null, remote: null, chat: []};
let state: PartyState = IDLE;
const listeners = new Set<() => void>();
const set = (patch: Partial<PartyState> | ((s: PartyState) => Partial<PartyState>)) => {
  state = {...state, ...(typeof patch === 'function' ? patch(state) : patch)};
  listeners.forEach(l => l());
};
export const useParty = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({length: 6}, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

let channel: RealtimeChannel | null = null;
let myKey = '';
let myName = 'Guest';
let snapshotFn: (() => {playing: boolean; position: number}) | null = null;
let seq = 0;
let uid = 0;
const nextId = () => `${Date.now()}-${uid++}`;
const MAX_PAYLOAD_CHARS = 120_000;

const send = (payload: Record<string, unknown>) => { void channel?.send({type: 'broadcast', event: 'p', payload: {...payload, from: myKey}}); };

const announce = () => {
  send({t: 'cfg', hostOnly: state.hostOnly});
  if (state.content) send({t: 'content', params: state.content.params, title: state.content.title});
  const snap = snapshotFn?.();
  if (snap) send({t: 'play', kind: 'play', playing: snap.playing, position: snap.position});
};

const readMembers = () => {
  if (!channel) return;
  const pres = channel.presenceState() as Record<string, Array<{name?: string; color?: string | null; host?: boolean}>>;
  const members = Object.entries(pres).map(([key, metas]) => ({key, name: metas[0]?.name || 'Guest', color: metas[0]?.color, host: !!metas[0]?.host}));
  members.sort((a, b) => Number(b.host) - Number(a.host) || a.name.localeCompare(b.name));
  set({members});
};

const open = async (code: string, host: boolean) => {
  if (state.status !== 'idle') await leaveRoom();
  const {data} = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error('Sign in first.');
  const {data: prof} = await supabase.from('profiles').select('display_name, avatar_color').eq('id', user.id).maybeSingle();
  const p = prof as {display_name?: string | null; avatar_color?: string | null} | null;
  myName = p?.display_name?.trim() || user.email?.split('@')[0] || 'Guest';
  myKey = `${user.id}:${Math.random().toString(36).slice(2, 6)}`;
  set({...IDLE, code, status: 'connecting', isHost: host});

  const ch = supabase.channel(`cinehub-party:${code}`, {config: {broadcast: {self: false}, presence: {key: myKey}}});
  channel = ch;
  const fromHost = (from: string) => !!state.members.find(m => m.key === from)?.host;

  ch.on('broadcast', {event: 'p'}, ({payload}) => {
    const msg = payload as Record<string, unknown>;
    const from = String(msg.from ?? '');
    switch (msg.t) {
      case 'content': set({content: {params: (msg.params ?? {}) as PartyParams, title: String(msg.title ?? '')}}); break;
      case 'cfg': set({hostOnly: !!msg.hostOnly}); break;
      case 'play':
        if (state.hostOnly && !fromHost(from)) break;
        seq += 1;
        set({remote: {playing: !!msg.playing, position: Number(msg.position) || 0, receivedAt: Date.now(), seq, kind: msg.kind === 'tick' ? 'tick' : 'play'}});
        break;
      case 'chat':
        set(s => ({chat: [...s.chat.slice(-79), {id: String(msg.id), name: String(msg.name), text: String(msg.text), mine: false}]}));
        break;
    }
  });
  ch.on('presence', {event: 'sync'}, readMembers);
  ch.on('presence', {event: 'join'}, () => { if (state.isHost) setTimeout(announce, 400); });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Could not connect. Check your internet.')), 12000);
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({name: myName, color: p?.avatar_color ?? null, host});
        clearTimeout(timer); resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer); reject(new Error('Could not connect. Check your internet.'));
      }
    });
  });
  if (!host) {
    // A joiner needs a host in the room, otherwise the code is wrong.
    await new Promise(r => setTimeout(r, 1800));
    readMembers();
    if (!state.members.some(m => m.host)) throw new Error('Room not found. Check the code and try again.');
  }
  set({status: 'connected'});
};

export const leaveRoom = async () => {
  const ch = channel;
  channel = null; snapshotFn = null;
  set({...IDLE});
  if (ch) { try { await ch.untrack(); await supabase.removeChannel(ch); } catch { /* already gone */ } }
};

export const partyApi = {
  async createRoom() { try { await open(randomCode(), true); } catch (e) { await leaveRoom(); throw e; } },
  async joinRoom(raw: string) {
    const code = normalizeCode(raw);
    if (code.length !== 6) throw new Error('Enter the 6 character room code.');
    try { await open(code, false); } catch (e) { await leaveRoom(); throw e; }
  },
  leaveRoom,
  setHostOnly(value: boolean) { if (!state.isHost) return; set({hostOnly: value}); send({t: 'cfg', hostOnly: value}); },
  sendContent(params: PartyParams, title: string) {
    if (!state.isHost) return;
    let shared = params;
    if (JSON.stringify(shared).length > MAX_PAYLOAD_CHARS) {
      const q = shared.queue as unknown[] | undefined; const i = Number(shared.index) || 0;
      shared = {...shared, queue: q?.[i] ? [q[i]] : [], index: 0};
    }
    set({content: {params: shared, title}});
    send({t: 'content', params: shared, title});
  },
  sendPlayback(kind: 'play' | 'tick', playing: boolean, position: number) {
    if (state.status !== 'connected' || (state.hostOnly && !state.isHost)) return;
    send({t: 'play', kind, playing, position});
  },
  sendChat(text: string) {
    const t = text.trim().slice(0, 300);
    if (!t || !channel) return;
    const id = nextId();
    set(s => ({chat: [...s.chat.slice(-79), {id, name: myName, text: t, mine: true}]}));
    send({t: 'chat', id, name: myName, text: t});
  },
  registerSnapshot(fn: (() => {playing: boolean; position: number}) | null) { snapshotFn = fn; },
};
