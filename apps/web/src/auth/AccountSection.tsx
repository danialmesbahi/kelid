import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon, Skeleton } from '@kelid/ui';
import { formatLongDate, toFaDigits } from '@kelid/core';
import { getSyncTarget, useSlow } from '../data';
import { useToast } from '../layout/Toasts';
import { ApiError, type Device } from './api';
import { syncNow, syncText, toneColor, useSyncStatus } from '../sync/state';
import { useAuth } from './AuthContext';
import { formatPhone } from './phone';
import './account.css';

function seen(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 2) return 'همین حالا';
  if (min < 60) return `${toFaDigits(min)} دقیقه پیش`;
  if (min < 24 * 60) return `${toFaDigits(Math.round(min / 60))} ساعت پیش`;
  return formatLongDate(new Date(iso));
}

/** حساب و دستگاه‌های واردشده؛ فقط وقتی برنامه به سرور وصل است (تنظیمات). */
export function AccountSection() {
  const { session, api, withToken, signOut } = useAuth();
  const toast = useToast();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<string | null>(null); // شناسهٔ دستگاه یا «out» برای خروج
  const slow = useSlow(!devices && !failed);
  const sync = useSyncStatus();
  const [wipe, setWipe] = useState(false);

  const out = async () => {
    await signOut();
    if (!wipe) return;
    // کامپیوتر مشترک: بعد از خروج هیچ اطلاعاتی از دفتر روی این دستگاه نمی‌ماند.
    const target = getSyncTarget();
    if (!target) return;
    await target.store.resetLocalData();
    target.refresh();
  };

  const load = useCallback(() => {
    if (!api) return;
    setFailed(false);
    withToken((t) => api.devices(t)).then(setDevices, () => setFailed(true));
  }, [api, withToken]);
  useEffect(load, [load]);

  if (!session || !api) return null;

  const remove = async (d: Device) => {
    setAsking(null);
    try {
      await withToken((t) => api.removeDevice(t, d.id));
      setDevices((list) => list?.filter((x) => x.id !== d.id) ?? null);
      toast(`«${d.name}» از حساب بیرون شد`);
    } catch (e) {
      toast(e instanceof ApiError && e.code === 'offline' ? 'برای این کار اینترنت لازم است' : 'دستگاه بیرون نشد؛ دوباره امتحان کنید');
    }
  };

  return (
    <section aria-labelledby="acc" className="card col" style={{ padding: 24, gap: 18 }}>
      <div className="acc-head">
        <span className="av" style={{ width: 52, height: 52, fontSize: 20 }}>{session.user.name.charAt(0) || <Icon name="user" />}</span>
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <h2 id="acc" className="t2">{session.user.name || 'حساب شما'}</h2>
          <span className="mute sm acc-sub">
            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{formatPhone(session.user.phone)}</span>
            <span>· {session.office.name}</span>
          </span>
        </div>
        {asking === 'out' ? (
          <span className="acc-ask">
            <span className="xs mute">برای ورود دوباره شماره و رمز عبور لازم است.</span>
            <label className="acc-wipe xs">
              <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
              اطلاعات دفتر را هم از این دستگاه پاک کن (کامپیوتر مشترک)
            </label>
            {wipe && !!sync?.pending && (
              <span className="xs acc-wipe-warn">{toFaDigits(sync.pending)} تغییر هنوز به سرور نرسیده و با پاک کردن از بین می‌رود؛ اول «همگام‌سازی» را بزنید.</span>
            )}
            <button type="button" className="btn btn-g" onClick={() => setAsking(null)}>انصراف</button>
            <button type="button" className="btn btn-d" onClick={() => void out()}>بله، خارج شو</button>
          </span>
        ) : (
          <button type="button" className="btn btn-s" onClick={() => setAsking('out')}><Icon name="out" size="s" />خروج از حساب</button>
        )}
      </div>

      <PasswordRow />
      {sync && (
        <div className="soft acc-sync" aria-live="polite">
          <span className={sync.phase === 'syncing' ? 'dot sync-pulse' : 'dot'} style={{ background: toneColor[syncText(sync).tone] }} />
          <span className="col" style={{ minWidth: 0, lineHeight: 1.6 }}>
            <span className="sb">{syncText(sync).label}</span>
            <span className="xs mute">
              {sync.phase === 'blocked'
                ? 'اطلاعات این دستگاه با دفتر دیگری همگام شده و به این حساب فرستاده نمی‌شود.'
                : sync.lastSync
                  ? `آخرین همگام‌سازی: ${seen(new Date(sync.lastSync).toISOString())}. تغییرها خودکار بین دستگاه‌های دفتر جابه‌جا می‌شوند.`
                  : 'تغییرها خودکار بین دستگاه‌های دفتر جابه‌جا می‌شوند؛ بدون اینترنت هم کار کنید.'}
            </span>
          </span>
          {sync.phase !== 'blocked' && (
            <button type="button" className="btn btn-s" disabled={sync.phase === 'syncing'} onClick={syncNow}>
              <Icon name="sync" size="s" />
              همگام‌سازی
            </button>
          )}
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        <span className="sb">دستگاه‌هایی که وارد شده‌اند</span>
        {failed ? (
          <span className="rw xs mute" style={{ gap: 8 }}>
            برای دیدن فهرست دستگاه‌ها اینترنت لازم است.
            <button type="button" className="lnk xs" style={{ border: 0, background: 'none', padding: 0 }} onClick={load}>دوباره</button>
          </span>
        ) : !devices ? (
          slow && <><Skeleton h={54} r={14} /><Skeleton h={54} r={14} /></>
        ) : (
          <ul className="acc-list">
            {devices.map((d) => (
              <li key={d.id} className="soft acc-dev">
                <Icon name={/گوشی|آیفون|تبلت|آیپد/.test(d.name) ? 'mobile' : 'pc'} />
                <span className="col" style={{ minWidth: 0, lineHeight: 1.6 }}>
                  <span className="sb">
                    {d.name}
                    {d.current && <span className="tag" style={{ marginInlineStart: 8 }}>همین دستگاه</span>}
                  </span>
                  <span className="xs mute">آخرین استفاده: {seen(d.lastSeenAt)}</span>
                </span>
                {!d.current &&
                  (asking === d.id ? (
                    <span className="acc-ask">
                      <button type="button" className="btn btn-g" onClick={() => setAsking(null)}>انصراف</button>
                      <button type="button" className="btn btn-d" onClick={() => void remove(d)}>بیرون شود</button>
                    </span>
                  ) : (
                    <button type="button" className="ib ghost" aria-label={`بیرون کردن ${d.name} از حساب`} onClick={() => setAsking(d.id)}><Icon name="x" /></button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** گذاشتن یا عوض کردن رمز عبور؛ رمز فعلی لازم است تا کسی که فقط به دستگاه باز دست یافته نتواند رمز را عوض کند. */
function PasswordRow() {
  const { session, api, withToken, markPassword } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session || !api) return null;
  // نشست‌های قدیمی این را نمی‌دانند؛ رمز فعلی پرسیده می‌شود و سرور اگر رمزی نبود نادیده‌اش می‌گیرد.
  const has = session.user.hasPassword !== false;

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setError('');
    setShow(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (next.length < 8) return setError('رمز تازه دست‌کم ۸ نویسه باشد.');
    setBusy(true);
    setError('');
    try {
      await withToken((t) => api.setPassword(t, next, has ? current : undefined));
      await markPassword();
      toast(has ? 'رمز عبور عوض شد' : 'رمز عبور گذاشته شد');
      close();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setError(code === 'wrong' ? 'رمز فعلی درست نیست.' : code === 'bad_password' ? 'رمز تازه دست‌کم ۸ نویسه باشد.' : code === 'offline' ? 'برای این کار اینترنت لازم است.' : 'رمز ذخیره نشد؛ دوباره امتحان کنید.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="soft acc-pass">
      <div className="acc-dev" style={{ padding: 0 }}>
        <Icon name="lock" />
        <span className="col" style={{ minWidth: 0, lineHeight: 1.6 }}>
          <span className="sb">رمز عبور</span>
          <span className="xs mute">{has ? 'با شمارهٔ موبایل و رمز وارد می‌شوید؛ کد پیامکی هم همیشه هست.' : 'هنوز رمزی نگذاشته‌اید؛ ورود فقط با کد پیامکی است.'}</span>
        </span>
        {!open && (
          <button type="button" className="btn btn-s" onClick={() => setOpen(true)}>
            <Icon name="key" size="s" />
            {has ? 'تغییر رمز' : 'گذاشتن رمز'}
          </button>
        )}
      </div>
      {open && (
        <form className="acc-pwform enter" onSubmit={save} noValidate>
          {/* برای مدیر رمز مرورگر: رمز تازه مال همین شماره است. */}
          <input type="text" autoComplete="username" value={session.user.phone} readOnly hidden />
          {has && (
            <label className="lbl">
              رمز فعلی
              <input className="fld" type={show ? 'text' : 'password'} dir="ltr" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} maxLength={128} autoFocus />
            </label>
          )}
          <label className="lbl">
            <span>رمز تازه <span className="hint">دست‌کم ۸ نویسه</span></span>
            <input className="fld" type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} maxLength={128} autoFocus={!has} />
          </label>
          <label className="acc-show xs">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            نمایش رمز
          </label>
          {error && <p className="acc-err xs" role="alert"><Icon name="warn" size="s" />{error}</p>}
          <span className="acc-ask">
            <button type="button" className="btn btn-g" onClick={close} disabled={busy}>انصراف</button>
            <button type="submit" className="btn btn-p" disabled={busy} aria-busy={busy}>{busy ? 'لحظه‌ای صبر کنید…' : 'ذخیرهٔ رمز'}</button>
          </span>
        </form>
      )}
    </div>
  );
}
