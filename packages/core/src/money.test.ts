import { describe, expect, it } from 'vitest';
import { annotateAmounts, spokenAmounts, spokenNumbers } from './money';

const values = (t: string) => spokenAmounts(t).map((a) => a.value);

describe('spoken amounts', () => {
  it('reads Persian money in words and digits', () => {
    expect(values('قیمت هشت میلیارد تومان')).toEqual([8_000_000_000]);
    expect(values('هشت و نیم میلیارد')).toEqual([8_500_000_000]);
    expect(values('هشت میلیارد و نیم')).toEqual([8_500_000_000]);
    expect(values('دو میلیارد و سیصد')).toEqual([2_300_000_000]);
    expect(values('یک میلیارد و دویست و پنجاه میلیون')).toEqual([1_250_000_000]);
    expect(values('رهن پانصد میلیون اجاره بیست و پنج میلیون')).toEqual([500_000_000, 25_000_000]);
    expect(values('۸٫۵ میلیارد')).toEqual([8_500_000_000]);
    expect(values('8.5 میلیارد')).toEqual([8_500_000_000]);
    expect(values('۸ میلیارد و ۵۰۰ میلیون')).toEqual([8_500_000_000]);
    expect(values('8,500,000,000 تومان')).toEqual([8_500_000_000]);
    expect(values('صدوبیست میلیون')).toEqual([120_000_000]);
    expect(values('سی میلیون ریال')).toEqual([3_000_000]);
    expect(values('میلیاردی')).toEqual([]);
  });

  it('leaves areas, rooms and years alone', () => {
    expect(values('آپارتمان صد و بیست متری، دو خواب، طبقه سوم، ساخت ۱۴۰۲')).toEqual([]);
    expect(values('قیمت سه میلیارد و دو خوابه')).toEqual([3_000_000_000]);
    expect(values('نه، سه میلیارد')).toEqual([3_000_000_000]);
  });

  it('keeps colloquial ranges as two numbers', () => {
    const nums = (t: string) => spokenNumbers(t).map((n) => n.value);
    expect(nums('هشتاد نود متر')).toEqual([80, 90]);
    expect(nums('هشتاد صد متری')).toEqual([80, 100]);
    expect(nums('بین صد و صد و بیست')).toEqual([100, 120]);
    expect(nums('سیصد چهل')).toEqual([340]);
    expect(values('هفت هشت میلیارد')).toEqual([8_000_000_000]);
  });

  it('marks each amount in the text for the model', () => {
    expect(annotateAmounts('ونک، قیمت هشت و نیم میلیارد، پارکینگ دارد')).toBe('ونک، قیمت هشت و نیم میلیارد [= 8500000000 تومان]، پارکینگ دارد');
    expect(annotateAmounts('قیمت سه میلیارد و دو خوابه')).toBe('قیمت سه میلیارد [= 3000000000 تومان] و دو خوابه');
  });
});
