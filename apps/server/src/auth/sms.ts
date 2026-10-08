/** هر سرویس پیامکی پشت همین رابط است؛ عوض کردنش به مسیرها دست نمی‌زند. */
export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
  /** یادآوری قرار به مشتری؛ بی‌قالب تأییدشده (production بدون KAVENEGAR_REMINDER_TEMPLATE) خطا می‌دهد. */
  sendReminder(phone: string, r: ReminderSms): Promise<void>;
}

export interface ReminderSms {
  /** نام دفتر */
  office: string;
  /** «امروز»، «فردا» یا نام روز؛ بی‌فاصله */
  day: string;
  /** «۱۶:۳۰» */
  time: string;
  /** محلهٔ ملک؛ ممکن است خالی باشد */
  place: string;
}

/** متن کامل یادآوری؛ قالب کاوه‌نگار هم باید همین را بسازد (docs/ARCHITECTURE.md). */
export function reminderText(r: ReminderSms): string {
  return `${r.office}: یادآوری قرار شما ${r.day} ساعت ${r.time}${r.place ? `، ${r.place}` : ''}.`;
}

/** فقط توسعه: کد را در لاگ نشان می‌دهد. در production سرور با آن بالا نمی‌آید (config.ts). */
export class ConsoleSms implements SmsSender {
  async sendOtp(phone: string, code: string) {
    console.warn(`[dev sms] ${phone} → ${code}`);
  }

  async sendReminder(phone: string, r: ReminderSms) {
    console.warn(`[dev sms] ${phone} → ${reminderText(r)}`);
  }
}

/** کاوه‌نگار، با قالب تأییدشدهٔ «verify/lookup» (سریع‌ترین مسیر و بدون محدودیت متن تبلیغاتی). */
export class KavenegarSms implements SmsSender {
  constructor(
    private readonly apiKey: string,
    private readonly template: string,
    private readonly fetchFn: typeof fetch = fetch,
    /** قالب یادآوری: token = ساعت، token2 = روز، token10 = محله (تا ۵ کلمه)، token20 = نام دفتر (تا ۸ کلمه) */
    private readonly reminderTemplate = '',
  ) {}

  async sendOtp(phone: string, code: string) {
    await this.lookup({ receptor: phone, token: code, template: this.template });
  }

  async sendReminder(phone: string, r: ReminderSms) {
    if (!this.reminderTemplate) throw new Error('kavenegar: no reminder template');
    // کاوه‌نگار فاصله را فقط در token10 و token20 می‌پذیرد؛ کلمه‌های اضافه بریده می‌شوند.
    const words = (s: string, n: number) => s.trim().split(/\s+/).slice(0, n).join(' ');
    await this.lookup({
      receptor: phone,
      template: this.reminderTemplate,
      token: r.time,
      token2: r.day.trim().replace(/\s+/g, '-'),
      token10: words(r.place, 5) || '-',
      token20: words(r.office, 8),
    });
  }

  private async lookup(params: Record<string, string>) {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(8_000),
    });
    // پیام خطا کلید API را در آدرس دارد؛ فقط کد وضعیت گزارش می‌شود.
    if (!res.ok) throw new Error(`kavenegar: HTTP ${res.status}`);
  }
}
