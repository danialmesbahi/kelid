import { applyServerChange, type EntityState, type IncomingEntity, type OutgoingChange } from '@kelid/core';
import { API_URL, request } from '../auth/api';

export interface PullPage {
  entities: IncomingEntity[];
  cursor: string;
  more: boolean;
  hlc: string | null;
}

export interface SyncApi {
  push(token: string, changes: OutgoingChange[]): Promise<{ hlc: string | null }>;
  pull(token: string, cursor: string, limit: number): Promise<PullPage>;
}

export function httpSyncApi(base: string): SyncApi {
  const root = base.replace(/\/+$/, '');
  return {
    // دسته‌های بزرگ روی اینترنت کند فرصت بیشتری می‌گیرند.
    push: (token, changes) => request(root, 'POST', '/sync/push', { changes }, token, 45_000),
    pull: (token, cursor, limit) => request(root, 'GET', `/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=${limit}`, undefined, token, 45_000),
  };
}

/** سرور خیالی پیش‌نمایش: همان ادغام سرور واقعی، در حافظهٔ همین صفحه. */
export function demoSyncApi(): SyncApi {
  const rows = new Map<string, { kind: IncomingEntity['kind']; id: string; state: EntityState; version: number }>();
  let version = 0;
  return {
    async push(_t, changes) {
      await new Promise((r) => setTimeout(r, 300));
      for (const c of changes) {
        const key = `${c.kind}:${c.id}`;
        const taken = new Set([...rows.values()].map((r) => r.state.fields.plaque).filter((p): p is number => typeof p === 'number'));
        const { state, changed } = applyServerChange(rows.get(key)?.state, c, (p) => (p !== null && !taken.has(p) ? p : Math.max(0, ...taken) + 1));
        if (changed) rows.set(key, { kind: c.kind, id: c.id, state, version: ++version });
      }
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
