import { afterEach, describe, expect, it, vi } from 'vitest';
import { floorLabel, listingPlace, formatPlaque, formatToman, matchListing, normalizeForSearch, filterListings, seedListings, seedClients, newId } from './index';

describe('persian', () => {
  it('normalizes spacing, letters and digits for search', () => {
    expect(normalizeForSearch('سعادت آباد')).toBe(normalizeForSearch('سعادت‌آباد'));
    expect(normalizeForSearch('كريمي')).toBe(normalizeForSearch('کریمی'));
    expect(normalizeForSearch('۰۲۷')).toBe('027');
  });

  it('formats plaques with three Persian digits', () => {
    expect(formatPlaque(27)).toBe('۰۲۷');
    expect(formatPlaque(null)).toBe('؟');
  });
});

describe('format', () => {
  it('formats toman amounts', () => {
    expect(formatToman(28_000_000_000)).toBe('۲۸ میلیارد');
    expect(formatToman(2_200_000_000)).toBe('۲٫۲ میلیارد');
    expect(formatToman(800_000_000)).toBe('۸۰۰ میلیون');
  });
  it('calls floor zero همکف', () => {
    const l = seedListings[0]!;
    expect(floorLabel({ ...l, floor: 0, floorsTotal: undefined })).toBe('همکف');
    expect(floorLabel({ ...l, floor: 0, floorsTotal: 4 })).toBe('همکف از ۴');
    expect(floorLabel({ ...l, floor: 3, floorsTotal: undefined })).toBe('۳');
    expect(floorLabel({ ...l, floor: undefined })).toBe('—');
  });
  it('joins place without a dangling comma', () => {
    expect(listingPlace({ neighborhood: 'ونک', street: 'ملاصدرا' })).toBe('ونک، ملاصدرا');
    expect(listingPlace({ neighborhood: 'ونک', street: '' })).toBe('ونک');
  });
});

describe('search', () => {
  it('finds listings by plaque code and neighborhood', () => {
    expect(filterListings(seedListings, { query: '۰۲۷' }).map((l) => l.plaque)).toEqual([27]);
    expect(filterListings(seedListings, { query: 'سعادت آباد' }).length).toBe(2);
  });
});

describe('match', () => {
  it('scores a perfect match high and a wrong deal type zero', () => {
    const karimi = seedClients[0]!.need;
    const l027 = seedListings.find((l) => l.plaque === 27)!;
    const l031 = seedListings.find((l) => l.plaque === 31)!;
    expect(matchListing(l027, karimi).score).toBeGreaterThanOrEqual(95);
    expect(matchListing(l031, karimi).score).toBe(0);
  });
});

describe('id', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes v4 UUIDs even where crypto.randomUUID is missing (phone over plain http)', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newId()).toMatch(uuid);
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(uuid);
  });
});
