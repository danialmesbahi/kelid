import type { FastifyReply, FastifyRequest } from 'fastify';
import type { KeyObject } from 'node:crypto';
import type { PlanId } from '@kelid/core/plans';
import { withOffice, type Db, type Pool } from '../db';
import { signLicense } from './license';

export interface Subscription {
  plan: PlanId;
  trial: boolean;
  expiresAt: Date;
  seats: number;
  /** تیم کلید دفتر را معلق کرده (پنل فروشنده)؛ مثل اشتراک تمام‌شده فقط خواندن باز است. */
  suspended: boolean;
  active: boolean;
}

/** اشتراک دفتر؛ دفتر تراکنش باید از قبل همین دفتر باشد (withOffice یا set_config). */
export async function readSubscription(db: Db, officeId: string): Promise<Subscription | null> {
  const { rows } = await db.query<{ plan: string; trial: boolean; expires_at: Date; seats: number; suspended: boolean; active: boolean }>(
    `select plan, trial, expires_at, seats, suspended_at is not null as suspended,
            expires_at > now() and suspended_at is null as active
       from offices where id = $1`,
    [officeId],
  );
  const r = rows[0];
  if (!r) return null;
  // ردیف پلن هیچ‌وقت پاک نمی‌شود (حذف از پنل نرم است)، پس پلن دفتر تا خرید بعدی همان می‌ماند.
  return { plan: r.plan, trial: r.trial, expiresAt: r.expires_at, seats: r.seats, suspended: r.suspended, active: r.active };
}

export function licenseOf(key: KeyObject, officeId: string, s: Subscription): string {
  return signLicense(key, { office: officeId, plan: s.plan, seats: s.seats, trial: s.trial, expiresAt: s.expiresAt, suspended: s.suspended });
}

/**
 * نوشتن داده (ارسال تغییرها، عکس، دعوت همکار) فقط با اشتراک فعال. خواندن همیشه باز است:
 * دفتری که اشتراکش تمام شده هم اطلاعاتش را می‌بیند و چیزی از دستش نمی‌رود.
 */
export function requireActive(pool: Pool) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const off = req.auth!.off;
    const s = await withOffice(pool, off, (db) => readSubscription(db, off));
    if (!s?.active) return reply.status(402).send({ error: 'subscription' });
  };
}
