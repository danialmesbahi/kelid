import type { PropertyKind } from './model';
import { spokenNumbers, type SpokenNumber } from './money';
import { normalizeForSearch, toEnDigits, toFaDigits } from './persian';
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
  ['apartment', /آپارتمان|اپارتمان|سوئیت|سوییت|واحد(?! (اداری|تجاری))|برج|مسکونی/],
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

const GLUED_BEDS: Record<string, number> = { یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6 };

const ORDINALS: Record<string, number> = {
  اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, شیشم: 6, هفتم: 7, هشتم: 8, نهم: 9, دهم: 10,
  یازدهم: 11, دوازدهم: 12, سیزدهم: 13, چهاردهم: 14, پانزدهم: 15, پونزدهم: 15,
};

/** واژه‌هایی که بعد از «محله» یا «خیابان» نام نیستند. */
const NOT_NAME = /^(و|که|با|از|در|تو|توی|به|برای|هست|است|داره|دارد|می|میخواد|متر|متری|خواب|طبقه|قیمت|رهن|اجاره|فروش|فروشی|نزدیک|حدود|یک|یه|خیلی|خوب|این|اون|همین|دنبال|حال|خانه|شهر|جا|جای|اینجا|اونجا|مشتری|مالک)$/;
/** تکهٔ دوم نام‌های دوکلمه‌ای (سعادت آباد، شهرک غرب، تهران پارس). */
const NAME_TAIL = /^(آباد|اباد|شهر|پارس|غرب|شرق|شمالی|جنوبی|پارک|نو|کوچک|بزرگ|ده|سر|ویلا|بالا|پایین)$/;

// «کوچه شهید رجایی»، «خیابان امام خمینی»: عنوان جزو نام است و کلمهٔ بعدش هم می‌آید.
const NAME_TITLE = /^(شهید|امام|آیت الله|آیت‌الله|دکتر|استاد|سردار|حاج|حاجی|سید|مهندس|شیخ)$/;

