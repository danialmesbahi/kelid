import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** کلیدهای جدا برای هر کاربرد، همه از یک JWT_SECRET؛ لو رفتن یکی دیگری را لو نمی‌دهد. */
export function deriveKey(secret: string, purpose: 'access' | 'otp'): Buffer {
  return createHmac('sha256', secret).update(`kelid:${purpose}`).digest();
}

export const sha256 = (s: string): Buffer => createHash('sha256').update(s).digest();
export const randomToken = (): string => randomBytes(32).toString('base64url');
/** کد شش‌رقمی با مولد امن رمزنگاری؛ صفرهای اول حفظ می‌شوند. */
export const otpCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const otpHash = (key: Buffer, phone: string, code: string): Buffer => createHmac('sha256', key).update(`${phone}:${code}`).digest();

export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface AccessClaims {
  sub: string; // user id
  off: string; // office id
  dev: string; // device id
}

// فقط HS256؛ هدر ثابت است، پس توکنی با alg دیگر (none، RS256…) پیش از هر کاری رد می‌شود.
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export function signAccess(key: Buffer, claims: AccessClaims, ttlSec: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const body = Buffer.from(JSON.stringify({ ...claims, iat, exp: iat + ttlSec })).toString('base64url');
  const sig = createHmac('sha256', key).update(`${HEADER}.${body}`).digest('base64url');
  return `${HEADER}.${body}.${sig}`;
}

export function verifyAccess(key: Buffer, token: string, now = Date.now()): AccessClaims | null {
  if (token.length > 2048) return null;
  const [header, body, sig, extra] = token.split('.');
  if (header !== HEADER || !body || !sig || extra !== undefined) return null;
  const want = createHmac('sha256', key).update(`${header}.${body}`).digest();
  if (!safeEqual(Buffer.from(sig, 'base64url'), want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof p.exp !== 'number' || p.exp * 1000 <= now) return null;
    if (typeof p.sub !== 'string' || typeof p.off !== 'string' || typeof p.dev !== 'string') return null;
    return { sub: p.sub, off: p.off, dev: p.dev };
  } catch {
    return null;
  }
}
