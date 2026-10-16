import type { GeoPoint } from '@kelid/core';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * سرویس نقشه پشت یک رابط؛ امروز «نشان»، و اگر روزی عوض شد (مثلاً Map.ir) فقط همین فایل عوض می‌شود.
 * کلید نقشه فقط نمایش کاشی‌هاست و در پنل نشان به دامنهٔ ما محدود می‌شود؛ کلید سرویس جدا است (جستجو و نشانی).
 */
const MAP_KEY = (import.meta.env.VITE_NESHAN_MAP_KEY as string | undefined) || '';
const API_KEY = (import.meta.env.VITE_NESHAN_API_KEY as string | undefined) || '';
const API = 'https://api.neshan.org';
const STYLES = 'https://static.neshan.org/sdk/maplibre/styles';

/** نقشه بدون کلید ساخته نمی‌شود؛ صفحه‌ها آن موقع همان فرم ساده را نشان می‌دهند. */
export const mapKey = MAP_KEY;
export const mapEnabled = MAP_KEY !== '';
/** `demo`: نقشهٔ خالی بی‌اینترنت، فقط برای دیدن صفحه‌ها در محیط توسعه و تست. */
const DEMO = MAP_KEY === 'demo';

export function mapStyle(dark: boolean): string | StyleSpecification {
  if (DEMO) return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#1b1e1c' : '#ecebe6' } }] };
  return `${STYLES}/${dark ? 'dark' : 'light'}.json`;
}

/** میدان ونک؛ وقتی هنوز نقطه‌ای نداریم نقشه از وسط تهران شروع می‌شود. */
export const DEFAULT_CENTER: GeoPoint = { lat: 35.7575, lng: 51.4098 };

export type Place = { neighborhood: string; street: string; address: string };
export type SearchHit = { title: string; detail: string; point: GeoPoint };

// «محله سعادت آباد» → «سعادت آباد»؛ فیلد محله در فرم خودش برچسب دارد.
const cleanHood = (s: unknown) => (typeof s === 'string' ? s.replace(/^محله\s+/, '').trim() : '');
const str = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

async function call(path: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  if (!API_KEY || !navigator.onLine) return null;
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'Api-Key': API_KEY }, signal });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// هر نقطه یک بار پرسیده می‌شود؛ جابه‌جا کردن نقشه و برگشتن به همان جا سهمیهٔ سرویس را خرج نمی‌کند.
const reverseCache = new Map<string, Place>();

/** محله و خیابان این نقطه؛ بی‌اینترنت یا بی‌کلید `null`. */
export async function reverse(p: GeoPoint, signal?: AbortSignal): Promise<Place | null> {
  const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const hit = reverseCache.get(k);
  if (hit) return hit;
  const r = await call(`/v5/reverse?lat=${p.lat}&lng=${p.lng}`, signal);
  if (!r || r.status !== 'OK') return null;
  const place = { neighborhood: cleanHood(r.neighbourhood), street: str(r.route_name), address: str(r.formatted_address) };
  reverseCache.set(k, place);
  return place;
}

/** جستجوی جا و نشانی، نزدیک‌ترها اول. */
export async function search(term: string, near: GeoPoint, signal?: AbortSignal): Promise<SearchHit[]> {
  const r = await call(`/v1/search?term=${encodeURIComponent(term)}&lat=${near.lat}&lng=${near.lng}`, signal);
  const items = Array.isArray(r?.items) ? (r.items as Array<Record<string, unknown>>) : [];
  return items.slice(0, 8).flatMap((it) => {
    const loc = it.location as { x?: unknown; y?: unknown } | undefined;
    if (typeof loc?.x !== 'number' || typeof loc.y !== 'number') return [];
    return [{ title: str(it.title), detail: str(it.address) || str(it.region), point: { lat: loc.y, lng: loc.x } }];
  });
}
