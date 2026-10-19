import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@kelid/ui';
import { normalizeForSearch, toFaDigits } from '@kelid/core';
import { FieldError, Req } from '../layout/Field';
import { CityField } from './CityField';
import { Combo, type ComboItem } from './Combo';
import { useCityPlaces, useOfficeCity } from './hooks';
import { search, streetKind, type CityPlaces } from './places';
import './places.css';

const QUICK_HOODS = 12;
const QUICK_STREETS = 8;
const fa = (n: number) => toFaDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

/**
 * «کجاست؟» فرم فایل: محله و خیابان از روی شهر دفتر پیشنهاد می‌شوند.
 * زون (منطقه) فهرست محله‌ها را کوتاه می‌کند، محلهٔ انتخاب‌شده خیابان‌های خودش را جلو می‌آورد. هر چیزی هم دستی نوشته می‌شود.
 */
export function PlaceFields({ hood, street, onHood, onStreet, hoodError }: { hood: string; street: string; onHood: (v: string) => void; onStreet: (v: string) => void; hoodError?: string }) {
  const { city, setCity, canEdit } = useOfficeCity();
  const data = useCityPlaces(city);
  const [editCity, setEditCity] = useState(false);
  const [draftCity, setDraftCity] = useState('');

  const pickCity = (c: string) => {
    setDraftCity(c);
    // فقط شهری که از فهرست انتخاب شد ذخیره می‌شود، نه هر حرفی که تایپ می‌شود
    if (c.trim()) {
      setCity(c.trim());
      setEditCity(false);
    }
  };

  const ask = !city || editCity;
  return (
    <div className="loc">
      {ask ? (
        <div className="loc-ask enter">
          <span className="loc-pin" aria-hidden="true"><Icon name="pin" /></span>
          <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
            <span className="b">دفترتان در کدام شهر است؟</span>
            <span className="xs mute">محله‌ها، زون‌ها و خیابان‌های همان شهر را پیشنهاد می‌دهیم؛ یک بار کافی است.</span>
            <div className="loc-askrow">
              <CityPickOnly value={draftCity} onDraft={setDraftCity} onPick={pickCity} />
              {editCity && <button type="button" className="btn btn-g btn-s" onClick={() => setEditCity(false)}>انصراف</button>}
            </div>
          </div>
        </div>
      ) : (
        <CityHead city={city} data={data} onChange={canEdit ? () => { setDraftCity(''); setEditCity(true); } : undefined} />
      )}
      <Places data={ask ? null : data} hood={hood} street={street} onHood={onHood} onStreet={onStreet} hoodError={hoodError} />
    </div>
  );
}

/** فیلد شهر که فقط با انتخاب از فهرست (یا Enter روی نامی که نوشته شده) ثبت می‌شود. */
function CityPickOnly({ value, onDraft, onPick }: { value: string; onDraft: (v: string) => void; onPick: (v: string) => void }) {
  return (
    <div
      className="loc-cityfld"
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        // Enter اینجا فرم فایل را نفرستد؛ نامی که نوشته شده (اگر از فهرست انتخاب نشده) همان ثبت می‌شود
        if (!e.defaultPrevented && value.trim()) onPick(value);
        e.preventDefault();
      }}
    >
      <CityField
        value={value}
        onChange={(v) => onDraft(v)}
        onPick={onPick}
        placeholder="نام شهر را بنویسید، مثلاً بوشهر"
      />
    </div>
  );
}

function CityHead({ city, data, onChange }: { city: string; data: CityPlaces | null | undefined; onChange?: () => void }) {
  return (
    <div className="loc-head">
      <span className="loc-pin" aria-hidden="true"><Icon name="pin" /></span>
      <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <span className="b loc-city">{city}</span>
        <span className="xs mute">
          {data === undefined ? 'در حال آماده کردن پیشنهادها…'
            : data ? <>استان {data.province} · {fa(data.hoods.length)} محله · {fa(data.streets.length)} خیابان و کوچه</>
            : 'برای این شهر هنوز فهرست محله نداریم؛ محله و خیابان را بنویسید.'}
        </span>
      </div>
      {onChange && <button type="button" className="btn btn-g btn-s" onClick={onChange}>تغییر شهر</button>}
    </div>
  );
}

