import { describe, expect, it } from 'vitest';
import { GatewayError, ZarinpalGateway } from './gateway';
import { DEV_LICENSE_SEED, licenseKey, publicKeyOf, signLicense, verifyLicense } from './license';

/** fetch ساختگی که درخواست‌ها را نگه می‌دارد و پاسخ آماده برمی‌گرداند. */
function fakeFetch(reply: (url: string, body: Record<string, unknown>) => unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ url, body });
    return new Response(JSON.stringify(reply(url, body)), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const MERCHANT = '1344b5d4-0048-11e8-94db-005056a205be';

describe('zarinpal', () => {
  it('starts a payment in rials and sends the user to StartPay', async () => {
    const f = fakeFetch(() => ({ data: { code: 100, authority: 'A0000000000000000000000000000123456789' }, errors: [] }));
    const g = new ZarinpalGateway(MERCHANT, true, f.fn);
    const r = await g.request({
      amount: 4_900_000,
      description: 'اشتراک',
      callbackUrl: 'https://api.kelid.ir/billing/callback?o=x&p=y',
      mobile: '09120000000',
    });
    expect(r.payUrl).toBe('https://sandbox.zarinpal.com/pg/StartPay/A0000000000000000000000000000123456789');
    expect(f.calls[0]!.url).toBe('https://sandbox.zarinpal.com/pg/v4/payment/request.json');
    expect(f.calls[0]!.body).toMatchObject({ merchant_id: MERCHANT, amount: 4_900_000, currency: 'IRR', metadata: { mobile: '09120000000' } });
  });

  it('refuses an error answer or a strange authority', async () => {
    await expect(
      new ZarinpalGateway(MERCHANT, false, fakeFetch(() => ({ data: [], errors: { code: -9 } })).fn).request({
        amount: 1000,
        description: 'x',
        callbackUrl: 'https://a',
      }),
    ).rejects.toThrow(GatewayError);
    await expect(
      new ZarinpalGateway(MERCHANT, false, fakeFetch(() => ({ data: { code: 100, authority: '../x' } })).fn).request({
        amount: 1000,
        description: 'x',
        callbackUrl: 'https://a',
      }),
    ).rejects.toThrow(GatewayError);
  });

  it('accepts verified (100) and already verified (101), nothing else', async () => {
    const ok = new ZarinpalGateway(MERCHANT, false, fakeFetch(() => ({ data: { code: 101, ref_id: 201, card_pan: '502229******5995' } })).fn);
    expect(await ok.verify({ authority: 'A1', amount: 1000 })).toEqual({ ok: true, refId: '201', card: '502229******5995' });
    const f = fakeFetch(() => ({ data: [], errors: { code: -51 } }));
    expect(await new ZarinpalGateway(MERCHANT, false, f.fn).verify({ authority: 'A1', amount: 1000 })).toEqual({ ok: false });
    expect(f.calls[0]!.url).toBe('https://payment.zarinpal.com/pg/v4/payment/verify.json');
    expect(f.calls[0]!.body).toEqual({ merchant_id: MERCHANT, amount: 1000, authority: 'A1' });
  });
});

describe('license', () => {
  it('signs with Ed25519 and checks against the public key', () => {
    const key = licenseKey(DEV_LICENSE_SEED);
    const token = signLicense(key, { office: 'o', plan: 'office', seats: 5, trial: true, expiresAt: new Date(Date.now() + 864e5) });
    expect(publicKeyOf(key)).toBe('I_UYFLmVD4B6Keak4m76BO-F2qZ6j6DYds_BPbqhstc');
    expect(verifyLicense(publicKeyOf(key), token)).toBe(true);
    expect(verifyLicense(publicKeyOf(licenseKey('A'.repeat(43))), token)).toBe(false);
    expect(() => licenseKey('short')).toThrow();
  });
});
