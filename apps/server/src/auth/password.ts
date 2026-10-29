import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { BusyError } from '../db';

// scrypt داخل خود Node است (بدون وابستگی تازه) و حدس زدن رمز روی کارت گرافیک را گران می‌کند.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// هر scrypt حدود ۱۰۰ میلی‌ثانیه یکی از رشته‌های libuv را می‌گیرد. وقتی هزاران نفر با هم وارد شوند صف بی‌انتها می‌شد:
// برنامه بعد از ۱۲ ثانیه دست می‌کشید و سرور هنوز برایش رمز می‌سنجید و نوبت بقیه را می‌سوزاند.
// حالا صف کوتاه است و هر چه بیشتر از چند ثانیه منتظر مانده «شلوغ است» می‌گیرد، بی آن‌که وقت پردازنده بسوزاند.
const RUNNING = Math.max(1, Number(process.env.UV_THREADPOOL_SIZE) || 4);
const QUEUE_MAX = 300;
const WAIT_MAX_MS = 8_000;
let running = 0;
const queue: Array<{ at: number; go: () => void; busy: () => void }> = [];

function next() {
  while (running < RUNNING && queue.length) {
    const job = queue.shift()!;
    if (Date.now() - job.at > WAIT_MAX_MS) job.busy();
    else job.go();
  }
}

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const go = () => {
      running++;
      scryptCb(password.normalize('NFKC'), salt, KEYLEN, opts, (err, key) => {
        running--;
        next();
        return err ? reject(err) : resolve(key);
      });
    };
    if (running < RUNNING) return go();
    if (queue.length >= QUEUE_MAX) return reject(new BusyError());
    queue.push({ at: Date.now(), go, busy: () => reject(new BusyError()) });
  });
}

/** خروجی: scrypt$N$r$p$salt$hash؛ پارامترها کنار هش می‌مانند تا بعداً بشود سخت‌ترشان کرد. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// برای شماره‌ای که حساب یا رمز ندارد هم همان‌قدر وقت صرف می‌شود تا از زمان پاسخ چیزی معلوم نشود.
let dummy: Promise<string> | null = null;

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // شلوغی وسط ساختنش نباید برای همیشه در حافظه بماند.
  dummy ??= hashPassword('kelid-dummy-password').catch((e: unknown) => {
    dummy = null;
    throw e;
  });
  const [alg, n, r, p, salt, hash] = (stored ?? (await dummy)).split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await scrypt(password, Buffer.from(salt, 'base64url'), { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return stored !== null && got.length === want.length && timingSafeEqual(got, want);
}

export function passwordOk(p: string): boolean {
  return p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
}
