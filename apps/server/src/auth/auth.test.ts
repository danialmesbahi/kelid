import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { normalizePhone } from './phone';
import { RateLimiter } from './rateLimit';
import { KavenegarSms } from './sms';
import { deriveKey, otpCode, signAccess, verifyAccess } from './tokens';

describe('normalizePhone', () => {
  it.each([
    ['09121234567', '09121234567'],
    ['۰۹۱۲ ۱۲۳ ۴۵۶۷', '09121234567'],
    ['+98 912-123-4567', '09121234567'],
    ['00989121234567', '09121234567'],
    ['989121234567', '09121234567'],
    ['9121234567', '09121234567'],
  ])('%s → %s', (input, want) => expect(normalizePhone(input)).toBe(want));

  it.each(['', '0912123456', '091212345678', '02112345678', 'abc', '0912123456a'])('rejects %s', (input) => expect(normalizePhone(input)).toBeNull());
  it('rejects non-strings', () => expect(normalizePhone(42)).toBeNull());
});

describe('access tokens', () => {
  const key = deriveKey('x'.repeat(40), 'access');
  const claims = { sub: 'u', off: 'o', dev: 'd' };

  it('round-trips and expires', () => {
    const t = signAccess(key, claims, 60, 1_000_000);
    expect(verifyAccess(key, t, 1_000_000)).toEqual(claims);
    expect(verifyAccess(key, t, 1_000_000 + 61_000)).toBeNull();
  });

  it('rejects a wrong key, tampering and alg=none', () => {
    const t = signAccess(key, claims, 60);
    expect(verifyAccess(deriveKey('y'.repeat(40), 'access'), t)).toBeNull();
    const [h, b, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...claims, sub: 'admin', exp: 9e9 })).toString('base64url');
    expect(verifyAccess(key, `${h}.${forged}.${s}`)).toBeNull();
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(verifyAccess(key, `${none}.${b}.`)).toBeNull();
    expect(verifyAccess(key, `${t}.extra`)).toBeNull();
  });

  it('keeps separate keys per purpose', () => {
    expect(deriveKey('s'.repeat(40), 'access').equals(deriveKey('s'.repeat(40), 'otp'))).toBe(false);
  });
});

describe('otpCode', () => {
  it('is always six digits', () => {
    for (let i = 0; i < 200; i++) expect(otpCode()).toMatch(/^\d{6}$/);
  });
});

describe('RateLimiter', () => {
  it('blocks after max hits until the window resets', () => {
    const rl = new RateLimiter(2, 10_000);
    expect(rl.take('ip', 0)).toBeNull();
    expect(rl.take('ip', 1)).toBeNull();
    expect(rl.take('ip', 2)).toBe(10);
    expect(rl.take('other', 2)).toBeNull();
    expect(rl.take('ip', 10_001)).toBeNull();
  });
});

describe('KavenegarSms', () => {
  it('calls verify/lookup with the template and never puts the key in errors', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }));
    await new KavenegarSms('KEY/1', 'kelid-otp', fetchFn as unknown as typeof fetch).sendOtp('09121234567', '012345');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.kavenegar.com/v1/KEY%2F1/verify/lookup.json');
    expect(String(init.body)).toBe('receptor=09121234567&token=012345&template=kelid-otp');

    const failing = new KavenegarSms('SECRET', 't', (async () => new Response('', { status: 403 })) as unknown as typeof fetch);
    await expect(failing.sendOtp('09121234567', '1')).rejects.toThrow('kavenegar: HTTP 403');
    await failing.sendOtp('09121234567', '1').catch((e: Error) => expect(e.message).not.toContain('SECRET'));
  });
});

describe('passwords', () => {
  it('hashes with a random salt and verifies only the right password', async () => {
    const h1 = await hashPassword('رمز من ۱۲۳');
    const h2 = await hashPassword('رمز من ۱۲۳');
    expect(h1).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('رمز من ۱۲۳', h1)).toBe(true);
    expect(await verifyPassword('رمز من ۱۲۴', h1)).toBe(false);
    expect(await verifyPassword('رمز من ۱۲۳', null)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});
