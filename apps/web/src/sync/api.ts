import { applyServerChange, type EntityState, type IncomingEntity, type OutgoingChange, type PhotoBlob } from '@kelid/core';
import { API_URL, ApiError, request } from '../auth/api';

export interface PullPage {
  entities: IncomingEntity[];
  cursor: string;
  more: boolean;
  hlc: string | null;
  /** اجازهٔ دیدن شمارهٔ مالک‌ها؛ سرور قدیمی ندارد. */
  ownerPhones?: boolean;
}

export interface SyncApi {
  push(token: string, changes: OutgoingChange[]): Promise<{ hlc: string | null }>;
  pull(token: string, cursor: string, limit: number): Promise<PullPage>;
  uploadPhoto(token: string, photo: PhotoBlob): Promise<void>;
  /** null = هنوز بالا نیامده (دستگاه صاحبش آفلاین است). */
  downloadPhoto(token: string, id: string): Promise<PhotoBlob | null>;
  /**
   * اتصال زنده: با هر «دستگاه دیگری چیزی فرستاد» change صدا زده می‌شود. تا بسته شدن اتصال باز می‌ماند؛
   * سرور قدیمی که آن را ندارد not_found می‌دهد و همگام‌سازی دوره‌ای کافی است.
   */
  listen?(token: string, on: LiveEvents, signal: AbortSignal): Promise<void>;
}

export interface LiveEvents {
  open(): void;
  change(): void;
}

// سرور هر ۲۵ ثانیه یک خط خالی می‌فرستد؛ سکوت طولانی‌تر یعنی اتصال بی‌صدا مرده (وای‌فای عوض شد، پراکسی بست).
const LIVE_SILENCE_MS = 70_000;

// بایت‌ها در JSON به‌صورت base64؛ تکه‌تکه تا آرایهٔ بزرگ پشتهٔ تابع را پر نکند.
function toB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function httpSyncApi(base: string): SyncApi {
  const root = base.replace(/\/+$/, '');
  return {
    // دسته‌های بزرگ روی اینترنت کند فرصت بیشتری می‌گیرند.
    push: (token, changes) => request(root, 'POST', '/sync/push', { changes }, token, 45_000),
    pull: (token, cursor, limit) => request(root, 'GET', `/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=${limit}`, undefined, token, 45_000),
    uploadPhoto: (token, p) => request(root, 'POST', `/sync/photos/${encodeURIComponent(p.id)}`, { mime: p.mime, bytes: toB64(p.bytes), thumb: toB64(p.thumb) }, token, 60_000),
    downloadPhoto: async (token, id) => {
      try {
        const r = await request<{ mime: string; bytes: string; thumb: string }>(root, 'GET', `/sync/photos/${encodeURIComponent(id)}`, undefined, token, 60_000);
        return { id, mime: r.mime, bytes: fromB64(r.bytes), thumb: fromB64(r.thumb) };
      } catch (e) {
        if (e instanceof ApiError && e.code === 'not_found') return null;
        throw e;
      }
    },
    listen: async (token, on, signal) => {
      // fetch به‌جای EventSource: توکن در هدر می‌رود، نه در آدرس (که در لاگ‌ها می‌ماند).
      const ctl = new AbortController();
      const abort = () => ctl.abort();
      signal.addEventListener('abort', abort);
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const alive = () => {
        clearTimeout(quiet);
        quiet = setTimeout(abort, LIVE_SILENCE_MS);
      };
      try {
        alive();
        let res: Response;
        try {
          res = await fetch(`${root}/sync/events`, { headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' }, signal: ctl.signal, credentials: 'omit', cache: 'no-store' });
        } catch {
          if (signal.aborted) return;
          throw new ApiError('offline');
        }
        if (res.status === 401) throw new ApiError('unauthorized');
        if (!res.ok || !res.body) throw new ApiError(res.status === 404 ? 'not_found' : 'server');
        on.open();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) return;
            alive();
            buf += value;
            for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
              if (/^data:/m.test(buf.slice(0, i))) on.change();
              buf = buf.slice(i + 2);
            }
            if (buf.length > 4096) buf = '';
          }
        } catch {
          if (!signal.aborted) throw new ApiError('offline');
        }
      } finally {
        clearTimeout(quiet);
        signal.removeEventListener('abort', abort);
      }
    },
  };
}

/** سرور خیالی پیش‌نمایش: همان ادغام سرور واقعی، در حافظهٔ همین صفحه. */
export function demoSyncApi(): SyncApi {
  const rows = new Map<string, { kind: IncomingEntity['kind']; id: string; state: EntityState; version: number }>();
  let version = 0;
  const photos = new Map<string, PhotoBlob>();
  const live = new Set<LiveEvents>();
  return {
    listen(_t, on, signal) {
      live.add(on);
      on.open();
      return new Promise((done) => signal.addEventListener('abort', () => done(void live.delete(on))));
    },
    async uploadPhoto(_t, p) {
      await new Promise((r) => setTimeout(r, 120));
      if (!photos.has(p.id)) photos.set(p.id, { ...p });
    },
    async downloadPhoto(_t, id) {
      await new Promise((r) => setTimeout(r, 120));
      return photos.get(id) ?? null;
    },
    async push(_t, changes) {
      await new Promise((r) => setTimeout(r, 300));
      for (const c of changes) {
        const key = `${c.kind}:${c.id}`;
        const taken = new Set([...rows.values()].map((r) => r.state.fields.plaque).filter((p): p is number => typeof p === 'number'));
        const { state, changed } = applyServerChange(rows.get(key)?.state, c, (p) => (p !== null && !taken.has(p) ? p : Math.max(0, ...taken) + 1));
        if (changed) rows.set(key, { kind: c.kind, id: c.id, state, version: ++version });
      }
      for (const l of live) l.change();
      return { hlc: null };
    },
    async pull(_t, cursor, limit) {
      await new Promise((r) => setTimeout(r, 150));
      const list = [...rows.values()].filter((r) => r.version > Number(cursor)).sort((a, b) => a.version - b.version).slice(0, limit);
      return { entities: list.map((r) => ({ kind: r.kind, id: r.id, fields: r.state.fields })), cursor: String(list.at(-1)?.version ?? cursor), more: list.length === limit, hlc: null };
    },
  };
}

export function syncApiFromEnv(): SyncApi | null {
  if (!API_URL) return null;
  return API_URL === 'demo' ? demoSyncApi() : httpSyncApi(API_URL);
}
