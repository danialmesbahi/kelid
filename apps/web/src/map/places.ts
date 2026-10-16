import { distanceMeters, normalizeForSearch, type GeoPoint } from '@kelid/core';
import type { KMap } from './MapView';
import { SOURCE } from './style';
import type { Place, SearchHit } from './provider';

/**
 * محله و خیابان از خود دادهٔ نقشه (OpenStreetMap) خوانده می‌شود، نه از یک سرویس بیرونی؛
 * پس بی‌اینترنت و روی نت ملی هم کار می‌کند. فقط کاشی‌هایی که الان باز شده‌اند دیده می‌شوند، که برای دور و بر سنجاق کافی است.
 */
type Props = Record<string, unknown>;
type Feat = { properties: Props; geometry: { type: string; coordinates: unknown } };

const nameOf = (p: Props) => {
  const n = p['name:fa'] ?? p.name;
  return typeof n === 'string' ? n.trim() : '';
};
const HOOD_KINDS = new Set(['neighbourhood', 'macrohood', 'suburb', 'quarter']);

/** همهٔ نقطه‌های یک هندسه، برای فاصلهٔ تقریبی تا خط یا چندضلعی. */
function points(g: Feat['geometry']): GeoPoint[] {
  const out: GeoPoint[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') out.push({ lng: c[0], lat: c[1] });
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(g.coordinates);
  return out;
}

/** فاصلهٔ نقطه تا یک خط (متر)؛ پاره‌خط‌به‌پاره‌خط، روی صفحهٔ تخت محلی که برای چند صد متر دقیق است. */
function toLine(p: GeoPoint, line: GeoPoint[]): number {
  if (line.length === 1) return distanceMeters(p, line[0]!);
  const k = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const ax = (a.lng - p.lng) * k,
      ay = a.lat - p.lat,
      bx = (b.lng - p.lng) * k,
      by = b.lat - p.lat;
    const dx = bx - ax,
      dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    const x = ax + t * dx,
      y = ay + t * dy;
    best = Math.min(best, Math.hypot(x, y) * 111_320);
  }
  return best;
}

function sourceFeatures(map: KMap, layer: string): Feat[] {
  try {
    return map.querySourceFeatures(SOURCE, { sourceLayer: layer }) as unknown as Feat[];
  } catch {
    return [];
  }
}

/** محله و خیابانِ این نقطه از دادهٔ خود نقشه؛ اگر چیزی نزدیک نبود `null`. */
export function placeAt(map: KMap, p: GeoPoint): Place | null {
  let hood = '';
  let hoodD = 2500;
  for (const f of sourceFeatures(map, 'places')) {
    const n = nameOf(f.properties);
    if (!n || !HOOD_KINDS.has(String(f.properties.kind))) continue;
    const pt = points(f.geometry)[0];
    if (!pt) continue;
    const d = distanceMeters(p, pt);
    if (d < hoodD) {
      hood = n;
      hoodD = d;
    }
  }
  let street = '';
  let streetD = 90;
  for (const f of sourceFeatures(map, 'roads')) {
    const n = nameOf(f.properties);
    if (!n) continue;
    const d = toLine(p, points(f.geometry));
    if (d < streetD) {
      street = n;
      streetD = d;
    }
  }
  if (!hood && !street) return null;
  return { neighborhood: hood, street, address: [hood, street].filter(Boolean).join('، ') };
}

const KIND_LABEL: Record<string, string> = { places: 'محله', roads: 'خیابان', pois: 'مکان' };

/** جستجوی نام محله، خیابان یا مکان در همان بخشی از نقشه که باز است؛ نزدیک‌ترها اول. */
export function searchPlaces(map: KMap, term: string, near: GeoPoint): SearchHit[] {
  const q = normalizeForSearch(term);
  if (!q) return [];
  const seen = new Map<string, SearchHit & { d: number; starts: boolean }>();
  for (const layer of ['places', 'roads', 'pois']) {
    for (const f of sourceFeatures(map, layer)) {
      const n = nameOf(f.properties);
      const norm = normalizeForSearch(n);
      if (!n || !norm.includes(q)) continue;
      const pts = points(f.geometry);
      const pt = pts[Math.floor(pts.length / 2)];
      if (!pt) continue;
      const d = distanceMeters(near, pt);
      const key = `${layer}:${norm}`;
      const old = seen.get(key);
      if (!old || d < old.d) seen.set(key, { title: n, detail: KIND_LABEL[layer] ?? '', point: pt, d, starts: norm.startsWith(q) });
    }
  }
  return [...seen.values()]
    .sort((a, b) => Number(b.starts) - Number(a.starts) || a.d - b.d)
    .slice(0, 8)
    .map(({ title, detail, point }) => ({ title, detail, point }));
}
