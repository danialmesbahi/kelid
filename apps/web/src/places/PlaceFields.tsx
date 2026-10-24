import { memo, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Icon } from '@kelid/ui';
import { normalizeForSearch, toFaDigits } from '@kelid/core';
import { FieldError, Req } from '../layout/Field';
import { Combo, type ComboItem } from './Combo';
import { useCityPlaces, useOfficeCity } from './hooks';
import { Select } from '../layout/Select';
import { PlaceSheet, type SheetTab } from './PlaceSheet';
import { match, rank, streetKind, type CityPlaces } from './places';
import './places.css';

const QUICK_HOODS = 8;
const QUICK_STREETS = 6;
const fa = (n: number) => toFaDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

/**
 * «کجاست؟» فرم فایل: محله و خیابان فقط از شهر دفتر (همان که در ثبت‌نام یا تنظیمات انتخاب شده) پیشنهاد می‌شوند.
 * منطقه (مثل بهمنی، شهر و ریشهر در بوشهر یا ۲۲ منطقهٔ تهران) فهرست محله‌ها را کوتاه می‌کند، محلهٔ انتخاب‌شده خیابان‌های خودش را جلو می‌آورد. هر چیزی هم دستی نوشته می‌شود.
 */
export function PlaceFields(props: { hood: string; street: string; onHood: (v: string) => void; onStreet: (v: string) => void; hoodError?: string }) {
  const { city } = useOfficeCity();
  const data = useCityPlaces(city);
  return (
    <div className="loc">
      <CityHead city={city} data={data} />
      <Places data={city ? data : null} {...props} />
    </div>
  );
}

function CityHead({ city, data }: { city: string; data: CityPlaces | null | undefined }) {
  if (!city) {
    return (
      <div className="loc-head loc-none">
        <span className="loc-pin" aria-hidden="true"><Icon name="pin" /></span>
        <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <span className="b">شهر دفتر انتخاب نشده</span>
          <span className="xs mute">با انتخاب شهر در تنظیمات، محله‌ها و خیابان‌های همان شهر اینجا پیشنهاد می‌شوند.</span>
        </span>
        <Link to="/settings" viewTransition className="btn btn-s">تنظیمات</Link>
      </div>
    );
  }
  return (
    <div className="loc-head">
      <span className="loc-pin" aria-hidden="true"><Icon name="pin" /></span>
      <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <span className="b loc-city">{city}</span>
        <span className="xs mute">
          {data === undefined ? 'در حال آماده کردن پیشنهادها…'
            : data ? <>استان {data.province} · {fa(data.hoods.length)} محله · {fa(data.streets.length)} خیابان و کوچه</>
            : 'برای این شهر هنوز فهرست محله نداریم؛ محله و خیابان را بنویسید.'}
        </span>
      </span>
    </div>
  );
}

type Sheet = 'hood' | 'street' | null;

