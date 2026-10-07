import { mergeChange, type EntityState } from './merge';
import type { SyncKind } from './types';

/**
 * یک تغییر رسیده روی سرور: ادغام فیلدبه‌فیلد، به‌علاوهٔ پلاک فایل که فقط سرور می‌دهد.
 * پلاک پیشنهادی دستگاه (پلاک موقتش) اگر در دفتر آزاد باشد همان می‌ماند، تا شماره‌های دستگاه اول عوض نشوند.
 * سرور واقعی (apps/server/src/sync) و سرور آزمایشی تست‌ها هر دو همین را صدا می‌زنند.
 */
export function applyServerChange(
  cur: EntityState | undefined,
  change: { kind: SyncKind; fields: Record<string, unknown>; hlc: string },
  assignPlaque: (proposed: number | null) => number,
): { state: EntityState; changed: boolean } {
  const fields = { ...change.fields };
  const proposed = fields.plaque;
  delete fields.plaque;
  if (change.kind === 'listing' && typeof cur?.fields.plaque !== 'number') {
    fields.plaque = assignPlaque(Number.isInteger(proposed) && (proposed as number) > 0 ? (proposed as number) : null);
  }
  return mergeChange(cur, fields, change.hlc);
}
