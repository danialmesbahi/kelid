import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GeoPoint } from '@kelid/core';
import type sdk from '@neshan-maps-platform/maplibre-sdk';
import { mapKey, mapStyle } from './provider';
import { installTileCache } from './tileCache';
import './map.css';

export type MapLib = typeof sdk;
export type KMap = InstanceType<MapLib['Map']>;

// کتابخانهٔ نقشه بزرگ است؛ فقط وقتی اولین نقشه باز می‌شود بار می‌شود و بعد آماده می‌ماند.
let libP: Promise<MapLib> | undefined;
export function loadMapLib(): Promise<MapLib> {
  libP ??= Promise.all([import('@neshan-maps-platform/maplibre-sdk'), import('@neshan-maps-platform/maplibre-sdk/style.css')]).then(([m]) => {
    installTileCache();
    return m.default;
  });
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
      map = new lib.Map({
        container: box.current,
        style: mapStyle(dark),
        center: [s.center.lng, s.center.lat],
        zoom: s.zoom,
        apiKey: mapKey,
        interactive: s.interactive,
        // چرخاندن و کج کردن برای کاربر ما فقط گیج‌کننده است
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxZoom: 18.5,
        fadeDuration: 120,
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.once('load', () => {
        if (gone || !map) return;
        setReady(true);
        cleanup = s.onMap?.(map, lib);
      });
      // پوستهٔ تیره و روشن برنامه، نقشه را هم عوض می‌کند
      obs = new MutationObserver(() => {
        if (isDark() === dark) return;
        dark = isDark();
        map?.setStyle(mapStyle(dark));
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
      {!online && interactive && (
        <span className="kmap-off xs" role="status"><span className="kmap-dot" />بدون اینترنت؛ فقط جاهایی که قبلاً دیده‌اید</span>
      )}
      {children}
    </div>
  );
}
