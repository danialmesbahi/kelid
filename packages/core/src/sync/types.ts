export const SYNC_KINDS = ['listing', 'client', 'visit', 'todo', 'deal', 'photo'] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

/** یک تغییر محلی برای فرستادن؛ fields فقط فیلدهای عوض‌شده‌اند (حذف = { deleted: true }). */
export interface OutgoingChange {
  seq: number;
  kind: SyncKind;
  id: string;
  fields: Record<string, unknown>;
  hlc: string;
}

/** وضعیت کامل ادغام‌شدهٔ یک رکورد که از سرور آمده. */
export interface IncomingEntity {
  kind: SyncKind;
  id: string;
  fields: Record<string, unknown>;
}

/** آنچه موتور همگام‌سازی از دیتابیس محلی لازم دارد (SqlStore). */
export interface Syncable {
  syncInfo(): Promise<{ office: string | null; cursor: string; pending: number }>;
  /** تغییرهای صف به ترتیب؛ lastSeq شامل ردیف‌های ردشده (دادهٔ نمونه) هم هست تا بعد از تأیید پاک شوند. */
  pendingChanges(limit: number): Promise<{ changes: OutgoingChange[]; lastSeq: number }>;
  ackChanges(upToSeq: number): Promise<void>;
  /** وضعیت سرور را در یک تراکنش اعمال می‌کند؛ فیلدهایی که هنوز در صف ارسال‌اند دست نمی‌خورند. نشانگر هم در همان تراکنش جلو می‌رود. */
  applyRemote(entities: IncomingEntity[], cursor: string, hlc: string | null, opts?: { quiet?: boolean }): Promise<void>;
  /** این دیتابیس از این به بعد مال همین دفتر است؛ دادهٔ یک دفتر هرگز به دفتر دیگری فرستاده نمی‌شود. */
  bindOffice(officeId: string): Promise<void>;
  /** خبر دادن به صفحه‌ها بعد از چند applyRemote آرام. */
  notifyChanged(): void;
}
