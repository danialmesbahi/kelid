import type { ClientTemperature, DealType, PropertyKind } from './model';
import { spokenAmounts, spokenNumbers } from './money';
import { normalizePhone } from './store';

export { annotateAmounts, spokenAmounts, type SpokenAmount } from './money';

// پر کردن فرم با صدا: مشاور مشخصات را می‌گوید، سرور گفته را به متن و متن را به این فیلدها تبدیل می‌کند.
// هر فیلدی که در صحبت نیامده خالی می‌ماند تا چیزی که کاربر نوشته پاک نشود.

export type VoiceForm = 'listing' | 'client';

/** پیش‌نویس فایل از روی صحبت؛ مبلغ‌ها به تومان. */
export interface ListingDraft {
  deal?: DealType;
  kind?: PropertyKind;
  neighborhood?: string;
  street?: string;
  address?: string;
  area?: number;
  bedrooms?: number;
  floor?: number;
  floorsTotal?: number;
  yearBuilt?: number;
  features?: string[];
  total?: number;
  deposit?: number;
  rent?: number;
  negotiable?: boolean;
  description?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerBestTime?: string;
}

/** پیش‌نویس مشتری؛ budget در فروش سقف قیمت و در رهن سقف ودیعه است (مثل فرم). */
export interface ClientDraft {
  name?: string;
  phone?: string;
  deal?: DealType;
  kinds?: PropertyKind[];
  neighborhoods?: string[];
  areaMin?: number;
  areaMax?: number;
  bedroomsMin?: number;
  budget?: number;
  rent?: number;
  temperature?: ClientTemperature;
  waiting?: boolean;
  notes?: string;
}

export type VoiceDraft<F extends VoiceForm> = F extends 'listing' ? ListingDraft : ClientDraft;

/** امکاناتی که فرم فایل تیک‌شان را دارد؛ مدل بهتر است همین نام‌ها را برگرداند. */
export const VOICE_FEATURES = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی و نگهبان', 'استخر و سونا', 'روف گاردن'];

const DEALS: DealType[] = ['sale', 'rent', 'full'];
const KINDS: PropertyKind[] = ['apartment', 'villa', 'shop', 'office', 'land'];
const TEMPS: ClientTemperature[] = ['hot', 'warm', 'cold'];

type Spec =
  | { t: 'text'; max: number; d: string }
  | { t: 'int'; min: number; max: number; d: string }
  | { t: 'bool'; d: string }
  | { t: 'enum'; of: readonly string[]; d: string }
  | { t: 'enums'; of: readonly string[]; d: string }
  | { t: 'texts'; max: number; d: string }
  | { t: 'phone'; d: string };

const TOMAN = 1_000_000_000_000_000; // سقف معقول: هزار هزار میلیارد تومان

const LISTING: Record<keyof ListingDraft, Spec> = {
  deal: { t: 'enum', of: DEALS, d: 'sale = فروش, rent = رهن و اجاره (deposit + monthly rent), full = رهن کامل (deposit only)' },
  kind: { t: 'enum', of: KINDS, d: 'apartment = آپارتمان, villa = ویلایی/خانه, shop = مغازه, office = دفتر کار/اداری, land = زمین/کلنگی' },
  neighborhood: { t: 'text', max: 80, d: 'neighbourhood name only, as written in Persian (e.g. سعادت‌آباد)' },
  street: { t: 'text', max: 120, d: 'street / alley name' },
  address: { t: 'text', max: 300, d: 'full address if a precise one (plaque, unit, alley) was spoken' },
  area: { t: 'int', min: 1, max: 1_000_000, d: 'area in square metres' },
  bedrooms: { t: 'int', min: 0, max: 50, d: 'number of bedrooms (خواب)' },
  floor: { t: 'int', min: 0, max: 200, d: 'which floor the unit is on; همکف = 0' },
  floorsTotal: { t: 'int', min: 1, max: 200, d: 'total floors of the building' },
  yearBuilt: { t: 'int', min: 1300, max: 1500, d: 'Solar Hijri build year (e.g. 1398). Convert "n years old" (n سال ساخت) using the current year given in the prompt; نوساز = current year' },
  features: { t: 'texts', max: 40, d: `amenities that exist. Use these exact names when they match: ${VOICE_FEATURES.join('، ')}; others as short Persian phrases` },
  total: { t: 'int', min: 1, max: TOMAN, d: 'sale only: total price in Toman' },
  deposit: { t: 'int', min: 1, max: TOMAN, d: 'rent / full mortgage: deposit (رهن/ودیعه) in Toman' },
  rent: { t: 'int', min: 1, max: TOMAN, d: 'rent only: monthly rent in Toman' },
  negotiable: { t: 'bool', d: 'true if price is negotiable (قابل مذاکره، جای چانه دارد), false if fixed (مقطوع)' },
  description: { t: 'text', max: 2000, d: 'other useful details that fit no other field (light, renovation, view, access), as a short clean Persian sentence' },
  ownerName: { t: 'text', max: 80, d: 'owner name, e.g. آقای رضایی' },
  ownerPhone: { t: 'phone', d: 'owner phone number, digits only' },
  ownerBestTime: { t: 'text', max: 80, d: 'best time to call the owner, e.g. عصرها' },
};

