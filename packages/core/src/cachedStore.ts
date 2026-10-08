import type { KelidStore } from './store';

type Table = 'listings' | 'clients' | 'visits' | 'todos' | 'photos' | 'deals';
const ALL: readonly Table[] = ['listings', 'clients', 'visits', 'todos', 'photos', 'deals'];

// هر خواندن به کدام جدول‌ها وابسته است. getPhoto عمداً نیست: بایت‌های کامل حجیم‌اند و photos.ts حافظهٔ جدا دارد.
const READS = {
  listListings: ['listings'],
  getListing: ['listings'],
  hasSampleData: ['listings'],
  listClients: ['clients'],
  getClient: ['clients'],
  listVisits: ['visits'],
  getVisit: ['visits'],
  listTodos: ['todos'],
  listPhotos: ['photos'],
  coverThumbs: ['photos'],
  listDeals: ['deals'],
} satisfies Partial<Record<keyof KelidStore, readonly Table[]>>;

// هر نوشتن کدام جدول‌ها را عوض می‌کند. شمار عکس در جدول فایل‌هاست، پس کارهای عکس فایل‌ها را هم کهنه می‌کنند.
const WRITES = {
  addListing: ['listings'],
  updateListing: ['listings'],
  archiveListing: ['listings'],
  restoreListing: ['listings'],
  addClient: ['clients'],
  updateClient: ['clients'],
  archiveClient: ['clients'],
  restoreClient: ['clients'],
  addVisit: ['visits'],
  updateVisit: ['visits'],
  addTodo: ['todos'],
  setTodoDone: ['todos'],
  deleteTodo: ['todos'],
  restoreTodo: ['todos'],
  addDeal: ['deals'],
  updateDeal: ['deals'],
  archiveDeal: ['deals'],
  restoreDeal: ['deals'],
  clearSampleData: ALL,
  addPhotos: ['photos', 'listings'],
  reorderPhotos: ['photos'],
  deletePhoto: ['photos', 'listings'],
  restorePhoto: ['photos', 'listings'],
} satisfies Partial<Record<keyof KelidStore, readonly Table[]>>;

const MEMO_KEEP = 200;

/**
 * لایهٔ حافظه روی هر KelidStore. تا داده عوض نشده، خواندن تکراری (مثلاً فهرست فایل‌ها که چند صفحه
 * هم‌زمان می‌خواهند) دوباره به دیتابیس نمی‌رود و همان نتیجه برمی‌گردد. با هر تغییر فقط خواندن‌های
 * جدول‌های عوض‌شده دور ریخته می‌شوند؛ پس تیک زدن یک کار، کاور همهٔ فایل‌ها را دوباره نمی‌خواند.
 * نتیجه‌ها بین صفحه‌ها مشترک‌اند و نباید دست‌کاری شوند.
 */
export class CachedStore implements KelidStore {
  private memo = new Map<string, { tables: readonly Table[]; value: Promise<unknown> }>();
  /** جدول‌هایی که نوشتن‌های در جریان عوض می‌کنند. */
  private writing: Array<readonly Table[]> = [];

  constructor(private inner: KelidStore) {
    // اولین شنونده است، پس پیش از صفحه‌ها حافظه را پاک می‌کند.
    inner.subscribe(() => this.invalidate());
  }

  /** همه‌چیز کهنه است؛ همگام‌سازی پیش از خبر دادن صدا می‌زند تا نوشتنِ هم‌زمانِ محلی دامنه را کوچک نکند. */
  dropAll() {
    this.memo.clear();
  }

  private invalidate() {
    // تغییری که از نوشتن‌های همین لایه نیامده (مثلاً همگام‌سازی آینده) همه‌چیز را کهنه می‌کند.
    const scope = new Set(this.writing.length ? this.writing.flat() : ALL);
    for (const [key, e] of this.memo) if (e.tables.some((t) => scope.has(t))) this.memo.delete(key);
  }

  private read<K extends keyof typeof READS>(name: K, args: unknown[]): ReturnType<KelidStore[K]> {
    const key = `${name}:${JSON.stringify(args)}`;
    const hit = this.memo.get(key);
    if (hit) {
      // تازه‌ترین استفاده به ته صف می‌رود تا کم‌استفاده‌ها زودتر کنار بروند
      this.memo.delete(key);
      this.memo.set(key, hit);
      return hit.value as ReturnType<KelidStore[K]>;
    }
    const value = (this.inner[name] as (...a: unknown[]) => Promise<unknown>).apply(this.inner, args);
    const entry = { tables: READS[name], value };
    this.memo.set(key, entry);
    // خطا در حافظه نمی‌ماند تا دفعهٔ بعد دوباره امتحان شود.
    value.catch(() => {
      if (this.memo.get(key) === entry) this.memo.delete(key);
    });
    if (this.memo.size > MEMO_KEEP) this.memo.delete(this.memo.keys().next().value as string);
    return value as ReturnType<KelidStore[K]>;
  }

