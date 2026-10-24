import type { PropertyKind } from './model';
import { spokenNumbers, type SpokenNumber } from './money';
import { normalizeForSearch, toEnDigits } from './persian';
import { normalizePhone } from './store';
import { VOICE_FEATURES, cleanVoiceDraft, slotOf, withSpokenPrices, type VoiceDraft, type VoiceForm } from './voice';

// پر کردن فرم از متن گفته‌شده با قاعده، بی مدل زبانی.
// مشاورها مشخصات را با الگوهای ثابتی می‌گویند («صد و بیست متر، دو خواب، طبقه سوم، قیمت هشت میلیارد»)؛
// این قاعده‌ها همیشه یک‌جور می‌فهمند و هزینه‌ای جز تبدیل صدا به متن ندارند.

/** یکسان‌سازی گفتار محاوره‌ای تا الگوها ساده بمانند. */
function norm(t: string): string {
  return toEnDigits(t)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ْ]/g, '')
    .replace(/‌/g, ' ')
    .replace(/خیابون/g, 'خیابان')
    .replace(/میدون/g, 'میدان')
    .replace(/خونه/g, 'خانه')
    .replace(/\s+/g, ' ')
    .trim();
}

const KIND_WORDS: Array<[PropertyKind, RegExp]> = [
  ['shop', /مغازه|تجاری|دکان|دکه|سوله/],
  ['office', /دفتر|اداری|مطب/],
  ['land', /زمین|کلنگی/],
  ['villa', /ویلا|ویلایی|حیاط دار|خانه حیاط/],
  ['apartment', /آپارتمان|اپارتمان|واحد مسکونی|برج|مسکونی/],
];

const FEATURE_WORDS: Array<[string, RegExp]> = [
  [VOICE_FEATURES[0]!, /پارکینگ/],
  [VOICE_FEATURES[1]!, /آسانسور|اسانسور/],
  [VOICE_FEATURES[2]!, /انباری/],
  [VOICE_FEATURES[3]!, /بالکن|تراس/],
  [VOICE_FEATURES[4]!, /لابی|نگهبان|سرایدار/],
  [VOICE_FEATURES[5]!, /استخر|سونا|جکوزی/],
  [VOICE_FEATURES[6]!, /روف ?گاردن|باغ (روی )?بام|پشت بام سبز/],
];

const ORDINALS: Record<string, number> = {
  اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, شیشم: 6, هفتم: 7, هشتم: 8, نهم: 9, دهم: 10,
  یازدهم: 11, دوازدهم: 12, سیزدهم: 13, چهاردهم: 14, پانزدهم: 15, پونزدهم: 15,
};

/** واژه‌هایی که بعد از «محله» یا «خیابان» نام نیستند. */
const NOT_NAME = /^(و|که|با|از|در|تو|توی|به|برای|هست|است|داره|دارد|می|میخواد|متر|متری|خواب|طبقه|قیمت|رهن|اجاره|فروش|فروشی|نزدیک|حدود|یک|یه|خیلی|خوب|این|اون|همین|دنبال|حال|خانه|شهر|جا|جای|اینجا|اونجا|مشتری|مالک)$/;
/** تکهٔ دوم نام‌های دوکلمه‌ای (سعادت آباد، شهرک غرب، تهران پارس). */
const NAME_TAIL = /^(آباد|اباد|شهر|پارس|غرب|شرق|شمالی|جنوبی|پارک|نو|کوچک|بزرگ|ده|سر|ویلا|بالا|پایین)$/;

function nameAt(words: string[], i: number): string | undefined {
  const w = words[i];
  if (!w || NOT_NAME.test(w) || /\d/.test(w) || spokenNumbers(w).length) return undefined;
  const next = words[i + 1];
  return next && NAME_TAIL.test(next) ? `${w} ${next}` : w;
}

/** نام بعد از یکی از این واژه‌ها، مثلاً «محله ونک» → «ونک». */
function nameAfter(t: string, lead: RegExp): Array<{ lead: string; name: string }> {
  const out: Array<{ lead: string; name: string }> = [];
  const words = t.replace(/[،,.:؛!?؟]/g, ' ').split(' ').filter(Boolean);
  words.forEach((w, i) => {
    if (!lead.test(w)) return;
    const name = nameAt(words, i + 1);
    if (name) out.push({ lead: w, name });
  });
  return out;
}

const before = (t: string, n: SpokenNumber, len = 25) => t.slice(Math.max(0, n.start - len), n.start).trimEnd();
const after = (t: string, n: SpokenNumber, len = 25) => t.slice(n.end, n.end + len).trimStart();

/** محله‌های همین دفتر که در متن آمده‌اند، به ترتیب گفته‌شدن. کلمه‌به‌کلمه، تا «ونک» از دل «پونک» پیدا نشود. */
function hintsIn(t: string, hints: string[]): string[] {
  const words = t.replace(/[،,.:؛!?؟]/g, ' ').split(' ').filter(Boolean);
  // نام یک‌کلمه‌ای که واژهٔ معمولی هم هست (زون «شهر» در بوشهر) در هر جمله‌ای پیدا می‌شود.
  const want = new Map(hints.filter((h) => h.trim() && !NOT_NAME.test(h.trim())).map((h) => [normalizeForSearch(h), h] as const));
  const found: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = 3; n >= 1; n--) {
      const h = want.get(normalizeForSearch(words.slice(i, i + n).join(' ')));
      if (h && i + n <= words.length) {
        if (!found.includes(h)) found.push(h);
        i += n - 1;
        break;
      }
    }
  }
  return found;
}

