import type { GeoPoint, Listing } from './model';

/** فاصلهٔ دو نقطه روی زمین به متر (هاورسین). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * محله و خیابانِ نزدیک‌ترین فایلِ دفتر به این نقطه؛ وقتی اینترنت نیست و نقشه نمی‌تواند نشانی را بگوید،
 * فایل‌های خود دفتر بهترین حدس‌اند. دورتر از `maxMeters` حدسی نمی‌زند.
 */
export function nearestPlace(listings: readonly Listing[], p: GeoPoint, maxMeters = 600): { neighborhood: string; street: string } | undefined {
  let best: Listing | undefined;
  let bestD = maxMeters;
  for (const l of listings) {
    if (!l.location || !l.neighborhood) continue;
    const d = distanceMeters(l.location, p);
    if (d <= bestD) {
      best = l;
      bestD = d;
    }
  }
  if (!best) return undefined;
  // خیابان فقط وقتی همان حوالی است به درد می‌خورد
  return { neighborhood: best.neighborhood, street: bestD < 120 ? best.street : '' };
}
