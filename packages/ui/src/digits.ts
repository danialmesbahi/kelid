import { toEnDigits } from '@kelid/core';

const NON_LATIN_DIGIT = /[۰-۹٠-٩]/;

/**
 * رقم فارسی و عربی همان لحظهٔ نوشتن (یا چسباندن) در هر فیلد متنی انگلیسی می‌شود، با هر کیبوردی.
 * یک شنوندهٔ سراسری به جای دست بردن در تک‌تک فیلدها؛ در فاز capture تا React مقدار تبدیل‌شده را ببیند.
 */
export function installLatinDigits(doc: Document = document): void {
  doc.addEventListener(
    'input',
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (!NON_LATIN_DIGIT.test(el.value)) return;
      // setter خود مرورگر، نه setter که React روی فیلد گذاشته؛ وگرنه React تغییر را نمی‌بیند و onChange صدا زده نمی‌شود.
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (!setValue) return;
      let start: number | null = null;
      let end: number | null = null;
      try {
        ({ selectionStart: start, selectionEnd: end } = el);
      } catch {
        // بعضی نوع‌ها (email، number) جای مکان‌نما ندارند
      }
      setValue.call(el, toEnDigits(el.value));
      // طول متن عوض نمی‌شود (هر رقم یک نویسه)، پس مکان‌نما همان‌جا می‌ماند
      if (start !== null && end !== null) {
        try {
          el.setSelectionRange(start, end);
        } catch {
          // همان نوع‌های بالا
        }
      }
    },
    true,
  );
}
