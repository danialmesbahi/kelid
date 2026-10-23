import { describe, expect, it } from 'vitest';
import { formatPhone, phoneDigits, phoneInputText } from './phone';

describe('phone input', () => {
  it.each([
    ['۰۹۱۲۳۴۵۶۷۸۹', '09123456789'],
    ['+98 912 345 6789', '09123456789'],
    ['00989123456789', '09123456789'],
    ['912345', '0912345'],
    ['0912-345-67890000', '09123456789'],
  ])('%s → %s', (input, want) => expect(phoneDigits(input)).toBe(want));

  it('groups like a business card, in Persian digits', () => {
    expect(formatPhone('09123456789')).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
    expect(formatPhone('0912')).toBe('۰۹۱۲');
    expect(formatPhone('')).toBe('');
  });

  it('keeps English digits inside the input', () => {
    expect(phoneInputText('09123456789')).toBe('0912 345 6789');
  });
});
