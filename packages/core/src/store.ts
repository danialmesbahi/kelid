import type { Client, DealType, Listing, Photo, Todo, Visit } from './model';
import { normalizeForSearch } from './persian';
import { listingTitle } from './format';

export interface ListingFilter {
  deal?: DealType;
  query?: string;
}

export type NewListing = Omit<Listing, 'id' | 'plaque' | 'createdAt' | 'updatedAt'>;
export type NewClient = Omit<Client, 'id' | 'createdAt' | 'lastContactAt'>;
export type NewVisit = Omit<Visit, 'id'>;
export type NewTodo = Pick<Todo, 'title'> & Partial<Pick<Todo, 'detail' | 'action'>>;

/** عکسی که در مرورگر کوچک شده و آمادهٔ ذخیره است. */
export interface NewPhoto {
  mime: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  thumb: Uint8Array;
}
export type PhotoThumb = Photo & { thumb: Uint8Array };
export type CoverThumbs = Record<string, { photoId: string; mime: string; thumb: Uint8Array }>;

/**
 * لایهٔ دسترسی به داده. SqlStore (ویندوز و وب) و MemoryStore (تست) هر دو
 * همین رابط را پیاده می‌کنند، پس صفحه‌ها به نوع دیتابیس وابسته نیستند.
 */
export interface KelidStore {
  listListings(filter?: ListingFilter): Promise<Listing[]>;
  getListing(id: string): Promise<Listing | undefined>;
  addListing(input: NewListing): Promise<Listing>;
  updateListing(id: string, patch: Partial<NewListing>): Promise<Listing>;
  /** حذف نرم؛ با restoreListing برمی‌گردد. */
  archiveListing(id: string): Promise<void>;
  restoreListing(id: string): Promise<void>;
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  addClient(input: NewClient): Promise<Client>;
  listVisits(fromIso: string, toIso: string): Promise<Visit[]>;
  getVisit(id: string): Promise<Visit | undefined>;
  addVisit(input: NewVisit): Promise<Visit>;
  updateVisit(id: string, patch: Partial<NewVisit>): Promise<Visit>;
  listTodos(): Promise<Todo[]>;
  /** کار تازه به انتهای فهرست می‌رود. */
  addTodo(input: NewTodo): Promise<Todo>;
  setTodoDone(id: string, done: boolean): Promise<void>;
  /** حذف نرم؛ با restoreTodo برمی‌گردد. */
  deleteTodo(id: string): Promise<void>;
  restoreTodo(id: string): Promise<void>;
  hasSampleData(): Promise<boolean>;
  clearSampleData(): Promise<void>;
  /** عکس‌های یک فایل به ترتیب، با تصویر کوچک؛ عکس اول کاور است. */
  listPhotos(listingId: string): Promise<PhotoThumb[]>;
  /** عکس با کیفیت کامل، برای گالری و حالت نمایش. */
  getPhoto(id: string): Promise<{ mime: string; bytes: Uint8Array } | undefined>;
  /** تصویر کوچک کاورِ هر فایلی که عکس دارد؛ کلید = شناسهٔ فایل. */
  coverThumbs(): Promise<CoverThumbs>;
  /** عکس‌ها به انتهای فهرست اضافه می‌شوند. */
  addPhotos(listingId: string, photos: NewPhoto[]): Promise<Photo[]>;
  /** ترتیب تازهٔ عکس‌ها؛ اولین شناسه کاور می‌شود. */
  reorderPhotos(listingId: string, ids: string[]): Promise<void>;
  /** حذف نرم؛ با restorePhoto برمی‌گردد. */
  deletePhoto(id: string): Promise<void>;
  restorePhoto(id: string): Promise<void>;
  /** هر بار داده عوض شود صدا زده می‌شود. */
  subscribe(listener: () => void): () => void;
}

