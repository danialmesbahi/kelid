import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Skeleton } from '@kelid/ui';
import { nearestPlace, normalizeForSearch, type GeoPoint } from '@kelid/core';
import { useQuery } from '../data';
import { filesQuery } from '../queries';
import { MapView, type KMap } from './MapView';
import { PinShape } from './Pin';
import { DEFAULT_CENTER, type Place, type SearchHit } from './provider';
import { placeAt, searchPlaces } from './places';

export type Picked = { point: GeoPoint; place: Place | null };

type Props = {
  /** `home`: جای دقیق یک ملک. `hood`: فقط محله، برای خواستهٔ مشتری. */
  mode: 'home' | 'hood';
  value?: GeoPoint;
  onPick: (r: Picked) => void;
  onClose: () => void;
};

const VIEW_KEY = 'kelid.map.view';
/** آخرین جایی که نقشه دیده شد؛ دفتر معمولاً در همان چند محله کار می‌کند. */
function lastView(): { center: GeoPoint; zoom: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as { center?: GeoPoint; zoom?: number } | null;
    return v?.center && typeof v.zoom === 'number' ? { center: v.center, zoom: v.zoom } : null;
  } catch {
    return null;
  }
}
function saveView(map: KMap) {
  try {
    const c = map.getCenter();
    localStorage.setItem(VIEW_KEY, JSON.stringify({ center: { lat: c.lat, lng: c.lng }, zoom: map.getZoom() }));
  } catch {
    /* حالت خصوصی مرورگر */
  }
}

/** زیر این بزرگ‌نمایی، سنجاق روی چند خانه می‌افتد؛ اول نزدیک‌تر می‌رویم. */
const HOUSE_ZOOM = 15.5;

