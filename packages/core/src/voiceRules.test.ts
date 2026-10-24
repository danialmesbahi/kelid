import { describe, expect, it } from 'vitest';
import { mergeDrafts, ruleDraft, spokenPhone } from './voiceRules';

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
      deal: 'rent', kind: 'apartment', neighborhood: 'ونک', area: 85, bedrooms: 1, floor: 0, deposit: 500_000_000, rent: 20_000_000,
    });
    expect(listing('مغازه برای فروش خیابون ولیعصر، چهل متر، متری دویست میلیون')).toEqual({ deal: 'sale', kind: 'shop', street: 'خیابان ولیعصر', area: 40, total: 8_000_000_000 });
    expect(listing('آپارتمان فروشی تو تجریش صد متر')).toMatchObject({ neighborhood: 'تجریش', area: 100 });
  });

  it('reads short build years', () => {
    expect(listing('آپارتمان ونک صد متر سال ۴۰۵')).toMatchObject({ yearBuilt: 1405 });
    expect(listing('آپارتمان ونک صد متر ساخت سال نود و سه')).toMatchObject({ yearBuilt: 1393 });
    expect(listing('آپارتمان ونک صد متر، سال ساخت: 98')).toMatchObject({ yearBuilt: 1398 });
    expect(listing('آپارتمان ونک صد متر سال ۱۴۰۲')).toMatchObject({ yearBuilt: 1402 });
    expect(listing('آپارتمان ونک صد متر ساخت سه')).toMatchObject({ yearBuilt: 1403 });
    expect(listing('آپارتمان ونک صد متر ده سال ساخت')).toMatchObject({ yearBuilt: 1395 });
    expect(listing('آپارتمان ونک صد متر سال ۴۰۹')).not.toHaveProperty('yearBuilt');
  });

  it('reads Mahdi\'s real sentences', () => {
    expect(listing('سال چهارصد و پنج')).toEqual({ yearBuilt: 1405 });
    expect(listing('این خونه برای رهن کامله تو منطقه تجریش، خیابون پاسداران، چهارخوابه، سه طبقه. لابی هم داره.')).toMatchObject({
      deal: 'full', neighborhood: 'تجریش', street: 'خیابان پاسداران', bedrooms: 4, features: ['لابی و نگهبان'],
    });
    expect(listing('یه خونه دویست و هشتاد متری داخل بوشهر، خب قیمتش بیست و دو میلیارد')).toEqual({ deal: 'sale', area: 280, total: 22_000_000_000 });
  });

  it('matches spoken zone numbers against the city list', () => {
    expect(ruleDraft('listing', 'منطقه هجده', ['منطقه ۱۸', 'ونک'], 1405)).toEqual({ neighborhood: 'منطقه ۱۸' });
  });

  it('hears a roof garden as a fixed amenity', () => {
    expect(listing('آپارتمان فروشی ونک صد متر، روف گاردن و پارکینگ داره')).toMatchObject({ features: ['پارکینگ', 'روف گاردن'] });
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

describe('spoken phone numbers', () => {
  const cases: Array<[string, string]> = [
    ['شماره صفر نهصد و دوازده، سیصد و چهل و پنج، شصت و هفت، هشتاد و نه', '09123456789'],
    ['شمارش صفر نهصد و دوازده سیصد و چهل و پنج شش هزار و هفتصد و هشتاد و نه', '09123456789'],
    ['شماره نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه', '09123456789'],
    ['تلفنش صفر نه، دوازده، سی و چهار، پنجاه و شش، هفتاد و هشت، نه', '09123456789'],
    ['موبایل صفر نود و یک دویست و سی و چهار پنجاه و شش هفتاد و هشت نه', '09123456789'],
    ['شماره صفر نه یک دو سه چهار پنج شش هفت هشت نه', '09123456789'],
    ['شماره صفر نهصد و دوازده، سه تا هفت، دو تا صفر، سی و پنج', '09127770035'],
    ['شماره ما مثبت نود و هشت نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه', '09123456789'],
    ['تلفن صفر هفتاد و هفت، سی و سه، سی و چهار، پنجاه و شش، هفتاد و هشت', '07733345678'],
    ['مالکش آقای رضایی ۰۹۱۲ ۳۴۵ ۶۷ ۸۹', '09123456789'],
    ['آقای رضایی صفر نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه', '09123456789'],
  ];
  it.each(cases)('%s', (t, phone) => expect(spokenPhone(t)).toEqual({ phone }));

  it('keeps an incomplete number in the description instead of guessing', () => {
    const d = listing('شماره ما یک هزار و نهصد و سی و سی چهارصد و چهل و یک سی سی و نه');
    expect(d.ownerPhone).toBeUndefined();
    expect(d.description).toContain('۱۹۳۰۳۰۴۴۱۳۰۳۹');
  });
});

describe('owner and client names', () => {
  it.each<[string, string]>([
    ['مالکش آقای محمد رضایی شماره صفر نهصد و دوازده', 'آقای محمد رضایی'],
    ['اسم مالک علی کریمی هست', 'علی کریمی'],
    ['صاحبش خانم احمدی عصرها جواب میده', 'خانم احمدی'],
    ['آپارتمان ونک صد متر مالک آقای رضایی', 'آقای رضایی'],
    ['به نام حسین محمدی', 'حسین محمدی'],
    ['این آپارتمان یکصد و هشتاد متری بری مهدی سعادت شماره نهصد و سی و سه چهارصد و چهل و یک سی سی و نه', 'مهدی سعادت'],
    ['واحد مال آقای کریمی هست', 'آقای کریمی'],
    ['متعلق به خانم رحیمی', 'خانم رحیمی'],
  ])('%s', (t, name) => expect(listing(t).ownerName).toBe(name));

  it('does not take «برای فروش» or «برای اجاره» as a name', () => {
    expect(listing('آپارتمان برای فروش صد متر').ownerName).toBeUndefined();
    expect(listing('این خونه برای اجاره هست').ownerName).toBeUndefined();
    expect(listing('خونه برای مهدی سعادت شماره صفر نهصد و دوازده سیصد و چهل و پنج شصت و هفت هشتاد و نه')).toMatchObject({ ownerName: 'مهدی سعادت', ownerPhone: '09123456789' });
  });

  it('reads a client name', () => {
    expect(client('مشتری آقای سامان کاظمی شماره صفر نهصد و سی و پنج، یکصد و بیست و سه، چهل و پنج، شصت و هفت دنبال آپارتمان')).toMatchObject({
      name: 'آقای سامان کاظمی', phone: '09351234567',
    });
  });
});

describe('best time to call the owner', () => {
  it.each<[string, string | undefined]>([
    ['مالک آقای رضایی عصرها جواب میده', 'عصرها'],
    ['صبحا زنگ بزنید', 'صبح‌ها'],
    ['بهترین زمان تماس بعد از ساعت پنج', 'بعد از ساعت ۵'],
    ['از ساعت چهار تا هشت شب در دسترسه', 'از ساعت ۴ تا ۸ شب'],
    ['پنجشنبه‌ها و جمعه‌ها زنگ بزنید', 'پنجشنبه‌ها و جمعه‌ها'],
    ['ساعت اداری تماس بگیرید', 'ساعت اداری'],
    ['برای تماس گرفتنم صبح ها تماس بگیرم', 'صبح‌ها'],
    ['عصر ها بعد از ساعت شش جواب میده', 'عصرها بعد از ساعت ۶'],
    ['ساعت ده و نیم صبح بهش زنگ بزن', 'ساعت ۱۰ و نیم صبح'],
    ['آپارتمان فروشی ونک صد متر قیمت هشت میلیارد', undefined],
    ['خونه آفتابگیره و صبح نور خوبی داره', undefined],
  ])('%s', (t, time) => expect(listing(t).ownerBestTime).toBe(time));
});
