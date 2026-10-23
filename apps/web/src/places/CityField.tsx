import { useMemo, useRef, useState } from 'react';
import { normalizeForSearch, toFaDigits } from '@kelid/core';
import { Select, type SelectOption } from '../layout/Select';
import { Combo, type ComboItem } from './Combo';
import { useCities } from './hooks';
import { indexed, match, rank, type CityRef } from './places';
import './places.css';

const collator = new Intl.Collator('fa');

/**
 * استان و شهر دفتر. اول استان (از فهرست)، بعد شهر همان استان: تایپ با پیشنهاد، یا هر نامی که در فهرست نیست.
 * مقدار بیرونی همان برچسب شهر است («بوشهر»، یا «کنگان (بوشهر)» برای نام‌های تکراری) که loadCity می‌شناسد.
 */
export function CityField({ value, onChange, onPick, invalid, className = '', hint }: {
  value: string;
  onChange: (label: string) => void;
  /** شهر از فهرست انتخاب شد (برای ذخیرهٔ بی‌دکمه در تنظیمات). */
  onPick?: (label: string) => void;
  invalid?: boolean;
  className?: string;
  hint?: string;
}) {
  const cities = useCities();
  const start = useMemo(() => cities?.find((c) => c.label === value.trim()), [cities, value]);
  const [province, setProvince] = useState<string>();
  const [text, setText] = useState<string>();
  // تا فهرست شهرها برسد، استان و نام از مقدار ذخیره‌شده درمی‌آید
  const prov = province ?? start?.province ?? '';
  const cityText = text ?? (start ? start.name : value);
  const cityRef = useRef<HTMLInputElement | null>(null);

  const provinces = useMemo<Array<SelectOption<string>>>(() => {
    const count = new Map<string, number>();
    for (const c of cities ?? []) count.set(c.province, (count.get(c.province) ?? 0) + 1);
    return [...count.keys()].sort(collator.compare).map((p) => ({ value: p, label: p, hint: `${toFaDigits(count.get(p)!)} شهر` }));
  }, [cities]);

  const inProv = useMemo(() => (cities ?? []).filter((c) => c.province === prov), [cities, prov]);
  // نمایهٔ شهرهای استان یک بار ساخته شود، نه با هر حرف
  const index = useMemo(() => inProv.map((c) => indexed(c.name)), [inProv]);
  const find = (t: string): CityRef | undefined => {
    const n = normalizeForSearch(t);
    return n ? inProv.find((_, i) => index[i]!.norm === n) : undefined;
  };
  const labelOf = (t: string) => find(t)?.label ?? t.trim();

  const items = useMemo<ComboItem[]>(() => {
    if (!prov) return [];
    const q = cityText.trim();
    return rank(index, q, q ? 10 : 60)
      .map((i) => inProv[i]!)
      // شهری که همین الان انتخاب شده دوباره پیشنهاد نشود
      .filter((c) => c.name !== q)
      .map((c) => ({ key: c.key, value: c.name, hit: match(c.name, q) ?? { text: c.name, at: 0, len: 0, score: 4 } }));
  }, [prov, cityText, index, inProv]);

  return (
    <div className="loc-pc">
      <div className="lbl">
        <span>استان</span>
        <Select
          value={prov}
          options={provinces}
          label="استان"
          placeholder={cities ? 'انتخاب استان' : '…'}
          popClass="loc-pop"
          className={className}
          onChange={(p) => {
            if (p === prov) return;
            setProvince(p);
            setText('');
            onChange('');
            // بی‌کلیک اضافه سراغ شهر برود
            requestAnimationFrame(() => cityRef.current?.focus());
          }}
        />
      </div>
      <div className="lbl">
        <span>شهر</span>
        <Combo
          value={cityText}
          onChange={(v, picked) => {
            setText(v);
            const l = labelOf(v);
            onChange(l);
            if (picked) onPick?.(l);
          }}
          items={items}
          label="شهر"
          disabled={!prov}
          placeholder={prov ? 'نام شهر را بنویسید' : 'اول استان را انتخاب کنید'}
          inputRef={cityRef}
          invalid={invalid}
          className={className}
          enterKeyHint="next"
          empty={prov && cityText.trim() && !find(cityText) ? `«${cityText.trim()}» در فهرست ${prov} نیست؛ همین نوشته ثبت می‌شود.` : undefined}
        />
      </div>
      {hint && <span className="loc-pc-hint xs mute">{hint}</span>}
    </div>
  );
}
