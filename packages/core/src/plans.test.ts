import { describe, expect, it } from 'vitest';
import { decodeLicense, encodeLicense, licenseInfo, monthlyOf, nextExpiry, planById, PLANS, priceOf, seatsFor, termDays, type LicensePayload } from './plans';

const DAY = 86_400_000;
const now = Date.parse('2026-10-08T12:00:00Z');
const office = planById('office')!;
const pro = planById('pro')!;
const solo = planById('solo')!;

describe('plans', () => {
  it('discounts longer terms and adds their gift months', () => {
    expect(priceOf(office, 'month')).toBe(office.monthly);
    expect(priceOf(office, 'half')).toBe(18_900_000);
    expect(priceOf(office, 'year')).toBe(35_700_000);
    expect([termDays('month'), termDays('half'), termDays('year')]).toEqual([30, 213, 426]);
    expect(new Set(PLANS.map((p) => p.id)).size).toBe(PLANS.length);
  });

  it('charges each seat beyond the base of a plan that sells extra seats', () => {
    expect(seatsFor(pro, 15)).toBe(15);
    expect(seatsFor(pro, 3)).toBe(pro.seats);
    expect(seatsFor(pro, 9999)).toBe(pro.extra!.max);
    expect(seatsFor(office, 15)).toBe(office.seats);
    expect(monthlyOf(pro, 15)).toBe(pro.monthly + 3 * pro.extra!.monthly);
    expect(priceOf(pro, 'month', 14)).toBe(6_500_000);
  });

  it('adds a period after the remaining days of the same plan or the trial', () => {
    const in5 = new Date(now + 5 * DAY).toISOString();
    expect(nextExpiry({ plan: 'office', trial: false, expiresAt: in5 }, office, 'month', now)).toBe(now + 35 * DAY);
    // روزهای آزمایشی کامل می‌مانند، حتی با پلن دیگر.
    expect(nextExpiry({ plan: 'office', trial: true, expiresAt: in5 }, pro, 'year', now)).toBe(now + 5 * DAY + 426 * DAY);
  });

  it('starts from now when the subscription already ended', () => {
    const ago = new Date(now - 40 * DAY).toISOString();
    expect(nextExpiry({ plan: 'office', trial: false, expiresAt: ago }, office, 'month', now)).toBe(now + 30 * DAY);
  });

  it('converts the value of the remaining days when the plan changes', () => {
    const in10 = new Date(now + 10 * DAY).toISOString();
    const up = nextExpiry({ plan: 'office', trial: false, expiresAt: in10 }, pro, 'month', now);
    expect(up).toBe(now + Math.floor((10 * DAY * office.monthly) / pro.monthly) + 30 * DAY);
    const down = nextExpiry({ plan: 'office', trial: false, expiresAt: in10 }, solo, 'month', now);
    expect(down).toBeGreaterThan(now + 40 * DAY);
    // نفر بیشتر روی همان پلن هم ارتقاست.
    const more = nextExpiry({ plan: 'pro', trial: false, expiresAt: in10, seats: 12 }, pro, 'month', now, 14);
    expect(more).toBe(now + Math.floor((10 * DAY * pro.monthly) / monthlyOf(pro, 14)) + 30 * DAY);
  });
});

describe('license', () => {
  const base: LicensePayload = {
    v: 1,
    off: 'o1',
    plan: 'office',
    seats: 5,
    trial: false,
    exp: (now + 30 * DAY) / 1000,
    iat: now / 1000,
    chk: (now + 14 * DAY) / 1000,
  };

  it('round-trips the signed part', () => {
    const body = encodeLicense(base);
    const d = decodeLicense(`${body}.AAAA`);
    expect(d?.payload).toEqual(base);
    expect(d?.body).toBe(body);
    expect(decodeLicense('nope')).toBeNull();
    expect(decodeLicense(`${body}.AA.x`)).toBeNull();
  });

  it('tells the phase', () => {
    expect(licenseInfo(base, now)).toMatchObject({ phase: 'active', readOnly: false, daysLeft: 30 });
    expect(licenseInfo({ ...base, trial: true }, now).phase).toBe('trial');
    expect(licenseInfo(base, now + 25 * DAY).phase).toBe('stale');
    expect(licenseInfo({ ...base, chk: base.exp }, now + 24 * DAY)).toMatchObject({ phase: 'ending', daysLeft: 6, readOnly: false });
    expect(licenseInfo(base, now + 31 * DAY)).toMatchObject({ phase: 'expired', readOnly: true, daysLeft: 0 });
    expect(licenseInfo({ ...base, sus: true }, now)).toMatchObject({ phase: 'suspended', readOnly: true });
  });
});
