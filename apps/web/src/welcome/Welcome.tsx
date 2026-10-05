import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { usePrefsContext } from '../App';
import { useQuery, useStore } from '../data';
import { usePhone } from '../layout/usePhone';
import { callName, type TextSize, type ThemePref } from '../prefs';
import './welcome.css';

const STEPS = ['خوش آمدید', 'آشنایی', 'راحتی چشم', 'شروع'] as const;

function greetingNow(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date()));
  return h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر';
}

/**
 * آشنایی بار اول: چهار قدم کوتاه با نوشتهٔ درشت و دکمه‌های بزرگ، برای کسی که اولین بار برنامه را باز می‌کند.
 * هر تغییری (اندازهٔ نوشته، پوسته) همان لحظه روی خود برنامه دیده می‌شود. همه‌جا «بعداً» هست.
 */
export function Welcome() {
  const prefs = usePrefsContext();
  const store = useStore();
  const phone = usePhone();
  const hasSample = useQuery('has-sample', (s) => s.hasSampleData());
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(prefs.userName);
  const [office, setOffice] = useState(prefs.officeName);
  const [keepSample, setKeepSample] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // هر قدم تازه، اولین فیلد یا دکمهٔ اصلی‌اش فوکوس می‌گیرد تا با Enter جلو رفت.
  useEffect(() => {
    if (phone) return;
    bodyRef.current?.querySelector<HTMLElement>('input, .wl-primary')?.focus();
  }, [step, phone]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const finish = async () => {
    prefs.setUserName(name.trim());
    prefs.setOfficeName(office.trim());
    if (hasSample && !keepSample) await store.clearSampleData();
    setLeaving(true);
    // انیمیشن کنار رفتن تمام شود، بعد برداشته شود
    setTimeout(() => prefs.setWelcomed(true), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  };

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    if (step < STEPS.length - 1) go(step + 1);
    else void finish();
  };

  const skip = () => {
    prefs.setUserName(name.trim());
    prefs.setOfficeName(office.trim());
    prefs.setWelcomed(true);
  };

  const who = callName(name);

  return (
    <div className={`wl${step > 0 ? ' later' : ''}${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="wl-title">
      <aside className="wl-hero" aria-hidden="true">
        <div className="wl-glow" />
        <div className="wl-stage">
          <span className="plq wl-key">کلید</span>
          <span className="wl-float f1"><span className="plq s">۰۲۷</span><b>آپارتمان ۱۲۰ متری</b><small>سعادت‌آباد · ۲۸ میلیارد</small></span>
          <span className="wl-float f2"><span className="av">ک</span><b>آقای کریمی</b><small className="ok">۹۲٪ جور</small></span>
          <span className="wl-float f3"><Icon name="cal" size="s" /><b>بازدید ساعت ۱۰:۳۰</b><small>فردا</small></span>
        </div>
        <div className="wl-hero-ft">
          <b>{office.trim() || 'دفتر املاک شما'}</b>
          <span>همهٔ فایل‌ها و مشتری‌ها، مرتب و دم دست</span>
        </div>
      </aside>

      <form className="wl-main" onSubmit={next}>
        <header className="wl-top">
          <ol className="wl-dots" aria-label={`قدم ${toFaDigits(step + 1)} از ${toFaDigits(STEPS.length)}`}>
            {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'past' : ''} aria-current={i === step ? 'step' : undefined}><span className="visually-hidden">{s}</span></li>)}
          </ol>
          <span className="sp" />
          <button type="button" className="btn btn-g" onClick={skip}>بعداً</button>
        </header>

        <div ref={bodyRef} key={step} className={`wl-body ${dir > 0 ? 'fwd' : 'back'}`}>
          {step === 0 && (
            <>
              <span className="eb">{greetingNow()}</span>
              <h1 id="wl-title" className="wl-h">به کلید خوش آمدید</h1>
              <p className="wl-lead">دفتر املاکتان، مرتب و همیشه دم دست؛ حتی وقتی اینترنت نیست.</p>
              <ul className="wl-points">
                <Point icon="shield" title="اطلاعات فقط روی همین دستگاه" text="فایل‌ها و شمارهٔ مالک‌ها رمزگذاری‌شده نگه داشته می‌شوند." />
                <Point icon="spark" title="مشتری جور را خودش پیدا می‌کند" text="هر فایل تازه با نیاز مشتری‌ها مقایسه می‌شود." />
                <Point icon="cal" title="قرار و قرارداد در یک جا" text="بازدیدها، امضاها و کمیسیون‌ها از یاد نمی‌روند." />
              </ul>
            </>
          )}

          {step === 1 && (
            <>
              <span className="eb">قدم ۲</span>
              <h1 id="wl-title" className="wl-h">شما را چه صدا کنیم؟</h1>
              <p className="wl-lead">اسم شما در خوش‌آمد صفحهٔ «امروز» و اسم دفتر کنار منو می‌آید. هر وقت خواستید در تنظیمات عوضشان کنید.</p>
              <div className="wl-fields">
                <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً علی رضایی" autoComplete="name" /></label>
                <label className="lbl">نام دفتر<input className="fld wl-fld" value={office} onChange={(e) => setOffice(e.target.value)} placeholder="مثلاً املاک پارسا" autoComplete="organization" /></label>
              </div>
              <div className="wl-preview" aria-live="polite">
                <span className="plq" style={{ height: 34, padding: '0 12px', fontSize: 16 }}>کلید</span>
                <span className="col" style={{ minWidth: 0 }}>
                  <b className="wl-ell">{office.trim() || 'نام دفتر'}</b>
                  <span className="xs mute">{greetingNow()}{who ? `، ${who}` : ''}</span>
                </span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="eb">قدم ۳</span>
              <h1 id="wl-title" className="wl-h">نوشته‌ها راحت خوانده می‌شوند؟</h1>
              <p className="wl-lead">اندازه‌ای را بزنید که بدون عینک هم راحت بخوانید. همین حالا روی کل برنامه اعمال می‌شود.</p>
              <div className="wl-choices" role="radiogroup" aria-label="اندازهٔ نوشته">
                {([0, 1, 2] as TextSize[]).map((z) => (
                  <Choice key={z} on={prefs.textSize === z} onClick={() => prefs.setTextSize(z)} label={['معمولی', 'درشت', 'خیلی درشت'][z]!}>
                    <span className="wl-aa" style={{ fontSize: [22, 28, 34][z] }}>آ ب پ</span>
                  </Choice>
                ))}
              </div>
              <div className="wl-choices" role="radiogroup" aria-label="پوسته">
                {([['light', 'روشن'], ['dark', 'تیره'], ['auto', 'هماهنگ با سیستم']] as Array<[ThemePref, string]>).map(([t, label]) => (
                  <Choice key={t} on={prefs.theme === t} onClick={() => prefs.setTheme(t)} label={label}>
                    <span className={`wl-win ${t}`}><i /><i /><i /></span>
                  </Choice>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="eb">آماده‌اید</span>
              <h1 id="wl-title" className="wl-h">{who ? `${who}، از کجا شروع کنیم؟` : 'از کجا شروع کنیم؟'}</h1>
              {hasSample ? (
                <>
                  <p className="wl-lead">چند فایل و مشتری نمونه گذاشته‌ایم تا برنامه را بی‌دغدغه امتحان کنید.</p>
                  <div className="wl-choices two" role="radiogroup" aria-label="دادهٔ نمونه">
                    <Choice on={keepSample} onClick={() => setKeepSample(true)} label="اول با نمونه‌ها آشنا می‌شوم" hint="هر وقت خواستید از تنظیمات پاکشان کنید.">
                      <Icon name="spark" size="l" />
                    </Choice>
                    <Choice on={!keepSample} onClick={() => setKeepSample(false)} label="دفتر خالی؛ فایل‌های خودم را ثبت می‌کنم" hint="فقط نمونه‌ها پاک می‌شوند.">
                      <Icon name="files" size="l" />
                    </Choice>
                  </div>
                </>
              ) : (
                <p className="wl-lead">همه‌چیز آماده است.</p>
              )}
              {!phone && (
                <div className="wl-keys">
                  <span><span className="kbd">Ctrl N</span> فایل تازه</span>
                  <span><span className="kbd">Ctrl K</span> جستجو در همه‌چیز</span>
                  <span><span className="kbd">Esc</span> بستن هر پنجره</span>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="wl-ft">
          {step > 0 && <button type="button" className="btn btn-g btn-lg" onClick={() => go(step - 1)}>قبلی</button>}
          <span className="sp" />
          <button type="submit" className="btn btn-p btn-lg wl-primary">
            {step === 0 ? 'شروع آشنایی' : step === STEPS.length - 1 ? 'ورود به کلید' : 'ادامه'}
            <Icon name="chl" size="s" />
          </button>
        </footer>
      </form>
    </div>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <li>
      <span className="wl-pi"><Icon name={icon} /></span>
      <span className="col"><b>{title}</b><span className="mute">{text}</span></span>
    </li>
  );
}

function Choice({ on, onClick, label, hint, children }: { on: boolean; onClick: () => void; label: string; hint?: string; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="wl-choice" onClick={onClick}>
      <span className="wl-choice-art" aria-hidden="true">{children}</span>
      <span className="wl-choice-l">{label}</span>
      {hint && <span className="xs mute">{hint}</span>}
      <span className="wl-tick" aria-hidden="true"><Icon name="check" size="s" thick /></span>
    </button>
  );
}
