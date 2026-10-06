import { useState } from 'react';
import { Icon, Segmented } from '@kelid/ui';
import { usePrefsContext } from '../App';
import { useQuery, useStorageInfo, useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { useFirstVisit } from '../layout/useFirstVisit';
import type { TextSize, ThemePref } from '../prefs';

const whereText = {
  desktop: { title: 'روی همین کامپیوتر، رمزگذاری‌شده', detail: 'دیتابیس با AES-256 رمز شده و کلیدش را خود ویندوز برای حساب کاربری شما نگه می‌دارد.' },
  browser: { title: 'روی همین مرورگر', detail: 'داده در حافظهٔ ماندگار مرورگر ذخیره می‌شود و بدون اینترنت هم در دسترس است.' },
  memory: { title: 'موقت', detail: 'این مرورگر حافظهٔ ماندگار ندارد؛ با بستن صفحه داده‌ها پاک می‌شوند. از Chrome یا Edge به‌روز استفاده کنید.' },
  locked: { title: 'موقت (تب دیگری باز است)', detail: 'کلید در یک تب یا پنجرهٔ دیگر همین مرورگر باز است. آن را ببندید و این صفحه را دوباره باز کنید تا به اطلاعات اصلی وصل شوید.' },
} as const;

export function SettingsPage() {
  const { theme, setTheme, textSize, setTextSize, userName, setUserName, officeName, setOfficeName, setWelcomed } = usePrefsContext();
  const storage = useStorageInfo();
  const store = useStore();
  const toast = useToast();
  const first = useFirstVisit('settings');
  const hasSample = useQuery('has-sample', (s) => s.hasSampleData());
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={first ? 'bd enter' : 'bd'} style={{ paddingTop: 26, maxWidth: 900 }}>
      <h1 className="t1">تنظیمات</h1>

      <section aria-labelledby="me" className="col" style={{ gap: 14 }}>
        <h2 id="me" className="t2">شما و دفتر</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 620 }}>
          <label className="lbl">نام شما<input className="fld" defaultValue={userName} onBlur={(e) => setUserName(e.target.value.trim())} placeholder="مثلاً علی رضایی" /></label>
          <label className="lbl">نام دفتر<input className="fld" defaultValue={officeName} onBlur={(e) => setOfficeName(e.target.value.trim())} placeholder="مثلاً املاک پارسا" /></label>
        </div>
        <button type="button" className="lnk sm" style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setWelcomed(false)}>
          <Icon name="spark" size="s" />
          نمایش دوبارهٔ آشنایی با کلید
        </button>
      </section>

      <section aria-labelledby="look" className="col" style={{ gap: 14 }}>
        <h2 id="look" className="t2">ظاهر</h2>
        <div className="rw" style={{ gap: 16, flexWrap: 'wrap' }}>
          <span className="sb" style={{ width: 120 }}>پوسته</span>
          <Segmented<ThemePref>
            label="پوسته"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: <><Icon name="today" size="s" />روشن</> },
              { value: 'dark', label: <><Icon name="moon" size="s" />تیره</> },
              { value: 'auto', label: <><Icon name="pc" size="s" />هماهنگ با ویندوز</> },
            ]}
          />
        </div>
        <div className="rw" style={{ gap: 16, flexWrap: 'wrap' }}>
          <span className="sb" style={{ width: 120 }}>اندازهٔ نوشته</span>
          <Segmented<TextSize> label="اندازهٔ نوشته" value={textSize} onChange={setTextSize} options={[{ value: 0, label: 'معمولی' }, { value: 1, label: 'درشت' }, { value: 2, label: 'خیلی درشت' }]} />
        </div>
      </section>

      <section aria-labelledby="data" className="card col" style={{ padding: 24, gap: 16 }}>
        <div className="rw" style={{ gap: 16, alignItems: 'flex-start' }}>
          <span className="ib" style={{ width: 52, height: 52, border: 0, background: storage.persistent ? 'var(--pri-tint)' : 'var(--warn-tint)', color: storage.persistent ? 'var(--pri-text)' : 'var(--warn)', borderRadius: 16 }}>
            <Icon name={storage.persistent ? 'shield' : 'warn'} size="l" />
          </span>
          <div className="col sp" style={{ gap: 2 }}>
            <h2 id="data" className="t2">محل ذخیرهٔ اطلاعات: {whereText[storage.where].title}</h2>
            <span className="mute sm" style={{ lineHeight: 1.8 }}>{whereText[storage.where].detail}</span>
          </div>
        </div>
        {hasSample && (
          <div className="rw soft" style={{ gap: 12, padding: '14px 16px', borderRadius: 14, flexWrap: 'wrap' }}>
            <span className="col sp" style={{ lineHeight: 1.6 }}>
              <span className="sb">دادهٔ نمونه</span>
              <span className="xs mute">فایل‌ها و مشتری‌های نمونه برای آشنایی با برنامه‌اند. وقتی آماده‌اید، پاکشان کنید.</span>
            </span>
            {confirming ? (
              <span className="rw" style={{ gap: 8 }}>
                <button type="button" className="btn btn-g" onClick={() => setConfirming(false)}>انصراف</button>
                <button
                  type="button"
                  className="btn btn-d"
                  onClick={async () => {
                    await store.clearSampleData();
                    setConfirming(false);
                    toast('دادهٔ نمونه پاک شد؛ فایل‌های خودتان سر جایشان هستند');
                  }}
                >
                  بله، پاک شود
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-s" onClick={() => setConfirming(true)}>پاک کردن دادهٔ نمونه</button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="sub" className="card" style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <span className="ib" style={{ width: 52, height: 52, border: 0, background: 'var(--pri-tint)', color: 'var(--pri-text)', borderRadius: 16 }}><Icon name="gem" size="l" /></span>
        <div className="col" style={{ flex: '1 1 260px' }}>
          <h2 id="sub" className="t2">اشتراک</h2>
          <span className="mute sm">پرداخت و مدیریت اشتراک در فاز ۳ وصل می‌شود.</span>
        </div>
      </section>
    </div>
  );
}
