import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from '../auth/tokens';

// رمز یک‌بارمصرف زمانی (RFC 6238)، همان که Google Authenticator و برنامه‌های مشابه می‌سازند؛ بدون وابستگی تازه.
const STEP = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** کلید تازهٔ ۲۰ بایتی به base32 (۳۲ نویسه)؛ همان «کلید راه‌اندازی» که در برنامهٔ کد وارد می‌شود. */
export function newTotpSecret(): string {
  return base32(randomBytes(20));
}

export function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('bad base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', fromBase32(secret)).update(counter).digest();
  const off = h[h.length - 1]! & 15;
  const n = (h.readUInt32BE(off) & 0x7fffffff) % 10 ** DIGITS;
  return String(n).padStart(DIGITS, '0');
}

export const totpStep = (now = Date.now()): number => Math.floor(now / 1000 / STEP);

/**
 * گام زمانی کدی که درست است، یا null. یک گام پیش و پس هم پذیرفته می‌شود (ساعت گوشی چند ثانیه جلو یا عقب).
 * گامی که قبلاً مصرف شده (after) دیگر پذیرفته نمی‌شود تا کدی که کسی دیده دوباره به کار نرود.
 */
export function checkTotp(secret: string, code: string, after: number, now = Date.now()): number | null {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const cur = totpStep(now);
  for (const step of [cur - 1, cur, cur + 1]) {
    if (step > after && safeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

/** نشانی‌ای که برنامهٔ کد از روی آن حساب را می‌سازد (اگر به‌جای تایپ کلید، QR بسازید). */
export function totpUri(secret: string, phone: string): string {
  return `otpauth://totp/${encodeURIComponent(`Kelid Admin:${phone}`)}?secret=${secret}&issuer=${encodeURIComponent('Kelid Admin')}&digits=${DIGITS}&period=${STEP}`;
}
