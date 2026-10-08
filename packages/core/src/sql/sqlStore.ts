import { newId } from '../id';
import type { Client, Deal, Listing, Photo, Todo, Visit } from '../model';
import { normalizeForSearch } from '../persian';
import type { CoverThumbs, DealPatch, KelidStore, ListingFilter, NewClient, NewDeal, NewListing, NewPhoto, NewTodo, NewVisit, PhotoThumb, SampleData } from '../store';
import { applyDealPatch, applyListingPatch, changedClientFields, changedFields, clientSearchText, searchText } from '../store';
import type { SqlDriver, SqlStatement, SqlValue } from './driver';
import { migrate } from './schema';
import { Hlc, encodeHlc } from '../sync/hlc';
import { REQUIRED, orUndef, sanitizeFields } from '../sync/sanitize';
import { SYNC_KINDS, type IncomingEntity, type OutgoingChange, type PhotoBlob, type SyncKind, type Syncable } from '../sync/types';

type Cell = SqlValue | undefined;
type Row = Record<string, Cell>;

const s = (v: Cell): string => (v === null || v === undefined ? '' : String(v));
const n = (v: Cell): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const b = (v: Cell): boolean => Number(v) === 1;
const opt = (v: Cell): string | undefined => (v === null || v === undefined ? undefined : String(v));
const blob = (v: Cell): Uint8Array => (v instanceof Uint8Array ? v : new Uint8Array());
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
// ویرایش به شمار عکس‌ها دست نمی‌زند؛ آن را فقط کارهای عکس عوض می‌کنند و ممکن است هم‌زمان اجرا شوند.
const LISTING_KEEP = new Set(['id', 'plaque', 'photo_count', 'created_at']);
const LISTING_SET = LISTING_COLS.split(', ').filter((c) => !LISTING_KEEP.has(c)).map((c) => `${c} = ?`).join(', ');
function listingUpdateValues(l: Listing): SqlValue[] {
  const cols = LISTING_COLS.split(', ');
  return listingValues(l).filter((_v, i) => !LISTING_KEEP.has(cols[i]!));
}

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

