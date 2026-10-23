import { Icon } from '@kelid/ui';
import { toEnDigits } from '@kelid/core';

/** نشان فیلد ضروری کنار نام آن. */
export function Req() {
  return (
    <span className="req" title="ضروری" aria-hidden="true">
      *
    </span>
  );
}

/** پیام خطای خود کلید زیر فیلد، به جای پیام انگلیسی مرورگر. */
export function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span id={id} className="ferr" role="alert">
      <Icon name="warn" size="s" />
      {text}
    </span>
  );
}

/** فیلد عددی: فقط رقم (فارسی یا انگلیسی) وارد می‌شود و انگلیسی نشان داده می‌شود؛ حرف و نشانه اصلاً جا نمی‌گیرد. */
export function onlyDigits(s: string, max = 15): string {
  return toEnDigits(s).replace(/\D/g, '').slice(0, max);
}

const groupFmt = new Intl.NumberFormat('en-US');

/** «28,000,000,000» برای فیلد مبلغ؛ در فیلدها رقم انگلیسی است، بیرون از فیلد همان فارسی. */
export const amountText = (n?: number) => (n ? groupFmt.format(n) : '');

/** مبلغ: فقط رقم، با جداکنندهٔ هزارگان همان وقت نوشتن تا صفرها اشتباه شمرده نشوند. */
export function onlyAmount(s: string): string {
  const d = toEnDigits(s).replace(/\D/g, '').replace(/^0+/, '').slice(0, 15);
  return d ? amountText(Number(d)) : '';
}
