import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { usePopoverPlace } from '../layout/Select';
import type { Hit } from './places';
import '../layout/picker.css';

export type ComboItem = { key: string; value: string; hit: Hit; tag?: string; hint?: string; group?: string };

/** نام با تکهٔ جورشده پررنگ؛ نوع خیابان (بلوار، کوچه…) برچسب کوچک جدا می‌شود. */
export function Marked({ hit, tag }: { hit: Hit; tag?: string }) {
  const skip = tag ? tag.length + 1 : 0;
  const text = hit.text.slice(skip);
  const at = Math.max(0, hit.at - skip);
  const len = hit.len - Math.max(0, skip - hit.at);
  return (
    <>
      {tag && <span className="loc-kind">{tag}</span>}
      <span className="kp-ol">
        {len > 0 ? (<>{text.slice(0, at)}<mark className="loc-mark">{text.slice(at, at + len)}</mark>{text.slice(at + len)}</>) : text}
      </span>
    </>
  );
}

/**
 * فیلد متنی با پیشنهاد زیرش. هر متنی را می‌پذیرد (پیشنهاد اجبار نیست)؛ ↑/↓ حرکت، Enter انتخاب، Esc بستن فهرست.
 * گروه‌ها (مثلاً «در همین محله» و «بقیهٔ شهر») با عنوان کوچک از هم جدا می‌شوند.
 */
export function Combo({ value, onChange, items, label, placeholder, invalid, describedBy, inputRef, empty, onFocusChange, className = '', openOnEmpty = true, trailing, disabled, enterKeyHint }: {
  value: string;
  onChange: (v: string, picked: boolean) => void;
  items: ComboItem[];
  label: string;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  empty?: ReactNode;
  onFocusChange?: (focused: boolean) => void;
  className?: string;
  /** خالی که هست فهرست باز نشود (دکمه‌های پیشنهادی زیر فیلد همان کار را می‌کنند). */
  openOnEmpty?: boolean;
  /** دکمهٔ کوچک داخل فیلد، سمت چپ (مثلاً «همهٔ محله‌ها»). */
  trailing?: ReactNode;
  disabled?: boolean;
  enterKeyHint?: 'next' | 'done' | 'search';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = open && !disabled && (openOnEmpty || !!value.trim()) && (items.length > 0 || !!empty);
  const place = usePopoverPlace(show, wrap, 0, 300);

  useEffect(() => {
    if (!show) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    addEventListener('pointerdown', away, true);
    return () => removeEventListener('pointerdown', away, true);
  }, [show]);

  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (it: ComboItem) => {
    onChange(it.value, true);
    setOpen(false);
    setActive(-1);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && show) {
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && show && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={wrap} className={`loc-combo${trailing ? ' has-tr' : ''}`}>
      <input
        ref={inputRef}
        className={`fld ${className}`}
        role="combobox"
        aria-expanded={show}
        aria-controls={id}
        aria-autocomplete="list"
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-activedescendant={show && items[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        enterKeyHint={enterKeyHint}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value, false);
          setOpen(true);
          setActive(e.target.value.trim() ? 0 : -1);
        }}
        onFocus={() => {
          setOpen(true);
          onFocusChange?.(true);
        }}
        onBlur={() => onFocusChange?.(false)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {trailing}
      {place && createPortal(
        <div ref={list} className={`kp-pop loc-pop${place.up ? ' up' : ''}`} style={{ top: place.top, left: place.left, width: place.width, maxHeight: Math.min(place.max, 380) }}>
          <div id={id} role="listbox" aria-label={label} className="kp-list">
            {items.map((it, i) => (
              <div key={it.key} className="loc-optwrap">
                {it.group && it.group !== items[i - 1]?.group && <div className="loc-group" role="presentation">{it.group}</div>}
                <div
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  className={`kp-opt loc-opt${i === active ? ' on' : ''}`}
                  onPointerMove={() => i !== active && setActive(i)}
                  // فوکوس از فیلد نرود تا صفحه‌کلید گوشی بسته و باز نشود
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(it)}
                >
                  <Marked hit={it.hit} tag={it.tag} />
                  {it.hint && <span className="loc-hint xs">{it.hint}</span>}
                </div>
              </div>
            ))}
            {items.length === 0 && empty && <div className="kp-none xs mute">{empty}</div>}
          </div>
        </div>,
        document.getElementById('root') ?? document.body,
      )}
    </div>
  );
}
