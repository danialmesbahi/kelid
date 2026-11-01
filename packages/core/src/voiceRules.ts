import type { PropertyKind } from './model';
import { NUMBER_WORDS, spokenNumbers, type SpokenNumber } from './money';
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
    .replace(/[ً-ْٔ]/g, '')
    .replace(/‌/g, ' ')
    .replace(/خیابون/g, 'خیابان')
    .replace(/میدون/g, 'میدان')
    .replace(/خونه/g, 'خانه')
    // «هشت ممیز پنج میلیارد» همان «هشت و نیم» است.
    .replace(/ (ممیز|مُمَیز|اعشار) (پنج|5)(?=\s|$|[،,.])/g, ' و نیم')
    // «هشتاد و نه صد متر» یعنی ۸۹ و بعد صد متر، نه «نهصد»: بعد از دهگان و «و» صدگان نمی‌آید.
    .replace(/(^|\s)(?<!(?:بیست|سی|چهل|چل|پنجاه|پنجا|شصت|هفتاد|هشتاد|نود) و )(یک|دو|سه|سی|چهار|پنج|پان|پون|شش|شیش|هفت|هشت|نه) صد(?=\s|$|[،,.])/g, (_, s: string, w: string) => `${s}${HUNDREDS[w]}`)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => unglue(uncopula(w)))
    .join(' ');
}

/** «پول پیشش سیصده»، «صده»: «ه» آخر عدد یعنی «است»؛ ولی «هفته» و «شیشه» عدد نیستند. */
function uncopula(w: string): string {
  const m = /^(\S+)ه([،,.!?؟]*)$/.exec(w);
  return m && !NUMBER_WORDS.has(`${m[1]}ه`) && NUMBER_WORDS.has(m[1]!) && !/^(هفت|شیش|ده|یک)$/.test(m[1]!) ? `${m[1]}${m[2]}` : w;
}

// «نه صد» → «نهصد»: آوانگار گاهی صدگان را جدا می‌نویسد.
const HUNDREDS: Record<string, string> = {
  یک: 'یکصد', دو: 'دویست', سه: 'سیصد', سی: 'سیصد', چهار: 'چهارصد', پنج: 'پانصد', پان: 'پانصد', پون: 'پانصد',
  شش: 'ششصد', شیش: 'ششصد', هفت: 'هفتصد', هشت: 'هشتصد', نه: 'نهصد',
};

/** «نهصدوسی»، «وپنج»، «یکصدو»، «صفرنهصد»، «نهصدودوازده»: عددهای سرهم جدا می‌شوند تا شماره و مبلغ درست خوانده شوند. */
function unglue(w: string): string {
  if (NUMBER_WORDS.has(w)) return w;
  const zero = /^صفر(?=\S)/.exec(w);
  if (zero && (NUMBER_WORDS.has(w.slice(3)) || unglue(w.slice(3)) !== w.slice(3))) return `صفر ${unglue(w.slice(3))}`;
  return splitAnd(w)?.join(' ') ?? w;
}

const NUM_BY_LENGTH = [...NUMBER_WORDS].sort((a, b) => b.length - a.length);

/**
 * واژهٔ سرهم به «عدد و عدد و …»؛ «و» داخل خود عدد («دوازده»، «نود») را با «و»ی جداکننده اشتباه نمی‌گیرد.
 * دو عدد بی «و» میانشان پذیرفته نیست تا واژهٔ معمولی عدد خوانده نشود.
 */
function splitAnd(w: string, needNum = false): string[] | undefined {
  if (!w) return needNum ? undefined : [];
  if (w.startsWith('و')) {
    const rest = splitAnd(w.slice(1), true);
    if (rest) return ['و', ...rest];
  }
  if (!needNum && w === 'و') return ['و'];
  for (const n of NUM_BY_LENGTH) {
    if (!w.startsWith(n)) continue;
    const tail = w.slice(n.length);
    if (!tail) return [n];
    if (!tail.startsWith('و')) continue;
    const rest = splitAnd(tail);
    if (rest && rest.length) return [n, ...rest];
  }
  return undefined;
}

const KIND_WORDS: Array<[PropertyKind, RegExp]> = [
  ['shop', /مغازه|تجاری|دکان|دکه|سوله/],
  ['office', /دفتر(?! املاک| مشاور| مشاوره| اسناد)|(?<!(ساعت|وقت|تایم) )اداری|مطب/],
  ['land', /زمین(?! بازی| فوتبال| ورزشی| تنیس| بسکتبال| چمن)|کلنگی/],
  ['villa', /ویلا|ویلایی|حیاط دار|خانه حیاط/],
  ['apartment', /آپارتمان|اپارتمان|پنت ?هاوس|سوئیت|سوییت|دوبلکس|تریپلکس|واحد(?! (اداری|تجاری))|برج|مسکونی/],
];

const FEATURE_WORDS: Array<[string, RegExp]> = [
  [VOICE_FEATURES[0]!, /پارکینگ/],
  [VOICE_FEATURES[1]!, /آسانسور|اسانسور/],
  [VOICE_FEATURES[2]!, /انباری?/],
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
    // «خیابان امام» خودش نام است؛ «خیابان شهید» تنها نه.
    return rest ? `${words[i]} ${rest}` : /^(امام|استاد|دکتر)$/.test(words[i]!) ? words[i] : undefined;
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
    // «کوچه پنج»، «خیابان سی متری»: عدد هم نام کوچه است.
    const num = /^(کوچه|خیابان|بلوار)$/.test(w) && words[i + 1] && (/^\d+$/.test(words[i + 1]!) || wordNum(words[i + 1]!) !== undefined) ? words[i + 1] : undefined;
    const name = num ? (words[i + 2] === 'متری' ? `${num} متری` : num) : nameAt(words, i + 1);
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

// نام محله‌هایی که واژهٔ معمولی یا نام شهر هم هستند.
const COMMON_PLACE = /^(ری|جی|حر|کن|کاج|صفا|سرو|ارم|آهنگ|قیام|شاهد|مقدم|شورا|بهار|بهاران|جهاد|دریا|دریاچه|حکمت|شهادت|ایران|آگاهی|بازار|آبشار|مخصوص|توحید|عدالت|کرمان|گرگان|استخر|آسمان|پرواز|بهداشت|پرستار|پیروزی|جمهوری|اندیشه|دبستان|مدیریت|گلستان|ساحلی|پودر|نیایش|دانشگاه|زمزم|کوثر|فلاح|شیوا|گمرک|مصلی|نیلوفر|شکوفه|فرزانه|درختی|اوقاف|امامت|ابوذر|سجاد)$/;
const PLACE_LEAD = /^(محله|منطقه|محدوده|حوالی|سمت|نزدیک|نزدیکی|تو|توی|در|خیابان|بلوار|میدان|کوچه|شهرک|کوی|طرف|اطراف|بالای|پایین|ی)$/;

function wordHints(t: string, hints: string[]): string[] {
  const words = t.replace(/[،,.:؛!?؟]/g, ' ').split(' ').filter(Boolean);
  // نام یک‌کلمه‌ای که واژهٔ معمولی هم هست (زون «شهر» در بوشهر) در هر جمله‌ای پیدا می‌شود.
  const want = new Map(hints.filter((h) => h.trim() && !NOT_NAME.test(h.trim())).map((h) => [normalizeForSearch(h), h] as const));
  const found: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = 3; n >= 1; n--) {
      const h = want.get(normalizeForSearch(words.slice(i, i + n).join(' ')));
      // «آقای شکری» نام است نه محلهٔ شکری؛ «ساحلی» یا «استخر» هم بی «محله/تو/نزدیک» واژهٔ معمولی‌اند.
      const prev = words[i - 1] ?? '';
      const asName = TITLE.test(prev) || TITLE.test(words[i - 2] ?? '') || /^(اسم|اسمش|نام|بنام|مالکش|صاحبش|مالک)$/.test(prev);
      // «هر جایی جز ریشهر»، «غیر از سنگی»: محلهٔ نخواسته.
      const except = /^(جز|بجز|الا|غیراز)$/.test(prev) || (prev === 'از' && words[i - 2] === 'غیر');
      if (h && (asName || except || (n === 1 && COMMON_PLACE.test(words[i]!) && !PLACE_LEAD.test(prev)))) continue;
      if (h && i + n <= words.length) {
        if (!found.includes(h)) found.push(h);
        i += n - 1;
        break;
      }
    }
  }
  return found;
}

