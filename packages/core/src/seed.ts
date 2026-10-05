import type { Client, Deal, Listing, Todo, Visit } from './model';
import { addDays } from './jalali';

/** دادهٔ نمونه برای توسعه و نمایش؛ در نسخهٔ واقعی دیتابیس خالی شروع می‌شود. */

const M = 1_000_000;
const B = 1_000_000_000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** تاریخ امروز به وقت تهران (yyyy-mm-dd). */
export function tehranToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(now);
}

function at(hhmm: string, dayOffset = 0): string {
  const base = new Date(`${tehranToday()}T12:00:00+03:30`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(base);
  return new Date(`${day}T${hhmm}:00+03:30`).toISOString();
}

type L = Partial<Listing> & Pick<Listing, 'plaque' | 'deal' | 'neighborhood' | 'street' | 'area' | 'bedrooms' | 'price' | 'cover'>;

function listing(id: string, l: L, ageDays: number): Listing {
  return {
    id,
    status: 'active',
    kind: 'apartment',
    features: [],
    negotiable: true,
    owner: { name: 'مالک نمونه', phone: '09120000000' },
    photoCount: 12,
    createdAt: daysAgo(ageDays),
    updatedAt: daysAgo(Math.max(0, ageDays - 1)),
    ...l,
  };
}

export const seedListings: Listing[] = [
  listing('l-027', { plaque: 27, deal: 'sale', neighborhood: 'سعادت‌آباد', street: 'سرو غربی', area: 120, bedrooms: 2, floor: 4, floorsTotal: 6, yearBuilt: 1403, price: { total: 28 * B }, cover: 'f', features: ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی'] }, 3),
  listing('l-052', { plaque: 52, deal: 'sale', neighborhood: 'ونک', street: 'ملاصدرا', area: 105, bedrooms: 2, floor: 8, floorsTotal: 12, yearBuilt: 1401, price: { total: 24 * B }, cover: 'i', features: ['پارکینگ', 'آسانسور', 'استخر', 'نگهبان'] }, 0),
  listing('l-031', { plaque: 31, deal: 'rent', status: 'negotiating', neighborhood: 'پونک', street: 'بلوار عدل', area: 85, bedrooms: 2, floor: 2, floorsTotal: 5, yearBuilt: 1398, price: { deposit: 800 * M, monthlyRent: 22 * M }, cover: 'g', features: ['پارکینگ', 'آسانسور', 'انباری'] }, 9),
  listing('l-014', { plaque: 14, deal: 'sale', status: 'reserved', neighborhood: 'شهرک غرب', street: 'فلامک', area: 155, bedrooms: 3, floor: 7, floorsTotal: 10, yearBuilt: 1400, price: { total: 41 * B }, cover: 'j', features: ['دو پارکینگ', 'استخر', 'ویو ابدی'] }, 20),
  listing('l-042', { plaque: 42, deal: 'full', neighborhood: 'تهرانپارس', street: 'فلکهٔ دوم', area: 70, bedrooms: 1, floor: 3, floorsTotal: 4, yearBuilt: 1395, price: { deposit: 2.2 * B }, cover: 'g', features: ['انباری', 'بالکن'] }, 6),
  listing('l-036', { plaque: 36, deal: 'rent', neighborhood: 'ونک', street: 'شیخ بهایی', area: 110, bedrooms: 2, floor: 5, floorsTotal: 8, yearBuilt: 1401, price: { deposit: 1.5 * B, monthlyRent: 35 * M }, cover: 'f', features: ['پارکینگ', 'آسانسور', 'لابی'] }, 62),
  listing('l-051', { plaque: 51, deal: 'sale', neighborhood: 'یوسف‌آباد', street: 'خیابان ۳۳', area: 95, bedrooms: 2, floor: 1, floorsTotal: 5, yearBuilt: 1399, price: { total: 19 * B }, cover: 'i', features: ['حیاط مشاع', 'انباری'] }, 1),
  listing('l-048', { plaque: 48, deal: 'full', status: 'closed', neighborhood: 'جنت‌آباد', street: 'مرکزی', area: 65, bedrooms: 1, floor: 2, floorsTotal: 4, yearBuilt: 1397, price: { deposit: 1.6 * B }, cover: 'f', features: ['پارکینگ'] }, 12),
  listing('l-033', { plaque: 33, deal: 'rent', neighborhood: 'سعادت‌آباد', street: 'علامه', area: 130, bedrooms: 3, floor: 6, floorsTotal: 9, yearBuilt: 1402, price: { deposit: 2 * B, monthlyRent: 40 * M }, cover: 'g', features: ['پارکینگ', 'آسانسور', 'روف گاردن'] }, 15),
  listing('l-050', { plaque: 50, deal: 'rent', neighborhood: 'پونک', street: 'حصارک', area: 80, bedrooms: 2, floor: 3, floorsTotal: 5, yearBuilt: 1396, price: { deposit: 900 * M, monthlyRent: 20 * M }, cover: 'g', photoCount: 0, features: ['پارکینگ'] }, 2),
];

export const seedClients: Client[] = [
  { id: 'c-1', name: 'آقای کریمی', phone: '09120000001', temperature: 'hot', waitingForNews: true, lastContactAt: daysAgo(0), createdAt: daysAgo(10), need: { deal: 'sale', kinds: ['apartment'], neighborhoods: ['سعادت‌آباد', 'ونک', 'یوسف‌آباد'], areaMin: 90, areaMax: 130, bedroomsMin: 2, budgetMax: 30 * B } },
  { id: 'c-2', name: 'خانم احمدی', phone: '09120000002', temperature: 'warm', waitingForNews: false, lastContactAt: daysAgo(1), createdAt: daysAgo(18), need: { deal: 'rent', kinds: ['apartment'], neighborhoods: ['پونک', 'شهران'], areaMin: 70, areaMax: 90, bedroomsMin: 2, budgetMax: 1 * B } },
  { id: 'c-3', name: 'آقای نوری', phone: '09120000003', temperature: 'warm', waitingForNews: false, lastContactAt: daysAgo(3), createdAt: daysAgo(28), need: { deal: 'sale', kinds: ['apartment'], neighborhoods: ['شهرک غرب'], areaMin: 140, areaMax: 180, bedroomsMin: 3, budgetMax: 45 * B } },
  { id: 'c-4', name: 'خانوادهٔ صالحی', phone: '09120000004', temperature: 'hot', waitingForNews: true, lastContactAt: daysAgo(0), createdAt: daysAgo(7), need: { deal: 'full', kinds: ['apartment'], neighborhoods: ['تهرانپارس', 'نارمک'], areaMin: 60, areaMax: 80, bedroomsMin: 1, budgetMax: 2.5 * B } },
  { id: 'c-5', name: 'خانم موسوی', phone: '09120000005', temperature: 'cold', waitingForNews: false, lastContactAt: daysAgo(14), createdAt: daysAgo(60), need: { deal: 'sale', kinds: ['apartment'], neighborhoods: ['سعادت‌آباد', 'شهرک غرب'], areaMin: 90, areaMax: 110, bedroomsMin: 2, budgetMax: 26 * B } },
  { id: 'c-6', name: 'آقای رحیمی', phone: '09120000006', temperature: 'warm', waitingForNews: false, lastContactAt: daysAgo(4), createdAt: daysAgo(11), need: { deal: 'rent', kinds: ['apartment'], neighborhoods: ['ونک', 'جردن'], areaMin: 100, areaMax: 130, bedroomsMin: 2, budgetMax: 2 * B } },
];

export const seedVisits: Visit[] = [
  { id: 'v-1', kind: 'call', title: 'تماس با خانم احمدی', startsAt: at('09:30'), endsAt: at('10:00'), clientId: 'c-2', listingId: 'l-031', done: true },
  { id: 'v-2', kind: 'visit', title: 'بازدید با آقای کریمی', startsAt: at('10:30'), endsAt: at('11:30'), clientId: 'c-1', listingId: 'l-027', done: false },
  { id: 'v-3', kind: 'visit', title: 'بازدید با آقای نوری', startsAt: at('16:00'), endsAt: at('17:00'), clientId: 'c-3', listingId: 'l-014', done: false },
  { id: 'v-4', kind: 'visit', title: 'بازدید با خانوادهٔ صالحی', startsAt: at('18:30'), endsAt: at('19:30'), clientId: 'c-4', listingId: 'l-042', done: false },
  { id: 'v-5', kind: 'signing', title: 'امضای قرارداد اجاره', startsAt: at('10:00', 1), endsAt: at('11:15', 1), clientId: 'c-2', listingId: 'l-031', done: false },
];

export const seedTodos: Todo[] = [
  { id: 't-1', title: 'به آقای کریمی خبر بده', detail: 'فایل ۰۵۱ با بودجه و محلهٔ او جور است', action: 'sms', done: true },
  { id: 't-2', title: 'قیمت ۰۳۶ را از مالک بپرس', detail: '۶۲ روز از آخرین تماس گذشته', action: 'call', done: false },
  { id: 't-3', title: 'برای فایل ۰۵۰ عکس بگیر', detail: 'فایل بی‌عکس کمتر دیده می‌شود', action: 'camera', done: false },
  { id: 't-4', title: 'اجاره‌نامهٔ ۰۱۹ رو به پایان است', detail: '۱۲ روز دیگر · فرصت فایل تازه', action: 'call', done: false },
];

const dayIn = (n: number) => addDays(tehranToday(), n);

export const seedDeals: Deal[] = [
  { id: 'd-1', listingId: 'l-031', clientId: 'c-2', stage: 'deposit', price: 800 * M, rent: 22 * M, commissionBuyer: 11.5 * M, commissionSeller: 11.5 * M, checklist: ['ids', 'deed', 'payment'], dueDay: dayIn(1), notes: 'مستأجر تا آخر ماه تحویل می‌خواهد.', createdAt: daysAgo(6), updatedAt: daysAgo(1) },
  { id: 'd-2', listingId: 'l-014', clientId: 'c-3', stage: 'talking', price: 40 * B, commissionBuyer: 200 * M, commissionSeller: 200 * M, checklist: [], notes: 'خریدار ۴۰ پیشنهاد داده؛ مالک روی ۴۱ است.', createdAt: daysAgo(3), updatedAt: daysAgo(0) },
  { id: 'd-3', listingId: 'l-042', clientId: 'c-4', stage: 'signed', price: 2.2 * B, commissionBuyer: 16.5 * M, commissionSeller: 16.5 * M, checklist: ['ids', 'deed', 'contract', 'payment'], dueDay: dayIn(4), createdAt: daysAgo(12), updatedAt: daysAgo(2) },
  { id: 'd-4', listingId: 'l-048', clientId: 'c-6', stage: 'done', price: 1.6 * B, commissionBuyer: 12 * M, commissionSeller: 12 * M, checklist: ['ids', 'deed', 'contract', 'payment', 'bills', 'handover'], closedAt: daysAgo(2), createdAt: daysAgo(20), updatedAt: daysAgo(2) },
];

export const seed = { listings: seedListings, clients: seedClients, visits: seedVisits, todos: seedTodos, deals: seedDeals };
