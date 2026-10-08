import { useSyncExternalStore } from 'react';
import { decodeLicense, fromB64url, licenseInfo, type LicenseInfo, type LicensePayload } from '@kelid/core';
import { API_URL } from '../auth/api';

/**
 * مجوز اشتراک روی همین دستگاه: سرور آن را با Ed25519 امضا می‌کند و برنامه با کلید عمومی می‌سنجد، پس بدون اینترنت هم
 * معلوم است اشتراک تا کی اعتبار دارد. هر سر زدن به سرور مجوز تازه می‌آورد؛ دستگاهی که بیش از مهلت سر نزند فقط‌خواندنی می‌شود.
 * این فقط رابط را راهنمایی می‌کند؛ مرز واقعی سرور است که بعد از پایان اشتراک تغییری نمی‌پذیرد.
 */

// کلید عمومی توسعه؛ جفت خصوصی‌اش DEV_LICENSE_SEED سرور است و در production پذیرفته نمی‌شود.
const DEV_KEY = 'I_UYFLmVD4B6Keak4m76BO-F2qZ6j6DYds_BPbqhstc';
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(API_URL ?? '');
const PUBLIC_KEY = (import.meta.env.VITE_KELID_LICENSE_KEY as string | undefined) || (import.meta.env.DEV || LOCAL ? DEV_KEY : '');
const DEMO = API_URL === 'demo';
const STORE = 'kelid.license';
const TICK_MS = 60_000;

interface Saved {
  token: string;
  /** ساعت سرور منهای ساعت این دستگاه، هنگام گرفتن مجوز. */
  skew: number;
  /** جلوترین زمانی که دیده شده؛ عقب کشیدن ساعت دستگاه اشتراک را دراز نمی‌کند. */
  seen: number;
}

let saved: Saved | null = null;
let payload: LicensePayload | null = null;
let snapshot: LicenseInfo | null = null;
let office: string | null = null;
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | undefined;

function now(): number {
  if (!saved) return Date.now();
  const t = Date.now() + saved.skew;
  if (t <= saved.seen) return saved.seen;
  saved.seen = t;
  return t;
}

function publish() {
  const next = payload ? licenseInfo(payload, now()) : null;
  const same =
    next &&
    snapshot &&
    next.phase === snapshot.phase &&
    next.daysLeft === snapshot.daysLeft &&
    next.plan === snapshot.plan &&
    next.expiresAt === snapshot.expiresAt &&
    next.seats === snapshot.seats;
  if (same || (!next && !snapshot)) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function persist() {
  try {
    if (saved) localStorage.setItem(STORE, JSON.stringify(saved));
    else localStorage.removeItem(STORE);
  } catch {
    /* حافظهٔ مرورگر بسته است؛ تا بستن صفحه در حافظه می‌ماند */
  }
}

async function verify(token: string): Promise<LicensePayload | null> {
  const d = decodeLicense(token);
  if (!d) return null;
  if (DEMO) return d.payload;
  if (!PUBLIC_KEY) return null;
  const subtle = globalThis.crypto?.subtle;
  // مرورگری که Ed25519 ندارد: مجوز مستقیم از سرور خودمان (روی https) آمده؛ همان را می‌پذیریم.
  if (!subtle) return d.payload;
  let key: CryptoKey;
  try {
    key = await subtle.importKey('raw', fromB64url(PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return d.payload;
  }
  const ok = await subtle.verify({ name: 'Ed25519' }, key, d.sig, new TextEncoder().encode(d.body)).catch(() => false);
  return ok ? d.payload : null;
}

/** بعد از ورود یا باز شدن برنامه: مجوز ذخیره‌شده فقط اگر مال همین دفتر باشد و امضایش درست. */
export async function bindLicense(officeId: string | null): Promise<void> {
  if (officeId === office) return;
  office = officeId;
  saved = null;
  payload = null;
  if (officeId) {
    try {
      const raw = localStorage.getItem(STORE);
      const s = raw ? (JSON.parse(raw) as Saved) : null;
      const p = s && typeof s.token === 'string' ? await verify(s.token) : null;
      if (p && p.off === officeId && office === officeId) {
        saved = { token: s!.token, skew: Number(s!.skew) || 0, seen: Number(s!.seen) || 0 };
        payload = p;
      }
    } catch {
      /* مجوز خراب: تا سر زدن بعدی بی مجوز */
    }
  } else {
    persist();
  }
  publish();
}

/** مجوز تازه از سرور (ورود، تمدید توکن، صفحهٔ اشتراک، بعد از پرداخت). */
export async function adoptLicense(token: string | null | undefined, officeId: string): Promise<void> {
  if (!token) return;
  const p = await verify(token);
  if (!p || p.off !== officeId) return;
  // جوابی که دیرتر رسیده نباید مجوز تازه‌تر را عقب ببرد.
  if (payload && payload.off === officeId && p.iat < payload.iat) return;
  office = officeId;
  // ساعت سرور معیار است؛ ساعت اشتباه دستگاه با هر سر زدن درست می‌شود.
  saved = { token, skew: p.iat * 1000 - Date.now(), seen: p.iat * 1000 };
  payload = p;
  persist();
  publish();
}

export function clearLicense(): void {
  void bindLicense(null);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // گذر زمان هم وضعیت را عوض می‌کند (روز آخر، پایان اشتراک)؛ فقط وقتی کسی گوش می‌دهد.
  ticker ??= setInterval(() => {
    publish();
    persist();
  }, TICK_MS);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}
const read = () => snapshot;

/** وضعیت اشتراک؛ null = بی سرور، بی ورود، یا هنوز مجوزی نرسیده (آن موقع هیچ چیز بسته نیست). */
export function useLicense(): LicenseInfo | null {
  return useSyncExternalStore(subscribe, read, read);
}

/** ثبت و ویرایش بسته است؟ لایهٔ داده (data.tsx) پیش از هر نوشتن می‌پرسد. */
export function isReadOnly(): boolean {
  if (!payload) return false;
  return licenseInfo(payload, now()).readOnly;
}
