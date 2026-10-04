/** نوع معامله؛ رنگ پلاک فایل از همین می‌آید. */
export type DealType = 'sale' | 'rent' | 'full';

export type ListingStatus = 'active' | 'reserved' | 'negotiating' | 'closed' | 'archived';

export type PropertyKind = 'apartment' | 'villa' | 'shop' | 'office' | 'land';

/** قیمت‌ها همیشه به تومان و به‌صورت عدد صحیح ذخیره می‌شوند. */
export interface Price {
  /** فروش: قیمت کل */
  total?: number;
  /** رهن و اجاره یا رهن کامل */
  deposit?: number;
  /** رهن و اجاره */
  monthlyRent?: number;
}

/** یک «فایل» ملک. */
export interface Listing {
  id: string;
  /** شمارهٔ پلاک که سرور می‌دهد؛ تا اولین همگام‌سازی خالی است. */
  plaque: number | null;
  deal: DealType;
  status: ListingStatus;
  kind: PropertyKind;
  neighborhood: string;
  street: string;
  /** نشانی کامل؛ فقط برای دفتر. */
  address?: string;
  area: number;
  bedrooms: number;
  floor?: number;
  floorsTotal?: number;
  yearBuilt?: number;
  features: string[];
  price: Price;
  negotiable: boolean;
  description?: string;
  owner: { name: string; phone: string; bestTime?: string };
  /** شناسهٔ تصویرسازی جای عکس تا وقتی عکس واقعی نیامده. */
  cover: 'f' | 'g' | 'i' | 'j';
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

/** عکس یک فایل؛ عکس اول (کمترین ord) کاور فایل است. خود بایت‌ها جدا خوانده می‌شوند. */
export interface Photo {
  id: string;
  listingId: string;
  ord: number;
  mime: string;
  width: number;
  height: number;
  createdAt: string;
}

export type ClientTemperature = 'hot' | 'warm' | 'cold';

export interface ClientNeed {
  deal: DealType;
  kinds: PropertyKind[];
  neighborhoods: string[];
  areaMin?: number;
  areaMax?: number;
  bedroomsMin?: number;
  budgetMax?: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  need: ClientNeed;
  temperature: ClientTemperature;
  waitingForNews: boolean;
  lastContactAt: string;
  createdAt: string;
}

export type VisitKind = 'visit' | 'call' | 'signing' | 'task';

export interface Visit {
  id: string;
  kind: VisitKind;
  title: string;
  startsAt: string;
  endsAt: string;
  listingId?: string;
  clientId?: string;
  done: boolean;
}

export interface Todo {
  id: string;
  title: string;
  detail: string;
  /** دکمهٔ میانبر کنار کار؛ کارهایی که خود مشاور می‌نویسد معمولاً ندارند. */
  action?: 'sms' | 'call' | 'camera';
  done: boolean;
}
