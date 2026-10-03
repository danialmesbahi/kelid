import type { SqlDriver, SqlParams, SqlStatement } from '@kelid/core';

interface DesktopBridge {
  platform: 'desktop';
  db: {
    all(sql: string, params?: SqlParams): Promise<unknown[]>;
    transaction(statements: SqlStatement[]): Promise<void>;
    execScript(sql: string): Promise<void>;
  };
}

declare global {
  interface Window {
    kelid?: DesktopBridge;
  }
}

export interface OpenedDriver {
  driver: SqlDriver;
  /** آیا داده بعد از بستن برنامه می‌ماند؟ */
  persistent: boolean;
  where: 'desktop' | 'browser' | 'memory' | 'locked';
}

/** ویندوز: دیتابیس رمزگذاری‌شده در پروسهٔ اصلی Electron، از طریق پل امن. */
function desktopDriver(bridge: DesktopBridge): SqlDriver {
  return {
    all: async <T>(sql: string, params?: SqlParams) => (await bridge.db.all(sql, params)) as T[],
    transaction: (st) => bridge.db.transaction(st),
    execScript: (sql) => bridge.db.execScript(sql),
  };
}

/** وب و گوشی: SQLite WASM در Worker. */
async function workerDriver(): Promise<OpenedDriver> {
  const worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
  let seq = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error));
  };
  const call = (msg: Record<string, unknown>) =>
    new Promise<unknown>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...msg, id });
    });

  // در توسعه، با هر ذخیرهٔ کد Worker قبلی بسته می‌شود تا دیتابیس قفل نماند.
  import.meta.hot?.dispose(() => worker.terminate());

  const info = (await call({ op: 'init' })) as { persistent: boolean; reason: string };
  const driver: SqlDriver = {
    all: async <T>(sql: string, params?: SqlParams) => (await call({ op: 'all', sql, params })) as T[],
    transaction: async (statements) => {
      await call({ op: 'tx', statements });
    },
    execScript: async (sql) => {
      await call({ op: 'exec', sql });
    },
  };
  return { driver, persistent: info.persistent, where: info.persistent ? 'browser' : info.reason === 'locked' ? 'locked' : 'memory' };
}

let opening: Promise<OpenedDriver> | null = null;

/** دیتابیس در هر صفحه فقط یک بار باز می‌شود (حتی اگر React دوبار mount کند). */
export function openDriver(): Promise<OpenedDriver> {
  if (!opening) {
    opening = window.kelid?.platform === 'desktop'
      ? Promise.resolve({ driver: desktopDriver(window.kelid), persistent: true, where: 'desktop' as const })
      : workerDriver();
  }
  return opening;
}
