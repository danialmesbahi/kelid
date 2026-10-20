import { normalizeForSearch } from '@kelid/core';

// محله‌ها و خیابان‌های هر شهر از نقشهٔ باز (OpenStreetMap از راه Overture)، ساختهٔ scripts/places/build.py.
// هر شهر فایل جدای خودش را دارد و فقط وقتی بار می‌شود که لازم است؛ نه به سرور سر می‌زند نه برنامه را سنگین می‌کند.

type RawCity = { n: string; p: string; z: Array<[string, number[]]>; h: string[]; s: Array<[string, ...number[]]> };
type RawIndex = Array<[key: string, name: string, province: string, dup: 0 | 1]>;

export type CityRef = { key: string; name: string; province: string; label: string };
export type Zone = { name: string; hoods: number[] };
export type Street = { name: string; hoods: number[] };
export type CityPlaces = {
  name: string;
  province: string;
  zones: Zone[];
  hoods: string[];
  streets: Street[];
  /** زون هر محله (-1 = بی‌زون) و خیابان‌های هر محله؛ یک بار ساخته می‌شوند تا تایپ کند نشود. */
  zoneOf: number[];
  streetsOf: number[][];
  hoodIndex: Indexed[];
  streetIndex: Indexed[];
};

/** نام آمادهٔ جستجو؛ normalizeForSearch روی هزاران نام در هر حرف تایپ، فرم را کند می‌کرد. */
export type Indexed = { norm: string; bare: string; words: string[] };

const files = import.meta.glob<RawCity>('./data/*.json', { import: 'default' });

let index: Promise<CityRef[]> | null = null;

/** فهرست همهٔ شهرها، پرجمعیت‌ها اول. */
export function loadCities(): Promise<CityRef[]> {
  index ??= import('./cities.json').then((m) =>
    (m.default as unknown as RawIndex).map(([key, name, province, dup]) => ({ key, name, province, label: dup ? `${name} (${province})` : name })),
  );
  return index;
}

const cache = new Map<string, Promise<CityPlaces | null>>();

/** دادهٔ یک شهر با همان نامی که دفتر انتخاب کرده؛ شهری که داده ندارد null. */
export function loadCity(label: string): Promise<CityPlaces | null> {
  const want = normalizeForSearch(label);
  if (!want) return Promise.resolve(null);
  let p = cache.get(want);
  if (!p) {
    p = loadCities().then(async (all) => {
      const ref = all.find((c) => normalizeForSearch(c.label) === want) ?? all.find((c) => normalizeForSearch(c.name) === want);
      const load = ref && files[`./data/${ref.key}.json`];
      if (!load) return null;
      const r = await load();
      const zoneOf = r.h.map(() => -1);
      r.z.forEach(([, hoods], z) => hoods.forEach((h) => (zoneOf[h] = z)));
      const streetsOf: number[][] = r.h.map(() => []);
      r.s.forEach(([, ...hoods], i) => hoods.forEach((h) => streetsOf[h]?.push(i)));
      return {
        name: r.n,
        province: r.p,
        zones: r.z.map(([name, hoods]) => ({ name, hoods })),
        hoods: r.h,
        streets: r.s.map(([name, ...hoods]) => ({ name, hoods })),
        zoneOf,
        streetsOf,
        hoodIndex: r.h.map(indexed),
        streetIndex: r.s.map(([name]) => indexed(name)),
      };
    });
    // بار نشد (مثلاً فایل در به‌روزرسانی عوض شد): دفعهٔ بعد دوباره امتحان شود.
    p.catch(() => cache.delete(want));
    cache.set(want, p);
  }
  return p;
}

/** نام با بخش جورشده، برای پررنگ کردن همان تکه در فهرست. */
export type Hit = { text: string; at: number; len: number; score: number };

// «خیابان»، «بلوار»… جلوی نام؛ «معلم» باید «خیابان معلم» را هم از اول پیدا کند.
const KIND = /^(خیابان|بلوار|بزرگراه|کوچه|میدان|کوی|جاده|بن‌بست|بن بست|کنارگذر|اتوبان|شهرک|مجتمع مسکونی|مجتمع|شهید) /;

/** جای تکهٔ جورشده در متن اصلی؛ normalizeForSearch فاصله و نیم‌فاصله را حذف می‌کند، پس نویسه‌به‌نویسه نگاشت می‌شود. */
function locate(text: string, q: string): { at: number; len: number } | null {
  let norm = '';
  const from: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = normalizeForSearch(text[i]!);
    for (const ch of n) {
      norm += ch;
      from.push(i);
    }
  }
  const k = norm.indexOf(q);
  if (k < 0) return null;
  const start = from[k]!;
  const end = from[k + q.length - 1]! + 1;
  return { at: start, len: end - start };
}

/** جستجوی سریع: هم‌نام، شروع نام، شروع یک کلمه، بعد هر جای نام. */
export function match(text: string, query: string): Hit | null {
  const q = normalizeForSearch(query);
  if (!q) return { text, at: 0, len: 0, score: 4 };
  const pos = locate(text, q);
  if (!pos) return null;
  const n = normalizeForSearch(text);
  const bare = normalizeForSearch(text.replace(KIND, ''));
  const score = n === q || bare === q ? 0 : n.startsWith(q) || bare.startsWith(q) ? 1 : pos.at === 0 || /[\s‌]/.test(text[pos.at - 1] ?? '') ? 2 : 3;
  return { text, ...pos, score };
}

export function indexed(name: string): Indexed {
  return { norm: normalizeForSearch(name), bare: normalizeForSearch(name.replace(KIND, '')), words: name.split(/[\s‌]+/).map(normalizeForSearch) };
}

function scoreOf(x: Indexed, q: string): number {
  if (x.norm === q || x.bare === q) return 0;
  if (x.norm.startsWith(q) || x.bare.startsWith(q)) return 1;
  if (!x.norm.includes(q)) return -1;
  return x.words.some((w) => w.startsWith(q)) ? 2 : 3;
}

/**
 * شمارهٔ بهترین نام‌ها برای جستجو؛ با امتیاز برابر ترتیب اصلی (اهمیت) می‌ماند.
 * pool: فقط همین شماره‌ها (مثلاً محله‌های یک زون)، به همین ترتیب.
 */
export function rank(index: Indexed[], query: string, limit: number, pool?: number[]): number[] {
  const q = normalizeForSearch(query);
  const ids = pool ?? index.map((_, i) => i);
  if (!q) return ids.slice(0, limit);
  const buckets: number[][] = [[], [], [], []];
  for (const i of ids) {
    const x = index[i];
    const sc = x ? scoreOf(x, q) : -1;
    if (sc >= 0) buckets[sc]!.push(i);
  }
  return buckets.flat().slice(0, limit);
}

/** «بلوار خلیج فارس» → نوع «بلوار» جدا، برای برچسب کوچک کنار نام. */
export function streetKind(name: string): { kind: string; rest: string } {
  const m = KIND.exec(name);
  return m && m[1] !== 'شهید' ? { kind: m[1]!, rest: name.slice(m[0].length) } : { kind: '', rest: name };
}
