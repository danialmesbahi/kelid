/** هر سرویس پیامکی پشت همین رابط است؛ عوض کردنش به مسیرها دست نمی‌زند. */
export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** فقط توسعه: کد را در لاگ نشان می‌دهد. در production سرور با آن بالا نمی‌آید (config.ts). */
export class ConsoleSms implements SmsSender {
  async sendOtp(phone: string, code: string) {
    console.warn(`[dev sms] ${phone} → ${code}`);
  }
}

/** کاوه‌نگار، با قالب تأییدشدهٔ «verify/lookup» (سریع‌ترین مسیر و بدون محدودیت متن تبلیغاتی). */
export class KavenegarSms implements SmsSender {
  constructor(
    private readonly apiKey: string,
    private readonly template: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendOtp(phone: string, code: string) {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ receptor: phone, token: code, template: this.template }),
      signal: AbortSignal.timeout(8_000),
    });
    // پیام خطا کلید API را در آدرس دارد؛ فقط کد وضعیت گزارش می‌شود.
    if (!res.ok) throw new Error(`kavenegar: HTTP ${res.status}`);
  }
}
