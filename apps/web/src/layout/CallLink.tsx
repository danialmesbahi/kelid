import type { CSSProperties, ReactNode } from 'react';
import { toEnDigits, toFaDigits } from '@kelid/core';
import { useToast } from './Toasts';

/** فقط رقم و +؛ شماره‌ای که با فاصله یا خط تیره ذخیره شده هم شماره‌گیر را درست باز کند. */
export function telHref(phone: string): string {
  return `tel:${toEnDigits(phone).replace(/[^\d+]/g, '')}`;
}

/**
 * دکمهٔ تماس. روی گوشی شماره‌گیر با همین شماره باز می‌شود.
 * روی ویندوز اگر برنامهٔ تماس (Phone Link) وصل باشد همان باز می‌شود؛ وگرنه لینک tel: بی‌صدا هیچ نمی‌کند،
 * برای همین شماره کپی و درشت نشان داده می‌شود تا دکمه هیچ‌وقت بی‌اثر نماند.
 */
export function CallLink({ phone, label, className, style, children }: { phone: string; label?: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const toast = useToast();
  const href = telHref(phone);
  return (
    <a
      className={className}
      style={style}
      href={href}
      aria-label={label}
      onClick={() => {
        if (matchMedia('(pointer: coarse)').matches) return;
        void navigator.clipboard?.writeText(href.slice(4)).catch(() => undefined);
        toast(`شمارهٔ ${toFaDigits(href.slice(4))} کپی شد`);
      }}
    >
      {children}
    </a>
  );
}
