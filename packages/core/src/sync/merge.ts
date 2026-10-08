/** وضعیت یک رکورد روی سرور: مقدار هر فیلد و زمان آخرین نوشتنش. */
export interface EntityState {
  fields: Record<string, unknown>;
  clocks: Record<string, string>;
}

/**
 * ادغام هر فیلد جدا، «آخرین نویسنده برنده» با HLC. حذف هم فقط فیلد deleted است، پس حذف و برگرداندن هم همین قاعده را دارند.
 * زمان برابر = همان تغییر دوباره رسیده (مثلاً بعد از قطع اینترنت)؛ چیزی عوض نمی‌شود، پس ارسال دوباره بی‌خطر است.
 */
export function mergeChange(state: EntityState | undefined, fields: Record<string, unknown>, hlc: string): { state: EntityState; changed: boolean } {
  const next: EntityState = { fields: { ...state?.fields }, clocks: { ...state?.clocks } };
  let changed = false;
  for (const [k, v] of Object.entries(fields)) {
    const cur = next.clocks[k];
    if (cur !== undefined && cur >= hlc) continue;
    next.fields[k] = v;
    next.clocks[k] = hlc;
    changed = true;
  }
  return { state: next, changed };
}