const CLIENT: Record<keyof ClientDraft, Spec> = {
  name: { t: 'text', max: 80, d: 'customer name, e.g. خانم احمدی' },
  phone: { t: 'phone', d: 'customer phone number, digits only' },
  deal: { t: 'enum', of: DEALS, d: 'what the customer wants: sale = buy (خرید), rent = رهن و اجاره, full = رهن کامل' },
  kinds: { t: 'enums', of: KINDS, d: 'property types wanted: apartment, villa, shop, office, land' },
  neighborhoods: { t: 'texts', max: 80, d: 'neighbourhoods wanted, each one a Persian name' },
  areaMin: { t: 'int', min: 1, max: 1_000_000, d: 'minimum area in square metres. «از ۸۰ تا ۱۰۰ متر»، «هشتاد نود متری»، «بین ۸۰ و ۱۰۰» → 80; «۱۰۰ متر به بالا» → 100' },
  areaMax: { t: 'int', min: 1, max: 1_000_000, d: 'maximum area in square metres. «از ۸۰ تا ۱۰۰ متر» → 100; «زیر ۱۰۰»، «۱۰۰ به پایین»، «از ۱۰۰ بیشتر نباشه» → 100' },
  bedroomsMin: { t: 'int', min: 0, max: 50, d: 'minimum bedrooms («دو سه خوابه» → 2)' },
  budget: { t: 'int', min: 1, max: TOMAN, d: 'buy: max total price; rent / full: max deposit (رهن/ودیعه/پول پیش). For a range («پنج شش میلیارد») the upper end. In Toman' },
  rent: { t: 'int', min: 1, max: TOMAN, d: 'rent only: max monthly rent in Toman' },
  temperature: { t: 'enum', of: TEMPS, d: 'hot = serious and urgent (فوری، جدی), warm = normal, cold = just looking / later' },
  waiting: { t: 'bool', d: 'true if the agent must call the customer back with news (منتظر خبر است)' },
  notes: { t: 'text', max: 2000, d: 'other useful details for the office as a short clean Persian sentence' },
};

const specs = (form: VoiceForm): Record<string, Spec> => (form === 'listing' ? LISTING : CLIENT);

function jsonType(s: Spec): object {
  switch (s.t) {
    case 'text':
    case 'phone':
      return { type: ['string', 'null'] };
    case 'int':
      return { type: ['integer', 'null'] };
    case 'bool':
      return { type: ['boolean', 'null'] };
    case 'enum':
      return { type: ['string', 'null'], enum: [...s.of, null] };
    case 'enums':
      return { type: ['array', 'null'], items: { type: 'string', enum: [...s.of] } };
    case 'texts':
      return { type: ['array', 'null'], items: { type: 'string' } };
  }
}

