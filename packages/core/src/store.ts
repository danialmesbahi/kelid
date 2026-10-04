import type { Client, DealType, Listing, Todo, Visit } from './model';
import { normalizeForSearch, toEnDigits } from './persian';
import { listingTitle } from './format';

export interface ListingFilter {
  deal?: DealType;
  query?: string;
}

export type NewListing = Omit<Listing, 'id' | 'plaque' | 'createdAt' | 'updatedAt'>;
export type NewClient = Omit<Client, 'id' | 'createdAt' | 'lastContactAt'>;

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
  updateClient(id: string, patch: Partial<NewClient>): Promise<Client>;
  /** حذف نرم؛ با restoreClient برمی‌گردد. */
  archiveClient(id: string): Promise<void>;
  restoreClient(id: string): Promise<void>;
  listVisits(fromIso: string, toIso: string): Promise<Visit[]>;
  listTodos(): Promise<Todo[]>;
  setTodoDone(id: string, done: boolean): Promise<void>;
  hasSampleData(): Promise<boolean>;
  clearSampleData(): Promise<void>;
  /** هر بار داده عوض شود صدا زده می‌شود. */
  subscribe(listener: () => void): () => void;
}

export function searchText(l: Listing): string {
  const plaque = l.plaque === null ? '' : String(l.plaque).padStart(3, '0');
  return normalizeForSearch(`${plaque} ${listingTitle(l)} ${l.neighborhood} ${l.street}`);
}

/** شماره تلفن برای مقایسه: ارقام لاتین، بدون فاصله و خط، و ۹۸+ به جای ۰. */
export function normalizePhone(phone: string): string {
  const d = toEnDigits(phone).replace(/[^\d]/g, '');
  if (d.startsWith('0098')) return `0${d.slice(4)}`;
  if (d.startsWith('98') && d.length === 12) return `0${d.slice(2)}`;
  return d;
}

/** فیلدهای عوض‌شدهٔ مشتری؛ نیاز (need) یک فیلد حساب می‌شود. */
export function changedClientFields(cur: Client, next: Client): Partial<NewClient> {
  const out: Record<string, unknown> = {};
  for (const k of ['name', 'phone', 'need', 'temperature', 'waitingForNews', 'notes'] as const) {
    if (JSON.stringify(cur[k]) !== JSON.stringify(next[k])) out[k] = next[k];
  }
  return out as Partial<NewClient>;
}

export function clientSearchText(c: Pick<Client, 'name' | 'phone' | 'need'>): string {
  return normalizeForSearch(`${c.name} ${c.need.neighborhoods.join(' ')} ${normalizePhone(c.phone)}`);
}

export function filterListings(all: Listing[], filter: ListingFilter = {}): Listing[] {
  const q = filter.query ? normalizeForSearch(filter.query) : '';
  return all.filter((l) => (!filter.deal || l.deal === filter.deal) && (!q || searchText(l).includes(q)));
}

/** نسخهٔ در حافظه؛ برای تست‌ها و وقتی مرورگر حافظهٔ ماندگار ندارد. */
export class MemoryStore implements KelidStore {
  private listings: Array<Listing & { deleted?: boolean; sample?: boolean }>;
  private clients: Array<Client & { deleted?: boolean }>;
  private visits: Visit[];
  private todos: Todo[];
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
    return this.clients.filter((c) => !c.deleted).sort((a, b) => Number(b.waitingForNews) - Number(a.waitingForNews) || b.lastContactAt.localeCompare(a.lastContactAt));
  }

  async getClient(id: string) {
    return this.clients.find((c) => c.id === id && !c.deleted);
  }

  async addClient(input: NewClient) {
    const now = new Date().toISOString();
    const c: Client = { ...input, id: crypto.randomUUID(), lastContactAt: now, createdAt: now };
    this.clients.push(c);
    this.emit();
    return c;
  }

  async updateClient(id: string, patch: Partial<NewClient>) {
    const i = this.clients.findIndex((c) => c.id === id && !c.deleted);
    const cur = this.clients[i];
    if (!cur) throw new Error('مشتری پیدا نشد');
    const next = { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt };
    if (Object.keys(changedClientFields(cur, next)).length === 0) return cur;
    this.clients[i] = next;
    this.emit();
    return next;
  }

  async archiveClient(id: string) {
    this.clients = this.clients.map((c) => (c.id === id ? { ...c, deleted: true } : c));
    this.emit();
  }

  async restoreClient(id: string) {
    this.clients = this.clients.map((c) => (c.id === id ? { ...c, deleted: false } : c));
    this.emit();
  }

  async listVisits(fromIso: string, toIso: string) {
    return this.visits.filter((v) => v.startsAt >= fromIso && v.startsAt < toIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async listTodos() {
    return [...this.todos];
  }

  async setTodoDone(id: string, done: boolean) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, done } : t));
    this.emit();
  }

  async hasSampleData() {
    return this.listings.some((l) => l.sample && !l.deleted);
  }

  async clearSampleData() {
    this.listings = this.listings.filter((l) => !l.sample);
    this.clients = [];
    this.visits = [];
    this.todos = [];
    this.emit();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
