import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@kelid/ui';
import { normalizeForSearch, toFaDigits } from '@kelid/core';
import { Select } from '../layout/Select';
import { Marked } from './Combo';
import { match, rank, streetKind, type Indexed } from './places';

export type SheetTab = { key: string; label: string; pool: number[] };


const collator = new Intl.Collator('fa', { numeric: true });
// فهرست الفبایی تا این اندازه؛ بیشتر از آن (خیابان‌های کل تهران) فقط مهم‌ترها و جستجو
const GROUP_MAX = 700;
const TOP = 160;
// تا این تعداد زبانه کنار هم؛ بیشتر (مناطق تهران) فهرست کشویی
const TABS = 7;
const fa = (n: number) => toFaDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

/**
 * انتخاب محله یا خیابان از فهرست کامل: جستجو بالای پنجره، زبانه برای منطقه، فهرست الفبایی با سرحرف‌های چسبان.
 * روی گوشی از پایین بالا می‌آید. Enter اولین نتیجه را برمی‌دارد، Esc می‌بندد.
 */
export function PlaceSheet({ title, sub, names, index, tabs, tab0, value, kinds, hint, onPick, onClose }: {
  title: string;
  sub?: string;
  names: string[];
  index: Indexed[];
  tabs: SheetTab[];
  tab0?: string;
  value: string;
  kinds?: boolean;
  hint?: (i: number) => string | undefined;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [tabKey, setTabKey] = useState(tab0 ?? tabs[0]?.key ?? '');
  const tab = tabs.find((t) => t.key === tabKey) ?? tabs[0];
  const pool = useMemo(() => tab?.pool ?? [], [tab]);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const cur = normalizeForSearch(value);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // روی گوشی صفحه‌کلید بی‌اجازه باز نشود؛ فهرست اول دیده شود
    if (matchMedia('(min-width: 768px)').matches) input.current?.focus();
    else body.current?.focus();
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = was;
      prev?.focus();
    };
  }, []);

  useEffect(() => body.current?.scrollTo({ top: 0 }), [tabKey, q]);

  // بی‌جستجو: الفبایی با سرحرف؛ با جستجو: بهترین‌ها اول
  const groups = useMemo(() => {
    if (q.trim() || pool.length > GROUP_MAX) return null;
    // «خیابان»، «کوچه»… جلوی نام در ترتیب الفبا حساب نمی‌شود
    const key = (i: number) => (kinds ? streetKind(names[i]!).rest : names[i]!);
    const sorted = [...pool].sort((a, b) => collator.compare(key(a), key(b)));
    const out: Array<{ letter: string; ids: number[] }> = [];
    for (const i of sorted) {
      const letter = key(i).charAt(0).replace('آ', 'ا');
      const last = out[out.length - 1];
      if (last?.letter === letter) last.ids.push(i);
      else out.push({ letter, ids: [i] });
    }
    return out;
  }, [q, pool, names, kinds]);
  const found = useMemo(() => (groups ? [] : rank(index, q, TOP, pool)), [groups, index, q, pool]);
  const exact = q.trim() && found.some((i) => index[i]!.norm === normalizeForSearch(q));

  const pick = (v: string) => {
    onPick(v);
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const item = (i: number) => {
    const name = names[i]!;
    const k = kinds ? streetKind(name).kind : '';
    const hit = match(name, q) ?? { text: name, at: 0, len: 0, score: 4 };
    const on = normalizeForSearch(name) === cur;
    // در زبانهٔ یک منطقه، نام همان منطقه کنار هر محله تکراری است
    const h = tab === tabs[0] ? hint?.(i) : undefined;
    return (
      <button key={i} type="button" className="ps-it" aria-pressed={on} onClick={() => pick(name)}>
        <span className="ps-nm"><Marked hit={hit} tag={k || undefined} /></span>
        {h && <span className="ps-h">{h}</span>}
        {on && <span className="ps-ok" aria-hidden="true"><Icon name="check" size="s" thick /></span>}
      </button>
    );
  };

  return createPortal(
    <div className="overlay ps-ov" onMouseDown={onClose}>
      <div className="ps" role="dialog" aria-modal="true" aria-labelledby="ps-title" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="ps-grab" aria-hidden="true" />
        <header className="ps-top">
          <div className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
            <h2 id="ps-title" className="ps-title">{title}</h2>
            {sub && <span className="xs mute">{sub}</span>}
          </div>
          <button type="button" className="ps-x" onClick={onClose} aria-label="بستن"><Icon name="x" /></button>
        </header>

        <div className="ps-search">
          <Icon name="search" size="s" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const first = groups ? groups[0]?.ids[0] : found[0];
              if (q.trim() && first !== undefined) pick(names[first]!);
            }}
            placeholder="جستجو…"
            aria-label={`جستجو در ${title}`}
            enterKeyHint="search"
          />
          {q && <button type="button" className="ps-clear" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="پاک کردن جستجو"><Icon name="x" size="s" /></button>}
        </div>

        {tabs.length > 1 && tabs.length <= TABS && (
          <div className="ps-tabs" role="tablist" aria-label="منطقه">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={t.key === tab?.key} className="ps-tab" onClick={() => setTabKey(t.key)}>
                {t.label}<span className="ps-tab-n">{fa(t.pool.length)}</span>
              </button>
            ))}
          </div>
        )}
        {tabs.length > TABS && (
          <div className="ps-tabsel">
            <Select value={tab?.key ?? ''} label="منطقه" popClass="ps-pop" options={tabs.map((t) => ({ value: t.key, label: t.label, hint: `${fa(t.pool.length)} محله` }))} onChange={setTabKey} />
          </div>
        )}

        <div ref={body} className="ps-body" tabIndex={-1}>
          {groups ? (
            groups.map((g) => (
              <section key={g.letter} className="ps-g" aria-label={g.letter}>
                <h3 className="ps-l">{g.letter}</h3>
                <div className="ps-grid">{g.ids.map(item)}</div>
              </section>
            ))
          ) : (
            <>
              {!q.trim() && pool.length > TOP && <p className="ps-note xs mute">{fa(TOP)} مورد پرکاربرد از {fa(pool.length)}؛ برای بقیه نام را جستجو کنید.</p>}
              <div className="ps-grid">{found.map(item)}</div>
            </>
          )}
          {q.trim() && !found.length && !groups?.length && <p className="ps-empty">«{q.trim()}» در فهرست نیست.</p>}
        </div>

        {q.trim() && !exact && (
          <footer className="ps-foot">
            <button type="button" className="btn btn-s ps-use" onClick={() => pick(q.trim())}>
              <Icon name="edit" size="s" />همین «{q.trim()}» را بنویس
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
