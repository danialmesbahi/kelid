/**
 * محدودیت ساده با پنجرهٔ ثابت در حافظه (برای IP). سقف‌های هر شماره در دیتابیس‌اند تا با راه‌اندازی دوباره پاک نشوند.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** null یعنی مجاز؛ وگرنه چند ثانیه تا آزاد شدن. */
  take(key: string, now = Date.now()): number | null {
    if (this.hits.size > 50_000) this.sweep(now);
    const h = this.hits.get(key);
    if (!h || h.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return null;
    }
    if (h.count >= this.max) return Math.ceil((h.resetAt - now) / 1000);
    h.count++;
    return null;
  }

  private sweep(now: number) {
    for (const [k, h] of this.hits) if (h.resetAt <= now) this.hits.delete(k);
  }
}
