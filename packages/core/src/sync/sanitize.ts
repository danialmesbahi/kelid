import type { SyncKind } from './types';

// داده‌ای که از سرور می‌آید را دستگاه دیگری نوشته؛ هر فیلد قبل از رسیدن به دیتابیس و صفحه‌ها بررسی می‌شود.
// فیلد نامعتبر نادیده گرفته می‌شود (نه کل رکورد)، تا یک نسخهٔ خراب برنامه دادهٔ بقیه را از کار نیندازد.
type Check = (v: unknown) => boolean;

const str: Check = (v) => typeof v === 'string' && v.length <= 20_000;
const optStr: Check = (v) => v === null || str(v);
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum: Check = (v) => v === null || num(v);
const bool: Check = (v) => typeof v === 'boolean';
const oneOf = (...xs: string[]): Check => (v) => typeof v === 'string' && xs.includes(v);
const strList: Check = (v) => Array.isArray(v) && v.length <= 200 && v.every(str);
const obj = (shape: Record<string, Check>): Check => (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.entries(v).every(([k, x]) => shape[k]?.(x) ?? false);
const deal = oneOf('sale', 'rent', 'full');
const propertyKind = oneOf('apartment', 'villa', 'shop', 'office', 'land');

const SPECS: Record<SyncKind, Record<string, Check>> = {
  listing: {
    deal,
    status: oneOf('active', 'reserved', 'negotiating', 'closed', 'archived'),
    kind: propertyKind,
    neighborhood: str,
    street: str,
    address: optStr,
    location: (v) => v === null || (obj({ lat: num, lng: num })(v) && Math.abs((v as { lat: number }).lat) <= 90 && Math.abs((v as { lng: number }).lng) <= 180),
    area: num,
    bedrooms: num,
    floor: optNum,
    floorsTotal: optNum,
    yearBuilt: optNum,
    features: strList,
    price: obj({ total: optNum, deposit: optNum, monthlyRent: optNum }),
    negotiable: bool,
    description: optStr,
    owner: obj({ name: str, phone: str, bestTime: optStr }),
    cover: oneOf('f', 'g', 'i', 'j'),
    plaque: (v) => v === null || (Number.isInteger(v) && (v as number) > 0),
    createdAt: str,
    updatedAt: str,
    deleted: bool,
  },
  client: {
    name: str,
    phone: str,
    need: obj({
      deal,
      kinds: (v) => Array.isArray(v) && v.every(propertyKind),
      neighborhoods: strList,
      areaMin: optNum,
      areaMax: optNum,
      bedroomsMin: optNum,
      budgetMax: optNum,
      rentMax: optNum,
    }),
    temperature: oneOf('hot', 'warm', 'cold'),
    waitingForNews: bool,
    lastContactAt: str,
    notes: optStr,
    createdAt: str,
    deleted: bool,
  },
  visit: {
    kind: oneOf('visit', 'call', 'signing', 'task'),
    title: str,
    startsAt: str,
    endsAt: str,
    listingId: optStr,
    clientId: optStr,
    done: bool,
    deleted: bool,
  },
  todo: {
    title: str,
    detail: str,
    action: (v) => v === null || v === '' || oneOf('sms', 'call', 'camera')(v),
    done: bool,
    deleted: bool,
  },
  deal: {
    listingId: str,
    clientId: optStr,
    stage: oneOf('talking', 'deposit', 'signed', 'done', 'lost'),
    price: optNum,
    rent: optNum,
    commissionBuyer: optNum,
    commissionSeller: optNum,
    checklist: strList,
    dueDay: optStr,
    notes: optStr,
    closedAt: optStr,
    createdAt: str,
    updatedAt: str,
    deleted: bool,
  },
  photo: {
    listingId: (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v),
    ord: num,
    mime: oneOf('image/webp', 'image/jpeg', 'image/png'),
    width: num,
    height: num,
    createdAt: str,
    deleted: bool,
  },
};

/** فیلدهایی که یک رکورد تازه حتماً باید داشته باشد تا در دیتابیس محلی ساخته شود. */
export const REQUIRED: Record<SyncKind, readonly string[]> = {
  listing: ['deal', 'status', 'kind', 'neighborhood', 'area', 'createdAt'],
  client: ['name', 'need', 'createdAt'],
  visit: ['kind', 'title', 'startsAt', 'endsAt'],
  todo: ['title'],
  deal: ['listingId', 'stage', 'createdAt'],
  photo: ['listingId', 'mime', 'width', 'height', 'createdAt'],
};

export function sanitizeFields(kind: SyncKind, fields: Record<string, unknown>): Record<string, unknown> {
  const spec = SPECS[kind];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (spec[k]?.(v)) out[k] = v;
  return out;
}

/** null یعنی «خالی شد»؛ در مدل برنامه همان undefined است. */
export const orUndef = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
