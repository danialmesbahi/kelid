import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Icon, Kbd, type IconName } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { prefetchQuery, useQuery, useStorageInfo, useStore } from '../data';
import { clientsQuery, coverThumbsQuery, filesQuery, navCountsQuery, paletteQuery } from '../queries';
import { CommandPalette } from './CommandPalette';
import { usePrefsContext } from '../App';

const NAV: Array<{ to: string; icon: IconName; label: string }> = [
  { to: '/', icon: 'today', label: 'امروز' },
  { to: '/files', icon: 'files', label: 'فایل‌ها' },
  { to: '/clients', icon: 'users', label: 'مشتری‌ها' },
  { to: '/calendar', icon: 'cal', label: 'تقویم' },
  { to: '/deals', icon: 'deal', label: 'قراردادها' },
];

const ROW = 46; // ارتفاع هر گزینه + فاصله، برای نشانگر لغزان

/** نوار پایین گوشی؛ قراردادها و تنظیمات در برگهٔ «بیشتر» نوار بالا هستند تا تقویم جا شود. */
const TABS: Array<{ to: string; icon: IconName; label: string }> = [
  { to: '/', icon: 'today', label: 'امروز' },
  { to: '/files', icon: 'files', label: 'فایل‌ها' },
  { to: '/clients', icon: 'users', label: 'مشتری‌ها' },
  { to: '/calendar', icon: 'cal', label: 'تقویم' },
];

function activeIndex(pathname: string): number {
  if (pathname === '/') return 0;
  return NAV.findIndex((n, i) => i > 0 && pathname.startsWith(n.to));
}

const storageLabel = { desktop: 'ذخیرهٔ رمزگذاری‌شده روی این سیستم', browser: 'ذخیره روی همین مرورگر', memory: 'این مرورگر حافظهٔ ماندگار ندارد', locked: 'کلید در تب دیگری باز است' } as const;

export function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [more, setMore] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const storage = useStorageInfo();
  const counts = useQuery(navCountsQuery.key, navCountsQuery.fn);
  const store = useStore();
  const { officeName, userName } = usePrefsContext();

  // بعد از اولین نقاشی، دادهٔ صفحه‌های دیگر در وقت آزاد آماده می‌شود تا رفتن به آن‌ها مکث نداشته باشد.
  useEffect(() => {
    const warm = () => [filesQuery, clientsQuery, coverThumbsQuery, paletteQuery].forEach((q) => prefetchQuery(store, q));
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(warm, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 300);
    return () => clearTimeout(t);
  }, [store]);
  const idx = activeIndex(pathname);

  // میانبرهای سراسری: Ctrl+K جستجو، Ctrl+N فایل جدید.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k' || k === 'ل') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (k === 'n' || k === 'د') {
        e.preventDefault();
        navigate('/add', { viewTransition: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="plq" style={{ height: 34, padding: '0 12px', fontSize: 16 }}>کلید</span>
          <span className="col" style={{ lineHeight: 1.45, minWidth: 0 }}>
            <span className="sm b" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{officeName || 'دفتر املاک'}</span>
            {userName && <span className="xs mute" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</span>}
          </span>
        </div>
        <nav aria-label="منوی اصلی" className="col navwrap" style={{ gap: 2 }}>
          <span className="nav-indicator" aria-hidden="true" style={{ transform: `translateY(${Math.max(idx, 0) * ROW}px)`, opacity: idx < 0 ? 0 : 1 }} />
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
              <Icon name={n.icon} />
              {n.label}
              {n.to === '/files' && counts && <span className="cnt num">{toFaDigits(counts.files)}</span>}
              {n.to === '/clients' && counts && <span className="cnt num">{toFaDigits(counts.clients)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sp" />
        <Link to="/settings" className="soft" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 14 }}>
          <span className="rw sm" style={{ justifyContent: 'space-between' }}>
            <span className="b">پلن حرفه‌ای</span>
            <span className="xs mute num">نسخهٔ آزمایشی</span>
          </span>
          <span className="bar"><span style={{ width: '76%' }} /></span>
          <span className="rw xs mute" style={{ gap: 6 }}>
            <span className="dot" style={{ background: storage.persistent ? 'var(--ok)' : 'var(--warn)' }} />
            {storageLabel[storage.where]}
          </span>
        </Link>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
          <Icon name="set" />
          تنظیمات
        </NavLink>
      </aside>

      <main className="main">
        <div className="top">
          <span className="plq mbrand" style={{ height: 32, padding: '0 10px', fontSize: 15 }}>کلید</span>
          <button type="button" className="gs" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" />
            <span className="sp" style={{ textAlign: 'right' }}>جستجو در فایل‌ها، مشتری‌ها و کارها…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <span className="sp" />
          <button type="button" className="ib ghost mset" aria-label="بیشتر" aria-expanded={more} onClick={() => setMore(true)}><Icon name="more" /></button>
          <Link className="btn btn-p top-new" to="/add" viewTransition>
            <Icon name="plus" size="s" thick />
            فایل جدید
          </Link>
        </div>
        <div className="page col" style={{ flex: 1 }}>
          <Outlet />
        </div>
      </main>

      <nav aria-label="منوی اصلی" className="mtab">
        {TABS.slice(0, 2).map((t) => <TabLink key={t.to} {...t} />)}
        <Link className="fab" to="/add" viewTransition aria-label="ثبت فایل جدید"><Icon name="plus" size="l" thick /></Link>
        {TABS.slice(2).map((t) => <TabLink key={t.to} {...t} />)}
      </nav>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </div>
  );
}

function TabLink({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'tab on' : 'tab')}>
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}

/** برگهٔ «بیشتر» روی گوشی: بخش‌هایی که در نوار پایین جا نشده‌اند. */
function MoreSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="overlay vd-ov" onMouseDown={onClose}>
      <nav className="vd pop more-sheet" aria-label="بیشتر" onMouseDown={(e) => e.stopPropagation()}>
        {[{ to: '/deals', icon: 'deal' as const, label: 'قراردادها' }, { to: '/settings', icon: 'set' as const, label: 'تنظیمات' }].map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'nav on' : 'nav')} onClick={onClose}>
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
