import { describe, expect, it } from 'vitest';
import { cleanVoiceDraft, voiceSchema } from './voice';

describe('voice draft', () => {
  it('keeps only valid listing fields and drops nulls', () => {
    const d = cleanVoiceDraft('listing', {
      deal: 'sale',
      kind: 'apartment',
      neighborhood: '  سعادت‌آباد ',
      area: 120.4,
      bedrooms: 2,
      floor: 0,
      total: 8_500_000_000,
      rent: 20_000_000,
      features: ['پارکینگ', 'پارکینگ', '', 3],
      ownerPhone: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
      street: null,
      negotiable: 'yes',
      hacked: 'x',
    });
    expect(d).toEqual({
      deal: 'sale',
      kind: 'apartment',
      neighborhood: 'سعادت‌آباد',
      area: 120,
      bedrooms: 2,
      floor: 0,
      total: 8_500_000_000,
      features: ['پارکینگ'],
      ownerPhone: '09123456789',
    });
  });

  it('rejects out-of-range numbers and unknown enum values', () => {
    expect(cleanVoiceDraft('listing', { area: -5, yearBuilt: 2024, kind: 'castle', deal: 'lease' })).toEqual({});
    expect(cleanVoiceDraft('client', 'nonsense')).toEqual({});
  });

  it('cleans a client draft', () => {
    const d = cleanVoiceDraft('client', {
      name: 'خانم احمدی',
      deal: 'rent',
      kinds: ['apartment', 'apartment', 'castle'],
      neighborhoods: ['ونک', ' ونک '],
      areaMin: 120,
      areaMax: 80,
      budget: 500_000_000,
      rent: 15_000_000,
      temperature: 'hot',
      waiting: true,
    });
    expect(d).toEqual({ name: 'خانم احمدی', deal: 'rent', kinds: ['apartment'], neighborhoods: ['ونک'], areaMin: 80, areaMax: 120, budget: 500_000_000, rent: 15_000_000, temperature: 'hot', waiting: true });
    expect(cleanVoiceDraft('client', { deal: 'sale', rent: 1000 })).toEqual({ deal: 'sale' });
  });

  it('builds a strict schema that names every field', () => {
    const s = voiceSchema('client') as { required: string[]; properties: Record<string, { type: string[] }>; additionalProperties: boolean };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(Object.keys(s.properties));
    expect(s.properties.kinds?.type).toContain('null');
  });
});
