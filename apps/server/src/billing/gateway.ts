import { randomBytes, randomInt } from 'node:crypto';

/**
 * درگاه پرداخت پشت یک رابط تا عوض کردنش (زرین‌پال، پی‌پینگ، آیدی‌پی) فقط یک کلاس تازه باشد.
 * مبلغ همیشه ریال است. هیچ پرداختی بدون verify سمت سرور «پرداخت‌شده» حساب نمی‌شود؛ برگشت از درگاه فقط خبر است.
 */
export interface PaymentGateway {
  readonly name: 'zarinpal' | 'dev';
  /** شروع پرداخت؛ کاربر به payUrl می‌رود و بعد به callbackUrl برمی‌گردد. */
  request(p: { amount: number; description: string; callbackUrl: string; mobile?: string }): Promise<{ authority: string; payUrl: string }>;
  /** تأیید نهایی با خود درگاه؛ برگشت تکراری برای پرداختی که قبلاً تأیید شده هم ok است. */
  verify(p: { authority: string; amount: number }): Promise<{ ok: true; refId: string; card: string | null } | { ok: false }>;
}

export class GatewayError extends Error {}

const AUTHORITY = /^[A-Za-z0-9_-]{1,64}$/;

/** زرین‌پال، API نسخهٔ ۴. sandbox برای آزمایش با مرچنت آزمایشی. */
export class ZarinpalGateway implements PaymentGateway {
  readonly name = 'zarinpal';
  private readonly base: string;

  constructor(
    private readonly merchantId: string,
    sandbox = false,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.base = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  private async call(path: string, body: object): Promise<{ code?: number; authority?: unknown; ref_id?: unknown; card_pan?: unknown }> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}/pg/v4/payment/${path}.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ merchant_id: this.merchantId, ...body }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new GatewayError(`zarinpal unreachable: ${(e as Error).message}`);
    }
    // پاسخ خطا هم JSON است (errors.code)؛ data در آن آرایهٔ خالی است.
    const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
    const data = json && typeof json.data === 'object' && json.data && !Array.isArray(json.data) ? (json.data as Record<string, unknown>) : {};
    return { code: typeof data.code === 'number' ? data.code : undefined, authority: data.authority, ref_id: data.ref_id, card_pan: data.card_pan };
  }

  async request(p: { amount: number; description: string; callbackUrl: string; mobile?: string }) {
    const r = await this.call('request', {
      amount: p.amount,
      currency: 'IRR',
      description: p.description,
      callback_url: p.callbackUrl,
      ...(p.mobile ? { metadata: { mobile: p.mobile } } : {}),
    });
    if (r.code !== 100 || typeof r.authority !== 'string' || !AUTHORITY.test(r.authority))
      throw new GatewayError(`zarinpal request refused: ${r.code ?? 'no code'}`);
    return { authority: r.authority, payUrl: `${this.base}/pg/StartPay/${r.authority}` };
  }

  async verify(p: { authority: string; amount: number }) {
    const r = await this.call('verify', { amount: p.amount, authority: p.authority });
    // ۱۰۰ = تأیید شد، ۱۰۱ = قبلاً تأیید شده بود.
    if (r.code !== 100 && r.code !== 101) return { ok: false as const };
    const refId = typeof r.ref_id === 'number' || typeof r.ref_id === 'string' ? String(r.ref_id).slice(0, 64) : '';
    if (!refId) return { ok: false as const };
    return { ok: true as const, refId, card: typeof r.card_pan === 'string' ? r.card_pan.slice(0, 32) : null };
  }
}

/**
 * درگاه آزمایشی سرور محلی: صفحهٔ «پرداخت / انصراف» را خود سرور نشان می‌دهد (billing/routes.ts) و هر پرداختی را می‌پذیرد.
 * config در production اجازه‌اش را نمی‌دهد.
 */
export class DevGateway implements PaymentGateway {
  readonly name = 'dev';

  async request(p: { callbackUrl: string }) {
    const authority = `DEV${randomBytes(12).toString('hex')}`;
    // همان نشانی برگشت، ولی اول صفحهٔ «پرداخت / انصراف» آزمایشی.
    return { authority, payUrl: `${p.callbackUrl.replace('/billing/callback?', '/billing/dev-pay?')}&Authority=${authority}` };
  }

  async verify(p: { authority: string }) {
    if (!p.authority.startsWith('DEV')) return { ok: false as const };
    return { ok: true as const, refId: String(randomInt(100_000_000, 999_999_999)), card: '6037-99**-****-1234' };
  }
}