  private fromList<T extends { id: string }>(name: 'listListings' | 'listClients', id: string): Promise<T | undefined> | undefined {
    const all = this.memo.get(`${name}:[]`);
    return all && (all.value as Promise<T[]>).then((list) => list.find((x) => x.id === id));
  }

  private async write<K extends keyof typeof WRITES>(name: K, args: unknown[]): Promise<Awaited<ReturnType<KelidStore[K]>>> {
    const scope = WRITES[name];
    this.writing.push(scope);
    try {
      return (await (this.inner[name] as (...a: unknown[]) => Promise<unknown>).apply(this.inner, args)) as Awaited<ReturnType<KelidStore[K]>>;
    } finally {
      this.writing.splice(this.writing.indexOf(scope), 1);
    }
  }

  listListings: KelidStore['listListings'] = (...a) => this.read('listListings', a);
  // اگر فهرست کامل در حافظه هست، یک فایل یا مشتری از همان برداشته می‌شود و به دیتابیس نمی‌رود.
  getListing: KelidStore['getListing'] = (id) => this.fromList('listListings', id) ?? this.read('getListing', [id]);
  hasSampleData: KelidStore['hasSampleData'] = (...a) => this.read('hasSampleData', a);
  listClients: KelidStore['listClients'] = (...a) => this.read('listClients', a);
  getClient: KelidStore['getClient'] = (id) => this.fromList('listClients', id) ?? this.read('getClient', [id]);
  listVisits: KelidStore['listVisits'] = (...a) => this.read('listVisits', a);
  getVisit: KelidStore['getVisit'] = (...a) => this.read('getVisit', a);
  listTodos: KelidStore['listTodos'] = (...a) => this.read('listTodos', a);
  listPhotos: KelidStore['listPhotos'] = (...a) => this.read('listPhotos', a);
  coverThumbs: KelidStore['coverThumbs'] = (...a) => this.read('coverThumbs', a);
  getPhoto: KelidStore['getPhoto'] = (id) => this.inner.getPhoto(id);

  addListing: KelidStore['addListing'] = (...a) => this.write('addListing', a);
  updateListing: KelidStore['updateListing'] = (...a) => this.write('updateListing', a);
  archiveListing: KelidStore['archiveListing'] = (...a) => this.write('archiveListing', a);
  restoreListing: KelidStore['restoreListing'] = (...a) => this.write('restoreListing', a);
  addClient: KelidStore['addClient'] = (...a) => this.write('addClient', a);
  updateClient: KelidStore['updateClient'] = (...a) => this.write('updateClient', a);
  archiveClient: KelidStore['archiveClient'] = (...a) => this.write('archiveClient', a);
  restoreClient: KelidStore['restoreClient'] = (...a) => this.write('restoreClient', a);
  addVisit: KelidStore['addVisit'] = (...a) => this.write('addVisit', a);
  updateVisit: KelidStore['updateVisit'] = (...a) => this.write('updateVisit', a);
  addTodo: KelidStore['addTodo'] = (...a) => this.write('addTodo', a);
  setTodoDone: KelidStore['setTodoDone'] = (...a) => this.write('setTodoDone', a);
  deleteTodo: KelidStore['deleteTodo'] = (...a) => this.write('deleteTodo', a);
  restoreTodo: KelidStore['restoreTodo'] = (...a) => this.write('restoreTodo', a);
  listDeals: KelidStore['listDeals'] = (...a) => this.read('listDeals', a);
  addDeal: KelidStore['addDeal'] = (...a) => this.write('addDeal', a);
  updateDeal: KelidStore['updateDeal'] = (...a) => this.write('updateDeal', a);
  archiveDeal: KelidStore['archiveDeal'] = (...a) => this.write('archiveDeal', a);
  restoreDeal: KelidStore['restoreDeal'] = (...a) => this.write('restoreDeal', a);
  clearSampleData: KelidStore['clearSampleData'] = (...a) => this.write('clearSampleData', a);
  addPhotos: KelidStore['addPhotos'] = (...a) => this.write('addPhotos', a);
  reorderPhotos: KelidStore['reorderPhotos'] = (...a) => this.write('reorderPhotos', a);
  deletePhoto: KelidStore['deletePhoto'] = (...a) => this.write('deletePhoto', a);
  restorePhoto: KelidStore['restorePhoto'] = (...a) => this.write('restorePhoto', a);

  subscribe(listener: () => void) {
    return this.inner.subscribe(listener);
  }
}