function Places({ data, hood, street, onHood, onStreet, hoodError }: { data: CityPlaces | null | undefined; hood: string; street: string; onHood: (v: string) => void; onStreet: (v: string) => void; hoodError?: string }) {
  // زون انتخابی؛ null یعنی «همه». اگر محلهٔ فایل در زونی است، همان زون از اول روشن است.
  const [zonePick, setZonePick] = useState<number | null | undefined>(undefined);
  const [allHoods, setAllHoods] = useState(false);

  const hoodIx = useMemo(() => {
    const n = normalizeForSearch(hood);
    return data && n ? data.hoods.findIndex((h) => normalizeForSearch(h) === n) : -1;
  }, [data, hood]);
  const zoneOf = (ix: number) => (data && ix >= 0 ? data.zones.findIndex((z) => z.hoods.includes(ix)) : -1);
  const zone = zonePick !== undefined ? zonePick : zoneOf(hoodIx) >= 0 ? zoneOf(hoodIx) : null;
  const zoneHoods = data ? (zone !== null && data.zones[zone] ? data.zones[zone].hoods : data.hoods.map((_, i) => i)) : [];

  const hoodItems = useMemo<ComboItem[]>(() => {
    if (!data) return [];
    // با جستجو همهٔ شهر گشته می‌شود، ولی محله‌های زون انتخابی جلوترند
    const order = hood.trim() ? [...zoneHoods, ...data.hoods.map((_, i) => i).filter((i) => !zoneHoods.includes(i))] : zoneHoods;
    return search(order, hood, (i) => data.hoods[i]!, 40)
      .filter(({ item }) => item !== hoodIx)
      .map(({ item, hit }) => {
        const z = zoneOf(item);
        return { key: String(item), value: data.hoods[item]!, hit, hint: z >= 0 && z !== zone ? data.zones[z]!.name : undefined };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zoneHoods و zoneOf از همین سه مقدار ساخته می‌شوند
  }, [data, hood, zone, hoodIx]);

  const hoodStreets = useMemo(() => (data && hoodIx >= 0 ? data.streets.filter((s) => s.hoods.includes(hoodIx)) : []), [data, hoodIx]);
  const streetItems = useMemo<ComboItem[]>(() => {
    if (!data) return [];
    const picked = normalizeForSearch(street);
    const near = search(hoodStreets, street, (s) => s.name, street.trim() ? 8 : 30).filter(({ item }) => normalizeForSearch(item.name) !== picked);
    const nearSet = new Set(near.map((n) => n.item));
    const rest = street.trim() || hoodIx < 0 ? search(data.streets, street, (s) => s.name, hoodIx < 0 ? 30 : 10).filter(({ item }) => !nearSet.has(item) && normalizeForSearch(item.name) !== picked) : [];
    const toItem = (g: string | undefined) => ({ item, hit }: { item: { name: string }; hit: ComboItem['hit'] }): ComboItem => {
      const k = streetKind(item.name);
      return { key: item.name, value: item.name, hit, tag: k.kind || undefined, group: g };
    };
    const hoodName = hoodIx >= 0 ? data.hoods[hoodIx] : '';
    return [...near.map(toItem(hoodName ? `در ${hoodName}` : undefined)), ...rest.map(toItem(hoodName ? `جاهای دیگر ${data.name}` : undefined))];
  }, [data, street, hoodStreets, hoodIx]);

  const quickHoods = data && !hood.trim() ? (allHoods ? zoneHoods : zoneHoods.slice(0, QUICK_HOODS)) : [];
  const quickStreets = hoodIx >= 0 && !street.trim() ? hoodStreets.slice(0, QUICK_STREETS) : [];

  return (
    <>
      {data && data.zones.length > 0 && (
        <div className="loc-zones" role="group" aria-label="زون">
          <span className="loc-lead">زون</span>
          <div className="loc-rail">
            <button type="button" className="loc-zone" aria-pressed={zone === null} onClick={() => setZonePick(null)}>
              همه<span className="loc-n">{fa(data.hoods.length)}</span>
            </button>
            {data.zones.map((z, i) => (
              <button key={z.name} type="button" className="loc-zone" aria-pressed={zone === i} onClick={() => { setZonePick(i); setAllHoods(false); }}>
                {z.name}<span className="loc-n">{fa(z.hoods.length)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="loc-grid">
        <div className="lbl">
          <span id="loc-hood-l">محله<Req /></span>
          <Combo
            value={hood}
            onChange={(v, picked) => {
              onHood(v);
              if (picked) setAllHoods(false);
            }}
            items={hoodItems}
            label="محله"
            openOnEmpty={!quickHoods.length}
            placeholder={data ? `محله را بنویسید یا انتخاب کنید` : 'مثلاً سعادت‌آباد'}
            invalid={!!hoodError}
            describedBy={hoodError ? 'err-hood' : undefined}
            empty={data && hood.trim() ? <>«{hood.trim()}» در فهرست نیست؛ همین نوشته ثبت می‌شود.</> : undefined}
          />
          <FieldError id="err-hood" text={hoodError} />
          {quickHoods.length > 0 && (
            <Chips label="محله‌های پیشنهادی">
              {quickHoods.map((i) => (
                <button key={i} type="button" className="loc-chip" onClick={() => onHood(data!.hoods[i]!)}>{data!.hoods[i]}</button>
              ))}
              {zoneHoods.length > QUICK_HOODS && (
                <button type="button" className="loc-chip more" onClick={() => setAllHoods((v) => !v)}>
                  {allHoods ? 'کمتر' : `همهٔ ${fa(zoneHoods.length)} محله`}
                </button>
              )}
            </Chips>
          )}
        </div>

        <div className="lbl">
          <span>خیابان</span>
          <Combo
            value={street}
            onChange={(v) => onStreet(v)}
            items={streetItems}
            label="خیابان"
            openOnEmpty={!quickStreets.length}
            placeholder={hoodIx >= 0 ? `خیابان‌های ${data!.hoods[hoodIx]}` : 'خیابان یا کوچه'}
          />
          {quickStreets.length > 0 && (
            <Chips label="خیابان‌های این محله">
              {quickStreets.map((s) => {
                const k = streetKind(s.name);
                return (
                  <button key={s.name} type="button" className="loc-chip" onClick={() => onStreet(s.name)}>
                    {k.kind && <span className="loc-kind">{k.kind}</span>}{k.rest}
                  </button>
                );
              })}
            </Chips>
          )}
        </div>
      </div>

      {data && hoodIx >= 0 && (
        <div className="loc-trail" aria-live="polite">
          <Icon name="check" size="s" thick />
          <span>{data.name}</span>
          {zoneOf(hoodIx) >= 0 && <><Icon name="chl" size="s" /><span>{data.zones[zoneOf(hoodIx)]!.name}</span></>}
          <Icon name="chl" size="s" />
          <b>{data.hoods[hoodIx]}</b>
          {street.trim() && <><Icon name="chl" size="s" /><b>{street.trim()}</b></>}
        </div>
      )}
    </>
  );
}

function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="loc-chips stagger" role="group" aria-label={label}>
      {children}
    </div>
  );
}
