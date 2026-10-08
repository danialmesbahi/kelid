import { describe, expect, it } from 'vitest';
import { base32, checkTotp, newTotpSecret, totpAt, totpStep } from './totp';

describe('totp', () => {
  it('matches the RFC 6238 test vectors (SHA-1, six digits)', () => {
    const secret = base32(Buffer.from('12345678901234567890'));
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totpAt(secret, totpStep(59_000))).toBe('287082');
    expect(totpAt(secret, totpStep(1_111_111_109_000))).toBe('081804');
    expect(totpAt(secret, totpStep(2_000_000_000_000))).toBe('279037');
  });

  it('accepts one step of clock drift, never an old or reused code', () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const now = Date.now();
    const step = totpStep(now);
    expect(checkTotp(secret, totpAt(secret, step), 0, now)).toBe(step);
    expect(checkTotp(secret, totpAt(secret, step - 1), 0, now)).toBe(step - 1);
    expect(checkTotp(secret, totpAt(secret, step + 1), 0, now)).toBe(step + 1);
    expect(checkTotp(secret, totpAt(secret, step - 2), 0, now)).toBeNull();
    expect(checkTotp(secret, totpAt(secret, step), step, now)).toBeNull();
    expect(checkTotp(secret, '12345', 0, now)).toBeNull();
  });
});
