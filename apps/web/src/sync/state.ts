import { useSyncExternalStore } from 'react';
import { toFaDigits } from '@kelid/core';
import type { SyncTarget } from '../data';
import { syncApiFromEnv } from './api';
import { SyncEngine, type SyncStatus } from './engine';

// موتور جاری؛ بیرون از React تا نوار کناری و تنظیمات بی‌واسطه وضعیت را بخوانند.
let engine: SyncEngine | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
let unwatch: (() => void) | null = null;
const api = syncApiFromEnv();

function setEngine(next: SyncEngine | null) {
  unwatch?.();
  engine?.stop();
  engine = next;
  unwatch = next ? next.onStatus(changed) : null;
  changed();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const read = () => engine?.getStatus() ?? null;

/** موتور تازه برای این دفتر؛ تابع برگشتی آن را خاموش می‌کند. */
export function startSync(target: SyncTarget, withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>, office: string): (() => void) | undefined {
  if (!api) return;
  const e = new SyncEngine(target, api, withToken, office);
  setEngine(e);
  e.start();
  return () => {
    if (engine === e) setEngine(null);
  };
}

/** null یعنی همگام‌سازی روشن نیست (بدون سرور، بدون ورود، یا حافظهٔ موقت). */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(subscribe, read, read);
}

export function syncNow() {
  void engine?.run();
}

/** عکس کاملی که روی این دستگاه نیست، همین حالا از سرور؛ true = حالا هست. بی همگام‌سازی همیشه false. */
export function fetchFullPhoto(id: string): Promise<boolean> {
  return engine?.fetchFull(id) ?? Promise.resolve(false);
}

export function syncText(s: SyncStatus): { label: string; tone: 'ok' | 'busy' | 'warn' | 'bad' } {
  const queued = s.pending ? ` · ${toFaDigits(s.pending)} تغییر در صف` : '';
  switch (s.phase) {
    case 'syncing':
      return { label: 'در حال همگام‌سازی…', tone: 'busy' };
    case 'offline':
      return { label: `بدون اینترنت${queued}`, tone: 'warn' };
    case 'error':
      return { label: `همگام نشد؛ دوباره امتحان می‌شود${queued}`, tone: 'warn' };
    case 'blocked':
      return { label: 'این دستگاه مال دفتر دیگری است', tone: 'bad' };
    default:
      return { label: s.pending ? `${toFaDigits(s.pending)} تغییر در صف` : 'همگام با دفتر', tone: 'ok' };
  }
}

export const toneColor = { ok: 'var(--ok)', busy: 'var(--pri)', warn: 'var(--warn)', bad: 'var(--bad)' } as const;