// (?<!\S): آغاز واژه، تا «رهن» از دل «فرهنگیان» پیدا نشود.
function dealOf(t: string, form: VoiceForm): 'sale' | 'rent' | 'full' | undefined {
  // «قبلا اجاره بوده، الان فروشیه»: آنچه بعد از «الان/حالا» آمده حال فایل است.
  const now = /(?<!\S)(الان|حالا|اکنون)(?!\S)/.exec(t);
  return (now && dealIn(t.slice(now.index), form)) || dealIn(t, form);
}

function dealIn(t: string, form: VoiceForm) {
  if (/(?<!\S)(رهن (و )?کامل|رهن کامله|رهن فول|فول رهن|فقط رهن)/.test(t)) return 'full' as const;
  if (/(?<!\S)((رهن|ودیعه) (و |، ?)?اجاره|پیش و پس|پیش پس|اجاره|کرایه)|(?<!\S)(رهن|ودیعه|پیش|پیشش)\s.*(?<!\S)(ماهی|ماهانه|ماهیانه|در ماه)/.test(t)) return 'rent' as const;
  // «ده سال پیش خریده» در فایل یعنی مالک خریده، نه اینکه فروشی است.
  if (/(?<!\S)(فروش|بفروش|میفروش)/.test(t) || (form === 'client' && /(?<!\S)(خرید|بخره|خریدار)/.test(t))) return 'sale' as const;
  // «پول پیش» تنها همان رهن است.
  if (/(?<!\S)(رهن|ودیعه|پول پیش)/.test(t)) return 'full' as const;
  // مشتری «مستاجر» است ولی مبلغی نگفته: رهن و اجاره رایج‌ترین حالت است.
  if (form === 'client' && /(?<!\S)مستاجر/.test(t)) return 'rent' as const;
  return undefined;
}

function kindsOf(t: string): PropertyKind[] {
  // «ویلای کناری»، «آپارتمان روبرویی»: ملک همسایه است، نه همین فایل.
  const kinds = KIND_WORDS.map(([k, re]) => ({ k, at: [...t.matchAll(new RegExp(re.source, 'g'))].find((m) => !/^ ?(ی )?(کناری|بغلی|روبرویی|همسایه|بالایی|پایینی)(?=\s|$)/.test(t.slice(m.index + m[0].length).replace(/^ی(?=\s)/, '')))?.index ?? -1 }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.k);
  // «ویلایی، دویست متر زمین»: زمینِ بعد از «متر» اندازهٔ همان ملک است، نه نوع دیگر.
  // «ویلا، زمین حداقل پونصد متر» هم همین است.
  if (kinds.length > 1 && !/کلنگی/.test(t) && [...t.matchAll(/زمین/g)].every((m) => /متری? $/.test(t.slice(0, m.index)) || /^ش? (\S+ ){0,5}متر/.test(t.slice(m.index + m[0].length, m.index + 50)))) return kinds.filter((k) => k !== 'land');
  return kinds;
}

function featuresOf(t: string): string[] {
  // «فول امکانات»، «همه امکانات رو داره»: در زبان بنگاه یعنی پارکینگ و آسانسور و انباری.
  const full = /(فول|همه|تمام|کلیه) ?(ی )?امکانات/.test(t);
  return FEATURE_WORDS.filter(([f, re]) => {
    if (full && VOICE_FEATURES.indexOf(f) < 3) return true;
    const m = re.exec(t);
    if (!m) return false;
    const pre = t.slice(Math.max(0, m.index - 8), m.index);
    const post = t.slice(m.index + m[0].length, m.index + m[0].length + 16);
    // «نه آسانسور داره نه پارکینگ»، «پارکینگ عمومی نزدیکشه»، «انباری مهم نیست»: نه منفی است نه مال همین واحد.
    return !/(بدون|بی|(?:^|\s)نه)\s*$/.test(pre) && !/^\s*(هم )?(ندار|نداره|نیست|نمی|خرابه|خراب|عمومی|محله|شهرداری|مهم نیست|لازم نیست|نخواست|اشکال نداره)/.test(post);
  }).map(([f]) => f);
}

/** نکته‌های رایج فایل که فیلد جدا ندارند ولی مشاورها همیشه می‌گویند؛ در توضیحات می‌مانند تا گم نشوند. */
const EXTRAS: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/سند (تک ?برگ|تک برگه|تکبرگ)/, () => 'سند تک‌برگ'],
  [/شش ?دانگ/, () => 'شش‌دانگ'],
  [/قولنامه ?ای/, () => 'قولنامه‌ای'],
  [/(?<!\S)(اوقافی|زمین وقفی)/, () => 'اوقافی'],
  [/بازسازی ?(شده|کامل)|(?<!\S)بازسازیه/, () => 'بازسازی‌شده'],
  [/(?<!\S)(دو|سه) ?نبش/, (m) => `${m[1]}‌نبش`],
  [/(?:^|[،,.]\s*|(?:واحد|ملک|آپارتمان|خانه|ساختمان|ساختمون|ویلا|ویلایی|مغازه|زمین|حیاط)\s)(شمالی|جنوبی|شرقی|غربی)(?=\s|$|[،,.])/, (m) => m[1]!],
  [/نورگیر|پر ?نور|نور (عالی|خوب)|نورش (خوبه|عالیه)/, () => 'نورگیر'],
  [/(?<!\S)(ویو|ویوی|چشم ?انداز)(?!\S*\s+(نداره|ندارد))/, () => 'ویو دارد'],
  [/(?<!\S)دهنه(?:ش)? (\S+(?: و \S+)?) متر|(?<!\S)(\S+(?: و \S+)?) متر دهنه/, (m) => `دهنه ${m[1] ?? m[2]} متر`],
  [/(?<!\S)(\S+(?: و \S+)?) متر بر(?=\s|$|[،,.])|(?<!\S)برش (\S+(?: و \S+)?) متر/, (m) => `بر ${m[1] ?? m[2]} متر`],
  [/قابل تبدیل/, () => 'رهن و اجاره قابل تبدیل'],
  [/(?<!\S)تخلیه/, () => 'تخلیه'],
  [/مستاجر (داره|دارد|نشسته)|مستاجر ?نشین/, () => 'مستاجر دارد'],
  [/کلید(ش)? (دست|پیش) (ما|من|دفتر|خودمون)/, () => 'کلید در دفتر'],
  [/وام (\S+ ){0,4}(داره|دارد)|(?<!\S)وام ?دار/, () => 'وام دارد'],
  [/(?<!\S)معاوضه/, () => 'معاوضه'],
];