export function searchText(l: Listing): string {
  const plaque = l.plaque === null ? '' : String(l.plaque).padStart(3, '0');
  return normalizeForSearch(`${plaque} ${listingTitle(l)} ${l.neighborhood} ${l.street}`);
}

export function filterListings(all: Listing[], filter: ListingFilter = {}): Listing[] {
  const q = filter.query ? normalizeForSearch(filter.query) : '';
  return all.filter((l) => (!filter.deal || l.deal === filter.deal) && (!q || searchText(l).includes(q)));
}

/** نسخهٔ در حافظه؛ برای تست‌ها و وقتی مرورگر حافظهٔ ماندگار ندارد. */
export class MemoryStore implements KelidStore {
  private listings: Array<Listing & { deleted?: boolean; sample?: boolean }>;
  private clients: Client[];
  private visits: Visit[];
  private todos: Array<Todo & { deleted?: boolean }>;
  private photos: Array<PhotoThumb & { bytes: Uint8Array; deleted?: boolean }> = [];
  private listeners = new Set<() => void>();

  constructor(seed: { listings: Listing[]; clients: Client[]; visits: Visit[]; todos: Todo[] }) {
    this.listings = seed.listings.map((l) => ({ ...l, sample: true }));
    this.clients = [...seed.clients];
    this.visits = [...seed.visits];
    this.todos = [...seed.todos];
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private live() {
    return this.listings.filter((l) => !l.deleted);
  }

  async listListings(filter?: ListingFilter) {
    return filterListings(this.live(), filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getListing(id: string) {
    return this.live().find((l) => l.id === id);
  }

  async addListing(input: NewListing) {
    const now = new Date().toISOString();
    const next = Math.max(0, ...this.listings.map((l) => l.plaque ?? 0)) + 1;
    const listing: Listing = { ...input, id: crypto.randomUUID(), plaque: next, createdAt: now, updatedAt: now };
    this.listings.push(listing);
    this.emit();
    return listing;
  }

  async updateListing(id: string, patch: Partial<NewListing>) {
    const i = this.listings.findIndex((l) => l.id === id);
    const cur = this.listings[i];
    if (!cur) throw new Error('فایل پیدا نشد');
    const next = { ...cur, ...patch, price: { ...cur.price, ...patch.price }, owner: { ...cur.owner, ...patch.owner }, updatedAt: new Date().toISOString() };
    this.listings[i] = next;
    this.emit();
    return next;
  }

  async archiveListing(id: string) {
    this.listings = this.listings.map((l) => (l.id === id ? { ...l, deleted: true } : l));
    this.emit();
  }

  async restoreListing(id: string) {
    this.listings = this.listings.map((l) => (l.id === id ? { ...l, deleted: false } : l));
    this.emit();
  }

  async listClients() {
    return [...this.clients].sort((a, b) => Number(b.waitingForNews) - Number(a.waitingForNews) || b.lastContactAt.localeCompare(a.lastContactAt));
  }

  async getClient(id: string) {
    return this.clients.find((c) => c.id === id);
  }

  async addClient(input: NewClient) {
    const now = new Date().toISOString();
    const c: Client = { ...input, id: crypto.randomUUID(), lastContactAt: now, createdAt: now };
    this.clients.push(c);
    this.emit();
    return c;
  }

  async listVisits(fromIso: string, toIso: string) {
    return this.visits.filter((v) => v.startsAt >= fromIso && v.startsAt < toIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getVisit(id: string) {
    return this.visits.find((v) => v.id === id);
  }

  async addVisit(input: NewVisit) {
    const v: Visit = { ...input, id: crypto.randomUUID() };
    this.visits.push(v);
    this.emit();
    return v;
  }

  async updateVisit(id: string, patch: Partial<NewVisit>) {
    const i = this.visits.findIndex((v) => v.id === id);
    const cur = this.visits[i];
    if (!cur) throw new Error('قرار پیدا نشد');
    const next = { ...cur, ...patch, id: cur.id };
    this.visits[i] = next;
    this.emit();
    return next;
  }

  async listTodos() {
    return this.todos.filter((t) => !t.deleted).map(({ deleted: _deleted, ...t }) => t);
  }

  async addTodo(input: NewTodo) {
    const t: Todo = { id: crypto.randomUUID(), title: input.title, detail: input.detail ?? '', action: input.action, done: false };
    this.todos.push(t);
    this.emit();
    return t;
  }

  async deleteTodo(id: string) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, deleted: true } : t));
    this.emit();
  }

  async restoreTodo(id: string) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, deleted: false } : t));
    this.emit();
  }

  async setTodoDone(id: string, done: boolean) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, done } : t));
    this.emit();
  }

  async hasSampleData() {
    return this.listings.some((l) => l.sample && !l.deleted);
  }

  async clearSampleData() {
    const sampleIds = new Set(this.listings.filter((l) => l.sample).map((l) => l.id));
    this.photos = this.photos.filter((p) => !sampleIds.has(p.listingId));
    this.listings = this.listings.filter((l) => !l.sample);
    this.clients = [];
    this.visits = [];
    this.todos = [];
    this.emit();
  }

  private livePhotos(listingId: string) {
    return this.photos.filter((p) => p.listingId === listingId && !p.deleted).sort((a, b) => a.ord - b.ord || a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  private syncPhotoCount(listingId: string) {
    const count = this.livePhotos(listingId).length;
    this.listings = this.listings.map((l) => (l.id === listingId ? { ...l, photoCount: count } : l));
  }

  async listPhotos(listingId: string) {
    return this.livePhotos(listingId).map(({ bytes: _bytes, deleted: _deleted, ...p }) => p);
  }

  async getPhoto(id: string) {
    const p = this.photos.find((x) => x.id === id && !x.deleted);
    return p ? { mime: p.mime, bytes: p.bytes } : undefined;
  }

  async coverThumbs() {
    const out: CoverThumbs = {};
    for (const l of this.live()) {
      const first = this.livePhotos(l.id)[0];
      if (first) out[l.id] = { photoId: first.id, mime: first.mime, thumb: first.thumb };
    }
    return out;
  }

  async addPhotos(listingId: string, photos: NewPhoto[]) {
    const now = new Date().toISOString();
    let ord = Math.max(-1, ...this.photos.filter((p) => p.listingId === listingId).map((p) => p.ord)) + 1;
    const added = photos.map((p) => ({ id: crypto.randomUUID(), listingId, ord: ord++, mime: p.mime, width: p.width, height: p.height, createdAt: now, bytes: p.bytes, thumb: p.thumb }));
    this.photos.push(...added);
    this.syncPhotoCount(listingId);
    this.emit();
    return added.map(({ bytes: _bytes, thumb: _thumb, ...meta }): Photo => meta);
  }

  async reorderPhotos(listingId: string, ids: string[]) {
    this.photos = this.photos.map((p) => (p.listingId === listingId && ids.includes(p.id) ? { ...p, ord: ids.indexOf(p.id) } : p));
    this.emit();
  }

  async deletePhoto(id: string) {
    this.setPhotoDeleted(id, true);
  }

  async restorePhoto(id: string) {
    this.setPhotoDeleted(id, false);
  }

  private setPhotoDeleted(id: string, deleted: boolean) {
    const p = this.photos.find((x) => x.id === id);
    if (!p) return;
    // مثل SqlStore: اگر جای عکس برگشتی گرفته شده، به انتها می‌رود.
    const others = this.livePhotos(p.listingId).filter((x) => x.id !== id);
    const ord = !deleted && others.some((x) => x.ord === p.ord) ? Math.max(...others.map((x) => x.ord)) + 1 : p.ord;
    this.photos = this.photos.map((x) => (x.id === id ? { ...x, deleted, ord } : x));
    this.syncPhotoCount(p.listingId);
    this.emit();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
