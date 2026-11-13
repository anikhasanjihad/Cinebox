import type {SerializedResponse} from '../provider/execute';

const inTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let nativeFetch: typeof fetch | null = null;
/** Native HTTP inside the desktop app (no CORS, any headers); browser fetch in `npm run dev`. */
export const appFetch = async (input: string, init?: RequestInit): Promise<Response> => {
  if (inTauri()) {
    nativeFetch ??= (await import('@tauri-apps/plugin-http')).fetch as typeof fetch;
    return nativeFetch(input, init);
  }
  return fetch(input, init);
};

export const hostFetch = async (args: {
  url: string;
  init: {method?: string; headers: Array<[string, string]>; body: {kind: string; value?: string}; redirect: 'follow' | 'manual'};
}): Promise<SerializedResponse> => {
  const {url, init} = args;
  const headers = new Headers();
  for (const [k, v] of init.headers) {
    try { headers.set(k, v); } catch { /* skip invalid header */ }
  }
  let body: BodyInit | undefined;
  if (init.body.kind === 'text') body = init.body.value;
  else if (init.body.kind === 'base64') body = Uint8Array.from(atob(init.body.value ?? ''), c => c.charCodeAt(0));
  const res = await appFetch(url, {method: init.method ?? 'GET', headers, body, redirect: init.redirect});
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const out: Array<[string, string]> = [];
  res.headers.forEach((v, k) => out.push([k, v]));
  return {status: res.status, statusText: res.statusText, url: res.url || url, headers: out, bodyBase64: btoa(s)};
};
