import { describe, expect, it } from 'vitest';
import { loadCity, match, search, streetKind } from './places';

describe('place suggestions', () => {
  it('finds a street by the name after its kind, and marks the matched part', () => {
    const hit = match('خیابان لیان غربی', 'ليان');
    expect(hit).toMatchObject({ score: 1, at: 7, len: 4 });
    expect(match('بلوار خلیج‌فارس', 'خلیج فارس')).toMatchObject({ score: 0 });
    expect(match('بازار', 'لیان')).toBeNull();
  });

  it('puts exact and leading matches first', () => {
    const got = search(['ریشهر', 'بهمنی', 'شهرک فضیلت', 'شهر'], 'شهر', (s) => s, 5).map((r) => r.item);
    expect(got).toEqual(['شهر', 'شهرک فضیلت', 'ریشهر']);
  });

  it('splits the street kind for its small label', () => {
    expect(streetKind('بلوار خلیج فارس')).toEqual({ kind: 'بلوار', rest: 'خلیج فارس' });
    expect(streetKind('شهید چمران')).toEqual({ kind: '', rest: 'شهید چمران' });
  });

  it('loads a city lazily with its zones', async () => {
    const c = await loadCity('بوشهر');
    expect(c?.zones.map((z) => z.name)).toEqual(['بهمنی', 'شهر', 'ریشهر']);
    expect(c?.hoods).toContain('بافت قدیم');
    expect(await loadCity('شهری که نیست')).toBeNull();
  });
});
