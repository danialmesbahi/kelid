import type { Client, Listing, Todo, Visit } from '../model';
import { normalizeForSearch } from '../persian';
import type { KelidStore, ListingFilter, NewClient, NewListing } from '../store';
import { changedClientFields, clientSearchText, searchText } from '../store';
import type { SqlDriver, SqlStatement, SqlValue } from './driver';
import { migrate } from './schema';

type Cell = SqlValue | undefined;
type Row = Record<string, Cell>;

const s = (v: Cell): string => (v === null || v === undefined ? '' : String(v));
const n = (v: Cell): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const b = (v: Cell): boolean => Number(v) === 1;
const opt = (v: Cell): string | undefined => (v === null || v === undefined ? undefined : String(v));
const nowIso = () => new Date().toISOString();

function rowToListing(r: Row): Listing {
  return {
    id: s(r.id),
    plaque: r.plaque === null || r.plaque === undefined ? null : Number(r.plaque),
    deal: s(r.deal) as Listing['deal'],
    status: s(r.status) as Listing['status'],
    kind: s(r.kind) as Listing['kind'],
    neighborhood: s(r.neighborhood),
    street: s(r.street),
    address: opt(r.address),
    area: Number(r.area),
    bedrooms: Number(r.bedrooms),
    floor: n(r.floor),
    floorsTotal: n(r.floors_total),
    yearBuilt: n(r.year_built),
    features: JSON.parse(s(r.features) || '[]') as string[],
    price: { total: n(r.price_total), deposit: n(r.price_deposit), monthlyRent: n(r.price_rent) },
    negotiable: b(r.negotiable),
    description: opt(r.description),
    owner: { name: s(r.owner_name), phone: s(r.owner_phone), bestTime: opt(r.owner_best_time) },
    cover: s(r.cover) as Listing['cover'],
    photoCount: Number(r.photo_count),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

function listingValues(l: Listing): SqlValue[] {
  return [
    l.id, l.plaque, l.deal, l.status, l.kind, l.neighborhood, l.street, l.address ?? null, l.area, l.bedrooms,
    l.floor ?? null, l.floorsTotal ?? null, l.yearBuilt ?? null, JSON.stringify(l.features),
    l.price.total ?? null, l.price.deposit ?? null, l.price.monthlyRent ?? null, l.negotiable ? 1 : 0,
    l.description ?? null, l.owner.name, l.owner.phone, l.owner.bestTime ?? null, l.cover, l.photoCount,
    searchText(l), l.createdAt, l.updatedAt,
  ];
}

const LISTING_COLS =
  'id, plaque, deal, status, kind, neighborhood, street, address, area, bedrooms, floor, floors_total, year_built, features, price_total, price_deposit, price_rent, negotiable, description, owner_name, owner_phone, owner_best_time, cover, photo_count, search, created_at, updated_at';
const LISTING_PH = LISTING_COLS.split(',').map(() => '?').join(', ');

function rowToClient(r: Row): Client {
  return {
    id: s(r.id),
    name: s(r.name),
    phone: s(r.phone),
    need: JSON.parse(s(r.need)) as Client['need'],
    temperature: s(r.temperature) as Client['temperature'],
    waitingForNews: b(r.waiting),
    lastContactAt: s(r.last_contact_at),
    notes: opt(r.notes),
    createdAt: s(r.created_at),
  };
}

function rowToVisit(r: Row): Visit {
  return {
    id: s(r.id),
    kind: s(r.kind) as Visit['kind'],
    title: s(r.title),
    startsAt: s(r.starts_at),
    endsAt: s(r.ends_at),
    listingId: opt(r.listing_id),
    clientId: opt(r.client_id),
    done: b(r.done),
  };
}

function outbox(entity: string, id: string, op: 'upsert' | 'delete', payload: unknown): SqlStatement {
  // undefined یعنی «پاک شد»؛ JSON.stringify آن را حذف می‌کند، پس null می‌نویسیم تا همگام‌سازی پاک شدن را ببیند.
  const json = JSON.stringify(payload, (_k, v: unknown) => (v === undefined ? null : v));
  return { sql: 'INSERT INTO outbox (entity, entity_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?)', params: [entity, id, op, json, nowIso()] };
}

/** لایهٔ داده روی SQLite؛ همان رابط KelidStore، پس صفحه‌ها فرقی نمی‌بینند. */
export class SqlStore implements KelidStore {
  private listeners = new Set<() => void>();
  private constructor(private db: SqlDriver) {}

  static async open(db: SqlDriver, sample?: { listings: Listing[]; clients: Client[]; visits: Visit[]; todos: Todo[] }): Promise<SqlStore> {
    await migrate(db);
    const store = new SqlStore(db);
    const [seeded] = await db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'seeded'");
    if (!seeded && sample) await store.insertSample(sample);
    return store;
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async insertSample(sample: { listings: Listing[]; clients: Client[]; visits: Visit[]; todos: Todo[] }) {
    const st: SqlStatement[] = [];
    for (const l of sample.listings) st.push({ sql: `INSERT INTO listings (${LISTING_COLS}, sample) VALUES (${LISTING_PH}, 1)`, params: listingValues(l) });
    for (const c of sample.clients) {
      st.push({
        sql: 'INSERT INTO clients (id, name, phone, need, temperature, waiting, last_contact_at, search, sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        params: [c.id, c.name, c.phone, JSON.stringify(c.need), c.temperature, c.waitingForNews ? 1 : 0, c.lastContactAt, clientSearchText(c), c.createdAt, c.createdAt],
      });
    }
    for (const v of sample.visits) {
      st.push({ sql: 'INSERT INTO visits (id, kind, title, starts_at, ends_at, listing_id, client_id, done, sample, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', params: [v.id, v.kind, v.title, v.startsAt, v.endsAt, v.listingId ?? null, v.clientId ?? null, v.done ? 1 : 0, nowIso()] });
    }
    sample.todos.forEach((t, i) => {
      st.push({ sql: 'INSERT INTO todos (id, title, detail, action, done, position, sample, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)', params: [t.id, t.title, t.detail, t.action, t.done ? 1 : 0, i, nowIso()] });
    });
    st.push({ sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', '1')" });
    await this.db.transaction(st);
  }

  async listListings(filter: ListingFilter = {}) {
    const where = ['deleted = 0'];
    const params: SqlValue[] = [];
    if (filter.deal) {
      where.push('deal = ?');
      params.push(filter.deal);
    }
    if (filter.query?.trim()) {
      where.push('search LIKE ?');
      params.push(`%${normalizeForSearch(filter.query)}%`);
    }
    const rows = await this.db.all<Row>(`SELECT * FROM listings WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
    return rows.map(rowToListing);
  }

  async getListing(id: string) {
    const [r] = await this.db.all<Row>('SELECT * FROM listings WHERE id = ? AND deleted = 0', [id]);
    return r ? rowToListing(r) : undefined;
  }

  async addListing(input: NewListing) {
    const now = nowIso();
    const [m] = await this.db.all<{ p: number | null }>('SELECT MAX(plaque) AS p FROM listings');
    const listing: Listing = { ...input, id: crypto.randomUUID(), plaque: (m?.p ?? 0) + 1, createdAt: now, updatedAt: now };
    await this.db.transaction([
      { sql: `INSERT INTO listings (${LISTING_COLS}) VALUES (${LISTING_PH})`, params: listingValues(listing) },
      outbox('listing', listing.id, 'upsert', listing),
    ]);
    this.emit();
    return listing;
  }

  async updateListing(id: string, patch: Partial<NewListing>) {
    const cur = await this.getListing(id);
    if (!cur) throw new Error('فایل پیدا نشد');
    const next: Listing = { ...cur, ...patch, price: { ...cur.price, ...patch.price }, owner: { ...cur.owner, ...patch.owner }, updatedAt: nowIso() };
    await this.db.transaction([
      { sql: `INSERT OR REPLACE INTO listings (${LISTING_COLS}) VALUES (${LISTING_PH})`, params: listingValues(next) },
      outbox('listing', id, 'upsert', patch),
    ]);
    this.emit();
    return next;
  }

  async archiveListing(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE listings SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      outbox('listing', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreListing(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE listings SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      outbox('listing', id, 'upsert', { deleted: false }),
    ]);
    this.emit();
  }

  async listClients() {
    const rows = await this.db.all<Row>('SELECT * FROM clients WHERE deleted = 0 ORDER BY waiting DESC, last_contact_at DESC');
    return rows.map(rowToClient);
  }

  async getClient(id: string) {
    const [r] = await this.db.all<Row>('SELECT * FROM clients WHERE id = ? AND deleted = 0', [id]);
    return r ? rowToClient(r) : undefined;
  }

  async addClient(input: NewClient) {
    const now = nowIso();
    const c: Client = { ...input, id: crypto.randomUUID(), lastContactAt: now, createdAt: now };
    await this.db.transaction([
      {
        sql: 'INSERT INTO clients (id, name, phone, need, temperature, waiting, last_contact_at, notes, search, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [c.id, c.name, c.phone, JSON.stringify(c.need), c.temperature, c.waitingForNews ? 1 : 0, now, c.notes ?? null, clientSearchText(c), now, now],
      },
      outbox('client', c.id, 'upsert', c),
    ]);
    this.emit();
    return c;
  }

  async updateClient(id: string, patch: Partial<NewClient>) {
    const cur = await this.getClient(id);
    if (!cur) throw new Error('مشتری پیدا نشد');
    const next: Client = { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt };
    const changed = changedClientFields(cur, next);
    if (Object.keys(changed).length === 0) return cur;
    await this.db.transaction([
      {
        sql: 'UPDATE clients SET name = ?, phone = ?, need = ?, temperature = ?, waiting = ?, notes = ?, search = ?, updated_at = ? WHERE id = ?',
        params: [next.name, next.phone, JSON.stringify(next.need), next.temperature, next.waitingForNews ? 1 : 0, next.notes ?? null, clientSearchText(next), nowIso(), id],
      },
      outbox('client', id, 'upsert', changed),
    ]);
    this.emit();
    return next;
  }

  async archiveClient(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE clients SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      outbox('client', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreClient(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE clients SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      outbox('client', id, 'upsert', { deleted: false }),
    ]);
    this.emit();
  }

  async listVisits(fromIso: string, toIso: string) {
    const rows = await this.db.all<Row>('SELECT * FROM visits WHERE deleted = 0 AND starts_at >= ? AND starts_at < ? ORDER BY starts_at', [fromIso, toIso]);
    return rows.map(rowToVisit);
  }

  async listTodos() {
    const rows = await this.db.all<Row>('SELECT * FROM todos WHERE deleted = 0 ORDER BY position');
    return rows.map((r): Todo => ({ id: s(r.id), title: s(r.title), detail: s(r.detail), action: s(r.action) as Todo['action'], done: b(r.done) }));
  }

  async setTodoDone(id: string, done: boolean) {
    await this.db.transaction([
      { sql: 'UPDATE todos SET done = ?, updated_at = ? WHERE id = ?', params: [done ? 1 : 0, nowIso(), id] },
      outbox('todo', id, 'upsert', { done }),
    ]);
    this.emit();
  }

  async hasSampleData() {
    const [r] = await this.db.all<{ c: number }>('SELECT COUNT(*) AS c FROM listings WHERE sample = 1 AND deleted = 0');
    return (r?.c ?? 0) > 0;
  }

  async clearSampleData() {
    await this.db.transaction(['listings', 'clients', 'visits', 'todos'].map((t) => ({ sql: `DELETE FROM ${t} WHERE sample = 1` })));
    this.emit();
  }
}