export function LocationPicker({ mode, value, onPick, onClose }: Props) {
  const files = useQuery(filesQuery.key, filesQuery.fn);
  const listings = useRef(files?.all ?? []);
  listings.current = files?.all ?? [];
  const mapRef = useRef<KMap>(null);
  const flying = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [point, setPoint] = useState<GeoPoint>();
  const [place, setPlace] = useState<Place | null>(null);
  const [guessed, setGuessed] = useState(false);
  const [looking, setLooking] = useState(true);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  const last = lastView();
  const start = useRef(
    value
      ? { center: value, zoom: 17 }
      : last
        ? { center: last.center, zoom: mode === 'hood' ? Math.min(last.zoom, 14) : Math.max(last.zoom, 14) }
        : { center: DEFAULT_CENTER, zoom: 12 },
  );

  const [zoom, setZoom] = useState(start.current.zoom);

  // نشانیِ نقطهٔ زیر سنجاق: از سرویس نقشه، و بی‌اینترنت از نزدیک‌ترین فایل خود دفتر.
  const lookup = useRef<{ timer?: number }>({});
  const look = useCallback((p: GeoPoint) => {
    const l = lookup.current;
    window.clearTimeout(l.timer);
    setLooking(true);
    // کاشی‌های تازه کمی بعد از ایستادن نقشه می‌رسند؛ کمی صبر می‌کنیم تا نام خیابان هم در آن‌ها باشد
    l.timer = window.setTimeout(() => {
      const map = mapRef.current;
      const r = map ? placeAt(map, p) : null;
      const guess = nearestPlace(listings.current, p);
      // محله‌ای که دفتر خودش برای فایل‌های همین حوالی نوشته، از نام رسمی نقشه آشناتر است
      const neighborhood = guess?.neighborhood || r?.neighborhood || '';
      setPlace(neighborhood || r?.street ? { neighborhood, street: r?.street || guess?.street || '', address: r?.address ?? '' } : null);
      setGuessed(!r && !!guess);
      setLooking(false);
    }, 450);
  }, []);

  const onMap = useCallback(
    (map: KMap) => {
      mapRef.current = map;
      let last: GeoPoint | undefined;
      const settle = () => {
        const c = map.getCenter();
        setMoving(false);
        setZoom(map.getZoom());
        // تغییر اندازهٔ پنجره هم «جابه‌جایی» حساب می‌شود؛ وقتی نقطه همان است دوباره نمی‌پرسیم (وگرنه حلقه می‌شود)
        if (last && Math.abs(last.lat - c.lat) < 1e-7 && Math.abs(last.lng - c.lng) < 1e-7) return;
        last = { lat: c.lat, lng: c.lng };
        setPoint(last);
        look(last);
      };
      // فقط وقتی کاربر یا جستجو نقشه را می‌برد سنجاق بلند می‌شود، نه با تغییر اندازهٔ پنجره
      const begin = (e: { originalEvent?: unknown }) => {
        if (!e.originalEvent && !flying.current) return;
        flying.current = false;
        setMoving(true);
        setTouched(true);
      };
      map.on('movestart', begin);
      map.on('moveend', settle);
      settle();
      return () => {
        saveView(map);
        window.clearTimeout(lookup.current.timer);
      };
    },
    [look],
  );

  // جستجو در دادهٔ خود نقشه و محله‌های فایل‌های دفتر؛ کمی بعد از آخرین حرف
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      const map = mapRef.current;
      const c = map?.getCenter();
      const near = c ? { lat: c.lat, lng: c.lng } : DEFAULT_CENTER;
      const nq = normalizeForSearch(term);
      const own = new Map<string, SearchHit>();
      for (const l of listings.current) {
        if (l.location && normalizeForSearch(l.neighborhood).includes(nq) && !own.has(l.neighborhood))
          own.set(l.neighborhood, { title: l.neighborhood, detail: 'از فایل‌های شما', point: l.location });
      }
      setHits([...own.values(), ...(map ? searchPlaces(map, term, near) : [])].slice(0, 8));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus();
  }, []);

  const go = (p: GeoPoint, z: number) => {
    flying.current = true;
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: z, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900, essential: true });
  };

  const pickHit = (h: SearchHit) => {
    setHits([]);
    setQ(h.title);
    go(h.point, mode === 'hood' ? 15 : 17);
  };

  // موقعیت گوشی؛ در نسخهٔ ویندوز معمولاً در دسترس نیست، پس دکمه‌اش آنجا نیست.
  const canLocate = !window.kelid && 'geolocation' in navigator;
  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (pos) => go({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    );

  const tooFar = mode === 'home' && zoom < HOUSE_ZOOM;
  const confirm = () => {
    if (!point) return;
    if (tooFar) {
      go(point, 17);
      return;
    }
    onPick({ point, place });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (hits.length) setHits([]);
    else onClose();
  };

  const hood = place?.neighborhood;
  const okLabel = tooFar ? 'نزدیک‌تر بروید' : mode === 'hood' ? 'افزودن این محله' : 'همین‌جاست';

  return createPortal(
    <div
      className="overlay lp-ov"
      onMouseDown={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-title"
        tabIndex={-1}
        className="lp pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="lp-title" className="visually-hidden">
          {mode === 'hood' ? 'انتخاب محله روی نقشه' : 'انتخاب جای ملک روی نقشه'}
        </h2>
        <MapView center={start.current.center} zoom={start.current.zoom} onMap={onMap} label="نقشه؛ نقشه را بکشید تا سنجاق روی جای درست بنشیند">
          <span className={`kpin ${moving ? 'up' : ''}`} aria-hidden="true">
            <PinShape />
          </span>
          <span className={`lp-hint ${touched ? 'gone' : ''}`} aria-hidden="true">
            {mode === 'hood' ? 'نقشه را بکشید تا سنجاق روی محله بنشیند' : 'نقشه را بکشید تا سنجاق روی خانه بنشیند'}
          </span>
          {canLocate && (
            <button type="button" className="kfab lp-me" aria-label="جای فعلی من" onClick={locate}>
              <Icon name="nav" />
            </button>
          )}
        </MapView>

        <div className="lp-top">
          <div className="lp-search">
            <Icon name="search" size="s" />
            <input
              className="fld"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی محله، خیابان یا جای معروف در همین حوالی"
              aria-label="جستجو در نقشه"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hits[0]) {
                  e.preventDefault();
                  pickHit(hits[0]);
                }
              }}
            />
            {hits.length > 0 && (
              <div className="lp-hits enter" role="listbox" aria-label="نتیجه‌های جستجو">
                {hits.map((h, i) => (
                  <button
                    key={`${h.point.lat},${h.point.lng},${i}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="lp-hit"
                    onClick={() => pickHit(h)}
                  >
                    <span className="sb">{h.title}</span>
                    {h.detail && <span className="xs mute">{h.detail}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="kfab lp-close" aria-label="بستن نقشه" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <div className="lp-card">
          <div className="lp-place" aria-live="polite">
            {looking || moving ? (
              <>
                <Skeleton w={150} h={22} r={8} />
                <Skeleton w={210} h={14} r={6} style={{ marginTop: 6 }} />
              </>
            ) : (
              <>
                <span className="lp-hood">{hood || (mode === 'hood' ? 'محلهٔ این نقطه پیدا نشد' : 'جای ملک')}</span>
                <span className="lp-street">
                  {guessed
                    ? [place?.street, 'حدس از فایل‌های نزدیک شما'].filter(Boolean).join(' · ')
                    : place?.street || (hood ? '' : 'نام محله را خودتان بنویسید')}
                </span>
              </>
            )}
          </div>
          <button type="button" className="btn btn-p lp-ok" disabled={!point || (mode === 'hood' && !tooFar && (!hood || looking || moving))} onClick={confirm}>
            {tooFar ? <Icon name="search" size="s" /> : <Icon name="check" size="s" thick />}
            {okLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
