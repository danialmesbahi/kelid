import { lazy, Suspense, useState } from 'react';
import { Icon } from '@kelid/ui';
import type { GeoPoint } from '@kelid/core';
import { MapView } from './MapView';
import { PinShape } from './Pin';
import { useMapAvailable } from './useMapAvailable';
import type { Picked } from './LocationPicker';

const LocationPicker = lazy(() => import('./LocationPicker').then((m) => ({ default: m.LocationPicker })));

type Props = { value?: GeoPoint; onChange: (v: GeoPoint | undefined, picked?: Picked) => void };

/** جای ملک در فرم: نقشهٔ کوچک با سنجاق، یا دعوت به زدن جا روی نقشه. با لمس، نقشهٔ بزرگ باز می‌شود. */
export function LocationField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const available = useMapAvailable();
  if (!available) return null;

  return (
    <>
      {value ? (
        <div className="col" style={{ gap: 8 }}>
          {/* key: با عوض شدن جا، نقشهٔ کوچک از نو روی جای تازه ساخته می‌شود */}
          <button type="button" className="locf" onClick={() => setOpen(true)} aria-label="جای ملک روی نقشه؛ برای تغییر بزنید">
            <MapView key={`${value.lat},${value.lng}`} center={value} zoom={16} interactive={false} label="جای ملک">
              <PinShape className="locf-pin" />
              <span className="locf-bar">
                <span className="locf-chip">
                  <Icon name="pin" size="s" />
                  روی نقشه ثبت شد
                </span>
                <span className="sp" />
                <span className="locf-chip">
                  <Icon name="edit" size="s" />
                  تغییر
                </span>
              </span>
            </MapView>
          </button>
          <button type="button" className="btn btn-g btn-s" style={{ alignSelf: 'flex-start' }} onClick={() => onChange(undefined)}>
            <Icon name="x" size="s" />
            برداشتن از نقشه
          </button>
        </div>
      ) : (
        <button type="button" className="locf-empty" onClick={() => setOpen(true)}>
          <span className="locf-ic">
            <Icon name="map" size="l" />
          </span>
          <span className="col sp" style={{ gap: 2, minWidth: 0 }}>
            <span className="b" style={{ fontSize: 16 }}>
              جای ملک را روی نقشه بزنید
            </span>
            <span className="sm mute">محله و خیابان خودشان پر می‌شوند؛ بعداً هم فایل روی نقشهٔ دفتر دیده می‌شود.</span>
          </span>
          <Icon name="chl" size="s" />
        </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <LocationPicker
            mode="home"
            value={value}
            onClose={() => setOpen(false)}
            onPick={(r) => {
              setOpen(false);
              onChange(r.point, r);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
