import { toEnDigits } from './persian';

// مبلغ گفته‌شده به فارسی → عدد تومان، بدون مدل زبانی.
// مدل‌ها در حساب «هشت و نیم میلیارد» یا «دو میلیارد و سیصد» زیاد اشتباه می‌کنند؛
// این‌جا قطعی حساب می‌شود و عدد کنار همان عبارت در متن می‌آید تا مدل فقط آن را بردارد.

const SMALL: Record<string, number> = {
  صفر: 0, یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16,
  هفده: 17, هیفده: 17, هجده: 18, هیجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, پونصد: 500,
  ششصد: 600, شیشصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};

const SCALES: Array<[string, number]> = [
  ['میلیارد', 1e9], ['ملیارد', 1e9], ['میلیون', 1e6], ['ملیون', 1e6], ['هزار', 1e3], ['تومن', 1], ['تومان', 1], ['ریال', 0.1],
];

export interface SpokenAmount {
  /** تومان */
  value: number;
  /** جای عبارت در متن اصلی */
  start: number;
  end: number;
}

const TOKEN = /[0-9۰-۹٠-٩]+(?:[.,/٫٬][0-9۰-۹٠-٩]+)*|[^\s0-9۰-۹٠-٩.,،؛:!?؟()«»"'-]+/g;

/** «۸٫۵» و «8,500,000» و «۸/۵» → عدد؛ ویرگول هزارگان است، نقطه و ممیز اعشار (مگر چند بار آمده باشد). */
function digitValue(raw: string): number {
  const s = toEnDigits(raw).replace(/٬/g, ',');
  if (/,/.test(s)) return Number(s.replace(/[,]/g, '').replace(/[٫/]/g, '.'));
  if ((s.match(/[.٫/]/g) ?? []).length > 1) return Number(s.replace(/[.٫/]/g, ''));
  return Number(s.replace(/[٫/]/g, '.'));
}

/** «صدوبیست» یا «دویست‌و‌پنجاه» که سرهم نوشته شده. */
function wordValue(w: string): number | undefined {
  const t = w.replace(/‌/g, '');
  if (t in SMALL) return SMALL[t];
  const parts = t.split('و').filter(Boolean);
  if (parts.length > 1 && parts.every((p) => p in SMALL)) return parts.reduce((a, p) => a + SMALL[p]!, 0);
  return undefined;
}

function scaleOf(w: string): number | undefined {
  const t = w.replace(/‌/g, '');
  // «میلیاردی» و «تومنی» هم حساب است.
  return SCALES.find(([k]) => t === k || t === `${k}ی` || t === `${k}ه`)?.[1];
}

export interface SpokenNumber extends SpokenAmount {
  /** میلیون/میلیارد یا تومان/ریال داشت، یا خودش دست‌کم یک میلیون است */
  money: boolean;
}

/** همهٔ عددهای متن، چه با رقم چه با حروف («صد و بیست»، «۱۲۰»، «سی و دو میلیارد»). */
export function spokenNumbers(text: string): SpokenNumber[] {
  const toks = [...text.matchAll(TOKEN)].map((m) => ({ s: m[0], start: m.index, end: m.index + m[0].length }));
  const out: SpokenNumber[] = [];
  let i = 0;
  while (i < toks.length) {
    let total = 0;
    let current = 0;
    let last = 0; // کوچک‌ترین مرتبه‌ای که تا این‌جا آمده (۰ = هنوز هیچ)
    let money = false;
    let rial = false;
    let first = -1; // اولین واژهٔ عبارت
    let end = -1; // آخرین واژه‌ای که در مبلغ حساب شد
    let scaleEnd = -1; // آخرین واژهٔ مرتبه (میلیارد، میلیون…)
    let afterAnd = false;
    for (let j = i; j < toks.length; j++) {
      const tk = toks[j]!;
      if (j > i && text.slice(toks[j - 1]!.end, tk.start).trim()) break; // نشانه‌گذاری عبارت را تمام می‌کند
      const w = tk.s;
      const num = /^[0-9۰-۹٠-٩]/.test(w) ? digitValue(w) : wordValue(w);
      if (num !== undefined && Number.isFinite(num)) {
        // «طبقه سه دو خوابه» یا «نه سه میلیارد»: دو عدد پشت هم بی «و» دو عبارت‌اند، نه جمع.
        if (current && !afterAnd && current % 10 !== 0 && !total) break;
        if (first < 0) first = j;
        current += num;
        end = j;
        afterAnd = false;
        continue;
      }
      if (first < 0) break;
      if (w === 'و') {
        afterAnd = true;
        continue;
      }
      if (w === 'نیم') {
        if (current) current += 0.5;
        else if (last) total += last / 2;
        else break;
        end = scaleEnd = j;
        afterAnd = false;
        continue;
      }
      const scale = scaleOf(w);
      if (scale === undefined) break;
      end = scaleEnd = j;
      afterAnd = false;
      if (scale === 1) money = true;
      else if (scale === 0.1) money = rial = true;
      else {
        total += (current || 1) * scale;
        current = 0;
        last = scale;
      }
    }
    if (first < 0) {
      i++;
      continue;
    }
    if (current && total && last >= 1e6) {
      // «دو میلیارد و سیصد» یعنی دو میلیارد و سیصد میلیون؛ ولی در «سه میلیارد و دو خوابه» «دو» جزو مبلغ نیست.
      if (current >= 50 && current < 1000) total += current * (last / 1000);
      else end = scaleEnd;
    } else total += current;
    if (rial) total /= 10;
    const isMoney = total > 0 && (money || last >= 1e6 || total >= 1e6);
    out.push({ value: isMoney ? Math.round(total) : total, start: toks[first]!.start, end: toks[end]!.end, money: isMoney });
    i = Math.max(end, i) + 1;
  }
  return out;
}

/** فقط مبلغ‌های پولی متن. */
export function spokenAmounts(text: string): SpokenAmount[] {
  return spokenNumbers(text)
    .filter((n) => n.money)
    .map(({ value, start, end }) => ({ value, start, end }));
}

/** متن برای مدل: کنار هر مبلغ عدد دقیقش به تومان، مثلاً «هشت و نیم میلیارد [= 8500000000 تومان]». */
export function annotateAmounts(text: string): string {
  let out = '';
  let at = 0;
  for (const a of spokenAmounts(text)) {
    out += `${text.slice(at, a.end)} [= ${a.value} تومان]`;
    at = a.end;
  }
  return out + text.slice(at);
}
