import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GeoPoint } from '@kelid/core';
import { mapStyle } from './style';
import { tilesUrl } from './provider';
import './map.css';

export type MapLib = typeof import('maplibre-gl');
export type KMap = InstanceType<MapLib['Map']>;

// کتابخانهٔ نقشه بزرگ است؛ فقط وقتی اولین نقشه باز می‌شود بار می‌شود و بعد آماده می‌ماند.
let libP: Promise<MapLib> | undefined;
export function loadMapLib(): Promise<MapLib> {
  libP ??= (async () => {
    const [lib, pm, cache, rtl, font] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
      import('./tileCache'),
      // شکل‌دادن حروف فارسی؛ از خود برنامه، به صورت blob تا در نسخهٔ ویندوز (file://) هم بار شود
      import('kelid-rtl-text'),
      import('vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]);
    // نقشه وزن فونت را از نامش می‌فهمد؛ «Vazirmatn Bold» همان فایل وزیرمتن است با نام دیگر
    try {
      document.fonts.add(new FontFace('Vazirmatn Bold', `url("${font.default}")`, { weight: '100 900' }));
    } catch {
      /* فونت ضخیم با فونت پیش‌فرض کشیده می‌شود */
    }
    const protocol = new pm.Protocol();
    protocol.add(cache.mapArchive());
    lib.addProtocol('pmtiles', protocol.tile);
    if (lib.getRTLTextPluginStatus() === 'unavailable') {
      void lib.setRTLTextPlugin(URL.createObjectURL(new Blob([rtl.default], { type: 'text/javascript' })), false);
    }
    // نوشته‌های نقشه با همین فونت روی دستگاه کشیده می‌شوند؛ اگر فونت هنوز نیامده باشد، حروف با فونت پیش‌فرض می‌مانند.
    await Promise.all([document.fonts.load('24px Vazirmatn', 'آ'), document.fonts.load('bold 24px "Vazirmatn Bold"', 'آ')]).catch(() => undefined);
    return lib;
  })();
  return libP;
}

const isDark = () => document.documentElement.classList.contains('dark');

type Props = {
  center: GeoPoint;
  zoom: number;
  /** نقشهٔ کوچک داخل فرم یا پرونده فقط نمایش است؛ با لمس، نقشهٔ بزرگ باز می‌شود. */
  interactive?: boolean;
  /** نقشه آماده شد؛ تابع برگشتی موقع بسته شدن صدا زده می‌شود. */
  onMap?: (map: KMap, lib: MapLib) => void | (() => void);
  label: string;
  className?: string;
  children?: ReactNode;
};

export function MapView({ center, zoom, interactive = true, onMap, label, className = '', children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  // فقط نقطهٔ شروع؛ جابه‌جایی بعدی کار خود صفحه است (onMap)
  const start = useRef({ center, zoom, interactive, onMap });

  useEffect(() => {
    let map: KMap | undefined;
    let cleanup: void | (() => void);
    let gone = false;
    let obs: MutationObserver | undefined;
    void loadMapLib().then((lib) => {
      if (gone || !box.current) return;
      const s = start.current;
      let dark = isDark();
      const tiles = tilesUrl();
      try {
        map = new lib.Map({
          container: box.current,
          style: mapStyle(dark, tiles),
          center: [s.center.lng, s.center.lat],
          zoom: s.zoom,
          interactive: s.interactive,
          attributionControl: { compact: true },
          // چرخاندن و کج کردن برای کاربر ما فقط گیج‌کننده است
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxZoom: 18.5,
          fadeDuration: 120,
        });
      } catch {
        // دستگاه بی WebGL (کارت گرافیک خیلی قدیمی)؛ فرم بی نقشه هم کار می‌کند
        setFailed(true);
        return;
      }
      const m = map;
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      m.once('load', () => {
        if (gone) return;
        setReady(true);
        cleanup = s.onMap?.(m, lib);
      });
      // پوستهٔ تیره و روشن برنامه، نقشه را هم عوض می‌کند
      obs = new MutationObserver(() => {
        if (isDark() === dark) return;
        dark = isDark();
        m.setStyle(mapStyle(dark, tiles));
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    return () => {
      gone = true;
      obs?.disconnect();
      if (typeof cleanup === 'function') cleanup();
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  return (
    <div className={`kmap ${ready ? 'on' : ''} ${className}`}>
      {/* نقشهٔ فقط‌نمایشی داخل دکمه است و خود دکمه برچسب دارد */}
      <div ref={box} className="kmap-gl" {...(interactive ? { role: 'application', 'aria-label': label } : { 'aria-hidden': true })} />
      {failed && (
        <span className="kmap-off xs" role="status">
          نقشه روی این دستگاه باز نمی‌شود
        </span>
      )}
      {!online && interactive && (
        <span className="kmap-off xs" role="status">
          <span className="kmap-dot" />
          بدون اینترنت؛ فقط جاهایی که قبلاً دیده‌اید
        </span>
      )}
      {children}
    </div>
  );
}
