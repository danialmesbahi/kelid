import { describe, expect, it } from 'vitest';
import { mergeDrafts, ruleDraft } from './voiceRules';

const hints = ['ونک', 'پونک', 'سعادت‌آباد'];
const listing = (t: string) => ruleDraft('listing', t, hints, 1405);
const client = (t: string) => ruleDraft('client', t, hints, 1405);

describe('voice rules (no language model)', () => {
  it('reads a full sale file', () => {
    expect(
      listing('آپارتمان فروشی در سعادت آباد صد و بیست متر دو خواب طبقه سوم از پنج طبقه، ده سال ساخت، پارکینگ و آسانسور داره انباری نداره، قیمت هشت و نیم میلیارد قابل مذاکره، مالک آقای رضایی شماره صفر نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه'),
    ).toEqual({
      deal: 'sale', kind: 'apartment', neighborhood: 'سعادت‌آباد', area: 120, bedrooms: 2, floor: 3, floorsTotal: 5, yearBuilt: 1395,
      features: ['پارکینگ', 'آسانسور'], total: 8_500_000_000, negotiable: true, ownerName: 'آقای رضایی', ownerPhone: '09123456789',
    });
  });

  it('reads rent, short amounts and per-metre prices', () => {
    expect(listing('یه واحد رهن و اجاره تو ونک، هشتاد و پنج متری، یک خوابه، همکف، رهن پانصد میلیون اجاره بیست')).toEqual({
      deal: 'rent', neighborhood: 'ونک', area: 85, bedrooms: 1, floor: 0, deposit: 500_000_000, rent: 20_000_000,
    });
    expect(listing('مغازه برای فروش خیابون ولیعصر، چهل متر، متری دویست میلیون')).toEqual({ deal: 'sale', kind: 'shop', street: 'خیابان ولیعصر', area: 40, total: 8_000_000_000 });
    expect(listing('آپارتمان فروشی تو تجریش صد متر')).toMatchObject({ neighborhood: 'تجریش', area: 100 });
  });

  it('knows the office city neighbourhoods, but not plain words among them', () => {
    const bushehr = ['سنگی', 'بهمنی', 'شهر', 'ریشهر', 'عالی آباد'];
    expect(ruleDraft('client', 'مشتری آقای سامان مغازه می خواهد، تو خیابون سنگی یکصد و بیست متر قیمت: سی و دو میلیارد', [...hints, ...bushehr], 1405)).toMatchObject({
      neighborhoods: ['سنگی'], areaMin: 120, budget: 32_000_000_000,
    });
    expect(ruleDraft('listing', 'آپارتمان فروشی بهمنی صد متر، نزدیک مرکز شهر', bushehr, 1405)).toMatchObject({ neighborhood: 'بهمنی', area: 100 });
    expect(ruleDraft('listing', 'یه آپارتمان تو شهر صد متر', ['شهر'], 1405)).not.toHaveProperty('neighborhood', 'شهر');
  });

  it('reads a customer as Avanegar wrote it', () => {
    expect(client('مشتری آقای سامان شماره تو مغازه می خواهد، تو خیابون سنگی یکصد و بیست متر قیمت: سی و دو میلیارد')).toEqual({
      name: 'آقای سامان', deal: 'sale', kinds: ['shop'], neighborhoods: ['خیابان سنگی'], areaMin: 120, budget: 32_000_000_000,
    });
    expect(client('خانم احمدی دنبال رهن کامل آپارتمان تو پونک یا ونک، بین صد تا صد و بیست متر، دو خواب، تا دو میلیارد، عجله داره')).toEqual({
      name: 'خانم احمدی', deal: 'full', kinds: ['apartment'], neighborhoods: ['پونک', 'ونک'], areaMin: 100, areaMax: 120, bedroomsMin: 2, budget: 2_000_000_000, temperature: 'hot',
    });
    expect(client('آقای کریمی خونه ویلایی تو پونک می‌خواد')).toEqual({ name: 'آقای کریمی', kinds: ['villa'], neighborhoods: ['پونک'] });
  });

  it('fills only what the model left empty', () => {
    expect(mergeDrafts('listing', { area: 110 }, { area: 120, bedrooms: 2 })).toEqual({ area: 110, bedrooms: 2 });
  });
});
