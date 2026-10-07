import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { usePrefsContext } from '../App';
import { useQuery, useStore } from '../data';
import { usePhone } from '../layout/usePhone';
import { callName, type TextSize, type ThemePref } from '../prefs';
import { WelcomeHero } from './WelcomeHero';
import './welcome.css';

const STEPS = ['خوش آمدید', 'آشنایی', 'راحتی چشم', 'شروع'] as const;
// بعد از ورود، خوش‌آمد و نام و دفتر را صفحهٔ ورود گرفته؛ آشنایی همان مسیر را با همان نقطه‌ها ادامه می‌دهد.
const LOGIN_STEPS = ['شمارهٔ موبایل', 'کد پیامکی', 'حساب'] as const;
const AFTER_LOGIN = 2;

function greetingNow(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date()));
  return h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر';
}

/**
 * آشنایی بار اول: چهار قدم کوتاه با نوشتهٔ درشت و دکمه‌های بزرگ، برای کسی که اولین بار برنامه را باز می‌کند.
 * هر تغییری (اندازهٔ نوشته، پوسته) همان لحظه روی خود برنامه دیده می‌شود. همه‌جا «بعداً» هست.
 */
export function Welcome({ continued = false }: { continued?: boolean }) {
  const prefs = usePrefsContext();
  const store = useStore();
  const phone = usePhone();
  const hasSample = useQuery('has-sample', (s) => s.hasSampleData());
  const first = continued ? AFTER_LOGIN : 0;
  const [step, setStep] = useState(first);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(prefs.userName);
  const [office, setOffice] = useState(prefs.officeName);
  const [keepSample, setKeepSample] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // هر قدم تازه، اولین فیلد یا دکمهٔ اصلی‌اش فوکوس می‌گیرد تا با Enter جلو رفت.
  useEffect(() => {
    if (phone) return;
    bodyRef.current?.querySelector<HTMLElement>('input, .wl-primary')?.focus();
  }, [step, phone]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    // روی گوشی قدم تازه از بالای صفحه شروع شود
    rootRef.current?.scrollTo({ top: 0 });
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

  // Enter در فیلد اسم به فیلد دفتر برود، نه قدم بعد؛ روی صفحه‌کلید گوشی طبیعی‌تر است
  const toOffice = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    ev.currentTarget.closest('label')?.nextElementSibling?.querySelector('input')?.focus();
  };

  return (
    <div ref={rootRef} className={`wl${continued ? ' cont' : ''}${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="wl-title">
      <WelcomeHero office={office} />

      <form className="wl-main" onSubmit={next}>
        {continued ? (
          <header className="wl-top">
            <span className="plq lg-brand">کلید</span>
            <span className="sp" />
            <ol className="wl-dots" aria-label={`قدم ${toFaDigits(LOGIN_STEPS.length + step - first + 1)} از ${toFaDigits(LOGIN_STEPS.length + STEPS.length - first)}`}>
              {LOGIN_STEPS.map((s) => <li key={s} className="past"><span className="visually-hidden">{s}</span></li>)}
              {STEPS.slice(first).map((s, i) => <li key={s} className={i + first === step ? 'on' : i + first < step ? 'past' : ''} aria-current={i + first === step ? 'step' : undefined}><span className="visually-hidden">{s}</span></li>)}
            </ol>
          </header>
        ) : (
          <header className="wl-top">
            <ol className="wl-dots" aria-label={`قدم ${toFaDigits(step + 1)} از ${toFaDigits(STEPS.length)}`}>
              {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'past' : ''} aria-current={i === step ? 'step' : undefined}><span className="visually-hidden">{s}</span></li>)}
            </ol>
            <span className="sp" />
            <button type="button" className="btn btn-g" onClick={skip}>بعداً</button>
          </header>
        )}

        <div ref={bodyRef} key={step} className={`wl-body ${dir > 0 ? 'fwd' : 'back'}`}>
          {step === 0 && (
            <>
              <span className="eb">آشنایی کوتاه · کمتر از یک دقیقه</span>
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
              <p className="wl-lead">{phone ? 'اسم شما در خوش‌آمد صفحهٔ «امروز» می‌آید؛ از تنظیمات هم عوض می‌شود.' : 'اسم شما در خوش‌آمد صفحهٔ «امروز» و اسم دفتر کنار منو می‌آید. هر وقت خواستید در تنظیمات عوضشان کنید.'}</p>
              <div className="wl-fields">
                <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={toOffice} enterKeyHint="next" placeholder="مثلاً علی رضایی" autoComplete="name" /></label>
                <label className="lbl">نام دفتر<input className="fld wl-fld" value={office} onChange={(e) => setOffice(e.target.value)} enterKeyHint="next" placeholder="مثلاً املاک پارسا" autoComplete="organization" /></label>
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
              <span className="eb">{continued ? 'وارد شدید · یک تنظیم کوچک' : 'قدم ۳'}</span>
              <h1 id="wl-title" className="wl-h">نوشته‌ها راحت خوانده می‌شوند؟</h1>
              {!phone && <p className="wl-lead">اندازه‌ای را بزنید که بدون عینک هم راحت بخوانید. همین حالا روی کل برنامه اعمال می‌شود.</p>}
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
          {step > first ? (
            <button type="button" className="btn btn-g btn-lg" onClick={() => go(step - 1)}>قبلی</button>
          ) : (
            continued && <button type="button" className="btn btn-g btn-lg" onClick={skip}>بعداً</button>
          )}
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
      <span className="wl-choice-txt">
        <span className="wl-choice-l">{label}</span>
        {hint && <span className="xs mute">{hint}</span>}
      </span>
      <span className="wl-tick" aria-hidden="true"><Icon name="check" size="s" thick /></span>
    </button>
  );
}
