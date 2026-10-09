import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Icon } from '@kelid/ui';
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
  useLiveConnection();
  // نظرها و خطاهای باز، زنده؛ همان آماری که صفحهٔ دفترها دارد (یک درخواست مشترک در حافظه).
  const stats = useLoad('stats', (a, t) => a.stats(t)).data;
  const open = (stats?.openFeedback ?? 0) + (stats?.openErrors ?? 0);
  return (
    <div className="shell ad-shell">
      <aside className="side ad-side" aria-label="منوی پنل">
        <div className="brand">
          <span className="plq" style={{ height: 34, padding: '0 11px', fontSize: 16 }}>
            کلید
          </span>
          <span className="col" style={{ lineHeight: 1.35 }}>
            <span className="b sm">پنل فروشنده</span>
            {DEMO ? (
              <span className="xs mute">پیش‌نمایش با دادهٔ نمونه</span>
            ) : (
              <span className={`xs mute ad-live ${live}`} role="status" title="هر تغییری در برنامهٔ دفترها همین لحظه این‌جا دیده می‌شود">
                <i aria-hidden="true" />
                {liveText[live]}
              </span>
            )}
          </span>
        </div>
        <nav className="col ad-nav" style={{ gap: 4 }}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
            <Icon name="files" />
            دفترها
          </NavLink>
          <NavLink to="/payments" className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
            <Icon name="receipt" />
            پرداخت‌ها
          </NavLink>
          <NavLink to="/beta" className={({ isActive }) => (isActive ? 'nav on' : 'nav')}>
            <Icon name="msg" />
            نظرها و خطاها
            {open > 0 && <span className="badge num" aria-label={`${toFaDigits(open)} مورد باز`}>{toFaDigits(open)}</span>}
          </NavLink>
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
          <button
            type="button"
            className="ib ghost"
            aria-label={`پوسته: ${themeName[theme]}`}
            title={`پوسته: ${themeName[theme]}`}
            onClick={() => setTheme(themeNext[theme])}
          >
            <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'today' : 'pc'} />
          </button>
          <button type="button" className="ib ghost" aria-label="خروج از پنل" title="خروج" onClick={() => setLeaving(true)}>
            <Icon name="out" />
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
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
