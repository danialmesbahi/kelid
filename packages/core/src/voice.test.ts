import { describe, expect, it } from 'vitest';
import { cleanVoiceDraft, voiceSchema, withSpokenPrices } from './voice';

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

  it('keeps only complete phone numbers from the model', () => {
    const phone = (v: unknown) => cleanVoiceDraft('client', { phone: v }).phone;
    expect(phone('۰۹۱۲ ۳۴۵ ۶۷ ۸۹')).toBe('09123456789');
    expect(phone('9123456789')).toBe('09123456789');
    expect(phone('+98 912 345 6789')).toBe('09123456789');
    expect(phone('2122334455')).toBe('02122334455');
    expect(phone('22334455')).toBe('22334455');
    expect(phone('0912345678')).toBeUndefined();
    expect(phone('091234567890')).toBeUndefined();
    expect(phone('12345')).toBeUndefined();
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

  it('infers the deal from the prices that were said', () => {
    expect(cleanVoiceDraft('listing', { total: 3_000_000_000 })).toEqual({ deal: 'sale', total: 3_000_000_000 });
    expect(cleanVoiceDraft('listing', { deposit: 500_000_000, rent: 20_000_000 })).toEqual({ deal: 'rent', deposit: 500_000_000, rent: 20_000_000 });
  });

  it('takes a price the model missed from the transcript', () => {
    const t = 'آپارتمان ونک صد و بیست متر قیمت هشت و نیم میلیارد';
    expect(withSpokenPrices('listing', t, { neighborhood: 'ونک', area: 120 })).toEqual({ deal: 'sale', neighborhood: 'ونک', area: 120, total: 8_500_000_000 });
    expect(withSpokenPrices('listing', t, { area: 120, total: 8_400_000_000 })).toMatchObject({ total: 8_400_000_000 });
    expect(withSpokenPrices('listing', 'صد متر، متری صد میلیون', { area: 100 })).toMatchObject({ total: 10_000_000_000 });
    expect(withSpokenPrices('listing', 'رهن کامل، رهن دو میلیارد', { deal: 'full' })).toEqual({ deal: 'full', deposit: 2_000_000_000 });
    expect(withSpokenPrices('client', 'دنبال خرید، بودجه‌اش تا پنج میلیارد', { deal: 'sale' })).toEqual({ deal: 'sale', budget: 5_000_000_000 });
  });
});
