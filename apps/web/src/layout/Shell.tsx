import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Icon, Kbd, Logo, type IconName } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { prefetchQuery, useQuery, useStorageInfo, useStore } from '../data';
import { syncText, toneColor, useSyncStatus } from '../sync/state';
import { clientsQuery, coverThumbsQuery, filesQuery, navCountsQuery, paletteQuery } from '../queries';
import { CommandPalette } from './CommandPalette';
import { usePrefsContext } from '../App';
import { useUpdatedToast } from '../updates';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './Toasts';
import { LicenseBar, PlanLine } from '../billing/LicenseUi';
import { useSupportUnread, useSupportUnreadSync } from '../support/unread';

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

function tabFromPath(pathname: string): string | undefined {
  if (pathname === '/') return '/';
  return NAV.find((n, i) => i > 0 && pathname.startsWith(n.to))?.to;
}

// تب هر ورودی تاریخچه. صفحهٔ جزئیات (مثل یک فایل) زیر همان تبی می‌ماند که از آن باز شد،
// نه اینکه کاربر را ناگهان به «فایل‌ها» ببرد؛ با دکمهٔ برگشت هم همان تب برمی‌گردد.
const tabByEntry = new Map<string, string | undefined>();
let lastTab: string | undefined;

function useActiveTab(): string | undefined {
  const { pathname, key } = useLocation();
  if (NAV.some((n) => n.to === pathname)) {
    lastTab = pathname;
    return pathname;
  }
  // تنظیمات و اشتراک زیر هیچ تبی نیستند
  const own = tabFromPath(pathname);
  if (!own) return undefined;
  if (!tabByEntry.has(key)) tabByEntry.set(key, lastTab ?? own);
  return tabByEntry.get(key);
}

const storageLabel = { desktop: 'ذخیرهٔ رمزگذاری‌شده روی این سیستم', browser: 'ذخیره روی همین مرورگر', memory: 'این مرورگر حافظهٔ ماندگار ندارد', locked: 'کلید در تب دیگری باز است' } as const;

// هر دعوت یک بار در هر اجرای برنامه خبر داده می‌شود؛ خود دعوت در تنظیمات می‌ماند.
let toldInvite = '';

export function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [more, setMore] = useState(false);
  // پشتیبانی روی سرور کلید است؛ بی حساب جایی برای فرستادن نیست.
  const signedIn = useAuth().status === 'signedIn';
  useSupportUnreadSync();
  const unread = useSupportUnread();
  const navigate = useNavigate();
  const storage = useStorageInfo();
  const sync = useSyncStatus();
  const counts = useQuery(navCountsQuery.key, navCountsQuery.fn);
  const store = useStore();
  const { officeName, userName } = usePrefsContext();
  useUpdatedToast();

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
  const tab = useActiveTab();
  const idx = NAV.findIndex((n) => n.to === tab);

  // دفتر دیگری شما را دعوت کرده: یک خبر کوچک، تصمیم در تنظیمات.
  const toast = useToast();
  const invite = useAuth().session?.invite;
  useEffect(() => {
    const key = invite ? `${invite.officeName}|${invite.role}` : '';
    if (!invite || toldInvite === key) return;
    toldInvite = key;
    toast(`«${invite.officeName}» شما را به دفترش دعوت کرده است`, { label: 'دیدن', run: () => void navigate('/settings', { viewTransition: true }) });
  }, [invite, toast, navigate]);

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
          <Logo size={36} />
          <span className="col" style={{ lineHeight: 1.45, minWidth: 0 }}>
            <span className="sm b" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{officeName || 'دفتر املاک'}</span>
            {userName && <span className="xs mute" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</span>}
          </span>
        </div>
        <nav aria-label="منوی اصلی" className="col navwrap" style={{ gap: 2 }}>
          <span className="nav-indicator" aria-hidden="true" style={{ transform: `translateY(${Math.max(idx, 0) * ROW}px)`, opacity: idx < 0 ? 0 : 1 }} />
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={n.to === tab ? 'nav on' : 'nav'} aria-current={n.to === tab ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
              {n.to === '/files' && counts && <span className="cnt num">{toFaDigits(counts.files)}</span>}
              {n.to === '/clients' && counts && <span className="cnt num">{toFaDigits(counts.clients)}</span>}
            </Link>
          ))}
        </nav>
        <div className="sp" />
        <Link to="/plans" className="soft lic-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 14 }}>
          <PlanLine />
          {sync ? (
            <span className="rw xs mute" style={{ gap: 6 }} aria-live="polite">
              <span className={sync.phase === 'syncing' ? 'dot sync-pulse' : 'dot'} style={{ background: toneColor[syncText(sync).tone] }} />
              {syncText(sync).label}
            </span>
          ) : (
            <span className="rw xs mute" style={{ gap: 6 }}>
              <span className="dot" style={{ background: storage.persistent ? 'var(--ok)' : 'var(--warn)' }} />
              {storageLabel[storage.where]}
            </span>
          )}
        </Link>
        {signedIn && (
          <NavLink to="/support" className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
            <Icon name="msg" />
            پشتیبانی
            {unread > 0 && <span className="badge num" aria-label={`${toFaDigits(unread)} پاسخ تازه`}>{toFaDigits(unread)}</span>}
          </NavLink>
        )}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
          <Icon name="set" />
          تنظیمات
        </NavLink>
      </aside>

      <main className="main">
        <div className="top">
          <span className="mbrand"><Logo size={32} word /></span>
          <button type="button" className="gs" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" />
            <span className="sp" style={{ textAlign: 'right' }}>جستجو در فایل‌ها، مشتری‌ها و کارها…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <span className="sp" />
          <button type="button" className="ib ghost mset" aria-label={unread > 0 ? 'بیشتر، پاسخ تازه از پشتیبانی' : 'بیشتر'} aria-expanded={more} onClick={() => setMore(true)}><Icon name="more" />{unread > 0 && <span className="mset-dot" aria-hidden="true" />}</button>
          <Link className="btn btn-p top-new" to="/add" viewTransition>
            <Icon name="plus" size="s" thick />
            فایل جدید
          </Link>
        </div>
        <div className="page col" style={{ flex: 1 }}>
          <LicenseBar />
          <Outlet />
        </div>
      </main>

      <nav aria-label="منوی اصلی" className="mtab">
        {TABS.slice(0, 2).map((t) => <TabLink key={t.to} {...t} on={t.to === tab} />)}
        <Link className="fab" to="/add" viewTransition aria-label="ثبت فایل جدید"><Icon name="plus" size="l" thick /></Link>
        {TABS.slice(2).map((t) => <TabLink key={t.to} {...t} on={t.to === tab} />)}
      </nav>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {more && <MoreSheet onClose={() => setMore(false)} support={signedIn} unread={unread} />}
    </div>
  );
}

function TabLink({ to, icon, label, on }: { to: string; icon: IconName; label: string; on: boolean }) {
  return (
    <Link to={to} className={on ? 'tab on' : 'tab'} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} />
      {label}
    </Link>
  );
}

/** برگهٔ «بیشتر» روی گوشی: بخش‌هایی که در نوار پایین جا نشده‌اند. */
function MoreSheet({ onClose, support, unread }: { onClose: () => void; support: boolean; unread: number }) {
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
        {support && (
          <NavLink to="/support" className={({ isActive }) => (isActive ? 'nav on' : 'nav')} onClick={onClose}>
            <Icon name="msg" />
            پشتیبانی
            {unread > 0 && <span className="badge num" aria-label={`${toFaDigits(unread)} پاسخ تازه`}>{toFaDigits(unread)}</span>}
          </NavLink>
        )}
      </nav>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