function rowToDeal(r: Row): Deal {
  return {
    id: s(r.id),
    listingId: s(r.listing_id),
    clientId: opt(r.client_id),
    stage: s(r.stage) as Deal['stage'],
    price: n(r.price),
    rent: n(r.rent),
    commissionBuyer: n(r.commission_buyer),
    commissionSeller: n(r.commission_seller),
    checklist: JSON.parse(s(r.checklist) || '[]') as string[],
    dueDay: opt(r.due_day),
    notes: opt(r.notes),
    closedAt: opt(r.closed_at),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

const DEAL_COLS = 'id, listing_id, client_id, stage, price, rent, commission_buyer, commission_seller, checklist, due_day, notes, closed_at, created_at, updated_at';
function dealValues(d: Deal): SqlValue[] {
  return [
    d.id, d.listingId, d.clientId ?? null, d.stage, d.price ?? null, d.rent ?? null, d.commissionBuyer ?? null, d.commissionSeller ?? null,
    JSON.stringify(d.checklist), d.dueDay ?? null, d.notes ?? null, d.closedAt ?? null, d.createdAt, d.updatedAt,
  ];
}

function rowToPhoto(r: Row): Photo {
  return { id: s(r.id), listingId: s(r.listing_id), ord: Number(r.ord), mime: s(r.mime), width: Number(r.w), height: Number(r.h), createdAt: s(r.created_at) };
}

/** عکسی که دستگاه دیگری گذاشته: اول فقط مشخصات (بی‌بایت، blob_state = ۲)، بایت‌ها بعد با savePhotoBlob می‌رسند. */
function remotePhoto(id: string, row: Row | undefined, f: Record<string, unknown>, deleted: number): SqlStatement {
  const now = nowIso();
  if (row) {
    return { sql: 'UPDATE photos SET ord = ?, deleted = ?, updated_at = ? WHERE id = ?', params: [typeof f.ord === 'number' ? f.ord : Number(row.ord), deleted, now, id] };
  }
  const empty = new Uint8Array(0);
  return {
    sql: 'INSERT INTO photos (id, listing_id, ord, mime, w, h, bytes, thumb, deleted, created_at, updated_at, blob_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)',
    params: [id, String(f.listingId), typeof f.ord === 'number' ? f.ord : 0, String(f.mime), Number(f.width), Number(f.height), empty, empty, deleted, String(f.createdAt), now],
  };
}

/** تعداد عکس فایل از خود جدول عکس‌ها حساب می‌شود تا هیچ‌وقت ناهماهنگ نشود. */
function photoCount(listingId: string): SqlStatement {
  // عکسی که بایتش هنوز از سرور نرسیده شمرده نمی‌شود تا شمار با عکس‌های دیدنی یکی باشد.
  return { sql: 'UPDATE listings SET photo_count = (SELECT COUNT(*) FROM photos WHERE listing_id = ? AND deleted = 0 AND blob_state <> 2) WHERE id = ?', params: [listingId, listingId] };
}

function outboxRow(entity: string, id: string, op: 'upsert' | 'delete', payload: unknown, hlc: string): SqlStatement {
  // undefined یعنی «پاک شد»؛ JSON.stringify آن را حذف می‌کند، پس null می‌نویسیم تا همگام‌سازی پاک شدن را ببیند.
  const json = JSON.stringify(payload, (_k, v: unknown) => (v === undefined ? null : v));
  return { sql: 'INSERT INTO outbox (entity, entity_id, op, payload, created_at, hlc) VALUES (?, ?, ?, ?, ?, ?)', params: [entity, id, op, json, nowIso(), hlc] };
}

const TABLE: Record<Exclude<SyncKind, 'photo'>, string> = { listing: 'listings', client: 'clients', visit: 'visits', todo: 'todos', deal: 'deals' };
const SYNC_CHUNK = 400; // سقف پارامترهای یک دستور SQLite

/** لایهٔ داده روی SQLite؛ همان رابط KelidStore، پس صفحه‌ها فرقی نمی‌بینند. */
export class SqlStore implements KelidStore, Syncable {
  private listeners = new Set<() => void>();
  // تا open شناسهٔ واقعی دستگاه را بخواند؛ هیچ نوشتنی پیش از آن نیست.
  private hlc = new Hlc('0');
  private constructor(private db: SqlDriver) {}

  /** ردیف صف ارسال با زمان منطقی همین لحظه. */
  private outbox(entity: string, id: string, op: 'upsert' | 'delete', payload: unknown): SqlStatement {
    return outboxRow(entity, id, op, payload, this.hlc.now());
  }

  static async open(db: SqlDriver, sample?: SampleData): Promise<SqlStore> {
    await migrate(db);
    const store = new SqlStore(db);
    await store.initClock();
    const [seeded] = await db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'seeded'");
    if (!seeded && sample) await store.insertSample(sample);
    return store;
  }

  private async initClock() {
    const rows = await this.db.all<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('node', 'hlc')");
    let node = rows.find((r) => r.key === 'node')?.value;
    if (!node) {
      // شناسهٔ کوتاه و تصادفی همین نصب؛ وقتی دو دستگاه در یک لحظه یک فیلد را عوض کنند، برنده را معلوم می‌کند.
      node = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => (x % 36).toString(36)).join('');
      await this.db.transaction([{ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('node', ?)", params: [node] }]);
    }
    this.hlc = new Hlc(node);
    const [m] = await this.db.all<{ h: string | null }>('SELECT MAX(hlc) AS h FROM outbox');
    this.hlc.receive(m?.h);
    this.hlc.receive(rows.find((r) => r.key === 'hlc')?.value);
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

  private async insertSample(sample: SampleData) {
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
      st.push({ sql: 'INSERT INTO todos (id, title, detail, action, done, position, sample, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)', params: [t.id, t.title, t.detail, t.action ?? '', t.done ? 1 : 0, i, nowIso()] });
    });
    for (const d of sample.deals ?? []) st.push({ sql: `INSERT INTO deals (${DEAL_COLS}, sample) VALUES (${DEAL_COLS.split(',').map(() => '?').join(', ')}, 1)`, params: dealValues(d) });
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
    const listing: Listing = { ...input, id: newId(), plaque: (m?.p ?? 0) + 1, createdAt: now, updatedAt: now };
    await this.db.transaction([
      { sql: `INSERT INTO listings (${LISTING_COLS}) VALUES (${LISTING_PH})`, params: listingValues(listing) },
      this.outbox('listing', listing.id, 'upsert', listing),
    ]);
    this.emit();
    return listing;
  }

  async updateListing(id: string, patch: Partial<NewListing>) {
    const cur = await this.getListing(id);
    if (!cur) throw new Error('فایل پیدا نشد');
    const merged = applyListingPatch(cur, patch);
    const changed = changedFields(cur, merged);
    if (Object.keys(changed).length === 0) return cur;
    const next: Listing = { ...merged, updatedAt: nowIso() };
    await this.db.transaction([
      { sql: `UPDATE listings SET ${LISTING_SET} WHERE id = ?`, params: [...listingUpdateValues(next), id] },
      this.outbox('listing', id, 'upsert', changed),
    ]);
    this.emit();
    return next;
  }

  async archiveListing(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE listings SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('listing', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreListing(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE listings SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('listing', id, 'upsert', { deleted: false }),
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
    const c: Client = { ...input, id: newId(), lastContactAt: now, createdAt: now };
    await this.db.transaction([
      {
        sql: 'INSERT INTO clients (id, name, phone, need, temperature, waiting, last_contact_at, notes, search, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [c.id, c.name, c.phone, JSON.stringify(c.need), c.temperature, c.waitingForNews ? 1 : 0, now, c.notes ?? null, clientSearchText(c), now, now],
      },
      this.outbox('client', c.id, 'upsert', c),
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
      this.outbox('client', id, 'upsert', changed),
    ]);
    this.emit();
    return next;
  }

  async archiveClient(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE clients SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('client', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreClient(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE clients SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('client', id, 'upsert', { deleted: false }),
    ]);
    this.emit();
  }

  async listVisits(fromIso: string, toIso: string) {
    const rows = await this.db.all<Row>('SELECT * FROM visits WHERE deleted = 0 AND starts_at >= ? AND starts_at < ? ORDER BY starts_at', [fromIso, toIso]);
    return rows.map(rowToVisit);
  }

  async getVisit(id: string) {
    const [r] = await this.db.all<Row>('SELECT * FROM visits WHERE id = ? AND deleted = 0', [id]);
    return r ? rowToVisit(r) : undefined;
  }

  async addVisit(input: NewVisit) {
    const v: Visit = { ...input, id: newId() };
    await this.db.transaction([
      { sql: 'INSERT INTO visits (id, kind, title, starts_at, ends_at, listing_id, client_id, done, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [v.id, v.kind, v.title, v.startsAt, v.endsAt, v.listingId ?? null, v.clientId ?? null, v.done ? 1 : 0, nowIso()] },
      this.outbox('visit', v.id, 'upsert', v),
    ]);
    this.emit();
    return v;
  }

  async updateVisit(id: string, patch: Partial<NewVisit>) {
    const cur = await this.getVisit(id);
    if (!cur) throw new Error('قرار پیدا نشد');
    const next: Visit = { ...cur, ...patch, id: cur.id };
    const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => k !== 'id' && v !== cur[k as keyof Visit]));
    if (Object.keys(changed).length === 0) return cur;
    await this.db.transaction([
      { sql: 'UPDATE visits SET kind = ?, title = ?, starts_at = ?, ends_at = ?, listing_id = ?, client_id = ?, done = ?, updated_at = ? WHERE id = ?', params: [next.kind, next.title, next.startsAt, next.endsAt, next.listingId ?? null, next.clientId ?? null, next.done ? 1 : 0, nowIso(), id] },
      this.outbox('visit', id, 'upsert', changed),
    ]);
    this.emit();
    return next;
  }

  async listTodos() {
    const rows = await this.db.all<Row>('SELECT * FROM todos WHERE deleted = 0 ORDER BY position');
    return rows.map((r): Todo => ({ id: s(r.id), title: s(r.title), detail: s(r.detail), action: (opt(r.action) || undefined) as Todo['action'], done: b(r.done) }));
  }

  async addTodo(input: NewTodo) {
    const [m] = await this.db.all<{ p: number | null }>('SELECT MAX(position) AS p FROM todos');
    const t: Todo = { id: newId(), title: input.title, detail: input.detail ?? '', action: input.action, done: false };
    await this.db.transaction([
      // ستون action در جدول اجباری است؛ «بدون میانبر» رشتهٔ خالی ذخیره می‌شود.
      { sql: 'INSERT INTO todos (id, title, detail, action, done, position, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)', params: [t.id, t.title, t.detail, t.action ?? '', (m?.p ?? -1) + 1, nowIso()] },
      this.outbox('todo', t.id, 'upsert', t),
    ]);
    this.emit();
    return t;
  }

  async deleteTodo(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE todos SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('todo', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreTodo(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE todos SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('todo', id, 'upsert', { deleted: false }),
    ]);
    this.emit();
  }

  async setTodoDone(id: string, done: boolean) {
    await this.db.transaction([
      { sql: 'UPDATE todos SET done = ?, updated_at = ? WHERE id = ?', params: [done ? 1 : 0, nowIso(), id] },
      this.outbox('todo', id, 'upsert', { done }),
    ]);
    this.emit();
  }

  async hasSampleData() {
    const [r] = await this.db.all<{ c: number }>('SELECT COUNT(*) AS c FROM listings WHERE sample = 1 AND deleted = 0');
    return (r?.c ?? 0) > 0;
  }

  async clearSampleData() {
    await this.db.transaction([
      { sql: 'DELETE FROM photos WHERE listing_id IN (SELECT id FROM listings WHERE sample = 1)' },
      ...['listings', 'clients', 'visits', 'todos', 'deals'].map((t) => ({ sql: `DELETE FROM ${t} WHERE sample = 1` })),
    ]);
    this.emit();
  }

  async listPhotos(listingId: string) {
    const rows = await this.db.all<Row>('SELECT id, listing_id, ord, mime, w, h, created_at, thumb FROM photos WHERE listing_id = ? AND deleted = 0 AND blob_state <> 2 ORDER BY ord, created_at, id', [listingId]);
    return rows.map((r): PhotoThumb => ({ ...rowToPhoto(r), thumb: blob(r.thumb) }));
  }

  async getPhoto(id: string) {
    const [r] = await this.db.all<Row>('SELECT mime, bytes FROM photos WHERE id = ? AND deleted = 0 AND blob_state <> 2', [id]);
    return r ? { mime: s(r.mime), bytes: blob(r.bytes) } : undefined;
  }

  async coverThumbs() {
    const rows = await this.db.all<Row>(
      // همان ترتیب listPhotos، تا با ord برابر هم کاور همیشه یک عکس مشخص باشد.
      `SELECT p.id, p.listing_id, p.mime, p.thumb FROM photos p
       WHERE p.deleted = 0 AND p.blob_state <> 2 AND p.id = (
         SELECT q.id FROM photos q WHERE q.listing_id = p.listing_id AND q.deleted = 0 AND q.blob_state <> 2 ORDER BY q.ord, q.created_at, q.id LIMIT 1
       )`,
    );
    const out: CoverThumbs = {};
    for (const r of rows) out[s(r.listing_id)] = { photoId: s(r.id), mime: s(r.mime), thumb: blob(r.thumb) };
    return out;
  }

  async addPhotos(listingId: string, photos: NewPhoto[]) {
    const now = nowIso();
    // عکس‌های حذف‌شده هم حساب می‌شوند تا اگر برگردانده شدند، ترتیبشان با عکس تازه یکی نشود.
    const [m] = await this.db.all<{ o: number | null }>('SELECT MAX(ord) AS o FROM photos WHERE listing_id = ?', [listingId]);
    let ord = (m?.o ?? -1) + 1;
    const added: Photo[] = photos.map((p) => ({ id: newId(), listingId, ord: ord++, mime: p.mime, width: p.width, height: p.height, createdAt: now }));
    const st: SqlStatement[] = [];
    added.forEach((a, i) => {
      const p = photos[i]!;
      st.push({ sql: 'INSERT INTO photos (id, listing_id, ord, mime, w, h, bytes, thumb, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [a.id, listingId, a.ord, a.mime, a.width, a.height, p.bytes, p.thumb, now, now] });
      // در outbox فقط مشخصات عکس می‌آید؛ بایت‌ها موقع همگام‌سازی از جدول photos خوانده می‌شوند.
      st.push(this.outbox('photo', a.id, 'upsert', a));
    });
    st.push(photoCount(listingId));
    await this.db.transaction(st);
    this.emit();
    return added;
  }

  async reorderPhotos(listingId: string, ids: string[]) {
    const now = nowIso();
    await this.db.transaction(
      ids.flatMap((id, ord) => [
        { sql: 'UPDATE photos SET ord = ?, updated_at = ? WHERE id = ? AND listing_id = ?', params: [ord, now, id, listingId] },
        this.outbox('photo', id, 'upsert', { ord }),
      ]),
    );
    this.emit();
  }

  async deletePhoto(id: string) {
    const [r] = await this.db.all<Row>('SELECT listing_id FROM photos WHERE id = ?', [id]);
    if (!r) return;
    await this.db.transaction([
      { sql: 'UPDATE photos SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('photo', id, 'delete', {}),
      photoCount(s(r.listing_id)),
    ]);
    this.emit();
  }

  async restorePhoto(id: string) {
    const [r] = await this.db.all<Row>('SELECT listing_id, ord FROM photos WHERE id = ?', [id]);
    if (!r) return;
    const listingId = s(r.listing_id);
    // اگر بعد از حذف ترتیب عوض شده و جای عکس گرفته شده، به انتها می‌رود تا کاور دوپهلو نشود.
    const [m] = await this.db.all<{ o: number | null; taken: number }>(
      'SELECT MAX(ord) AS o, SUM(ord = ?) AS taken FROM photos WHERE listing_id = ? AND deleted = 0 AND id <> ?',
      [Number(r.ord), listingId, id],
    );
    const ord = Number(m?.taken ?? 0) > 0 ? (m?.o ?? -1) + 1 : Number(r.ord);
    const now = nowIso();
    await this.db.transaction([
      { sql: 'UPDATE photos SET deleted = 0, ord = ?, updated_at = ? WHERE id = ?', params: [ord, now, id] },
      this.outbox('photo', id, 'upsert', { deleted: false, ord }),
      photoCount(listingId),
    ]);
    this.emit();
  }

  async listDeals() {
    const rows = await this.db.all<Row>('SELECT * FROM deals WHERE deleted = 0 ORDER BY updated_at DESC');
    return rows.map(rowToDeal);
  }

  async addDeal(input: NewDeal) {
    const now = nowIso();
    const d: Deal = { ...input, id: newId(), closedAt: input.stage === 'done' ? now : undefined, createdAt: now, updatedAt: now };
    await this.db.transaction([
      { sql: `INSERT INTO deals (${DEAL_COLS}) VALUES (${DEAL_COLS.split(',').map(() => '?').join(', ')})`, params: dealValues(d) },
      this.outbox('deal', d.id, 'upsert', d),
    ]);
    this.emit();
    return d;
  }

  async updateDeal(id: string, patch: DealPatch) {
    const [r] = await this.db.all<Row>('SELECT * FROM deals WHERE id = ? AND deleted = 0', [id]);
    if (!r) throw new Error('معامله پیدا نشد');
    const cur = rowToDeal(r);
    const { next, changed } = applyDealPatch(cur, patch, nowIso());
    if (Object.keys(changed).length === 0) return cur;
    const set = DEAL_COLS.split(', ').filter((c) => c !== 'id' && c !== 'created_at');
    const vals = dealValues(next).filter((_v, i) => i !== 0 && i !== 12);
    await this.db.transaction([
      { sql: `UPDATE deals SET ${set.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, params: [...vals, id] },
      this.outbox('deal', id, 'upsert', changed),
    ]);
    this.emit();
    return next;
  }

  async archiveDeal(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE deals SET deleted = 1, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('deal', id, 'delete', {}),
    ]);
    this.emit();
  }

  async restoreDeal(id: string) {
    await this.db.transaction([
      { sql: 'UPDATE deals SET deleted = 0, updated_at = ? WHERE id = ?', params: [nowIso(), id] },
      this.outbox('deal', id, 'upsert', { deleted: false }),
    ]);
    this.emit();
  }

  // ── همگام‌سازی (موتورش در apps/web/src/sync) ──

  async syncInfo() {
    const rows = await this.db.all<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('sync_office', 'sync_cursor')");
    const [c] = await this.db.all<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return { office: rows.find((r) => r.key === 'sync_office')?.value ?? null, cursor: rows.find((r) => r.key === 'sync_cursor')?.value ?? '0', pending: Number(c?.n ?? 0) };
  }

  async bindOffice(officeId: string) {
    await this.db.transaction([{ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('sync_office', ?)", params: [officeId] }]);
  }

  async pendingChanges(limit: number) {
    const rows = await this.db.all<Row>('SELECT seq, entity, entity_id, op, payload, hlc, created_at FROM outbox ORDER BY seq LIMIT ?', [limit]);
    const last = rows.at(-1);
    if (!last) return { changes: [], lastSeq: 0 };
    // فقط رکوردی فرستاده می‌شود که هنوز هست و نمونه نیست. نمونه‌ها مال آشنایی همین دستگاه‌اند؛ و چون پاک کردن نمونه‌ها
    // تنها حذف واقعی است (بقیه نرم‌اند)، صفِ رکوردِ ناپیدا هم یعنی نمونهٔ پاک‌شده، نه دادهٔ دفتر.
    const keep = new Set<string>();
    const queries: Array<[string, string]> = [
      ...Object.entries(TABLE).map(([kind, table]): [string, string] => [kind, `SELECT id FROM ${table} WHERE sample = 0 AND id IN `]),
      ['photo', 'SELECT p.id FROM photos p JOIN listings l ON l.id = p.listing_id WHERE l.sample = 0 AND p.id IN '],
    ];
    for (const [kind, sql] of queries) {
      const ids = rows.filter((r) => r.entity === kind).map((r) => s(r.entity_id));
      for (let i = 0; i < ids.length; i += SYNC_CHUNK) {
        const part = ids.slice(i, i + SYNC_CHUNK);
        const hits = await this.db.all<{ id: string }>(`${sql}(${part.map(() => '?').join(',')})`, part);
        for (const h of hits) keep.add(`${kind}:${h.id}`);
      }
    }
    const changes: OutgoingChange[] = [];
    for (const r of rows) {
      const kind = s(r.entity) as SyncKind;
      if (!SYNC_KINDS.includes(kind) || !keep.has(`${kind}:${s(r.entity_id)}`)) continue;
      const fields: Record<string, unknown> = r.op === 'delete' ? { deleted: true } : (JSON.parse(s(r.payload) || '{}') as Record<string, unknown>);
      delete fields.id;
      // شمار عکس را هر دستگاه از عکس‌های خودش حساب می‌کند.
      if (kind === 'listing') delete fields.photoCount;
      // تغییرهای پیش از همگام‌سازی زمان منطقی ندارند؛ زمان ثبت + شمارهٔ صف ترتیبشان را نگه می‌دارد.
      const hlc = opt(r.hlc) ?? encodeHlc({ wall: Date.parse(s(r.created_at)) || 0, count: Number(r.seq) % 60_000_000, node: this.hlc.node });
      changes.push({ seq: Number(r.seq), kind, id: s(r.entity_id), fields, hlc });
    }
    return { changes, lastSeq: Number(last.seq) };
  }

  async ackChanges(upToSeq: number) {
    await this.db.transaction([
      // ساعت منطقی با پاک شدن صف گم نشود
      {
        sql: "INSERT INTO meta (key, value) SELECT 'hlc', MAX(hlc) FROM outbox WHERE seq <= ? AND hlc IS NOT NULL HAVING MAX(hlc) IS NOT NULL ON CONFLICT(key) DO UPDATE SET value = MAX(value, excluded.value)",
        params: [upToSeq],
      },
      { sql: 'DELETE FROM outbox WHERE seq <= ?', params: [upToSeq] },
    ]);
  }

  notifyChanged() {
    this.emit();
  }

  async applyRemote(entities: IncomingEntity[], cursor: string, hlc: string | null, opts: { quiet?: boolean } = {}) {
    const st: SqlStatement[] = [];
    const byKind = new Map<string, string[]>();
    for (const e of entities) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e.id]);

    // فیلدهایی که روی همین دستگاه عوض شده‌اند و هنوز نرفته‌اند دست نمی‌خورند؛ بعد از ارسال، نسخهٔ ادغام‌شده برمی‌گردد.
    const pending = new Map<string, Set<string>>();
    const existing = new Map<string, Row>();
    for (const [kind, ids] of byKind) {
      for (let i = 0; i < ids.length; i += SYNC_CHUNK) {
        const part = ids.slice(i, i + SYNC_CHUNK);
        const ph = part.map(() => '?').join(',');
        for (const r of await this.db.all<Row>(`SELECT entity_id, op, payload FROM outbox WHERE entity = ? AND entity_id IN (${ph})`, [kind, ...part])) {
          const key = `${kind}:${s(r.entity_id)}`;
          const set = pending.get(key) ?? new Set<string>();
          if (r.op === 'delete') set.add('deleted');
          else for (const k of Object.keys(JSON.parse(s(r.payload) || '{}') as object)) set.add(k);
          pending.set(key, set);
        }
        const table = kind === 'photo' ? 'photos' : TABLE[kind as keyof typeof TABLE];
        // بایت عکس‌ها لازم نیست؛ فقط مشخصات.
        const cols = kind === 'photo' ? 'id, listing_id, ord, deleted' : '*';
        for (const r of await this.db.all<Row>(`SELECT ${cols} FROM ${table} WHERE id IN (${ph})`, part)) existing.set(`${kind}:${s(r.id)}`, r);
      }
    }

    const photoListings = new Set<string>();
    for (const e of entities) {
      const key = `${e.kind}:${e.id}`;
      const skip = pending.get(key);
      const f = sanitizeFields(e.kind, e.fields);
      const plaque = f.plaque;
      if (skip) for (const k of skip) delete f[k];
      const row = existing.get(key);
      if (!row && REQUIRED[e.kind].some((k) => !(k in f))) continue;
      const deleted = 'deleted' in f ? (f.deleted ? 1 : 0) : Number(row?.deleted ?? 0);
      if (e.kind === 'photo') {
        st.push(remotePhoto(e.id, row, f, deleted));
        photoListings.add(row ? s(row.listing_id) : String(f.listingId));
        continue;
      }
      st.push(...this.remoteRow(e.kind, e.id, row, f, deleted, plaque));
    }
    for (const l of photoListings) st.push(photoCount(l));
    st.push({ sql: "INSERT OR REPLACE INTO meta (key, value) VALUES ('sync_cursor', ?)", params: [cursor] });
    if (hlc) {
      st.push({ sql: "INSERT INTO meta (key, value) VALUES ('hlc', ?) ON CONFLICT(key) DO UPDATE SET value = MAX(value, excluded.value)", params: [hlc] });
    }
    await this.db.transaction(st);
    this.hlc.receive(hlc);
    if (!opts.quiet) this.emit();
  }

  async photosToUpload(limit: number): Promise<PhotoBlob[]> {
    const rows = await this.db.all<Row>(
      `SELECT p.id, p.mime, p.bytes, p.thumb FROM photos p LEFT JOIN listings l ON l.id = p.listing_id
       WHERE p.blob_state = 0 AND COALESCE(l.sample, 0) = 0 ORDER BY p.created_at, p.id LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({ id: s(r.id), mime: s(r.mime), bytes: blob(r.bytes), thumb: blob(r.thumb) }));
  }

  async markPhotosUploaded(ids: string[]) {
    if (!ids.length) return;
    await this.db.transaction([{ sql: `UPDATE photos SET blob_state = 1 WHERE blob_state = 0 AND id IN (${ids.map(() => '?').join(',')})`, params: ids }]);
  }

  async photosToDownload(limit: number) {
    // عکسِ فایلی که روی این دستگاه نیست پرسیده نمی‌شود؛ وگرنه عکسِ بی‌صاحب هر دور دوباره از سرور خواسته می‌شد.
    const rows = await this.db.all<{ id: string }>(
      'SELECT p.id FROM photos p JOIN listings l ON l.id = p.listing_id WHERE p.blob_state = 2 AND p.deleted = 0 ORDER BY p.ord, p.id LIMIT ?',
      [limit],
    );
    return rows.map((r) => r.id);
  }

  async savePhotoBlob(b: PhotoBlob) {
    const [r] = await this.db.all<Row>('SELECT listing_id FROM photos WHERE id = ? AND blob_state = 2', [b.id]);
    if (!r) return;
    await this.db.transaction([
      { sql: 'UPDATE photos SET mime = ?, bytes = ?, thumb = ?, blob_state = 1 WHERE id = ? AND blob_state = 2', params: [b.mime, b.bytes, b.thumb, b.id] },
      photoCount(s(r.listing_id)),
    ]);
  }

  async resetLocalData() {
    await this.db.transaction([
      ...['photos', 'listings', 'clients', 'visits', 'todos', 'deals', 'outbox'].map((t) => ({ sql: `DELETE FROM ${t}` })),
      // شناسهٔ دستگاه و ساعت منطقی می‌مانند؛ فقط پیوند با دفتر قبلی و نشانگر دریافت.
      { sql: "DELETE FROM meta WHERE key IN ('sync_office', 'sync_cursor')" },
    ]);
    this.emit();
  }

  /** ردیف محلی از وضعیت سرور؛ همان ستون‌ها و همان متن جستجو که نوشتن‌های عادی می‌سازند. */
  private remoteRow(kind: Exclude<SyncKind, 'photo'>, id: string, row: Row | undefined, f: Record<string, unknown>, deleted: number, plaque: unknown): SqlStatement[] {
    const now = nowIso();
    const v = <T>(k: string, fallback: T): T => (k in f ? (orUndef(f[k]) as T) : fallback);
    switch (kind) {
      case 'listing': {
        const cur = row ? rowToListing(row) : undefined;
        const l: Listing = {
          id,
          // پلاک را سرور می‌دهد؛ پلاک موقت محلی تا آن موقع می‌ماند.
          plaque: typeof plaque === 'number' ? plaque : (cur?.plaque ?? null),
          deal: v('deal', cur?.deal as Listing['deal']),
          status: v('status', cur?.status as Listing['status']),
          kind: v('kind', cur?.kind as Listing['kind']),
          neighborhood: v('neighborhood', cur?.neighborhood ?? ''),
          street: v('street', cur?.street ?? '') ?? '',
          address: v('address', cur?.address),
          area: v('area', cur?.area ?? 0),
          bedrooms: v('bedrooms', cur?.bedrooms ?? 0) ?? 0,
          floor: v('floor', cur?.floor),
          floorsTotal: v('floorsTotal', cur?.floorsTotal),
          yearBuilt: v('yearBuilt', cur?.yearBuilt),
          features: v('features', cur?.features ?? []) ?? [],
          price: v('price', cur?.price ?? {}) ?? {},
          negotiable: v('negotiable', cur?.negotiable ?? true) ?? true,
          description: v('description', cur?.description),
          owner: v('owner', cur?.owner ?? { name: '', phone: '' }) ?? { name: '', phone: '' },
          cover: v('cover', cur?.cover ?? 'f') ?? 'f',
          photoCount: cur?.photoCount ?? 0,
          createdAt: v('createdAt', cur?.createdAt ?? now) ?? now,
          updatedAt: v('updatedAt', cur?.updatedAt ?? now) ?? now,
        };
        l.price = { total: orUndef(l.price.total), deposit: orUndef(l.price.deposit), monthlyRent: orUndef(l.price.monthlyRent) };
        l.owner = { name: l.owner.name, phone: l.owner.phone, bestTime: orUndef(l.owner.bestTime) };
        const set = LISTING_COLS.split(', ').filter((c) => c !== 'id' && c !== 'photo_count');
        return [
          // پلاکی که سرور به این فایل داد اگر موقتاً دست فایل محلی دیگری است، آن یکی منتظر پلاک خودش می‌ماند.
          ...(l.plaque !== null ? [{ sql: 'UPDATE listings SET plaque = NULL WHERE plaque = ? AND id <> ?', params: [l.plaque, id] }] : []),
          {
            sql: `INSERT INTO listings (${LISTING_COLS}, deleted) VALUES (${LISTING_PH}, ?) ON CONFLICT(id) DO UPDATE SET ${set.map((c) => `${c} = excluded.${c}`).join(', ')}, deleted = excluded.deleted`,
            params: [...listingValues(l), deleted],
          },
        ];
      }
      case 'client': {
        const cur = row ? rowToClient(row) : undefined;
        const c: Client = {
          id,
          name: v('name', cur?.name ?? ''),
          phone: v('phone', cur?.phone ?? '') ?? '',
          need: v('need', cur?.need as Client['need']),
          temperature: v('temperature', cur?.temperature ?? 'warm') ?? 'warm',
          waitingForNews: v('waitingForNews', cur?.waitingForNews ?? false) ?? false,
          lastContactAt: v('lastContactAt', cur?.lastContactAt ?? now) ?? now,
          notes: v('notes', cur?.notes),
          createdAt: v('createdAt', cur?.createdAt ?? now) ?? now,
        };
        return [
          {
            sql: `INSERT INTO clients (id, name, phone, need, temperature, waiting, last_contact_at, notes, search, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, need = excluded.need, temperature = excluded.temperature, waiting = excluded.waiting,
                  last_contact_at = excluded.last_contact_at, notes = excluded.notes, search = excluded.search, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted = excluded.deleted`,
            params: [c.id, c.name, c.phone, JSON.stringify(c.need), c.temperature, c.waitingForNews ? 1 : 0, c.lastContactAt, c.notes ?? null, clientSearchText(c), c.createdAt, now, deleted],
          },
        ];
      }
      case 'visit': {
        const cur = row ? rowToVisit(row) : undefined;
        const x: Visit = {
          id,
          kind: v('kind', cur?.kind as Visit['kind']),
          title: v('title', cur?.title ?? ''),
          startsAt: v('startsAt', cur?.startsAt ?? now),
          endsAt: v('endsAt', cur?.endsAt ?? now),
          listingId: v('listingId', cur?.listingId),
          clientId: v('clientId', cur?.clientId),
          done: v('done', cur?.done ?? false) ?? false,
        };
        return [
          {
            sql: `INSERT INTO visits (id, kind, title, starts_at, ends_at, listing_id, client_id, done, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
                  listing_id = excluded.listing_id, client_id = excluded.client_id, done = excluded.done, updated_at = excluded.updated_at, deleted = excluded.deleted`,
            params: [x.id, x.kind, x.title, x.startsAt, x.endsAt, x.listingId ?? null, x.clientId ?? null, x.done ? 1 : 0, now, deleted],
          },
        ];
      }
      case 'todo': {
        const title = v('title', row ? s(row.title) : '');
        const detail = v('detail', row ? s(row.detail) : '') ?? '';
        const action = v<string | undefined>('action', row ? s(row.action) : '') ?? '';
        const done = v('done', row ? b(row.done) : false) ?? false;
        return [
          {
            // کار تازه ته فهرست می‌رود؛ ترتیب فهرست مال هر دستگاه است.
            sql: `INSERT INTO todos (id, title, detail, action, done, position, updated_at, deleted) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM todos), ?, ?)
                  ON CONFLICT(id) DO UPDATE SET title = excluded.title, detail = excluded.detail, action = excluded.action, done = excluded.done, updated_at = excluded.updated_at, deleted = excluded.deleted`,
            params: [id, title, detail, action, done ? 1 : 0, now, deleted],
          },
        ];
      }
      case 'deal': {
        const cur = row ? rowToDeal(row) : undefined;
        const d: Deal = {
          id,
          listingId: v('listingId', cur?.listingId ?? ''),
          clientId: v('clientId', cur?.clientId),
          stage: v('stage', cur?.stage as Deal['stage']),
          price: v('price', cur?.price),
          rent: v('rent', cur?.rent),
          commissionBuyer: v('commissionBuyer', cur?.commissionBuyer),
          commissionSeller: v('commissionSeller', cur?.commissionSeller),
          checklist: v('checklist', cur?.checklist ?? []) ?? [],
          dueDay: v('dueDay', cur?.dueDay),
          notes: v('notes', cur?.notes),
          closedAt: v('closedAt', cur?.closedAt),
          createdAt: v('createdAt', cur?.createdAt ?? now) ?? now,
          updatedAt: v('updatedAt', cur?.updatedAt ?? now) ?? now,
        };
        const set = DEAL_COLS.split(', ').filter((c) => c !== 'id');
        return [
          {
            sql: `INSERT INTO deals (${DEAL_COLS}, deleted) VALUES (${DEAL_COLS.split(',').map(() => '?').join(', ')}, ?) ON CONFLICT(id) DO UPDATE SET ${set.map((c) => `${c} = excluded.${c}`).join(', ')}, deleted = excluded.deleted`,
            params: [...dealValues(d), deleted],
          },
        ];
      }
    }
  }
}