function extrasOf(t: string): string[] {
  const out: string[] = [];
  for (const [re, label] of EXTRAS) {
    const m = re.exec(t);
    if (!m) continue;
    // «دهنه چهار متر» با رقم فارسی
    const v = label(m).replace(/(\S+(?: و \S+)?)(?= متر$)/, (w) => {
      const n = spokenNumbers(w)[0];
      return n && n.start === 0 && n.end === w.length ? toFaDigits(n.value) : w;
    });
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** رتبهٔ جایگاه هر عدد در خواندن فارسی: هزار ۴، صدگان ۳، دهگان ۲، یکان و ده‌تا‌نوزده ۱. */
const rankOf = (v: number) => (v >= 1000 ? 4 : v >= 100 ? 3 : v >= 20 ? 2 : 1);
const PHONE_KEY = /^(شماره|شمارش|شمارشو|شمارشون|تلفن|تلفنش|تلفنشو|تلفنشون|موبایل|موبایلش|موبایلشو|موبایلشون|همراه|همراهش|همراهشون|تماس|تماسش)$/;
const PHONE_SKIP = /^(شماره|شمارش|شمارشو|شمارشون|تلفن|تلفنش|تلفنشو|تلفنشون|موبایل|موبایلش|موبایلشو|موبایلشون|همراه|همراهش|همراهشون|تماس|تماسش|ثابت|منزل|خانه|دفتر|مثبت|ما|من|مالک|صاحب|صاحبش|مالکش|مشتری|ایشون|ایشان|خودش|خودشون|شخصی|اش|ش|شون|ی|هم|هست|هستش|است|اینه|این|اینو|اینجوریه|میشه|رو|را|بنویس|بنویسید|یادداشت|کن|کنید|خط|:)$/;
// «… هشتاد و هشت، ببخشید، هشتاد و نه»: بعد از این واژه‌ها گوینده شماره یا تکهٔ آخرش را درست می‌گوید.
const PHONE_FIX = /^(ببخشید|ببخشین|اشتباه|اشتباهی|اشتباهه|یعنی|نخیر|اصلاح|عذر|درستش|درستشو|درست|ش|شد|گفتم|کردم|میخوام|می|خوام|میشه|بنویس|اینه|رو)$/;

type Tok = { w: string; start: number; end: number };
const BREAK = /^[،,؛.]$/;
const tokensOf = (t: string): Tok[] => [...t.matchAll(/[،,؛.]|[^\s،,.:؛!?؟()«»"-]+/g)].map((m) => ({ w: m[0], start: m.index, end: m.index + m[0].length }));

/** عدد درست یک واژه («نهصد»، «دوازده»)؛ میلیون و تومان شماره نیستند. */
function wordNum(w: string): number | undefined {
  const v = spokenNumbers(w)[0];
  return v && v.start === 0 && v.end === w.length && !v.money && Number.isInteger(v.value) ? v.value : undefined;
}

/** جایی که شماره می‌تواند تمام شود: رقم‌های تا آنجا و توکن بعدش. */
type Cut = { digits: string; next: number; end: number };
type Run = Cut & { cuts: Cut[] };

/**
 * رقم‌های پشت هم از توکن i. دو عدد وقتی یک عددند که با «و» آمده باشند و جایگاه دومی کوچک‌تر باشد («نهصد و سی»)،
 * وگرنه دو تکه‌اند («سی و سی» = ۳۰۳۰). glue یعنی «سیصد چهل» بی «و» هم یک عدد است، چون آوانگار گاهی «و» را نمی‌نویسد.
 * rep یعنی «دو صفر» بی «تا» هم «۰۰» است، نه «۲۰».
 */
function phoneRun(toks: Tok[], i: number, glue: boolean, rep: boolean): Run {
  let digits = '';
  let cur = 0;
  let has = false;
  let rank = 9;
  let and = false;
  let end = toks[i]?.start ?? 0;
  let next = i;
  const cuts: Cut[] = [];
  const flush = () => {
    if (has) {
      digits += String(cur);
      cuts.push({ digits, next, end });
    }
    cur = 0;
    has = false;
    rank = 9;
  };
  let j = i;
  for (; j < toks.length; j++) {
    const w = toks[j]!.w;
    if (BREAK.test(w)) {
      flush();
      and = false;
      continue;
    }
    if (w === 'و') {
      and = true;
      continue;
    }
    let add = '';
    if (/^\d+(?:٬\d{3})*$/.test(w)) add = w.replace(/٬/g, '');
    else if (/^(صفر)+$/.test(w)) add = '0'.repeat(w.length / 3);
    else if (w === 'هزار') {
      // «شش هزار و هفتصد» = ۶۷۰۰، «هزار و دویست» = ۱۲۰۰
      if (has && rank < 4) cur *= 1000;
      else {
        flush();
        cur = 1000;
        has = true;
      }
      rank = 4;
    } else {
      // «سه تا هفت»، «دوتا یک»، «دوصفر»: یک رقم چند بار.
      const glued = /^(دو|سه|چهار|پنج)(تا|صفر)$/.exec(w);
      const n = wordNum(glued ? glued[1]! : w);
      if (n === undefined) break;
      const skip = glued ? (glued[2] === 'صفر' ? 0 : 1) : toks[j + 1]?.w === 'تا' ? 2 : rep && toks[j + 1]?.w === 'صفر' ? 1 : 0;
      const dTok = glued?.[2] === 'صفر' ? { w: 'صفر' } : skip ? toks[j + skip] : undefined;
      const d = dTok ? (dTok.w === 'صفر' ? 0 : wordNum(dTok.w)) : undefined;
      if (n >= 2 && n <= 5 && d !== undefined && d <= 9) {
        add = String(d).repeat(n);
        j += skip;
      } else if (glued) break;
      else if (has && rankOf(n) < rank && (and || (glue && (rank > 2 || n < 10)))) {
        cur += n;
        rank = rankOf(n);
      } else {
        flush();
        cur = n;
        has = true;
        rank = rankOf(n);
      }
    }
    and = false;
    if (add) flush();
    digits += add;
    end = toks[j]!.end;
    next = j + 1;
    if (add) cuts.push({ digits, next, end });
  }
  flush();
  return { digits, next: j, end, cuts };
}

/** «مثبت نود و هشت…»، بی «صفر» اول، یا ثابت بی صفر («هفتاد و هفت…» = ۰۷۷…). */
const fixDigits = (d: string) => d.replace(/^(?:00)?98(?=9\d{9}$)/, '').replace(/^(?=[1-9]\d{9}$)/, '0');
const isMobile = (d: string) => /^09\d{9}$/.test(d);
// موبایل، ثابت با پیش‌شماره (۰۷۷ بوشهر)، یا ثابت هشت‌رقمی همان شهر
const isPhone = (d: string) => isMobile(d) || /^0[1-8]\d{9}$/.test(d) || /^[2-8]\d{7}$/.test(d);

type Read = Cut & { valid: boolean };
const MODES: Array<[boolean, boolean]> = [[false, false], [true, false], [false, true], [true, true]];

/** همهٔ خوانش‌ها (با «و» و بی «و»، «دو صفر») امتحان می‌شود و آنکه شمارهٔ درست می‌دهد برنده است. */
function bestRun(toks: Tok[], i: number, ok: (d: string) => boolean, prefix = true): Read & { runs: Run[] } {
  const runs = MODES.map(([g, r]) => phoneRun(toks, i, g, r));
  for (const r of runs) {
    const d = fixDigits(r.digits);
    if (ok(d)) return { ...r, digits: d, valid: true, runs };
  }
  // شمارهٔ درست و پشتش عدد دیگری («… هشتاد و نه صد متر»، «… هشتاد و نه دو خوابه»): فقط تکهٔ آخر اضافه است
  // و بعدش واژهٔ دیگری آمده؛ شماره‌ای که در پایان جمله بلندتر شده احتمالاً غلط شنیده شده و پر نمی‌شود.
  for (const r of prefix ? runs : []) {
    const last = r.cuts.length - 1;
    const c = r.cuts[last - 1];
    const after = toks[r.cuts[last]?.next ?? toks.length];
    if (!c || !after || BREAK.test(after.w)) continue;
    const d = fixDigits(c.digits);
    if (ok(d)) return { ...c, digits: d, valid: true, runs };
  }
  const s = runs[0]!;
  return { ...s, digits: fixDigits(s.digits), valid: false, runs };
}

/** شماره از توکن i، با اصلاح گوینده: «… هشتاد و هشت، ببخشید، هشتاد و نه» تکهٔ آخر را عوض می‌کند. */
function readPhone(toks: Tok[], i: number, ok: (d: string) => boolean): Read {
  // اصلاح بعد از خود رشتهٔ عدد می‌آید؛ آن‌وقت تکهٔ اضافهٔ آخر همان اشتباه است و سرِ شماره برداشته نمی‌شود.
  let k = Math.max(...MODES.map(([g, r]) => phoneRun(toks, i, g, r).next));
  while (k < toks.length && BREAK.test(toks[k]!.w)) k++;
  const corrected = k < toks.length && /^(ببخشید|ببخشین|اشتباه|اشتباهی|اشتباهه|یعنی|نخیر|اصلاح|عذر)$/.test(toks[k]!.w);
  const first = bestRun(toks, i, ok, !corrected);
  if (!corrected) return first;
  while (k < toks.length && (BREAK.test(toks[k]!.w) || PHONE_FIX.test(toks[k]!.w))) k++;
  if (k >= toks.length) return first;
  const fix = bestRun(toks, k, ok);
  if (fix.valid) return fix;
  // شمارهٔ درست را فقط شمارهٔ کامل دیگری عوض می‌کند؛ «… هشتاد و نه، یعنی دو خوابه» شماره را خراب نمی‌کند.
  if (first.valid || !fix.digits || fix.digits.length > 4) return first;
  // تکهٔ اصلاح‌شده جای همان تعداد رقم آخر می‌نشیند.
  for (const r of first.runs) {
    for (const c of [...r.cuts].reverse()) {
      const d = fixDigits(c.digits + fix.runs[0]!.digits);
      if (ok(d)) return { digits: d, next: fix.next, end: fix.end, valid: true };
    }
  }
  return first;
}

type PhoneHit = { phone?: string; raw?: string; start: number; end: number };

function findPhone(t: string): PhoneHit | undefined {
  const s = toEnDigits(t);
  const toks = tokensOf(s);
  // ۱. بعد از «شماره/تلفن/موبایل…»
  let raw: PhoneHit | undefined;
  for (let i = 0; i < toks.length; i++) {
    if (!PHONE_KEY.test(toks[i]!.w)) continue;
    let j = i + 1;
    while (j < toks.length && j - i <= 4 && PHONE_SKIP.test(toks[j]!.w)) j++;
    if (j >= toks.length) continue;
    const r = readPhone(toks, j, isPhone);
    if (r.valid) return { phone: r.digits, start: toks[i]!.start, end: r.end };
    if (!raw && r.digits.length >= 5) raw = { raw: r.digits, start: toks[i]!.start, end: r.end };
    i = Math.max(i, r.next - 1);
  }
  // ۲. رقم نوشته‌شده با فاصله یا خط تیره: «۰۹۱۲-۳۴۵-۶۷-۸۹»، «+98 912…»، «۰۷۷ ۳۳۳۳ ۴۴۵۵»
  const written = /(?<!\d)(?:(?:\+|00)?98[\s-]*|0)?9\d{2}(?:[\s-]*\d){7}(?!\d)/.exec(s) ?? /(?<!\d)0[1-8]\d(?:[\s-]*\d){8}(?!\d)/.exec(s);
  if (written) return { phone: normalizePhone(written[0]), start: written.index, end: written.index + written[0].length };
  // ۳. بی هیچ کلمه‌ای: هر رشته عددی که دقیقاً یک موبایل بدهد («آقای رضایی نهصد و دوازده…»)
  for (let i = 0; i < toks.length; ) {
    const w = toks[i]!.w;
    if (!/^\d/.test(w) && !/^صفر/.test(w) && w !== 'هزار' && wordNum(w) === undefined) {
      i++;
      continue;
    }
    const r = readPhone(toks, i, isMobile);
    if (r.valid) return { phone: r.digits, start: toks[i]!.start, end: r.end };
    i = Math.max(r.next, i + 1);
  }
  return raw;
}

/**
 * شمارهٔ گفته‌شده، به هر شکلی که عامیانه خوانده می‌شود:
 * «صفر نهصد و دوازده، سیصد و چهل و پنج، شصت و هفت، هشتاد و نه»، «صفر نه یک دو…» رقم‌به‌رقم،
 * «سه تا هفت» (۷۷۷)، «شش هزار و هفتصد و هشتاد و نه»، رقم‌های نوشته‌شده با فاصله، بی «صفر» اول و بی کلمهٔ «شماره».
 * شمارهٔ ناقص (دست‌کم ۵ رقم بعد از «شماره») در raw می‌آید تا گم نشود.
 */
export function spokenPhone(t: string): { phone?: string; raw?: string } {
  const hit = findPhone(norm(t));
  return hit ? (hit.phone ? { phone: hit.phone } : { raw: hit.raw }) : {};
}

// «عصرها»، «بعد از ساعت پنج»، «از ساعت چهار تا هشت شب»، «پنجشنبه‌ها»، «ساعت اداری»: بهترین زمان تماس با مالک.
const T_NUM = '(?:[0-9۰-۹]{1,2}(?::[0-9۰-۹]{2})?|(?:یازده|دوازده|یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده)(?= |$|[،,.])(?: و نیم)?)';
const T_PART = '(?:صبح|ظهر|بعد ?از ?ظهر|عصر|غروب|شب)';
const T_DAY = '(?:شنبه|یکشنبه|دوشنبه|سه ?شنبه|چهارشنبه|پنج ?شنبه|جمعه)';
const T_UNIT = [
  `(?:از|بین) (?:ساعت )?${T_NUM}(?: ${T_PART})? (?:تا|الی) (?:ساعت )?${T_NUM}(?: ${T_PART})?`,
  `(?:قبل از |قبل )?${T_PART}(?: ?ها|ا)?(?: زود)?(?: به بعد)?`,
  `(?:بعد از |قبل از |از |تا |بین )?ساعت ${T_NUM}(?: ${T_PART})?(?: به بعد)?`,
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
// بی «زنگ/تماس» فقط ساعت و روز روشن پذیرفته است؛ «شب‌ها سر و صدا نداره» زمان تماس نیست.
const STRONG_TIME = /ساعت|روزهای|اداری|شنبه|^(از|بین) \S+ .*(تا|الی) /;

export function bestTimeOf(t: string): string | undefined {
  const hint = CALL_HINT.exec(t);
  // «بین هشت تا ده میلیارد»، «از صد تا صد و بیست متر»: بازهٔ مبلغ و متراژ است، نه ساعت.
  const all = [...t.matchAll(TIME_RE)].filter((m) => (/\s|ها$|^(صبح|عصر|ظهر|شب|غروب)ا$/.test(m[0]) || hint) && !/^\s*(میلیون|میلیارد|ملیون|ملیارد|تومن|تومان|متر|متری|خواب|سال|طبقه)/.test(t.slice(m.index + m[0].length)));
  // نزدیک «زنگ/تماس/جواب» باشد؛ بی آن فقط شکل‌های روشن مثل «عصرها» پذیرفته است.
  const pick = hint
    ? all.sort((a, b) => Math.abs(a.index - hint.index) - Math.abs(b.index - hint.index))[0]
    : all.find((m) => STRONG_TIME.test(m[0]) && !/^(صبح|ظهر|عصر|غروب|شب)$/.test(m[0]));
  if (!pick) return undefined;
  // «صبح زود زنگ نزنید»، «ظهرها در دسترس نیست»: زمانی که نباید زنگ زد.
  if (/^\s*(\S+\s){0,2}(نزنید|نزن|نزنین|نگیرید|نگیرین|نیست|نمیده|نمی ده|نمیدن|نداره)/.test(t.slice(pick.index + pick[0].length, pick.index + pick[0].length + 30))) return undefined;
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
const LOOSE_STOP = /^(حد|حدود|طول|عرض|کنار|وسط|اول|آخر|نزدیکی|جوار|مقابل|انتظار|حین|دسترس|دسترسه|دسترسی|خدمت|حال|نظر|مورد|جریان|اختیار|اسرع|کل|ضمن|واقع|عوض|همون|همان|این|اون|آن|یه|یک|ساختمون|ساختمان|مجتمع|برج|خانه|شهر|بالا|پایین|طبقه|کوچه|خیابان|بلوار|مایه|مایه های|مایه‌های)$/;

const NAME_STOP = /^(زیر|بالای|حداقل|حداکثر|حدود|بین|دنبال|بعد|قبل|فقط|ساعت|داره|دارن|دارد|گفت|گفته|میگه|برای|بری|مال|الان|خیلی|اینجا|اونجا|ولی|اما|یا|هم|تا|از|به|رو|را|صبح|عصر|ظهر|شب|طبقه|آپارتمان|واحد|تماس|زنگ|هست|است|هستن|هستند|که|و|با|شماره|تلفن|موبایل|مالک|صاحب|عصرها|صبح‌ها|صبحها|شبها|شب‌ها|ظهرها|خونه|خانه|ملک|فایل|دنبال|میخواد|می‌خواد|میخواهد|می‌خواهد|بود|باشه|خودش|ایشون|شمارش|شمارشون|تلفنش|موبایلش|همراهش|تماسش|مناسب|مناسبه|خانواده|زوج|زوجین|دانشجو|دانشجویی|سکونت|کار|سرمایه|سرمایه‌گذاری|مسکونی|شما|ما|من|همه|بچه|مجرد|متاهل|مستاجر|زندگی|بازدید|خرید|دیدن|عجله|فعلا|هنوز|دیگه|پول|بودجه|بودجش|نیاز|لازم|مشتری|جدی|جدیه|فوری|منتظر|دنبال|میخواست|زنگ|زد|خارج|ایران|شهرستان|تهران|اینجا|نیست|سفر|مسافرت|کشور|کشوره|مشاور|مشاوره|گفت|میگه|ساکن|مقیم|ساکنه|مقیمه|واسه|واسش|برا|براش|خریدار|متقاضی|نقد|پولش|مستاجره)$/;
// «میخواد» فعل است ولی «میرزایی» و «میری» نام‌اند.
const VERB = /^ن?می(خواد|خواهد|خوان|خوام|خواست|ده|دن|دم|دی|گه|گن|گم|گفت|کنه|کنن|کنم|کرد|اد|آد|ان|آن|شه|شن|شد|تونه|تونن|فروشه|فروشن|خره|خرن|ره|رن|رم|زنه|بینه|گیره|ذاره|زاره|دونه|پرسه|مونه|خوره|گرده|بره|پسنده)$/;
// «آقای سامان مغازه می‌خواد»: نوع ملک یا امکانات جزو نام نیست.
const nameWord = (w: string | undefined) => !!w && !NOT_NAME.test(w) && !NAME_STOP.test(w) && !kindsOf(w).length && !featuresOf(w).length && !VERB.test(w) && !/ها$/.test(w) && !/\d/.test(w) && !spokenNumbers(w).length;

const TITLE = /^(جناب|حاج|حاجی|آقا|آقای|خانم|خانوم|دکتر|مهندس|استاد)$/;
/** «جناب» نوشته نمی‌شود؛ «آقا» تنها «آقای» می‌شود ولی «حاج آقا» همان می‌ماند. */
function titleOf(chain: string[]): string {
  const out = chain
    .filter((w) => w !== 'جناب')
    .map((w) => (w === 'خانوم' ? 'خانم' : w));
  return out.length ? out.join(' ') : 'آقای';
}

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
    if (TITLE.test(w)) {
      if (TITLE.test(words[i - 1] ?? '')) return;
      // «حاج آقا رحیمی»، «خانم دکتر نوری»، «جناب آقای کریمی»: همهٔ عنوان‌ها پشت هم، بعد خود نام.
      let j = i;
      while (TITLE.test(words[j] ?? '')) j++;
      const n = take(j);
      if (n) hits.push({ name: `${titleOf(words.slice(i, j))} ${n}`, at: i, near: isNear || (!!near && near.test(words[i - 1] ?? '')) });
    } else if (/^(مالکش|صاحبش|مالک|صاحب)$/.test(w) || (/^(اسم|اسمش|نام|بنام)$/.test(w))) {
      // «به نام»، «اسم مالک»، «مالکش» و بعد خود نام (اگر «آقای» نیامده باشد)
      let j = i + 1;
      while (/^(ملک|مالک|مالکش|صاحبش|هم|هست|است|:)$/.test(words[j] ?? '')) j++;
      if (TITLE.test(words[j] ?? '')) return;
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
  // «علی آقا»، «زهرا خانم»: نام کوچک و بعد عنوان.
  if (!hits.length) {
    words.forEach((w, i) => {
      if (hits.length || i === 0 || !/^(آقا|خانم|خانوم)$/.test(w) || TITLE.test(words[i - 2] ?? '') || !nameWord(words[i - 1])) return;
      hits.push({ name: `${words[i - 1]} ${w === 'خانوم' ? 'خانم' : w}`, at: i - 1, near: !!near && near.test(words[i - 2] ?? '') });
    });
  }
  const pick = (near && hits.find((h) => h.near)) || hits[0];
  return pick?.name;
}

/** «اجاره بیست»، «رهن پانصد»: عدد بی‌واحد پس از رهن/اجاره میلیون تومان است. */
/** «هشت و دویست» بعد از «قیمت» یعنی هشت میلیارد و دویست میلیون (عدد کوچک‌تر اول آمده، پس دو مرتبه است). */
function billionAndMillion(src: string): number | undefined {
  const atoms = src.split(' و ').map((p) => wordNum(p.trim()));
  if (atoms.length < 2 || atoms.some((x) => x === undefined)) return undefined;
  const k = atoms.findIndex((x) => x! >= 100);
  if (k < 1) return undefined;
  const sum = (xs: Array<number | undefined>) => xs.reduce<number>((acc, x) => acc + x!, 0);
  const hi = sum(atoms.slice(0, k));
  const lo = sum(atoms.slice(k));
  return hi >= 1 && hi < 100 && lo >= 100 && lo < 1000 ? hi * 1e9 + lo * 1e6 : undefined;
}

/**
 * عدد بی‌واحد بعد از رهن/اجاره/قیمت، همان‌طور که مشاورها می‌گویند:
 * «اجاره بیست» و «اجاره هفت تومن» = میلیون؛ «رهن پونصد» = میلیون ولی «رهن دو» = میلیارد؛
 * «قیمتش هشت و نیم» = میلیارد و «قیمت نهصد» = میلیون؛ «رهن کامل هزار و پونصد» = یک و نیم میلیارد.
 * buying: مشتری خرید که «تا پنج» می‌گوید. sale: فایل فروشی (یا بی نوع معامله) که «هفت تومن» بی برچسب گفته.
 */
function shortPrices(t: string, nums: SpokenNumber[], buying = false, sale = buying): { deposit?: number; rent?: number; total?: number } {
  const out: { deposit?: number; rent?: number; total?: number } = {};
  const RANGE_GAP = /^\s*(تا|الی|یا|-)?\s*$/;
  for (const [i, n] of nums.entries()) {
    // «دو تا خواب» شمارش است؛ ولی «قیمت پونزده تا» یعنی پونزده میلیارد.
    if (n.value < 1 || /^\s*(متر|خواب|طبقه|سال|ساله|تا\s+(خواب|اتاق|طبقه|واحد|پارکینگ|انباری|متر))/.test(after(t, n))) continue;
    // «اجاره هفت هشت تومن»، «پنج تا شش میلیارد»: سر پایین بازه کنار می‌رود؛ سقف همان عدد بزرگ‌تر است.
    const next = nums[i + 1];
    if (next && next.value > n.value && RANGE_GAP.test(t.slice(n.end, next.start))) continue;
    // «رهن صد تا صد و پنجاه»: برچسب سقف بازه پیش از عدد اول آمده است.
    const prev = nums[i - 1];
    const b = before(t, prev && prev.value < n.value && RANGE_GAP.test(t.slice(prev.end, n.start)) ? prev : n, 30);
    const slot = slotOf(b, t.slice(n.end, n.end + 20));
    if (slot === 'perMeter') continue;
    // «هفت تومن» بی میلیون/میلیارد: در اجاره هفت میلیون، در فروش هفت میلیارد.
    if (n.money) {
      const s = slot ?? (sale ? 'total' : undefined);
      // «هفت و سیصد و پنجاه تومن» = هفت میلیارد و سیصد و پنجاه میلیون
      const mixed = s && s !== 'rent' ? billionAndMillion(t.slice(n.start, n.end).replace(/\s*(تومن|تومان)$/, '')) : undefined;
      if (mixed) out[s!] ??= mixed;
      else if (n.value < 1000 && s) out[s] ??= Math.round(n.value * (s === 'rent' ? 1e6 : n.value < (s === 'total' ? 100 : 20) ? 1e9 : 1e6));
      continue;
    }
    if (!slot) {
      // «هشت و پونصد» بی برچسب در فایل فروشی: فقط همین شکل میلیارد و میلیون روشن است.
      const mixed = sale ? billionAndMillion(t.slice(n.start, n.end)) : undefined;
      if (mixed) out.total ??= mixed;
      continue;
    }
    if (slot === 'rent') {
      if (n.value < 1000) out.rent ??= Math.round(n.value * 1e6);
      continue;
    }
    const key = b.replace(/[\s،:]+$/, '').replace(/\s*(تا|حدود|زیر|سقف|حداکثر|حداکثرش|نهایتا|تقریبا)$/, '');
    if (slot === 'total' && !buying && !/(قیمت|قیمتش|کل|کلش|بودجه|بودجش|بودجه اش|بودجه‌اش)$/.test(key)) continue;
    const mixed = billionAndMillion(t.slice(n.start, n.end));
    const value = mixed ?? (n.value >= 100_000 ? undefined : n.value * (n.value < (slot === 'total' ? 100 : 20) ? 1e9 : 1e6));
    if (value) out[slot] ??= Math.round(value);
  }
  return out;
}

/** «منطقه هجده» یا «منطقه یک یا دو» بی فهرست محله: خود «منطقه ۱۸». */
function zonesOf(t: string): string[] {
  const m = /(?:^|\s)منطقه (?:ی )?/.exec(t);
  if (!m) return [];
  const out: string[] = [];
  for (const part of t.slice(m.index + m[0].length).split(/ یا |، ?| یا اینکه /)) {
    const n = spokenNumbers(part)[0];
    if (!n || n.start !== 0 || !Number.isInteger(n.value) || n.value < 1 || n.value >= 30) break;
    out.push(`منطقه ${toFaDigits(n.value)}`);
    if (part.slice(n.end).trim()) break;
  }
  return out;
}

const AREA_GAP = /^\s*(متر|متری|مترمربع)?\s*(تا|الی|یا|و|،|-)?\s*$/;

/**
 * متراژی که مشتری می‌خواهد، همان‌طور که عامیانه گفته می‌شود:
 * «از هشتاد تا صد متر»، «متراژ بین صد و صد و بیست»، «هشتاد نود متری»، «صد، صد و بیست متر»، «متراژ زیر صد»،
 * «صد متر به بالا»، «صد متر به پایین»، «کمتر از صد متر نباشه»، «حداقل صد متر، حداکثر صد و پنجاه».
 * used: عددهایی که متراژ شدند تا قیمت حساب نشوند.
 */
function areaNeed(t: string, nums: SpokenNumber[], areas: SpokenNumber[]): { min?: number; max?: number; used: Set<SpokenNumber> } {
  const used = new Set(areas);
  // عدد بی‌واحد؛ «طبقه ده» و «سال نود» و «منطقه پنج» نه.
  const bare = (n: SpokenNumber) =>
    !n.money && Number.isInteger(n.value) && n.value >= 10 && n.value < 100_000 &&
    !/^\s*(متر|خواب|اتاق|طبقه|سال|ساله|میلیون|میلیارد|تومن|تومان|هزار|نفر|واحد|تا (خواب|اتاق))/.test(after(t, n)) &&
    !/(طبقه|سال|ساخت|مدل|منطقه|کوچه|پلاک|شماره|خیابان|بلوار|فاز)( ی)?$/.test(before(t, n));
  // ۱. جملهٔ «متراژ …»: عددهای بی‌واحد بعدش تا ویرگول متراژند.
  for (const n of nums) {
    if (used.has(n) || !bare(n)) continue;
    const m = /(?:^|\s)(متراژ|متراژش|مساحت|مساحتش|زیربنا|زیربناش)(?:\s|$)(.*)$/.exec(before(t, n, 40));
    if (m && !/[،,.؛]|خواب|طبقه|رهن|اجاره|قیمت|بودجه|میلیون|میلیارد|تومن|سال/.test(m[2]!)) used.add(n);
  }
  // ۲. جفت بازه کنار یک متراژ: «هشتاد تا صد متر»، «هشتاد نود متر»، «صد، صد و بیست متری».
  const pair = (a: SpokenNumber, b: SpokenNumber) => AREA_GAP.test(t.slice(a.end, b.start)) && a.value < b.value && b.value <= a.value * 3;
  for (let i = 0; i + 1 < nums.length; i++) {
    const a = nums[i]!;
    const b = nums[i + 1]!;
    if (!pair(a, b)) continue;
    if (used.has(b) && !used.has(a) && bare(a)) used.add(a);
    // «متراژ صد، صد و ده»: بعد از ویرگول فقط وقتی نزدیک است بازه حساب می‌شود.
    else if (used.has(a) && !used.has(b) && bare(b) && (!/،/.test(t.slice(a.end, b.start)) || b.value <= a.value * 1.5)) used.add(b);
  }
  // ۳. واحد از متراژ قبلی: «حداقل صد متر، حداکثر صد و پنجاه»، «از صد متر تا صد و پنجاه».
  for (let i = 1; i < nums.length; i++) {
    const n = nums[i]!;
    const prev = nums[i - 1]!;
    if (used.has(n) || !used.has(prev) || !bare(n) || n.value <= prev.value) continue;
    const gap = t.slice(prev.end, n.start);
    if (/^\s*(متر|متری|مترمربع)?\s*(تا|الی)\s*$/.test(gap) || /^\s*(متر|متری|مترمربع)?\s*[،,]?\s*(حداکثر|حداکثرش|ماکزیمم|ماکسیمم|نهایتا|تا)\s*$/.test(gap)) used.add(n);
  }
  const list = nums.filter((n) => used.has(n));
  let min: number | undefined;
  let max: number | undefined;
  for (let i = 0; i + 1 < list.length && min === undefined; i++) {
    if (nums.indexOf(list[i + 1]!) === nums.indexOf(list[i]!) + 1 && pair(list[i]!, list[i + 1]!)) {
      min = list[i]!.value;
      max = list[i + 1]!.value;
    }
  }
  if (min !== undefined) return { min, max, used };
  const dirOf = (n: SpokenNumber): 'min' | 'max' | undefined => {
    const b = before(t, n, 20);
    const a = after(t, n, 30).replace(/^(متر|متری|مترمربع)\s*/, '');
    if (/^(به بالا|به بالاتر|و بالاتر|و بیشتر|به بیشتر|به بعد|بالاتر)/.test(a)) return 'min';
    if (/^(به پایین|به پایینتر|به پایین تر|و کمتر|و پایینتر|به کمتر)/.test(a)) return 'max';
    // «از صد متر کمتر نباشه»، «از صد و بیست بیشتر نشه»
    if (/^(کمتر|پایینتر|پایین تر|کوچکتر|کوچیکتر|کوچیک تر)\s*(نباشه|نشه|نباشد|نمیخواد)/.test(a)) return 'min';
    if (/^(بیشتر|بالاتر|بزرگتر|بزرگ تر|گنده تر)\s*(نباشه|نشه|نباشد|نره|نمیخواد)/.test(a)) return 'max';
    const d = /(حداکثر|حداکثرش|زیر|کمتر از|پایینتر از|پایین تر از|تا|نهایتا|نهایت|ماکزیمم|ماکسیمم)$/.test(b) ? 'max' : /(حداقل|بالای|بیشتر از|بیش از|بالاتر از|از)$/.test(b) ? 'min' : undefined;
    // «کمتر از صد متر نباشه»: منفی، برعکس.
    return d && /^(نباشه|نشه|نباشد)/.test(a) ? (d === 'min' ? 'max' : 'min') : d;
  };
  min = list.find((n) => dirOf(n) === 'min')?.value;
  max = list.find((n) => dirOf(n) === 'max')?.value;
  if (min === undefined && max === undefined) min = list[0]?.value;
  return { min, max, used };
}

/** خواسته‌های مشتری که فیلد جدا ندارند («حتماً پارکینگ داشته باشه»، «نوساز»، «شمال شهر») در یادداشت می‌مانند. */
function wishesOf(t: string): string[] {
  const out: string[] = [];
  const features = featuresOf(t);
  if (features.length) out.push(`امکانات: ${features.join('، ')}`);
  if (/نوساز|کلید نخورده/.test(t)) out.push('نوساز');
  else {
    const age = spokenNumbers(t).find((n) => !n.money && n.value < 60 && /^سال( ساخت|ه)?/.test(after(t, n)) && /(تا|زیر|حداکثر|کمتر از|نهایتا)$/.test(before(t, n)));
    if (age) out.push(`حداکثر ${toFaDigits(age.value)} سال ساخت`);
  }
  const region = /(?<!\S)(شمال|جنوب|شرق|غرب|مرکز) (شهر|تهران)|(?<!\S)(بالای|پایین) شهر/.exec(t);
  if (region) out.push(`محدوده: ${region[0]}`);
  if (/(?<!\S)(با|از) وام|وام (داره|دارد|میگیره|می گیره|بانکی)/.test(t)) out.push('با وام');
  if (/قابل تبدیل/.test(t)) out.push('رهن و اجاره قابل تبدیل');
  if (/(?<!\S)معاوضه/.test(t)) out.push('معاوضه');
  return out;
}

/** فیلدهای فرم از متن گفته‌شده. year سال شمسی جاری است (برای «ده سال ساخت» و «نوساز»). */
export function ruleDraft<F extends VoiceForm>(form: F, transcript: string, hints: string[], year: number): VoiceDraft<F> {
  const said = norm(transcript);
  if (!said) return {} as VoiceDraft<F>;
  const phone = findPhone(said);
  // رقم‌های شماره از متن برداشته می‌شوند تا قیمت، متراژ یا اسم حساب نشوند؛ «شماره» می‌ماند تا اسمِ پیش از آن تمام شود.
  const t = phone ? `${said.slice(0, phone.start)} شماره، ${said.slice(phone.end)}`.replace(/\s+/g, ' ').trim() : said;
  const nums = spokenNumbers(t);
  const raw: Record<string, unknown> = {};
  const deal = dealOf(t, form);
  if (deal) raw.deal = deal;

  // «پونصد متر تا دریا فاصله داره» متراژ نیست.
  const areas = nums.filter((n) => !n.money && !/^متر( \S+){0,3} (فاصله|بالاتر|پایین تر|پایینتر|جلوتر|عقب تر|عقبتر)|^متر تا (دریا|ساحل|خیابان|بلوار|میدان|پارک|مدرسه|ایستگاه|مترو)/.test(after(t, n, 40)) &&
    // «خیابان سی متری»، «بیست متری اول»: نام خیابان است.
    !/(خیابان|کوچه|بلوار)$/.test(before(t, n)) && !/^متری (اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)(?=\s|$)/.test(after(t, n)) &&
    // «دهنه چهار متر»، «دوازده متر بر»: پهنای ملک است، نه متراژ.
    !/(?<!\S)(دهنه|دهنش|عرض|طول|ارتفاع|عمق|بر|برش)$/.test(before(t, n)) && !/^متر (دهنه|بر|عرض|طول|ارتفاع|عمق)(?=\s|$|[،,.])/.test(after(t, n)) &&
    // «سن بنا پنج سال» سن ساختمان است.
    ((/^(متر|متری|مترمربع)/.test(after(t, n)) && !/(متری|هر متر)$/.test(before(t, n))) || /(?<!(سن|عمر) )(متراژ|متراژش|زیربنا|زیربناش|بنا|مساحت|مساحتش)[:،]?$/.test(before(t, n))));
  const bedrooms = nums.find((n) => !n.money && n.value < 20 && /^(تا )?(اتاق( خواب)?|خواب)/.test(after(t, n)));
  // «چهارخوابه» سرهم نوشته می‌شود و عدد جدا پیدا نمی‌شود.
  const glued = /(?:^|\s)(یک|یه|دو|سه|چهار|پنج|شش|شیش)\u200c?خوابه?(?=$|[\s،,.])/.exec(t);
  const bedroomsValue = bedrooms?.value ?? (glued ? GLUED_BEDS[glued[1]!] : /تک خواب/.test(t) ? 1 : /بدون خواب|استودیو/.test(t) ? 0 : undefined);
  const places = hintsIn(t, hints);
  const streets = nameAfter(t, /^(خیابان|بلوار|کوچه|میدان)$/);
  // «منطقه هجده» بی فهرست محله: خود «منطقه ۱۸».
  const hoods = zonesOf(t)
    .concat(nameAfter(t, /^(محله|منطقه|محدوده|حوالی|شهرک)$/).map((x) => (x.lead === 'شهرک' ? `شهرک ${x.name}` : x.name)).filter((x) => !CITY_NAMES.test(x)));
  // «آپارتمان فروشی تو تجریش»: نام بعد از «تو/در» وقتی هیچ محلهٔ دیگری گفته نشده.
  if (!places.length && !hoods.length) {
    const loose = nameAfter(t, /^(تو|توی|در)$/).find((x) => !kindsOf(x.name).length && !CITY_NAMES.test(x.name) && !LOOSE_STOP.test(x.name.split(' ')[0]!) && !/^(خیابان|بلوار|کوچه|میدان|محله|منطقه|شهرک|طبقه|ساختمان|واحد)/.test(x.name));
    if (loose) hoods.push(loose.name);
  }

  if (form === 'listing') {
    const kind = kindsOf(t)[0];
    if (kind) raw.kind = kind;
    // «منطقه مبارزان، محله سعدی»: «محله» دقیق‌تر است و برنده است.
    const said = nameAfter(t, /^محله$/)[0]?.name;
    const saidHood = said && !CITY_NAMES.test(said) ? (places.find((p) => normalizeForSearch(p) === normalizeForSearch(said)) ?? said) : undefined;
    raw.neighborhood = saidHood ?? places[0] ?? hoods[0];
    if (streets[0]) raw.street = `${streets[0].lead} ${streets[0].name}`;
    // «دویست متر زمین، صد و هشتاد متر بنا»: برای خانه زیربنا مهم است، برای زمین خود زمین.
    const builtArea = areas.find((n) => /^(متر|متری|مترمربع) ?(بنا|زیربنا|مفید)/.test(after(t, n)) || /(زیربنا|زیربناش|بنا)[:،]?$/.test(before(t, n)));
    raw.area = (kind !== 'land' && builtArea ? builtArea : areas[0])?.value;
    const landArea = builtArea && kind !== 'land' ? areas.find((n) => n !== builtArea && /^(متر|متری|مترمربع) زمین|^زمین/.test(after(t, n))) : undefined;
    const notes: string[] = [];
    if (landArea) notes.push(`زمین ${toFaDigits(landArea.value)} متر`);
    raw.bedrooms = bedroomsValue;

    const floorNum = nums.find((n) => !n.money && /طبقه( ی)?$/.test(before(t, n)));
    const ord = [...t.matchAll(/طبقه( ی)? (?=([^\s،,.]+))/g)].map((m) => ORDINALS[m[2]!]).find((v) => v !== undefined);
    raw.floor = /(?<!زیر )همکف/.test(t) ? 0 : /زیر ?همکف|زیرزمین|منفی/.test(t) ? undefined : (floorNum?.value ?? ord);
    raw.floorsTotal =
      nums.find((n) => !n.money && /^طبقه/.test(after(t, n)) && !/طبقه( ی)?$/.test(before(t, n)))?.value ??
      nums.find((n) => !n.money && /طبقه( ی)? \S+ از$/.test(before(t, n)))?.value;
    // «طبقه آخر» یعنی بالاترین طبقهٔ همان ساختمان.
    if (raw.floor === undefined && /طبقه( ی)? (آخر|اخر|آخره)(?=\s|$|[،,.])/.test(t) && typeof raw.floorsTotal === 'number') raw.floor = raw.floorsTotal;

    // «سال ۹۸ بازسازی شده» سال ساخت نیست؛ «ساخت سال ۸۵» بر «سال ۸۵» مقدم است.
    const years = nums.filter((n) => !n.money && Number.isInteger(n.value) && fullYear(n.value, year) && /(ساخت|ساختش|سال|سازه|مدل)[:،]?$/.test(before(t, n)) && !/^(سال|ساله|بازسازی|تعمیر|نوسازی|خرید|خریده|خریدم|خریدن)/.test(after(t, n)));
    // «سال نود صنعتی، مدل نود و شش»: «ساخت/مدل» از «سال» تنها مطمئن‌تر است.
    const built = years.find((n) => /(ساختش?|مدل|سازه)( سال)?[:،]?$/.test(before(t, n))) ?? years[0];
    // «قرارداد یک ساله» سن ساختمان نیست.
    // «ده سالشه»، «سن بنا پنج سال»، «پونزده سال عمر داره»
    const age = nums.find((n) => n.value < 100 && !n.money && (/^(سال ساخت|ساله|سالشه|سال سن|سال عمر)/.test(after(t, n)) || (/(سن|عمر)( بنا| بناش| ساختمان| ساختمون| ملک)?( هم)?[:،]?$/.test(before(t, n)) && /^سال/.test(after(t, n)))) && !/(قرارداد|اجاره|مستاجر|وام|قسط|اقساط|اجاره نامه)$/.test(before(t, n)));
    raw.yearBuilt = (built && fullYear(built.value, year)) ?? (age ? year - age.value : /نوساز|کلید نخورده/.test(t) ? year : undefined);

    const features = featuresOf(t);
    if (features.length) raw.features = features;
    if (/مقطوع|(?<!\S)قطعی(ه)?(?!\S)|قیمت نهایی|تخفیف نمیده|تخفیف نداره|کوتاه نمیاد|پایین نمیاد/.test(t)) raw.negotiable = false;
    else if (/قابل مذاکره|توافقی|جای چانه|چونه|تخفیف|میاد پایین|میاد پائین|کوتاه میاد|قابل جابجایی/.test(t)) raw.negotiable = true;
    raw.ownerName = personOf(t, /(مالک|صاحب)/);
    raw.ownerBestTime = bestTimeOf(t);
    raw.ownerPhone = phone?.phone;
    // شماره‌ای که کامل شنیده نشد گم نشود؛ مشاور خودش درستش می‌کند.
    notes.push(...extrasOf(t));
    if (phone?.raw) notes.push(`شمارهٔ گفته‌شده (کامل شنیده نشد): ${toFaDigits(phone.raw)}`);
    if (notes.length) raw.description = notes.join('، ');
    Object.assign(raw, shortPrices(t, nums, false, raw.deal !== 'rent' && raw.deal !== 'full'));
    // «متری هشتاد، صد متر»: قیمت هر متر بی «میلیون» و متراژ بعدش آمده.
    const perMeter = raw.total === undefined && typeof raw.area === 'number' && raw.deal !== 'rent' && raw.deal !== 'full' ? nums.find((n) => !n.money && n.value >= 1 && n.value < 1000 && slotOf(before(t, n, 30)) === 'perMeter') : undefined;
    if (perMeter) raw.total = Math.round(perMeter.value * 1e6 * (raw.area as number));
  } else {
    raw.name = personOf(t);
    raw.phone = phone?.phone;
    // مشتری فیلد زمان تماس ندارد؛ در یادداشت می‌ماند تا گم نشود.
    const time = bestTimeOf(t);
    raw.notes = [...wishesOf(t), time && `بهترین زمان تماس: ${time}`, phone?.raw && `شمارهٔ گفته‌شده (کامل شنیده نشد): ${toFaDigits(phone.raw)}`].filter(Boolean).join('، ') || undefined;
    const kinds = kindsOf(t);
    if (kinds.length) raw.kinds = kinds;
    const wanted = [...places, ...hoods];
    if (!wanted.length && streets[0]) wanted.push(`${streets[0].lead} ${streets[0].name}`);
    if (wanted.length) raw.neighborhoods = wanted;

    const area = areaNeed(t, nums, areas);
    raw.areaMin = area.min;
    raw.areaMax = area.max;
    // «دو یا سه خواب»، «دو سه خوابه»، «دو تا سه خواب»: کمترینش.
    const orBeds = bedrooms && /(?:^|\s)(\S+)(?: یا| تا| الی)?$/.exec(before(t, bedrooms));
    const lowBeds = orBeds ? wordNum(orBeds[1]!) : undefined;
    // «حداکثر دو خواب» حداقل نیست.
    const maxBeds = bedrooms && /(حداکثر|نهایتا|نهایت|زیر|کمتر از)$/.test(before(t, bedrooms));
    raw.bedroomsMin = maxBeds ? undefined : lowBeds !== undefined && lowBeds >= 1 && bedrooms && lowBeds < bedrooms.value ? lowBeds : bedroomsValue;
    // «قراردادش ماه دیگه تموم میشه»، «باید تا آخر ماه جابجا بشه»: فوری است، حتی اگر «ماه دیگه» شبیه «بعداً» باشد.
    const moving = /قرارداد(ش|شون)? (\S+ ){0,3}(تموم|تمام)|باید (\S+ ){0,3}(جابجا|جابه ?جا|اسباب ?کشی|تخلیه|بلند)/.test(t);
    if (!moving && /عجله ?(ای )?(نداره|ندارد|نداریم|نیست)|فقط نگاه|فعلا نگاه|سر فرصت|(?<!\S)بعدا(?!\S)|قیمت میگیر|قیمت می گیر|استعلام|تحقیق|(سال|ماه) (دیگه|بعد|آینده)|هنوز (مطمئن|تصمیم|قطعی)|مرده?د/.test(t)) raw.temperature = 'cold';
    else if (moving || /فوری|عجله (داره|دارد)|(^|\s)جدی(ه|ست)?(?=\s|$|[،,.])|سریع|ضروری|پول(ش)? (آماده|حاضر|نقده?)(?!\S)|نقد (داره|دارد|آماده)|(همین|این) (هفته|ماه)|تا آخر (هفته|ماه)|پیگیره|خیلی پیگیر/.test(t)) raw.temperature = 'hot';
    if (/منتظر|خبرش کن|بهش خبر|خبر بدم|زنگ بزنم|تماس بگیرم|بهش زنگ|باهاش تماس|خبر بده|خبرم کن|در جریان|اطلاع بد|هر وقت (چیزی|فایلی|موردی)|اگه (چیزی|فایلی|موردی)/.test(t)) raw.waiting = true;
    // «قیمت» برای مشتری یعنی خرید؛ رهن و اجاره «قیمت» ندارد.
    if (!raw.deal && /قیمت|بخره|خرید/.test(t)) raw.deal = 'sale';
    // عددهای متراژ («متراژ زیر صد») قیمت حساب نشوند.
    const short = shortPrices(t, nums.filter((n) => !area.used.has(n)), raw.deal !== 'rent' && raw.deal !== 'full');
    if (short.deposit) raw.budget = short.deposit;
    else if (short.total) raw.budget = short.total;
    if (short.rent) raw.rent = short.rent;
  }
  return withSpokenPrices(form, t, cleanVoiceDraft(form, raw));
}

/**
 * پیش‌نویس مدل جلوتر است؛ قاعده‌ها فقط جاهای خالی را پر می‌کنند.
 * جز شماره تلفن: قاعده‌ها فقط شمارهٔ کامل و درست برمی‌گردانند و رقم‌ها را جابه‌جا یا جمع نمی‌کنند، ولی مدل گاهی می‌کند.
 */
export function mergeDrafts<F extends VoiceForm>(form: F, primary: VoiceDraft<F>, backup: VoiceDraft<F>): VoiceDraft<F> {
  const out = { ...primary } as Record<string, unknown>;
  for (const [k, v] of Object.entries(backup)) if (out[k] === undefined || k === 'phone' || k === 'ownerPhone') out[k] = v;
  return cleanVoiceDraft(form, out);
}
