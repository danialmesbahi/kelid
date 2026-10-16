import { lazy, Suspense, useState } from 'react';
import { Icon } from '@kelid/ui';
import { useMapAvailable } from './useMapAvailable';

const LocationPicker = lazy(() => import('./LocationPicker').then((m) => ({ default: m.LocationPicker })));

/** «روی نقشه»: مشتری‌ای که نام محله را نمی‌داند، جا را روی نقشه نشان می‌دهد و نام محله می‌آید. */
export function HoodMapButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const available = useMapAvailable();
  if (!available) return null;
  return (
    <>
      <button type="button" className="btn btn-s" onClick={() => setOpen(true)}>
        <Icon name="map" size="s" />
        روی نقشه
      </button>
      {open && (
        <Suspense fallback={null}>
          <LocationPicker
            mode="hood"
            onClose={() => setOpen(false)}
            onPick={(r) => {
              setOpen(false);
              if (r.place?.neighborhood) onAdd(r.place.neighborhood);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
