import { useCallback, useEffect, useState } from 'react';
import { Icon, Skeleton } from '@kelid/ui';
import { formatLongDate, toFaDigits } from '@kelid/core';
import { useSlow } from '../data';
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
            <span className="xs mute">برای ورود دوباره کد پیامکی لازم است. اطلاعات روی همین دستگاه می‌ماند.</span>
            <button type="button" className="btn btn-g" onClick={() => setAsking(null)}>انصراف</button>
            <button type="button" className="btn btn-d" onClick={() => void signOut()}>بله، خارج شو</button>
          </span>
        ) : (
          <button type="button" className="btn btn-s" onClick={() => setAsking('out')}><Icon name="out" size="s" />خروج از حساب</button>
        )}
      </div>

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
