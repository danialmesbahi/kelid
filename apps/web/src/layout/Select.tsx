import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@kelid/ui';
import { normalizeForSearch, toFaDigits } from '@kelid/core';
import './picker.css';

export type SelectOption<T extends string> = { value: T; label: string; hint?: string; lead?: ReactNode };

type Place = { top: number; left: number; width: number; up: boolean; max: number };

/** جای فهرست زیر فیلد (یا بالای آن اگر پایین جا نیست)؛ بیرون از پنجره رندر می‌شود تا بریده نشود. */
export function usePopoverPlace(open: boolean, anchor: React.RefObject<HTMLElement | null>, minWidth = 0): Place | null {
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const below = innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 260 && above > below;
      const width = Math.max(r.width, minWidth);
      // راست‌به‌چپ: لبهٔ راست فهرست با لبهٔ راست فیلد یکی است و از صفحه بیرون نمی‌زند
      const left = Math.min(Math.max(8, r.right - width), innerWidth - width - 8);
      setPlace({ top: up ? r.top - 6 : r.bottom + 6, left, width, up, max: Math.min(360, (up ? above : below) - 6) });
    };
    update();
    addEventListener('resize', update);
    addEventListener('scroll', update, true);
    return () => {
      removeEventListener('resize', update);
      removeEventListener('scroll', update, true);
    };
  }, [open, anchor, minWidth]);
  return open ? place : null;
}

/**
 * فهرست کشویی با ظاهر خود کلید، به جای <select> که در هر ویندوز و گوشی شکل دیگری دارد.
 * با صفحه‌کلید کامل کار می‌کند: Enter/Space/↓ باز، ↑/↓ حرکت، Enter انتخاب، Esc بستن (فقط فهرست، نه پنجرهٔ دور آن).
 * بیشتر از ۷ گزینه که باشد، بالای فهرست جستجو دارد.
 */
export function Select<T extends string>({ value, options, onChange, label, placeholder }: { value: T; options: Array<SelectOption<T>>; onChange: (v: T) => void; label: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const place = usePopoverPlace(open, btn, 240);
  const cur = options.find((o) => o.value === value);
  const searchable = options.length > 7;
  const nq = normalizeForSearch(q);
  const shown = nq ? options.filter((o) => normalizeForSearch(`${o.label} ${o.hint ?? ''}`).includes(nq)) : options;

  const show = () => {
    setQ('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  };
  const choose = (o: SelectOption<T>) => {
    onChange(o.value);
    close();
  };

  const ready = !!place;
  useEffect(() => {
    if (!ready) return;
    if (searchable) search.current?.focus();
    else list.current?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.parentElement?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    addEventListener('pointerdown', away, true);
    return () => removeEventListener('pointerdown', away, true);
  }, [ready, searchable]);

  // گزینهٔ فعال همیشه در دید بماند
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[active];
      if (o) choose(o);
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="fld kp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${cur?.label ?? placeholder ?? ''}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (open) onKey(e);
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show();
          }
        }}
      >
        {cur?.lead}
        <span className={`kp-val${cur ? '' : ' faint'}`}>{cur?.label ?? placeholder}</span>
        <span className={`kp-chev${open ? ' up' : ''}`} aria-hidden="true"><Icon name="down" size="s" /></span>
      </button>
      {place && createPortal(
        <div className={`kp-pop${place.up ? ' up' : ''}`} style={{ top: place.top, left: place.left, width: place.width }} onKeyDown={onKey}>
          {searchable && (
            <div className="kp-search">
              <Icon name="search" size="s" />
              <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="جستجو…" aria-label={`جستجو در ${label}`} aria-controls={id} aria-activedescendant={shown[active] ? `${id}-${active}` : undefined} />
            </div>
          )}
          <div ref={list} id={id} role="listbox" aria-label={label} tabIndex={-1} className="kp-list" style={{ maxHeight: place.max }} aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}>
            {shown.map((o, i) => (
              <div
                key={o.value}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                className={`kp-opt${i === active ? ' on' : ''}`}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => choose(o)}
              >
                {o.lead}
                <span className="col" style={{ minWidth: 0, flex: 1 }}>
                  <span className="kp-ol">{o.label}</span>
                  {o.hint && <span className="xs mute kp-ol">{o.hint}</span>}
                </span>
                {o.value === value && <Icon name="check" size="s" thick />}
              </div>
            ))}
            {shown.length === 0 && <div className="kp-none xs mute">چیزی با «{toFaDigits(q)}» پیدا نشد.</div>}
          </div>
        </div>,
        document.getElementById('root') ?? document.body,
      )}
    </>
  );
}
