export type SqlValue = string | number | null;
export type SqlParams = SqlValue[];

export interface SqlStatement {
  sql: string;
  params?: SqlParams;
}

/**
 * حداقلِ چیزی که لایهٔ داده از SQLite لازم دارد.
 * ویندوز: better-sqlite3 رمزگذاری‌شده در پروسهٔ اصلی Electron.
 * وب: SQLite WASM روی OPFS در یک Worker.
 */
export interface SqlDriver {
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  /** چند دستور در یک تراکنش؛ یا همه انجام می‌شوند یا هیچ‌کدام. */
  transaction(statements: SqlStatement[]): Promise<void>;
  /** اجرای اسکریپت چنددستوری (فقط برای مهاجرت‌ها). */
  execScript(sql: string): Promise<void>;
}
