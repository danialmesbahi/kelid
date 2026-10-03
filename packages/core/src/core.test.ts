import { describe, expect, it } from 'vitest';
import { formatPlaque, formatToman, matchListing, normalizeForSearch, filterListings, seedListings, seedClients } from './index';

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