function nameAt(words: string[], i: number): string | undefined {
  if (words[i] === 'ی') i++;
  if (words[i] && NAME_TITLE.test(words[i]!)) {
    const rest = nameAt(words, i + 1);
    return rest ? `${words[i]} ${rest}` : undefined;
  }
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

/** «سال ۹۳» یعنی ۱۳۹۳ و «سال ۴۰۵» یعنی ۱۴۰۵؛ مشاورها سال را کوتاه می‌گویند. سال آینده پذیرفته نیست. */
function fullYear(v: number, year: number): number | undefined {
  const y = v >= 1300 ? v : v >= 300 && v < 500 ? 1000 + v : v < 100 ? (1400 + v <= year ? 1400 + v : 1300 + v) : undefined;
  return y && y >= 1300 && y <= year ? y : undefined;
}

const before = (t: string, n: SpokenNumber, len = 25) => t.slice(Math.max(0, n.start - len), n.start).trimEnd();
const after = (t: string, n: SpokenNumber, len = 25) => t.slice(n.end, n.end + len).trimStart();

/** محله‌های همین دفتر که در متن آمده‌اند، به ترتیب گفته‌شدن. کلمه‌به‌کلمه، تا «ونک» از دل «پونک» پیدا نشود. */
function hintsIn(t: string, hints: string[]): string[] {
  // «منطقه هجده» در فهرست «منطقه ۱۸» است: یک بار هم با عددهای رقمی شده گشته می‌شود.
  let digits = t;
  for (const n of spokenNumbers(t).reverse()) if (!n.money && Number.isInteger(n.value)) digits = `${digits.slice(0, n.start)}${n.value}${digits.slice(n.end)}`;
  const found = wordHints(t, hints);
  if (digits !== t) for (const h of wordHints(digits, hints)) if (!found.includes(h)) found.push(h);
  return found;
}

function wordHints(t: string, hints: string[]): string[] {
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
  if (/(رهن|ودیعه) (و |، ?)?اجاره|پیش و پس|پیش پس|اجاره|کرایه|(رهن|ودیعه).*(ماهی|ماهانه|ماهیانه|در ماه)/.test(t)) return 'rent' as const;
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

/** رتبهٔ جایگاه هر عدد در خواندن فارسی: هزار ۴، صدگان ۳، دهگان ۲، یکان و ده‌تا‌نوزده ۱. */
const rankOf = (v: number) => (v >= 1000 ? 4 : v >= 100 ? 3 : v >= 20 ? 2 : 1);
const PHONE_KEY = /(شماره|تلفن|تلفنش|موبایل|موبایلش|همراه|تماس|شمارش|شماره‌اش|شمارشون)/;
const PHONE_SKIP = /^(ثابت|منزل|خونه|خانه|دفتر|مثبت|ما|من|مالک|صاحب|صاحبش|مالکش|ایشون|ایشان|اش|ش|هم|هست|است|اینه|این|اینجوریه|بنویس|یادداشت|کن|خط|همراه|موبایل|تلفن|شماره|تماس|:)$/;

/**
 * شمارهٔ موبایل گفته‌شده، به هر شکلی که عامیانه خوانده می‌شود:
 * «صفر نهصد و دوازده، سیصد و چهل و پنج، شصت و هفت، هشتاد و نه»، «صفر نه یک دو…» رقم‌به‌رقم،
 * «سه تا هفت» (۷۷۷)، «هزار و دویست و سی و چهار» (۱۲۳۴)، رقم‌های نوشته‌شده با فاصله، و بی «صفر» اول.
 * دو عدد پشت هم فقط وقتی جمع می‌شوند که با «و» آمده باشند و جایگاه دومی کوچک‌تر باشد («نهصد و سی»)، وگرنه دو تکه‌اند («سی و سی» = ۳۰۳۰).
 */
export function spokenPhone(t: string): { phone?: string; raw?: string } {
  const written = /(?:\+98|0098|0)?9\d{2}[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.exec(toEnDigits(t));
  if (written) return { phone: normalizePhone(written[0]) };
  const key = PHONE_KEY.exec(t);
  // بی کلمهٔ «شماره» هم «صفر نهصد…» یا «صفر نه…» آغاز شماره است.
  const bare = /(^|\s)صفر\s+(نهصد|نود|نه)(\s|‌|و|$)/.exec(t);
  const at = key ? key.index + key[0].length : bare ? bare.index : -1;
  if (at < 0) return {};
  const words = t.slice(at).replace(/[،,.:؛!?؟()«»-]/g, ' ').split(/\s+/).filter(Boolean);
  let digits = '';
  let cur = 0;
  let has = false;
  let rank = 9;
  let and = false;
  let skipped = 0;
  const flush = () => {
    if (has) digits += String(cur);
    cur = 0;
    has = false;
    rank = 9;
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^[0-9۰-۹]+$/.test(w)) {
      flush();
      digits += toEnDigits(w);
      and = false;
      continue;
    }
    if (w === 'و') {
      and = true;
      continue;
    }
    if (/^(صفر)+$/.test(w)) {
      flush();
      digits += '0'.repeat(w.length / 3);
      and = false;
      continue;
    }
    if (w === 'هزار' && has) {
      cur *= 1000;
      rank = 4;
      and = false;
      continue;
    }
    if (/^(دو|سه|چهار|پنج)تا$/.test(w)) {
      words.splice(i, 1, w.slice(0, -2), 'تا');
      i--;
      continue;
    }
    const v = spokenNumbers(w)[0];
    const num = v && v.start === 0 && v.end === w.length && Number.isInteger(v.value) ? v.value : undefined;
    if (num === undefined) {
      if (!digits && !has && PHONE_SKIP.test(w) && skipped++ < 3) continue;
      break;
    }
    // «سه تا هفت» یا «دوتا یک»: یک رقم چند بار.
    const next = words[i + 2];
    if (num >= 2 && num <= 5 && words[i + 1] === 'تا' && next) {
      const d = next === 'صفر' ? 0 : spokenNumbers(next)[0]?.value;
      if (d !== undefined && d >= 0 && d <= 9 && Number.isInteger(d)) {
        flush();
        digits += String(d).repeat(num);
        i += 2;
        and = false;
        continue;
      }
    }
    if (has && and && rankOf(num) < rank) {
      cur += num;
    } else {
      flush();
      cur = num;
      has = true;
    }
    rank = rankOf(num);
    and = false;
  }
  flush();
  // «مثبت نود و هشت…» یا بی «صفر» اول
  digits = digits.replace(/^(?:00)?98(?=9\d{9}$)/, '').replace(/^(?=9\d{9}$)/, '0');
  // موبایل، یا تلفن ثابت با پیش‌شمارهٔ شهر (مثلاً ۰۷۷ بوشهر)
  if (/^0[1-9]\d{9}$/.test(digits)) return { phone: digits };
  return digits.length >= 7 ? { raw: digits } : {};
}

// «عصرها»، «بعد از ساعت پنج»، «از ساعت چهار تا هشت شب»، «پنجشنبه‌ها»، «ساعت اداری»: بهترین زمان تماس با مالک.
const T_NUM = '(?:[0-9۰-۹]{1,2}(?::[0-9۰-۹]{2})?|(?:یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|یازده|دوازده)(?: و نیم)?)';
const T_PART = '(?:صبح|ظهر|بعد ?از ?ظهر|عصر|غروب|شب)';
const T_DAY = '(?:شنبه|یکشنبه|دوشنبه|سه ?شنبه|چهارشنبه|پنج ?شنبه|جمعه)';
const T_UNIT = [
  `${T_PART}(?: ?ها|ا)?`,
  `(?:بعد از |قبل از |از )?ساعت ${T_NUM}(?: ${T_PART})?(?: به بعد)?`,
  `روزهای (?:زوج|فرد|تعطیل|کاری)`,
  `آخر هفته(?: ?ها)?`,
  `${T_DAY}(?: ?ها)?`,
  `(?:ساعت|تایم|وقت) اداری`,
  `هر (?:وقت|موقع|ساعتی)`,
].join('|');
// بعد از یک تکهٔ زمان، «تا هشت» یا «تا ساعت هشت شب» هم دنبالهٔ همان است.
const T_MORE = `(?:${T_UNIT}|(?:تا|الی) (?:ساعت )?${T_NUM}(?: ${T_PART})?)`;
export const TIME_RE = new RegExp(`(?:${T_UNIT})(?:(?: و |، ?| )${T_MORE})*`, 'g');
const CALL_HINT = /(?:^|\s)(زنگ|تماس|جواب|در دسترس|بهترین (زمان|وقت|موقع)|وقت (تماس|زنگ)|بگیرید|بگیرین|بگیر)/;
const STRONG_TIME = /(صبح|ظهر|عصر|غروب|شب)( ?ها|ا)|ساعت|روزهای|اداری|شنبه/;

export function bestTimeOf(t: string): string | undefined {
  const hint = CALL_HINT.exec(t);
  const all = [...t.matchAll(TIME_RE)].filter((m) => /\s|ها$|^(صبح|عصر|ظهر|شب|غروب)ا$/.test(m[0]) || hint);
  // نزدیک «زنگ/تماس/جواب» باشد؛ بی آن فقط شکل‌های روشن مثل «عصرها» پذیرفته است.
  const pick = hint
    ? all.sort((a, b) => Math.abs(a.index - hint.index) - Math.abs(b.index - hint.index))[0]
    : all.find((m) => STRONG_TIME.test(m[0]) && !/^(صبح|ظهر|عصر|غروب|شب)$/.test(m[0]));
  if (!pick) return undefined;
  let out = pick[0].trim()
    .replace(/(^|\s)(صبح|ظهر|عصر|غروب|شب)ا(?=\s|$)/g, (_, s: string, w: string) => `${s}${w === 'عصر' || w === 'ظهر' ? `${w}ها` : `${w}‌ها`}`)
    .replace(/بعد ?از ?ظهر/g, 'بعدازظهر')
    .replace(/(\S) ها(?=\s|$)/g, (_, w: string) => (/[رظ]$/.test(w) ? `${w}ها` : `${w}\u200cها`))
    .replace(/سه ?شنبه/g, 'سه‌شنبه')
    .replace(/پنج ?شنبه/g, 'پنجشنبه');
  // عدد ساعت با رقم فارسی: «ساعت پنج و نیم» → «ساعت ۵ و نیم»
  for (const n of spokenNumbers(out).reverse()) {
    const whole = Math.floor(n.value);
    out = `${out.slice(0, n.start)}${toFaDigits(whole)}${n.value % 1 ? ' و نیم' : ''}${out.slice(n.end)}`;
  }
  return out;
}

// نام شهر محله نیست («منطقه تهران»)، مگر اینکه در فهرست محله‌های شهر دفتر باشد.
const CITY_NAMES = /^(تهران|مشهد|اصفهان|شیراز|تبریز|کرج|اهواز|قم|کرمانشاه|ارومیه|رشت|زاهدان|همدان|کرمان|یزد|اردبیل|بندرعباس|بندر عباس|اراک|زنجان|سنندج|قزوین|خرم آباد|گرگان|ساری|بجنورد|بیرجند|ایلام|شهرکرد|یاسوج|سمنان|بوشهر|کیش|قشم|برازجان|گناوه|کنگان|عسلویه|دیر|جم)$/;

// «در دسترسه»، «در حال ساخت»، «تو این ساختمون»: این‌ها بعد از «در/تو» محله نیستند.
const LOOSE_STOP = /^(دسترس|دسترسه|دسترسی|خدمت|حال|نظر|مورد|جریان|اختیار|اسرع|کل|ضمن|واقع|عوض|همون|همان|این|اون|آن|یه|یک|ساختمون|ساختمان|مجتمع|برج|خانه|شهر|بالا|پایین|طبقه|کوچه|خیابان|بلوار)$/;

const NAME_STOP = /^(زیر|بالای|حداقل|حداکثر|حدود|بین|دنبال|بعد|قبل|فقط|ساعت|داره|دارن|دارد|گفت|گفته|میگه|برای|بری|مال|الان|خیلی|اینجا|اونجا|ولی|اما|یا|هم|تا|از|به|رو|را|صبح|عصر|ظهر|شب|طبقه|آپارتمان|واحد|تماس|زنگ|هست|است|هستن|هستند|که|و|با|شماره|تلفن|موبایل|مالک|صاحب|عصرها|صبح‌ها|صبحها|شبها|شب‌ها|ظهرها|خونه|خانه|ملک|فایل|دنبال|میخواد|می‌خواد|میخواهد|می‌خواهد|بود|باشه|خودش|ایشون)$/;
// «آقای سامان مغازه می‌خواد»: نوع ملک یا امکانات جزو نام نیست.
const nameWord = (w: string | undefined) => !!w && !NOT_NAME.test(w) && !NAME_STOP.test(w) && !kindsOf(w).length && !featuresOf(w).length && !/^(می|نمی)/.test(w) && !/ها$/.test(w) && !/\d/.test(w) && !spokenNumbers(w).length;

/** «آقای محمد رضایی»، «مالکش خانم احمدی»، «اسم مالک علی کریمی»: نام و نام خانوادگی تا دو کلمه. */
function personOf(t: string, near?: RegExp): string | undefined {
  const words = t.replace(/[،,.:؛!?؟()«»]/g, ' ').split(/\s+/).filter(Boolean);
  type Hit = { name: string; at: number; near: boolean };
  const hits: Hit[] = [];
  const take = (i: number) => {
    const first = words[i];
    if (!nameWord(first)) return undefined;
    return nameWord(words[i + 1]) ? `${first} ${words[i + 1]}` : first;
  };
  words.forEach((w, i) => {
    const prev = words.slice(Math.max(0, i - 2), i).join(' ');
    const isNear = !!near && near.test(prev);
    if (/^(آقای|آقا|جناب|خانم|خانوم)$/.test(w)) {
      const n = take(i + 1);
      if (n) hits.push({ name: `${/خانم|خانوم/.test(w) ? 'خانم' : 'آقای'} ${n}`, at: i, near: isNear || (!!near && near.test(words[i - 1] ?? '')) });
    } else if (/^(مالکش|صاحبش|مالک|صاحب)$/.test(w) || (/^(اسم|اسمش|نام|بنام)$/.test(w))) {
      // «به نام»، «اسم مالک»، «مالکش» و بعد خود نام (اگر «آقای» نیامده باشد)
      let j = i + 1;
      while (/^(ملک|مالک|مالکش|صاحبش|هم|هست|است|:)$/.test(words[j] ?? '')) j++;
      if (/^(آقای|آقا|جناب|خانم|خانوم)$/.test(words[j] ?? '')) return;
      const n = take(j);
      if (n) hits.push({ name: n, at: i, near: /^(مالک|صاحب)/.test(w) || /^(مالک|صاحب)/.test(words[i + 1] ?? '') });
    }
  });
  // «آپارتمان برای مهدی سعادت، شماره…» یا «مال آقای…»: فقط وقتی بعد از نام، شماره یا پایان جمله می‌آید؛ «برای فروش» نام نیست.
  if (near && !hits.length) {
    words.forEach((w, i) => {
      if (hits.length || !/^(برای|بری|مال|متعلق|متعلقه)$/.test(w)) return;
      const j = /^متعلق/.test(w) && words[i + 1] === 'به' ? i + 2 : i + 1;
      const n = take(j);
      const end = words[j + (n?.split(' ').length ?? 0)];
      if (n && (!end || /^(شماره|شمارش|تلفن|تلفنش|موبایل|موبایلش|هست|است|که)$/.test(end))) hits.push({ name: n, at: i, near: true });
    });
  }
  const pick = (near && hits.find((h) => h.near)) || hits[0];
  return pick?.name;
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

  const areas = nums.filter((n) => !n.money && ((/^(متر|متری|مترمربع)/.test(after(t, n)) && !/(متری|هر متر)$/.test(before(t, n))) || /(متراژ|متراژش|زیربنا|زیربناش|بنا|مساحت|مساحتش)[:،]?$/.test(before(t, n))));
  const bedrooms = nums.find((n) => !n.money && n.value < 20 && /^((تا )?اتاق( خواب)?|خواب)/.test(after(t, n)));
  // «چهارخوابه» سرهم نوشته می‌شود و عدد جدا پیدا نمی‌شود.
  const glued = /(?:^|\s)(یک|یه|دو|سه|چهار|پنج|شش|شیش)\u200c?خوابه?(?=$|[\s،,.])/.exec(t);
  const bedroomsValue = bedrooms?.value ?? (glued ? GLUED_BEDS[glued[1]!] : /تک خواب/.test(t) ? 1 : /بدون خواب|استودیو/.test(t) ? 0 : undefined);
  const places = hintsIn(t, hints);
  const streets = nameAfter(t, /^(خیابان|بلوار|کوچه|میدان)$/);
  // «منطقه هجده» بی فهرست محله: خود «منطقه ۱۸».
  const zone = /(?:^|\s)منطقه (?:ی )?([^\s،,.]+(?: و [^\s،,.]+)?)/.exec(t);
  const zoneNum = zone ? spokenNumbers(zone[1]!)[0] : undefined;
  const hoods = (zoneNum && zoneNum.start === 0 && Number.isInteger(zoneNum.value) && zoneNum.value > 0 && zoneNum.value < 30 ? [`منطقه ${toFaDigits(zoneNum.value)}`] : [])
    .concat(nameAfter(t, /^(محله|منطقه|محدوده|حوالی|شهرک)$/).map((x) => (x.lead === 'شهرک' ? `شهرک ${x.name}` : x.name)).filter((x) => !CITY_NAMES.test(x)));
  // «آپارتمان فروشی تو تجریش»: نام بعد از «تو/در» وقتی هیچ محلهٔ دیگری گفته نشده.
  if (!places.length && !hoods.length) {
    const loose = nameAfter(t, /^(تو|توی|در)$/).find((x) => !kindsOf(x.name).length && !CITY_NAMES.test(x.name) && !LOOSE_STOP.test(x.name.split(' ')[0]!) && !/^(خیابان|بلوار|کوچه|میدان|محله|منطقه|شهرک|طبقه|ساختمان|واحد)/.test(x.name));
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
    const ord = [...t.matchAll(/طبقه( ی)? ([^\s،,.]+)/g)].map((m) => ORDINALS[m[2]!]).find((v) => v !== undefined);
    raw.floor = /همکف/.test(t) ? 0 : (floorNum?.value ?? ord);
    raw.floorsTotal = nums.find((n) => !n.money && /^طبقه/.test(after(t, n)) && !/طبقه( ی)?$/.test(before(t, n)))?.value;

    const built = nums.find((n) => !n.money && Number.isInteger(n.value) && fullYear(n.value, year) && /(ساخت|سال|سازه|مدل)[:،]?$/.test(before(t, n)) && !/^(سال|ساله)/.test(after(t, n)));
    const age = nums.find((n) => n.value < 100 && /^(سال ساخت|ساله)/.test(after(t, n)));
    raw.yearBuilt = (built && fullYear(built.value, year)) ?? (age ? year - age.value : /نوساز|کلید نخورده/.test(t) ? year : undefined);

    const features = featuresOf(t);
    if (features.length) raw.features = features;
    if (/قابل مذاکره|جای چانه|چونه|تخفیف/.test(t)) raw.negotiable = true;
    else if (/مقطوع/.test(t)) raw.negotiable = false;
    raw.ownerName = personOf(t, /(مالک|صاحب)/);
    raw.ownerBestTime = bestTimeOf(t);
    const phone = spokenPhone(t);
    raw.ownerPhone = phone.phone;
    // شماره‌ای که کامل شنیده نشد گم نشود؛ مشاور خودش درستش می‌کند.
    if (phone.raw) raw.description = `شمارهٔ گفته‌شده (کامل شنیده نشد): ${toFaDigits(phone.raw)}`;
    Object.assign(raw, shortPrices(t, nums));
  } else {
    raw.name = personOf(t);
    const phone = spokenPhone(t);
    raw.phone = phone.phone;
    if (phone.raw) raw.notes = `شمارهٔ گفته‌شده (کامل شنیده نشد): ${toFaDigits(phone.raw)}`;
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
