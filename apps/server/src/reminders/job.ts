import { formatDate, formatTime } from '@kelid/core/format';
import { withJob, type Pool } from '../db';
import type { SmsSender } from '../auth/sms';

const BATCH = 20;
const MAX_ATTEMPTS = 3;
const RETRY_MS = 2 * 60 * 1000;
// پیامکی که دیگر نمی‌رسد پیش از قرار خوانده شود، فرستاده نمی‌شود.
const LAST_CALL_MS = 5 * 60 * 1000;
// «در حال فرستادن» که این‌قدر مانده یعنی سرور وسط کار افتاده؛ دوباره نمی‌فرستیم تا مشتری دو پیامک نگیرد.
const STUCK_MS = 10 * 60 * 1000;

interface Claimed {
  office_id: string;
  visit_id: string;
  phone: string;
  starts_at: Date;
  place: string;
  attempts: number;
  office: string;
  active: boolean;
}

const tehranDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' });

/** «امروز» یا «فردا» به وقت تهران، وگرنه تاریخ کوتاه. */
export function reminderDay(starts: Date, now: Date): string {
  const day = (d: Date) => tehranDay.format(d);
  if (day(starts) === day(now)) return 'امروز';
  if (day(starts) === day(new Date(now.getTime() + 86_400_000))) return 'فردا';
  return formatDate(starts);
}

/**
 * فرستندهٔ یادآوری‌ها. هر دور یادآوری‌های رسیده را با `skip locked` برمی‌دارد (چند نمونهٔ سرور یک پیامک را دو بار نمی‌فرستند)،
 * پیامک را بیرون از تراکنش می‌فرستد و نتیجه را ثبت می‌کند. دسترسی فقط از راه withJob و سیاست kelid_job است.
 */
export class ReminderJob {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<unknown> | null = null;

  constructor(
    private pool: Pool,
    private sms: SmsSender,
    private log: (e: unknown) => void = () => {},
  ) {}

  async runOnce(now = new Date()): Promise<number> {
    const claimed = await withJob(this.pool, async (db) => {
      await db.query(
        "update reminders set status = 'failed', updated_at = now() where status = 'sending' and claimed_at < $1",
        [new Date(now.getTime() - STUCK_MS)],
      );
      const { rows } = await db.query<Claimed>(
        `with due as (
           select office_id, visit_id from reminders
            where status = 'pending' and send_at <= $1
            order by send_at limit $2 for update skip locked)
         update reminders r set status = 'sending', claimed_at = $1, attempts = r.attempts + 1, updated_at = now()
           from due, offices o
          where r.office_id = due.office_id and r.visit_id = due.visit_id and o.id = r.office_id
         returning r.office_id, r.visit_id, r.phone, r.starts_at, r.place, r.attempts, o.name as office,
                   o.expires_at > $1 and o.suspended_at is null as active`,
        [now, BATCH],
      );
      return rows;
    });

    await Promise.all(
      claimed.map(async (r) => {
        let status: 'sent' | 'pending' | 'failed' | 'canceled';
        // دفتری که اشتراکش تمام شده یا قراری که شروع شده، پیامک نمی‌گیرد.
        if (!r.active || r.starts_at.getTime() - now.getTime() < LAST_CALL_MS) status = 'canceled';
        else {
          try {
            await this.sms.sendReminder(r.phone, { office: r.office, day: reminderDay(r.starts_at, now), time: formatTime(r.starts_at.toISOString()), place: r.place });
            status = 'sent';
          } catch (e) {
            this.log(e);
            const retry = now.getTime() + RETRY_MS;
            status = r.attempts < MAX_ATTEMPTS && r.starts_at.getTime() - retry >= LAST_CALL_MS ? 'pending' : 'failed';
          }
        }
        await withJob(this.pool, (db) =>
          db.query(
            `update reminders set status = $3, updated_at = now(),
                    sent_at = case when $3 = 'sent' then $4 else sent_at end,
                    send_at = case when $3 = 'pending' then $4::timestamptz + make_interval(secs => $5) else send_at end
              where office_id = $1 and visit_id = $2 and status = 'sending' and claimed_at = $4`,
            [r.office_id, r.visit_id, status, now, RETRY_MS / 1000],
          ),
        );
      }),
    );
    return claimed.length;
  }

  /** هر چند ثانیه یک دور؛ دورها روی هم نمی‌افتند. */
  start(everyMs = 30_000) {
    const tick = () => {
      this.running = this.runOnce()
        .catch(this.log)
        .finally(() => {
          this.running = null;
          if (this.timer) this.timer = setTimeout(tick, everyMs);
        });
    };
    this.timer = setTimeout(tick, 1_000);
  }

  async stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.running;
  }
}