/** JSON Schema سخت‌گیر (structured outputs): همهٔ کلیدها لازم‌اند و null یعنی «گفته نشد». */
export function voiceSchema(form: VoiceForm): object {
  const all = specs(form);
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(all),
    properties: Object.fromEntries(Object.entries(all).map(([k, s]) => [k, { ...jsonType(s), description: s.d }])),
  };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function clean(s: Spec, v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  switch (s.t) {
    case 'text':
      return text(v, s.max) || undefined;
    case 'phone': {
      // ثابت بی صفر اول («۲۱۲۲۳۳۴۴۵۵») هم درست می‌شود؛ شمارهٔ ناقص یا بلند غلط است و در فرم نمی‌نشیند.
      const p = typeof v === 'string' || typeof v === 'number' ? normalizePhone(String(v)).replace(/^(?=[1-8]\d{9}$)/, '0') : '';
      return /^0[1-9]\d{9}$|^[2-8]\d{7}$/.test(p) ? p : undefined;
    }
    case 'int': {
      const n = Math.round(typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);
      return Number.isFinite(n) && n >= s.min && n <= s.max ? n : undefined;
    }
    case 'bool':
      return typeof v === 'boolean' ? v : undefined;
    case 'enum':
      return typeof v === 'string' && s.of.includes(v) ? v : undefined;
    case 'enums': {
      if (!Array.isArray(v)) return undefined;
      const out = [...new Set(v.filter((x): x is string => typeof x === 'string' && s.of.includes(x)))];
      return out.length ? out : undefined;
    }
    case 'texts': {
      if (!Array.isArray(v)) return undefined;
      const out = [...new Set(v.map((x) => text(x, s.max)).filter(Boolean))].slice(0, 20);
      return out.length ? out : undefined;
    }
  }
}

/**
 * خروجی مدل را به پیش‌نویس امن تبدیل می‌کند: کلید ناشناخته، نوع اشتباه و عدد بی‌معنی کنار می‌رود.
 * پاسخ مدل هرگز مستقیم به فرم نمی‌رسد.
 */
export function cleanVoiceDraft<F extends VoiceForm>(form: F, raw: unknown): VoiceDraft<F> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out as VoiceDraft<F>;
  for (const [k, s] of Object.entries(specs(form))) {
    const v = clean(s, (raw as Record<string, unknown>)[k]);
    if (v !== undefined) out[k] = v;
  }
  // نوع معامله گفته نشده ولی قیمت گفته شده: «اجاره» یعنی رهن و اجاره، «قیمت کل» یعنی فروش؛ وگرنه فیلد قیمت در فرم پنهان می‌ماند.
  if (form === 'listing' && !out.deal) {
    if (out.rent) out.deal = 'rent';
    else if (out.total && !out.deposit) out.deal = 'sale';
  }
  // مشتری بودجه گفته و از رهن و اجاره حرفی نزده: خرید است.
  if (form === 'client' && !out.deal && out.budget && !out.rent) out.deal = 'sale';
  // قیمتی که به نوع معامله نمی‌خورد (اجاره در فروش) گیج‌کننده است؛ فقط وقتی نوع معامله معلوم است کنار می‌رود.
  if (form === 'listing' && out.deal) {
    if (out.deal !== 'sale') delete out.total;
    if (out.deal === 'sale') delete out.deposit;
    if (out.deal !== 'rent') delete out.rent;
  }
  if (form === 'client' && out.deal && out.deal !== 'rent') delete out.rent;
  if (form === 'client' && typeof out.areaMin === 'number' && typeof out.areaMax === 'number' && out.areaMin > out.areaMax) {
    [out.areaMin, out.areaMax] = [out.areaMax, out.areaMin];
  }
  return out as VoiceDraft<F>;
}

type PriceSlot = 'deposit' | 'rent' | 'total';

/**
 * واژهٔ پیش از مبلغ می‌گوید کدام قیمت است؛ اگر نبود یا در جملهٔ قبل (پیش از ویرگول) بود، واژهٔ بعد از مبلغ:
 * «صد میلیون پول پیش دارن»، «پنج تومن اجاره».
 */
export function slotOf(before: string, follow = ''): PriceSlot | 'perMeter' | undefined {
  const own = slotBefore(before);
  const f = /^\s*(پول پیش|پیش|رهن|ودیعه|اجاره|کرایه)(?=\s|$|[،,.])/.exec(follow);
  if (!f || own === 'perMeter') return own;
  return own === undefined || /[،,][\s\u200c]*$/.test(before) ? (/اجاره|کرایه/.test(f[1]!) ? 'rent' : 'deposit') : own;
}

