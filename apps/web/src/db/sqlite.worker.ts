/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type Params = Array<string | number | null>;
type Req =
  | { id: number; op: 'all'; sql: string; params?: Params }
  | { id: number; op: 'tx'; statements: Array<{ sql: string; params?: Params }> }
  | { id: number; op: 'exec'; sql: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

/**
 * دیتابیس وب در این Worker اجرا می‌شود تا رابط کاربری هیچ‌وقت منتظر دیسک نماند.
 * OPFS (حافظهٔ ماندگار مرورگر) بدون تنظیم خاص سرور کار می‌کند؛ اگر مرورگر پشتیبانی نکند،
 * دیتابیس موقت در حافظه ساخته می‌شود و به رابط کاربری خبر داده می‌شود.
 */
const ready = (async () => {
  const sqlite3 = await sqlite3InitModule();
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'kelid' });
    db = new pool.OpfsSAHPoolDb('/kelid.db');
    return { persistent: true, reason: '' };
  } catch (err) {
    // NoModificationAllowedError یعنی تب یا پنجرهٔ دیگری دیتابیس را باز کرده است.
    const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name ?? '';
    db = new sqlite3.oo1.DB(':memory:');
    return { persistent: false, reason: /NoModificationAllowed|InvalidState/.test(String(name)) ? 'locked' : 'unsupported' };
  }
})();

function all(sql: string, params?: Params) {
  return db.exec({ sql, bind: params && params.length ? params : undefined, rowMode: 'object', returnValue: 'resultRows' });
}

self.onmessage = async (e: MessageEvent<Req | { id: number; op: 'init' }>) => {
  const req = e.data;
  try {
    const info = await ready;
    let result: unknown = null;
    if (req.op === 'init') result = info;
    else if (req.op === 'all') result = all(req.sql, req.params);
    else if (req.op === 'exec') db.exec(req.sql);
    else if (req.op === 'tx') {
      db.transaction(() => {
        for (const s of req.statements) all(s.sql, s.params);
      });
    }
    self.postMessage({ id: req.id, ok: true, result });
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