function dealOf(t: string) {
  if (/رهن (و )?کامل|رهن کامله|فقط رهن/.test(t)) return 'full' as const;
  if (/(رهن|ودیعه) (و |، ?)?اجاره|اجاره/.test(t)) return 'rent' as const;
  if (/فروش|فروشی|خرید|بخره|بفروش|میفروش/.test(t)) return 'sale' as const;
  if (/رهن|ودیعه/.test(t)) return 'full' as const;
  return undefined;
}

function kindsOf(t: string): PropertyKind[] {
  return KIND_WORDS.map(([k, re]) => ({ k, at: t.search(re) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.k);
}

function featuresOf(t: string): string[] {
  return FEATURE_WORDS.filter(([, re]) => {
    const m = re.exec(t);
    if (!m) return false;
    const pre = t.slice(Math.max(0, m.index - 8), m.index);
    const post = t.slice(m.index + m[0].length, m.index + m[0].length + 10);
    return !/بدون\s*$|بی\s*$/.test(pre) && !/^\s*(ندار|نداره|نیست|نمی)/.test(post);
  }).map(([f]) => f);
}

function phoneOf(t: string, nums: SpokenNumber[]): string | undefined {
  const digits = /(?:\+98|0098|0)?9\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.exec(t);
  if (digits) return normalizePhone(digits[0]);
  // «صفر نهصد و دوازده، سیصد و چهل و پنج…»: گروه‌های پشت سر هم بعد از «شماره».
  const key = /(شماره|تلفن|موبایل|تماس|شمارش)/.exec(t);
  if (!key) return undefined;
  const groups = nums.filter((n) => n.start > key.index && n.start < key.index + 120 && !n.money);
  let d = '';
  let last = -1;
  for (const g of groups) {
    if (last >= 0 && t.slice(last, g.start).replace(/[\s،,-]/g, '')) break;
    d += t.slice(g.start, g.end).trim().startsWith('صفر') ? `0${g.value || ''}` : String(g.value);
    last = g.end;
  }
  const p = normalizePhone(d);
  return /^09\d{9}$/.test(p) ? p : undefined;
}

function personOf(t: string, near?: RegExp): string | undefined {
  const re = /(آقای|آقا|جناب|خانم|خانوم) ([^\s،,.:؛]+)/g;
  const all = [...t.matchAll(re)].filter((m) => !NOT_NAME.test(m[2]!));
  const pick = (near && all.find((m) => near.test(t.slice(Math.max(0, m.index - 20), m.index)))) || all[0];
  if (pick) return `${/خانم|خانوم/.test(pick[1]!) ? 'خانم' : 'آقای'} ${pick[2]}`;
  const named = /(?:به اسم|اسمش|اسم) ([^\s،,.:؛]+)/.exec(t);
  return named && !NOT_NAME.test(named[1]!) ? named[1] : undefined;
}

/** «اجاره بیست»، «رهن پانصد»: عدد بی‌واحد پس از رهن/اجاره میلیون تومان است. */
function shortPrices(t: string, nums: SpokenNumber[]): { deposit?: number; rent?: number } {
  const out: { deposit?: number; rent?: number } = {};
  for (const n of nums) {
    if (n.money || n.value < 1 || n.value >= 1000 || /^\s*(متر|خواب|طبقه|سال|ساله|تا)/.test(after(t, n))) continue;
    const slot = slotOf(before(t, n, 30));
    if (slot === 'deposit' || slot === 'rent') out[slot] ??= Math.round(n.value * 1e6);
  }
  return out;
}

/** فیلدهای فرم از متن گفته‌شده. year سال شمسی جاری است (برای «ده سال ساخت» و «نوساز»). */
export function ruleDraft<F extends VoiceForm>(form: F, transcript: string, hints: string[], year: number): VoiceDraft<F> {
  const t = norm(transcript);
  if (!t) return {} as VoiceDraft<F>;
  const nums = spokenNumbers(t);
  const raw: Record<string, unknown> = {};
  const deal = dealOf(t);
  if (deal) raw.deal = deal;

  const areas = nums.filter((n) => !n.money && /^(متر|متری|مترمربع)/.test(after(t, n)) && !/(متری|هر متر)$/.test(before(t, n)));
  const bedrooms = nums.find((n) => !n.money && /^خواب/.test(after(t, n)));
  const bedroomsValue = bedrooms?.value ?? (/تک خواب/.test(t) ? 1 : /بدون خواب|استودیو/.test(t) ? 0 : undefined);
  const places = hintsIn(t, hints);
  const streets = nameAfter(t, /^(خیابان|بلوار|کوچه|میدان)$/);
  const hoods = nameAfter(t, /^(محله|منطقه|محدوده|حوالی|شهرک)$/).map((x) => (x.lead === 'شهرک' ? `شهرک ${x.name}` : x.name));
  // «آپارتمان فروشی تو تجریش»: نام بعد از «تو/در» وقتی هیچ محلهٔ دیگری گفته نشده.
  if (!places.length && !hoods.length) {
    const loose = nameAfter(t, /^(تو|توی|در)$/).find((x) => !kindsOf(x.name).length && !/^(خیابان|بلوار|کوچه|میدان|محله|منطقه|شهرک|طبقه|ساختمان|واحد)/.test(x.name));
    if (loose) hoods.push(loose.name);
  }

  if (form === 'listing') {
    const kind = kindsOf(t)[0];
    if (kind) raw.kind = kind;
    raw.neighborhood = places[0] ?? hoods[0];
    if (streets[0]) raw.street = `${streets[0].lead} ${streets[0].name}`;
    raw.area = areas[0]?.value;
    raw.bedrooms = bedroomsValue;

    const floorNum = nums.find((n) => !n.money && /طبقه( ی)?$/.test(before(t, n)));
    const ord = /طبقه( ی)? ([^\s،,.]+)/.exec(t);
    raw.floor = /همکف/.test(t) ? 0 : (floorNum?.value ?? (ord ? ORDINALS[ord[2]!] : undefined));
    raw.floorsTotal = nums.find((n) => !n.money && /^طبقه/.test(after(t, n)) && !/طبقه( ی)?$/.test(before(t, n)))?.value;

    const built = nums.find((n) => n.value >= 1300 && n.value <= 1500 && /(ساخت|سال|سازه)$/.test(before(t, n)));
    const age = nums.find((n) => n.value < 100 && /^(سال ساخت|ساله)/.test(after(t, n)));
    raw.yearBuilt = built?.value ?? (age ? year - age.value : /نوساز|کلید نخورده/.test(t) ? year : undefined);

    const features = featuresOf(t);
    if (features.length) raw.features = features;
    if (/قابل مذاکره|جای چانه|چونه|تخفیف/.test(t)) raw.negotiable = true;
    else if (/مقطوع/.test(t)) raw.negotiable = false;
    raw.ownerName = personOf(t, /(مالک|صاحب)/);
    raw.ownerPhone = phoneOf(t, nums);
    Object.assign(raw, shortPrices(t, nums));
  } else {
    raw.name = personOf(t);
    raw.phone = phoneOf(t, nums);
    const kinds = kindsOf(t);
    if (kinds.length) raw.kinds = kinds;
    const wanted = [...places, ...hoods];
    if (!wanted.length && streets[0]) wanted.push(`${streets[0].lead} ${streets[0].name}`);
    if (wanted.length) raw.neighborhoods = wanted;

    const range = /(\d+(?:\.\d+)?) تا (\d+(?:\.\d+)?) متر/.exec(toEnDigits(t));
    const lo = areas.find((n) => /(حداقل|بالای|بیشتر از|بیش از|از)$/.test(before(t, n)));
    const hi = areas.find((n) => /(حداکثر|زیر|کمتر از|تا)$/.test(before(t, n)));
    // «بین صد تا صد و بیست متر»: عدد اول «متر» ندارد، پس جداگانه پیدا می‌شود.
    const loWord = nums.find((n, i) => !n.money && nums[i + 1] && hi && nums[i + 1] === hi && /^تا/.test(after(t, n)));
    raw.areaMin = range ? Number(range[1]) : (lo?.value ?? loWord?.value ?? (hi ? undefined : areas[0]?.value));
    raw.areaMax = range ? Number(range[2]) : hi?.value;
    raw.bedroomsMin = bedroomsValue;
    if (/عجله نداره|عجله ندارد|فقط نگاه|فعلا نگاه|سر فرصت|بعدا/.test(t)) raw.temperature = 'cold';
    else if (/فوری|عجله داره|عجله دارد|خیلی جدی|سریع/.test(t)) raw.temperature = 'hot';
    if (/منتظر|خبرش کن|بهش خبر|خبر بدم|زنگ بزنم|تماس بگیرم/.test(t)) raw.waiting = true;
    // «قیمت» برای مشتری یعنی خرید؛ رهن و اجاره «قیمت» ندارد.
    if (!raw.deal && /قیمت|بخره|خرید/.test(t)) raw.deal = 'sale';
    const short = shortPrices(t, nums);
    if (short.deposit) raw.budget = short.deposit;
    if (short.rent) raw.rent = short.rent;
  }
  return withSpokenPrices(form, t, cleanVoiceDraft(form, raw));
}

/** پیش‌نویس مدل جلوتر است؛ قاعده‌ها فقط جاهای خالی را پر می‌کنند. */
export function mergeDrafts<F extends VoiceForm>(form: F, primary: VoiceDraft<F>, backup: VoiceDraft<F>): VoiceDraft<F> {
  const out = { ...primary } as Record<string, unknown>;
  for (const [k, v] of Object.entries(backup)) if (out[k] === undefined) out[k] = v;
  return cleanVoiceDraft(form, out);
}
