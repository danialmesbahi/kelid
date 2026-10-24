import { useState } from 'react';
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Icon, Logo, type IconName } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { DEMO } from './api';
import { useAuth } from './auth';
import { useTheme } from './theme';
import { useLiveConnection, useLiveState } from './live';
import { Dialog, Phone, useLoad } from './ui';

const liveText = { live: 'زنده', connecting: 'در حال وصل شدن…', offline: 'قطع است؛ دوباره وصل می‌شود' } as const;

const themeNext = { light: 'dark', dark: 'auto', auto: 'light' } as const;
const themeName = { light: 'روشن', dark: 'تیره', auto: 'هماهنگ با سیستم' } as const;

export function Shell() {
  const { admin, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const [leaving, setLeaving] = useState(false);
  const live = useLiveState();
  // صفحهٔ یک دفتر هم زیر «دفترها» است
  const inOffice = useLocation().pathname.startsWith('/offices/');
  useLiveConnection();
  // نظرها و خطاهای باز، زنده؛ همان آماری که صفحهٔ دفترها دارد (یک درخواست مشترک در حافظه).
  const stats = useLoad('stats', (a, t) => a.stats(t)).data;
  const open = (stats?.openFeedback ?? 0) + (stats?.openErrors ?? 0);
  const tickets = stats?.openTickets ?? 0;
  const nav: { to: string; icon: IconName; label: string; short: string; count: number; badge?: string }[] = [
    { to: '/', icon: 'files', label: 'دفترها', short: 'دفترها', count: 0 },
    { to: '/payments', icon: 'receipt', label: 'پرداخت‌ها', short: 'پرداخت‌ها', count: 0 },
    { to: '/tickets', icon: 'msg', label: 'پشتیبانی', short: 'پشتیبانی', count: tickets, badge: `${toFaDigits(tickets)} تیکت منتظر پاسخ` },
    { to: '/beta', icon: 'warn', label: 'نظرها و خطاها', short: 'نظر و خطا', count: open, badge: `${toFaDigits(open)} مورد باز` },
  ];
  const themeBtn = (
    <button
      type="button"
      className="ib ghost"
      aria-label={`پوسته: ${themeName[theme]}`}
      title={`پوسته: ${themeName[theme]}`}
      onClick={() => setTheme(themeNext[theme])}
    >
      <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'today' : 'pc'} />
    </button>
  );
  const outBtn = (
    <button type="button" className="ib ghost" aria-label="خروج از پنل" title="خروج" onClick={() => setLeaving(true)}>
      <Icon name="out" />
    </button>
  );
  const status = DEMO ? (
    <span className="xs mute">پیش‌نمایش با دادهٔ نمونه</span>
  ) : (
    <span className={`xs mute ad-live ${live}`} role="status" title="هر تغییری در برنامهٔ دفترها همین لحظه این‌جا دیده می‌شود">
      <i aria-hidden="true" />
      {liveText[live]}
    </span>
  );
  return (
    <div className="shell ad-shell">
      <aside className="side ad-side" aria-label="منوی پنل">
        <div className="brand">
          <Logo size={36} />
          <span className="col" style={{ lineHeight: 1.35 }}>
            <span className="b sm">پنل فروشنده</span>
            {status}
          </span>
        </div>
        <nav className="col ad-nav" style={{ gap: 4 }}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              title={n.label}
              className={({ isActive }) => (isActive || (n.to === '/' && inOffice) ? 'nav on' : 'nav')}
            >
              <Icon name={n.icon} />
              <span className="ad-nl">{n.label}</span>
              {n.count > 0 && (
                <span className="badge num" aria-label={n.badge}>
                  {toFaDigits(n.count)}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <span className="sp" />
        <div className="ad-me">
          <span className="av" aria-hidden="true">
            {admin?.name.trim()[0] ?? '؟'}
          </span>
          <span className="col sp" style={{ minWidth: 0, lineHeight: 1.4 }}>
            <span className="b sm ad-ell">{admin?.name}</span>
            <span className="xs mute">{admin && <Phone value={admin.phone} />}</span>
          </span>
          {themeBtn}
          {outBtn}
        </div>
      </aside>
      <main className="main">
        {/* گوشی: نوار بالا جای ستون کناری را می‌گیرد و بخش‌ها به نوار پایین می‌روند، زیر انگشت شست */}
        <div className="ad-top">
          <Logo size={32} />
          <span className="col sp" style={{ lineHeight: 1.35, minWidth: 0 }}>
            <span className="b sm">پنل فروشنده</span>
            {status}
          </span>
          {themeBtn}
          {outBtn}
        </div>
        <Outlet />
      </main>
      {/* صفحهٔ تازه از بالا باز می‌شود و «برگشت» همان‌جای قبلی فهرست برمی‌گردد */}
      <ScrollRestoration />
      <nav className="ad-tabs" aria-label="منوی پنل">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive || (n.to === '/' && inOffice) ? 'tab on' : 'tab')}>
            <span className="ad-tab-ic">
              <Icon name={n.icon} />
              {n.count > 0 && (
                <span className="badge num" aria-label={n.badge}>
                  {toFaDigits(n.count)}
                </span>
              )}
            </span>
            {n.short}
          </NavLink>
        ))}
      </nav>
      {leaving && (
        <Dialog title="از پنل خارج می‌شوید؟" onClose={() => setLeaving(false)}>
          <div className="ad-dlg-bd">
            <p className="sm mute" style={{ margin: 0, lineHeight: 1.9 }}>
              برای ورود دوباره، رمز و کد دومرحله‌ای لازم است.
            </p>
            <div className="ad-dlg-ft">
              <button type="button" className="btn btn-g" data-autofocus onClick={() => setLeaving(false)}>
                می‌مانم
              </button>
              <button type="button" className="btn ad-btn-bad" onClick={() => signOut()}>
                <Icon name="out" size="s" />
                خروج
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
