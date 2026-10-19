import { useMemo, type Ref } from 'react';
import { Combo, type ComboItem } from './Combo';
import { useCities } from './hooks';
import { search } from './places';

/** انتخاب شهر دفتر از فهرست همهٔ شهرها؛ شهری که در فهرست نیست هم نوشته می‌شود (فقط پیشنهادی نمی‌آید). */
export function CityField({ value, onChange, onPick, inputRef, invalid, className, placeholder = 'مثلاً بوشهر' }: { value: string; onChange: (v: string) => void; onPick?: (v: string) => void; inputRef?: Ref<HTMLInputElement>; invalid?: boolean; className?: string; placeholder?: string }) {
  const cities = useCities();
  const items = useMemo<ComboItem[]>(
    () =>
      search(cities ?? [], value, (c) => c.label, 8)
        // شهری که همین الان انتخاب شده دوباره پیشنهاد نشود
        .filter(({ item, hit }) => !(hit.score === 0 && item.label === value.trim()))
        .map(({ item, hit }) => ({ key: item.key, value: item.label, hit: { ...hit, text: item.name }, hint: `استان ${item.province}` })),
    [cities, value],
  );
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
