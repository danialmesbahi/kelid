import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { Cover, Icon, Plaque } from '@kelid/ui';
import { formatPlaque, headlinePrice, listingPlace, listingTitle, toFaDigits, type Listing } from '@kelid/core';
import { MapView, type KMap, type MapLib } from './MapView';
import { DEFAULT_CENTER } from './provider';

type Props = {
  list: Listing[];
  selId?: string;
  onSelect: (id: string) => void;
  /** روی گوشی پیش‌نمایش کناری نیست؛ کارت کوچک پایین نقشه همان کار را می‌کند. */
  phone: boolean;
  cover: (id: string) => string | undefined;
};

const dealCls = { sale: '', rent: 'r', full: 'f' } as const;

/** فایل‌های دفتر روی نقشه؛ هر فایل با پلاک خودش، به همان رنگ نوع معامله. */
export function FilesMap({ list, selId, onSelect, phone, cover }: Props) {
  const placed = useMemo(() => list.filter((l) => l.location), [list]);
  const ctx = useRef<{ map: KMap; lib: MapLib; marks: Map<string, { m: InstanceType<MapLib['Marker']>; el: HTMLElement; key: string }> } | null>(null);
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const sync = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    const keep = new Set<string>();
    for (const l of placed) {
      const loc = l.location!;
      // اگر جا یا رنگ یا پلاک عوض شد، نشانگر از نو ساخته می‌شود
      const key = `${loc.lat},${loc.lng},${l.deal},${l.plaque}`;
      keep.add(l.id);
      const old = c.marks.get(l.id);
      if (old?.key === key) continue;
      old?.m.remove();
      // نگه‌دارنده را خود نقشه جابه‌جا می‌کند؛ دکمه داخلش است تا سبک‌های ما با سبک نشانگر نقشه قاطی نشود.
      const box = document.createElement('div');
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `kmark ${dealCls[l.deal]}`;
      el.setAttribute('aria-label', `پلاک ${formatPlaque(l.plaque)}، ${listingTitle(l)}، ${listingPlace(l)}`);
      const plq = document.createElement('span');
      plq.className = `plq s ${dealCls[l.deal]}`;
      plq.textContent = formatPlaque(l.plaque);
      el.append(plq);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(l.id);
      });
      box.append(el);
      const m = new c.lib.Marker({ element: box, anchor: 'bottom', offset: [0, -4] }).setLngLat([loc.lng, loc.lat]).addTo(c.map);
      c.marks.set(l.id, { m, el, key });
    }
    for (const [id, v] of c.marks) {
      if (!keep.has(id)) {
        v.m.remove();
        c.marks.delete(id);
      }
    }
    // بار اول نقشه طوری باز می‌شود که همهٔ فایل‌ها دیده شوند
    if (!fitted.current && placed.length) {
      fitted.current = true;
      const b = new c.lib.LngLatBounds();
      for (const l of placed) b.extend([l.location!.lng, l.location!.lat]);
      c.map.fitBounds(b, { padding: phone ? 50 : 80, maxZoom: 15, duration: 0 });
    }
  }, [placed, phone]);

  const onMap = useCallback((map: KMap, lib: MapLib) => {
    ctx.current = { map, lib, marks: new Map() };
    syncRef.current();
    return () => {
      ctx.current = null;
    };
  }, []);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => sync(), [sync]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    for (const [id, v] of c.marks) v.el.classList.toggle('on', id === selId);
    const l = placed.find((x) => x.id === selId);
    // فایل انتخاب‌شده اگر بیرون از دید است، نقشه آرام به سمتش می‌رود
    if (l?.location && !c.map.getBounds().contains([l.location.lng, l.location.lat])) {
      c.map.easeTo({ center: [l.location.lng, l.location.lat], duration: 500 });
    }
  });

  const sel = phone ? placed.find((l) => l.id === selId) : undefined;
  const missing = list.length - placed.length;

  return (
    <div className="fmap">
      <MapView center={DEFAULT_CENTER} zoom={11.5} onMap={onMap} label="نقشهٔ فایل‌ها">
        {missing > 0 && (
          <span className="fmap-note locf-chip xs">
            <Icon name="pin" size="s" />
            {placed.length === 0 ? 'هنوز فایلی جای روی نقشه ندارد' : `${toFaDigits(missing)} فایل هنوز جای روی نقشه ندارد`}
          </span>
        )}
        {sel && (
          <Link viewTransition to={`/files/${sel.id}`} className="fmap-card enter">
            <Cover variant={sel.cover} src={cover(sel.id)} style={{ flex: '0 0 76px', height: 62, borderRadius: 12 }} />
            <span className="col sp" style={{ minWidth: 0, gap: 2 }}>
              <span className="sb" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {listingTitle(sel)}
              </span>
              <span className="xs mute">{listingPlace(sel)}</span>
              <span className="num b sm">{headlinePrice(sel)}</span>
            </span>
            <Plaque value={sel.plaque} deal={sel.deal} size="s" />
            <Icon name="chl" size="s" />
          </Link>
        )}
      </MapView>
    </div>
  );
}