function slotBefore(before: string): PriceSlot | 'perMeter' | undefined {
  const raw = before.replace(/[\s\u200c،,:]+$/, '');
  // «شارژ ماهانه پونصد هزار»، «وام صد میلیونی»: هزینه یا بدهی است، نه قیمت.
  if (/(وام|شارژ|بدهی|مالیات|قسط|اقساط|هزینه|جریمه)(ش)?( ماهانه| ماهیانه| ماهی| ماه)?( \S+)?$/.test(raw)) return undefined;
  // «رهن تا دویست»، «اجاره هم حداکثر ده»: قید مبلغ جای آن را عوض نمی‌کند.
  let b = raw;
  for (let prev = ''; prev !== b; ) {
    prev = b;
    b = b.replace(/\s*(تا|حدود|حدودا|زیر|سقف|حداکثر|حداکثرش|نهایتا|نهایت|تقریبا|در حد|هم|هم که|میتونه|می تونه)$/, '') || b;
  }
  // «صد متری هشت میلیارد»: «متری» مال متراژ است، نه قیمت هر متر.
  if (/(متری|هر\s*متر|متر\s*مربعی)$/.test(b)) return /متری$/.test(b) && spokenNumbers(b).some((n) => /^\s*متری$/.test(b.slice(n.end))) ? undefined : 'perMeter';
  if (/(رهن|ودیعه|پیش|رهنش|ودیعه‌اش|ودیعش|پیشش)(\s*(کامل|فول))?$/.test(b)) return 'deposit';
  if (/(اجاره|اجاره‌اش|اجارش|کرایه|ماهی|ماهیانه|ماهانه)$/.test(b)) return 'rent';
  if (/(قیمت|قیمتش|کل|کلش|فروش|بودجه|بودجه‌اش|بودجه اش|بودجش|پولش|نقد|نقدش|دستش|تا|حدود|زیر|سقف)$/.test(raw)) return 'total';
  return undefined;
}

/**
 * پشتوانهٔ مدل: مبلغی که در متن آمده ولی مدل جا انداخته از خود متن برداشته می‌شود.
 * فقط فیلدهای خالی پر می‌شوند؛ عددی که مدل داده دست نمی‌خورد.
 */
export function withSpokenPrices<F extends VoiceForm>(form: F, transcript: string, draft: VoiceDraft<F>): VoiceDraft<F> {
  const amounts = spokenAmounts(transcript).filter((a) => a.value >= 100_000);
  if (!amounts.length) return draft;
  const d = { ...draft } as Record<string, unknown>;
  const set = (k: string, v: number) => {
    if (d[k] === undefined) d[k] = v;
  };
  for (const a of amounts) {
    const pre = transcript.slice(Math.max(0, a.start - 30), a.start);
    if (/(وام|شارژ|بدهی|مالیات|قسط|اقساط|هزینه|جریمه)(ش)?( ماهانه| ماهیانه| ماهی| ماه)?[\s\u200c،,:]*$/.test(pre)) continue;
    let slot = slotOf(pre, transcript.slice(a.end, a.end + 20));
    if (slot === 'perMeter') {
      if (form === 'listing' && typeof d.area === 'number') set('total', a.value * d.area);
      continue;
    }
    // مبلغ بی‌برچسب فقط وقتی تنها مبلغ است معنی روشنی دارد.
    if (!slot && amounts.length === 1) slot = d.deal === 'full' || d.deal === 'rent' ? 'deposit' : 'total';
    if (!slot) continue;
    if (form === 'listing') set(slot, a.value);
    else set(slot === 'rent' ? 'rent' : 'budget', a.value);
  }
  return cleanVoiceDraft(form, d);
}

/** چند فیلد از فرم را این صحبت پر کرد (برای پیام «۷ مورد پر شد»). */
export function draftSize(d: ListingDraft | ClientDraft): number {
  return Object.keys(d).length;
}
