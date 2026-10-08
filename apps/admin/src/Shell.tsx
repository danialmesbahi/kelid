import { NavLink, Outlet } from 'react-router';
import { Icon } from '@kelid/ui';
import { DEMO } from './api';
import { useAuth } from './auth';
import { useTheme } from './theme';
import { Phone } from './ui';

const themeNext = { light: 'dark', dark: 'auto', auto: 'light' } as const;
const themeName = { light: 'روشن', dark: 'تیره', auto: 'هماهنگ با سیستم' } as const;

export function Shell() {
  const { admin, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  return (
    <div className="shell ad-shell">
      <aside className="side ad-side" aria-label="منوی پنل">
        <div className="brand">
          <span className="plq" style={{ height: 34, padding: '0 11px', fontSize: 16 }}>
            کلید
          </span>
          <span className="col" style={{ lineHeight: 1.35 }}>
            <span className="b sm">پنل فروشنده</span>
            <span className="xs mute">{DEMO ? 'پیش‌نمایش با دادهٔ نمونه' : 'دفترها و اشتراک‌ها'}</span>
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
          <button type="button" className="ib ghost" aria-label="خروج از پنل" title="خروج" onClick={() => signOut()}>
            <Icon name="out" />
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
