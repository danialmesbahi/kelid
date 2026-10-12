import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon, Kbd, Plaque, type IconName } from '@kelid/ui';
import { listingPlace, headlinePrice, listingTitle, normalizeForSearch, normalizePhone, filterListings, toEnDigits } from '@kelid/core';
import { useQuery } from '../data';
import { paletteQuery } from '../queries';

type Item = { key: string; group: string; to: string; render: () => ReactNode };

const ACTIONS: Array<{ label: string; to: string; icon: IconName; kbd: string }> = [
  { label: 'ثبت فایل جدید', to: '/add', icon: 'plus', kbd: 'Ctrl N' },
  { label: 'ثبت مشتری جدید', to: '/clients/new', icon: 'user', kbd: '' },
  { label: 'شروع نمایش به مشتری', to: '/show', icon: 'show', kbd: '' },
  { label: 'تنظیمات و اشتراک', to: '/settings', icon: 'set', kbd: '' },
];

/** جستجوی سراسری؛ با Ctrl+K از هر صفحه باز می‌شود و کاملاً روی همین دستگاه کار می‌کند. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const data = useQuery(paletteQuery.key, paletteQuery.fn);

  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const nq = normalizeForSearch(q);
    const files = filterListings(data.listings, { query: q }).slice(0, 5);
    // «۰۹۱۲ ۳۴۵» با فاصله هم باید شماره را پیدا کند؛ اگر بیشتر جستجو رقم است، بی‌فاصله هم مقایسه می‌کنیم.
    const digits = toEnDigits(q).replace(/\D/g, '');
    const phoneQ = digits.length >= 3 && digits.length * 2 > q.replace(/\s/g, '').length ? digits : '';
    const clients = data.clients.filter((c) => !nq || normalizeForSearch(`${c.name} ${c.need.neighborhoods.join(' ')} ${normalizePhone(c.phone)}`).includes(nq) || (!!phoneQ && normalizePhone(c.phone).includes(phoneQ))).slice(0, 3);
    const actions = ACTIONS.filter((a) => !nq || normalizeForSearch(a.label).includes(nq));
    return [
      ...files.map((l) => ({
        key: l.id, group: 'فایل‌ها', to: `/files/${l.id}`,
        render: () => (<><Plaque value={l.plaque} deal={l.deal} /><span className="col sp" style={{ lineHeight: 1.45 }}><span className="sb">{listingTitle(l)}</span><span className="xs mute">{listingPlace(l)}</span></span><span className="num sb sm">{headlinePrice(l, true)}</span></>),
      })),
      ...clients.map((c) => ({
        key: c.id, group: 'مشتری‌ها', to: `/clients?c=${c.id}`,
        render: () => (<><span className="av" style={{ width: 32, height: 32, fontSize: 13 }}>{c.name.replace(/^(آقای|خانم|خانوادهٔ)\s*/, '').charAt(0)}</span><span className="col sp" style={{ lineHeight: 1.45 }}><span className="sb">{c.name}</span><span className="xs mute">{c.need.neighborhoods.join('، ')}</span></span></>),
      })),
      ...actions.map((a) => ({
        key: a.to, group: 'کارها', to: a.to,
        render: () => (<><span className="ib" style={{ width: 32, height: 32, border: 0, background: 'var(--sunk)' }}><Icon name={a.icon} size="s" /></span><span className="sp">{a.label}</span>{a.kbd && <Kbd>{a.kbd}</Kbd>}</>),
      })),
    ];
  }, [data, q]);

  useEffect(() => setActive(0), [q]);

  const go = (i: number) => {
    const it = items[i];
    if (!it) return;
    onClose();
    navigate(it.to, { viewTransition: true });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') go(active);
  };

  let lastGroup = '';
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="جستجوی سراسری" className="pop" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}
        style={{ width: 'min(680px, calc(100% - 32px))', marginTop: 100, background: 'var(--paper)', borderRadius: 22, boxShadow: 'var(--sh-lg), 0 0 0 1px var(--line)', overflow: 'hidden' }}>
        <label className="rw" style={{ gap: 12, padding: '0 20px', height: 68, borderBottom: '1px solid var(--line)' }}>
          <Icon name="search" size="l" className="mute" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="کد فایل، محله، نام مشتری یا یک کار…" aria-label="جستجو"
            style={{ flex: 1, border: 0, outline: 'none', fontSize: 19, background: 'transparent', height: '100%' }} />
          <Kbd>Esc</Kbd>
        </label>
        <div style={{ maxHeight: 460, overflow: 'auto', padding: '6px 10px 10px' }} role="listbox" aria-label="نتایج">
          {items.length === 0 && <div className="mute" style={{ padding: 24, textAlign: 'center' }}>چیزی پیدا نشد.</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <span className="xs sb faint" style={{ display: 'block', padding: '10px 12px 4px' }}>{it.group}</span> : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {header}
                <button type="button" role="option" aria-selected={i === active} className={`row hov ${i === active ? 'sel' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => go(i)}
                  style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'right', padding: '8px 12px' }}>
                  {it.render()}
                </button>
              </div>
            );
          })}
        </div>
        <div className="rw xs mute" style={{ gap: 16, padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--paper2)' }}>
          <span className="rw" style={{ gap: 6 }}><Kbd>↑</Kbd><Kbd>↓</Kbd>حرکت</span>
          <span className="rw" style={{ gap: 6 }}><Kbd>Enter</Kbd>باز کردن</span>
          <span className="sp" />
          <span className="rw" style={{ gap: 6 }}><span className="dot" style={{ background: 'var(--ok)' }} />جستجو روی همین دستگاه</span>
        </div>
      </div>
    </div>
  );
}