const Places = memo(function Places({ data, hood, street, onHood, onStreet, hoodError }: { data: CityPlaces | null | undefined; hood: string; street: string; onHood: (v: string) => void; onStreet: (v: string) => void; hoodError?: string }) {
  // منطقهٔ انتخابی؛ null یعنی «همه». اگر محلهٔ فایل در منطقه‌ای است، همان از اول روشن است.
  const [zonePick, setZonePick] = useState<number | null | undefined>(undefined);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [streetFocus, setStreetFocus] = useState(false);

  const hoodIx = useMemo(() => {
    const n = normalizeForSearch(hood);
    return data && n ? data.hoodIndex.findIndex((h) => h.norm === n) : -1;
  }, [data, hood]);
  const hoodZone = data && hoodIx >= 0 ? data.zoneOf[hoodIx]! : -1;
  const zone = zonePick !== undefined ? zonePick : hoodZone >= 0 ? hoodZone : null;
  const allHoods = useMemo(() => (data ? data.hoods.map((_, i) => i) : []), [data]);
  const zoneHoods = data && zone !== null && data.zones[zone] ? data.zones[zone].hoods : allHoods;

  const hoodItems = useMemo<ComboItem[]>(() => {
    if (!data || !hood.trim()) return [];
    // با جستجو همهٔ شهر گشته می‌شود، ولی محله‌های منطقهٔ انتخابی جلوترند
    const first = rank(data.hoodIndex, hood, 12, zoneHoods);
    const rest = zoneHoods === allHoods ? [] : rank(data.hoodIndex, hood, 12).filter((i) => !first.includes(i));
    return [...first, ...rest].filter((i) => i !== hoodIx).slice(0, 12).map((i) => {
      const z = data.zoneOf[i]!;
      return { key: String(i), value: data.hoods[i]!, hit: match(data.hoods[i]!, hood) ?? { text: data.hoods[i]!, at: 0, len: 0, score: 3 }, hint: z >= 0 && z !== zone ? data.zones[z]!.name : undefined };
    });
  }, [data, hood, zone, zoneHoods, allHoods, hoodIx]);

  const hoodStreets = useMemo(() => (data && hoodIx >= 0 ? data.streetsOf[hoodIx]! : []), [data, hoodIx]);
  const streetIx = useMemo(() => {
    const n = normalizeForSearch(street);
    return data && n ? data.streetIndex.findIndex((s) => s.norm === n) : -1;
  }, [data, street]);
  const streetItems = useMemo<ComboItem[]>(() => {
    if (!data || !street.trim()) return [];
    const near = hoodIx >= 0 ? rank(data.streetIndex, street, 8, hoodStreets).filter((i) => i !== streetIx) : [];
    const rest = rank(data.streetIndex, street, 10 + near.length).filter((i) => i !== streetIx && !near.includes(i)).slice(0, 10);
    const hoodName = hoodIx >= 0 ? data.hoods[hoodIx]! : '';
    const toItem = (g: string | undefined) => (i: number): ComboItem => {
      const name = data.streets[i]!.name;
      return { key: String(i), value: name, hit: match(name, street) ?? { text: name, at: 0, len: 0, score: 3 }, tag: streetKind(name).kind || undefined, group: g };
    };
    return [...near.map(toItem(hoodName ? `در ${hoodName}` : undefined)), ...rest.map(toItem(hoodName && near.length ? `جاهای دیگر ${data.name}` : undefined))];
  }, [data, street, hoodStreets, hoodIx, streetIx]);

  const quickHoods = data && !hood.trim() ? zoneHoods.slice(0, QUICK_HOODS) : [];
  const quickStreets = hoodIx >= 0 && !street.trim() ? hoodStreets.slice(0, QUICK_STREETS) : [];

  const hoodTabs = useMemo<SheetTab[]>(
    () => (data ? [{ key: 'all', label: 'همهٔ مناطق', pool: allHoods }, ...data.zones.map((z, i) => ({ key: String(i), label: z.name, pool: z.hoods }))] : []),
    [data, allHoods],
  );
  const streetTabs = useMemo<SheetTab[]>(() => {
    if (!data) return [];
    const all = { key: 'all', label: `همهٔ ${data.name}`, pool: data.streets.map((_, i) => i) };
    return hoodIx >= 0 && hoodStreets.length ? [{ key: 'hood', label: data.hoods[hoodIx]!, pool: hoodStreets }, all] : [all];
  }, [data, hoodIx, hoodStreets]);

  const listBtn = (what: Exclude<Sheet, null>, label: string) => (
    <button type="button" className="loc-all" onClick={() => setSheet(what)} aria-label={label} title={label}>
      <Icon name="list" size="s" />
    </button>
  );

  return (
    <>
      {data && data.zones.length > 0 && <Areas data={data} zone={zone} onZone={setZonePick} />}

      <div className="loc-grid">
        <div className="lbl">
          <span>محله<Req /></span>
          <Combo
            value={hood}
            onChange={(v) => onHood(v)}
            items={hoodItems}
            label="محله"
            placeholder={data ? 'نام محله را بنویسید' : 'مثلاً سعادت‌آباد'}
            invalid={!!hoodError}
            describedBy={hoodError ? 'err-hood' : undefined}
            openOnEmpty={false}
            trailing={data ? listBtn('hood', 'فهرست همهٔ محله‌ها') : undefined}
            empty={data && hood.trim() && hoodIx < 0 ? <>«{hood.trim()}» در فهرست نیست؛ همین نوشته ثبت می‌شود.</> : undefined}
          />
          <FieldError id="err-hood" text={hoodError} />
          {quickHoods.length > 0 && (
            <div className="loc-chips" role="group" aria-label="محله‌های پیشنهادی">
              {quickHoods.map((i) => (
                <button key={i} type="button" className="loc-chip" onClick={() => onHood(data!.hoods[i]!)}>{data!.hoods[i]}</button>
              ))}
              {zoneHoods.length > QUICK_HOODS && (
                <button type="button" className="loc-chip more" onClick={() => setSheet('hood')}>
                  <Icon name="search" size="s" />همهٔ {fa(zoneHoods.length)} محله
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lbl">
          <span>خیابان</span>
          <Combo
            value={street}
            onChange={(v) => onStreet(v)}
            items={streetItems}
            label="خیابان"
            placeholder={hoodIx >= 0 ? `خیابان‌های ${data!.hoods[hoodIx]}` : 'خیابان یا کوچه'}
            openOnEmpty={false}
            onFocusChange={setStreetFocus}
            trailing={data && data.streets.length ? listBtn('street', 'فهرست خیابان‌ها') : undefined}
          />
          {quickStreets.length > 0 && (
            <div className="loc-chips" role="group" aria-label="خیابان‌های این محله">
              {quickStreets.map((i) => {
                const k = streetKind(data!.streets[i]!.name);
                return (
                  <button key={i} type="button" className="loc-chip" onClick={() => onStreet(data!.streets[i]!.name)}>
                    {k.kind && <span className="loc-kind">{k.kind}</span>}{k.rest}
                  </button>
                );
              })}
              {hoodStreets.length > QUICK_STREETS && (
                <button type="button" className="loc-chip more" onClick={() => setSheet('street')}>
                  <Icon name="search" size="s" />همهٔ {fa(hoodStreets.length)} خیابان
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {data && hoodIx >= 0 && (
        <div className="loc-trail" aria-live="polite">
          <Icon name="check" size="s" thick />
          <span>{data.name}</span>
          {hoodZone >= 0 && data.zones[hoodZone]!.name !== data.hoods[hoodIx] && <><Icon name="chl" size="s" /><span>{data.zones[hoodZone]!.name}</span></>}
          <Icon name="chl" size="s" />
          <b>{data.hoods[hoodIx]}</b>
          {street.trim() && (streetIx >= 0 || !streetFocus) && <><Icon name="chl" size="s" /><b>{street.trim()}</b></>}
        </div>
      )}

      {data && sheet === 'hood' && (
        <PlaceSheet
          title={`محله در ${data.name}`}
          sub={`${fa(data.hoods.length)} محله${data.zones.length ? ` در ${fa(data.zones.length)} منطقه` : ''}`}
          names={data.hoods}
          index={data.hoodIndex}
          tabs={hoodTabs}
          tab0={zone !== null ? String(zone) : 'all'}
          value={hood}
          hint={(i) => (data.zoneOf[i]! >= 0 ? data.zones[data.zoneOf[i]!]!.name : undefined)}
          onPick={(v) => {
            onHood(v);
            const i = data.hoodIndex.findIndex((h) => h.norm === normalizeForSearch(v));
            if (i >= 0 && data.zoneOf[i]! >= 0) setZonePick(data.zoneOf[i]!);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {data && sheet === 'street' && (
        <PlaceSheet
          title={hoodIx >= 0 ? `خیابان در ${data.hoods[hoodIx]}` : `خیابان در ${data.name}`}
          sub={`${fa(data.streets.length)} خیابان و کوچه در ${data.name}`}
          names={data.streets.map((s) => s.name)}
          index={data.streetIndex}
          tabs={streetTabs}
          value={street}
          kinds
          onPick={onStreet}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
});

// تا این تعداد منطقه دکمه‌های کنار هم؛ بیشتر (۲۲ منطقهٔ تهران) فهرست کشویی با جستجو
const AREA_TILES = 6;

/** انتخاب منطقهٔ شهر؛ اختیاری است و فقط محله‌های پیشنهادی را کوتاه می‌کند. */
function Areas({ data, zone, onZone }: { data: CityPlaces; zone: number | null; onZone: (z: number | null) => void }) {
  return (
    <div className="loc-areas">
      <span className="loc-lead" id="loc-area-l">منطقه <span className="xs mute">· اختیاری، محله‌ها را کوتاه‌تر می‌کند</span></span>
      {data.zones.length <= AREA_TILES ? (
        <div className="loc-tiles" role="radiogroup" aria-labelledby="loc-area-l" style={{ '--n': data.zones.length + 1 } as CSSProperties}>
          {[null, ...data.zones.map((_, i) => i)].map((z) => {
            const on = zone === z;
            return (
              <button key={z ?? 'all'} type="button" role="radio" aria-checked={on} className="loc-tile" onClick={() => onZone(z)}>
                <span className="loc-tile-n">{z === null ? 'همهٔ شهر' : data.zones[z]!.name}</span>
                <span className="loc-tile-c">{fa(z === null ? data.hoods.length : data.zones[z]!.hoods.length)} محله</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="loc-areasel">
          <Select
            value={zone === null ? 'all' : String(zone)}
            label="منطقه"
            options={[
              { value: 'all', label: 'همهٔ مناطق', hint: `${fa(data.hoods.length)} محله` },
              ...data.zones.map((z, i) => ({ value: String(i), label: z.name, hint: `${fa(z.hoods.length)} محله` })),
            ]}
            onChange={(v) => onZone(v === 'all' ? null : Number(v))}
          />
        </div>
      )}
    </div>
  );
}
