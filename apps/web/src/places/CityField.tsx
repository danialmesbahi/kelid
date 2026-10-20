import { useMemo, type Ref } from 'react';
import { Combo, type ComboItem } from './Combo';
import { useCities } from './hooks';
import { indexed, match, rank } from './places';

/** انتخاب شهر دفتر از فهرست همهٔ شهرها؛ شهری که در فهرست نیست هم نوشته می‌شود (فقط پیشنهادی نمی‌آید). */
export function CityField({ value, onChange, onPick, inputRef, invalid, className, placeholder = 'مثلاً بوشهر' }: { value: string; onChange: (v: string) => void; onPick?: (v: string) => void; inputRef?: Ref<HTMLInputElement>; invalid?: boolean; className?: string; placeholder?: string }) {
  const cities = useCities();
  // نمایهٔ هزار شهر یک بار ساخته شود، نه با هر حرف
  const index = useMemo(() => (cities ?? []).map((c) => indexed(c.label)), [cities]);
  const items = useMemo<ComboItem[]>(() => {
    if (!cities) return [];
    return rank(index, value, 8)
      .map((i) => cities[i]!)
      // شهری که همین الان انتخاب شده دوباره پیشنهاد نشود
      .filter((c) => c.label !== value.trim())
      .map((c) => ({ key: c.key, value: c.label, hit: { ...(match(c.name, value) ?? { at: 0, len: 0, score: 4 }), text: c.name }, hint: `استان ${c.province}` }));
  }, [cities, index, value]);
  return (
    <Combo
      value={value}
      onChange={(v, picked) => {
        onChange(v);
        if (picked) onPick?.(v);
      }}
      items={items}
      label="شهر دفتر"
      placeholder={placeholder}
      inputRef={inputRef}
      invalid={invalid}
      className={className}
      empty={cities && value.trim() ? 'این شهر در فهرست نیست؛ همین را می‌نویسیم.' : undefined}
    />
  );
}
