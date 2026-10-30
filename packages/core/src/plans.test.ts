import { describe, expect, it } from 'vitest';
import { bestTerm, DEFAULT_CATALOG, decodeLicense, encodeLicense, forSale, licenseInfo, monthlyOf, nextExpiry, priceOf, seatsFor, termDays, type LicensePayload } from './plans';

const DAY = 86_400_000;
const now = Date.parse('2026-10-08T12:00:00Z');
const plan = (id: string) => DEFAULT_CATALOG.plans.find((p) => p.id === id)!;
const term = (id: string) => DEFAULT_CATALOG.terms.find((t) => t.id === id)!;
const office = plan('office');
const pro = plan('pro');
const solo = plan('solo');
const [month, half, year] = [term('month'), term('half'), term('year')];

describe('plans', () => {
  it('discounts longer terms and adds their gift months', () => {
    expect(priceOf(office, month)).toBe(office.monthly);
    expect(priceOf(office, half)).toBe(26_950_000);
    expect(priceOf(office, year)).toBe(51_100_000);
    expect([termDays(month), termDays(half), termDays(year)]).toEqual([30, 213, 426]);
    expect(new Set(DEFAULT_CATALOG.plans.map((p) => p.id)).size).toBe(DEFAULT_CATALOG.plans.length);
    expect(bestTerm(DEFAULT_CATALOG.terms)).toBe(year);
  });

  it('charges each seat beyond the base of a plan that sells extra seats', () => {
    expect(seatsFor(pro, 15)).toBe(15);
    expect(priceOf(pro, year, 12)).toBe((7_200_000 + 2 * 350_000) * 14);
    expect(seatsFor(pro, 3)).toBe(pro.seats);
    expect(seatsFor(pro, 9999)).toBe(pro.extra!.max);
    expect(seatsFor(office, 15)).toBe(office.seats);
    expect(monthlyOf(pro, 15)).toBe(pro.monthly + 5 * pro.extra!.monthly);
    expect(priceOf(pro, month, 14)).toBe(11_900_000);
  });

  it('adds a period after the remaining days of the same plan or the trial', () => {
    const in5 = new Date(now + 5 * DAY).toISOString();
    expect(nextExpiry({ plan: 'office', trial: false, expiresAt: in5 }, plan('office'), office, termDays(month), now)).toBe(now + 35 * DAY);
    // روزهای آزمایشی کامل می‌مانند، حتی با پلن دیگر.
    expect(nextExpiry({ plan: 'office', trial: true, expiresAt: in5 }, plan('office'), pro, termDays(year), now)).toBe(now + 5 * DAY + 426 * DAY);
  });

  it('starts from now when the subscription already ended', () => {
    const ago = new Date(now - 40 * DAY).toISOString();
    expect(nextExpiry({ plan: 'office', trial: false, expiresAt: ago }, plan('office'), office, termDays(month), now)).toBe(now + 30 * DAY);
  });

  it('converts the value of the remaining days when the plan changes', () => {
    const in10 = new Date(now + 10 * DAY).toISOString();
    const up = nextExpiry({ plan: 'office', trial: false, expiresAt: in10 }, plan('office'), pro, termDays(month), now);
    expect(up).toBe(now + Math.floor((10 * DAY * office.monthly) / pro.monthly) + 30 * DAY);
    const down = nextExpiry({ plan: 'office', trial: false, expiresAt: in10 }, plan('office'), solo, termDays(month), now);
    expect(down).toBeGreaterThan(now + 40 * DAY);
    // نفر بیشتر روی همان پلن هم ارتقاست.
    const more = nextExpiry({ plan: 'pro', trial: false, expiresAt: in10, seats: 12 }, plan('pro'), pro, termDays(month), now, 14);
    expect(more).toBe(now + Math.floor((10 * DAY * monthlyOf(pro, 12)) / monthlyOf(pro, 14)) + 30 * DAY);
  });
});

describe('catalog', () => {
  it('offers only what is not hidden, and picks the cheapest month as the best term', () => {
    const c = { plans: [office, { ...pro, hidden: true }], terms: [month, { ...year, hidden: true }, half] };
    expect(forSale(c)).toEqual({ plans: [office], terms: [month, half] });
    expect(bestTerm(forSale(c).terms)).toBe(half);
    expect(bestTerm([])).toBeUndefined();
  });

  it('keeps the days of a plan that is no longer in the catalog', () => {
    const in10 = new Date(now + 10 * DAY).toISOString();
    expect(nextExpiry({ plan: 'gone', trial: false, expiresAt: in10 }, undefined, office, 30, now)).toBe(now + 40 * DAY);
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
