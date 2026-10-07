import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '@kelid/ui';
import { toEnDigits, toFaDigits } from '@kelid/core';
import { usePrefsContext } from '../App';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { usePhone } from '../layout/usePhone';
import { WelcomeHero } from '../welcome/WelcomeHero';
import { ApiError, deviceLabel, type Session } from './api';
import { formatPhone, phoneDigits } from './phone';
import { useAuth } from './AuthContext';
import '../welcome/welcome.css';
import './login.css';

export type AuthMode = 'login' | 'signup';
type Step = 'phone' | 'details' | 'code' | 'nouser';
const STEPS: Record<AuthMode, Step[]> = { login: ['phone', 'code'], signup: ['details', 'code'] };
const LEN = 6;

function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'مشکلی پیش آمد. دوباره امتحان کنید.';
  switch (e.code) {
    case 'bad_phone':
      return 'این شمارهٔ موبایل درست نیست؛ مثل ۰۹۱۲ ۳۴۵ ۶۷۸۹ بنویسید.';
    case 'wrong':
      return e.attemptsLeft ? `کد درست نیست. ${toFaDigits(e.attemptsLeft)} بار دیگر می‌توانید امتحان کنید.` : 'کد درست نیست.';
    case 'bad_code':
      return 'کد شش رقم است.';
    case 'expired':
      return 'این کد دیگر معتبر نیست؛ یک کد تازه بگیرید.';
    case 'too_many':
      return `چند بار پشت هم درخواست شد. ${waitText(e.retryAfter ?? 60)} دیگر دوباره امتحان کنید.`;
    case 'sms_failed':
      return 'پیامک فرستاده نشد. چند لحظه بعد دوباره بزنید.';
    case 'offline':
      return 'به اینترنت وصل نیستید. اولین ورود اینترنت می‌خواهد؛ بعد از آن کلید بدون اینترنت هم کار می‌کند.';
    case 'bad_name':
      return 'نام شما و نام دفتر را بنویسید.';
    default:
      return 'سرور کلید جواب نداد. چند لحظه بعد دوباره امتحان کنید.';
  }
}

function waitText(sec: number): string {
  return sec >= 120 ? `${toFaDigits(Math.ceil(sec / 60))} دقیقه` : `${toFaDigits(sec)} ثانیه`;
}

function clock(sec: number): string {
  return toFaDigits(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
}

/**
 * ورود و ثبت‌نام با موبایل، بدون رمز عبور (کد پیامکی).
 * ورود: شماره ← کد ← داخل برنامه. ثبت‌نام: نام شما، نام دفتر و شماره ← کد ← آشنایی کوتاه.
 * این‌که شماره‌ای حساب دارد یا نه فقط بعد از کد درست معلوم می‌شود تا کسی نتواند شماره‌های مشتری‌ها را امتحان کند.
 */
export function Login({ onDone, handOff = false }: { onDone: (mode: AuthMode) => void; /** آشنایی بلافاصله جایش را می‌گیرد؛ بدون محو شدن. */ handOff?: boolean }) {
  const { api, signIn } = useAuth();
  const prefs = usePrefsContext();
  const store = useStore();
  const toast = useToast();
  const isPhone = usePhone();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<Step>('phone');
  const [dir, setDir] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // کد درست بود ولی شماره حساب نداشت: ساختن دفتر دیگر کد تازه نمی‌خواهد.
  const [ticket, setTicket] = useState('');
  const [name, setName] = useState('');
  const [office, setOffice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const order: Step[] = ['phone', 'details', 'code', 'nouser'];
  const go = (s: Step, m: AuthMode = mode) => {
    setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1);
    setError('');
    setMode(m);
    setStep(s);
  };

  // هر قدم تازه، فیلد اصلی‌اش فوکوس می‌گیرد (روی گوشی هم، تا صفحه‌کلید همان لحظه باز شود).
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLInputElement>('input:not([readonly])')?.focus({ preventScroll: isPhone });
  }, [step, mode, isPhone]);

  // شمارش معکوس فقط تا وقتی لازم است؛ بعدش هیچ تایمری نمی‌ماند.
  const left = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (step !== 'code' || resendAt <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= resendAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [step, resendAt]);

  const fail = (e: unknown) => {
    setError(errorText(e));
    setShake(true);
  };

  const sendCode = async () => {
    if (!api || busy) return;
    if (phone.length !== 11 || !phone.startsWith('09')) return fail(new ApiError('bad_phone'));
    setBusy(true);
    setError('');
    try {
      const { retryAfter } = await api.requestOtp(phone);
      setResendAt(Date.now() + retryAfter * 1000);
      setNow(Date.now());
      setCode('');
      if (step !== 'code') go('code');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_many' && step === 'code') setResendAt(Date.now() + (e.retryAfter ?? 60) * 1000);
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const finish = async (s: Session, kind: AuthMode) => {
    await signIn(s);
    // نام‌ها از این به بعد از سرور می‌آیند؛ همان‌ها در منو و صفحهٔ امروز دیده می‌شوند.
    if (s.user.name) prefs.setUserName(s.user.name);
    if (s.office.name) prefs.setOfficeName(s.office.name);
    const tour = kind === 'signup' && handOff;
    if (kind === 'login') {
      // دستگاه تازه در دفتری که از قبل هست: آشنایی لازم نیست و نمونه‌ها نباید کنار فایل‌های واقعی دفتر بنشینند.
      prefs.setWelcomed(true);
      if (await store.hasSampleData()) await store.clearSampleData();
    }
    if (tour) return onDone(kind);
    setLeaving(true);
    setTimeout(() => onDone(kind), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  };

  const createOffice = async (t: string) => {
    if (!api) return;
    await finish(await api.signup(t, name.trim(), office.trim(), deviceLabel()), 'signup');
  };

  const verify = async (value = code) => {
    if (!api || busy || value.length !== LEN) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.verify(phone, value, deviceLabel());
      if ('session' in r) {
        // ثبت‌نام با شماره‌ای که از قبل حساب دارد: همان حساب باز می‌شود، چیزی دوباره ساخته نمی‌شود.
        if (mode === 'signup') toast('این شماره از قبل در کلید حساب داشت؛ وارد همان حساب شدید');
        await finish(r.session, 'login');
      } else if (mode === 'signup') {
        await createOffice(r.signupToken);
      } else {
        setTicket(r.signupToken);
        go('nouser');
      }
    } catch (e) {
      setCode('');
      fail(e);
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const validDetails = () => {
    if (!name.trim() || !office.trim()) return fail(new ApiError('bad_name')), false;
    return true;
  };

  /** ثبت‌نام: با شماره‌ای که همین الان تأیید شده دیگر کد نمی‌خواهد. */
  const submitDetails = async () => {
    if (!validDetails()) return;
    if (!ticket) return void sendCode();
    setBusy(true);
    setError('');
    try {
      await createOffice(ticket);
    } catch (e) {
      fail(e);
      // بلیت ساختن دفتر ربع ساعت اعتبار دارد؛ بعدش با کد تازه.
      if (e instanceof ApiError && e.code === 'expired') setTicket('');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'phone') void sendCode();
    else if (step === 'details') void submitDetails();
    else if (step === 'code') void verify();
    else go('details', 'signup');
  };

  const onCode = (raw: string) => {
    const v = toEnDigits(raw).replace(/\D/g, '').slice(0, LEN);
    setCode(v);
    if (error) setError('');
    // رقم ششم = ورود، بدون زدن دکمه (پر شدن خودکار از پیامک هم همین‌طور)
    if (v.length === LEN) void verify(v);
  };

  const switchTo = (m: AuthMode) => {
    setTicket('');
    setCode('');
    go(m === 'login' ? 'phone' : 'details', m);
  };

  const steps = STEPS[mode];
  const idx = step === 'nouser' ? 1 : steps.indexOf(step);
  const back = step === 'code' ? (mode === 'login' ? 'phone' : 'details') : step === 'nouser' ? 'phone' : step === 'details' && ticket ? 'nouser' : null;

  const phoneField = (
    <label className="lbl lg-field">
      شمارهٔ موبایل
      <span className={`lg-phone${error && step === 'phone' ? ' bad' : ''}${shake && step === 'phone' ? ' shake' : ''}${ticket ? ' done' : ''}`} onAnimationEnd={() => setShake(false)}>
        <Icon name={ticket ? 'check' : 'mobile'} />
        <input
          className="lg-input"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          dir="ltr"
          enterKeyHint={mode === 'login' ? 'send' : 'done'}
          placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
          value={formatPhone(phone)}
          readOnly={!!ticket}
          onChange={(e) => {
            setPhone(phoneDigits(e.target.value));
            if (error) setError('');
          }}
          aria-invalid={!!error}
          aria-describedby="lg-msg"
        />
      </span>
    </label>
  );

  return (
    <div className={`wl lg${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lg-title">
      <WelcomeHero office={mode === 'signup' ? office : ''} />

      <form className="wl-main" onSubmit={submit} noValidate>
        <header className="wl-top">
          <span className="plq lg-brand">کلید</span>
          <span className="sp" />
          <ol className="wl-dots" aria-label={`قدم ${toFaDigits(idx + 1)} از ${toFaDigits(steps.length)}`}>
            {steps.map((s, i) => <li key={s} className={i === idx ? 'on' : i < idx ? 'past' : ''} aria-current={i === idx ? 'step' : undefined} />)}
          </ol>
        </header>

        <div ref={bodyRef} key={`${mode}-${step}`} className={`wl-body ${dir > 0 ? 'fwd' : 'back'}`}>
          {step === 'phone' && (
            <>
              <span className="eb">ورود</span>
              <h1 id="lg-title" className="wl-h">به دفترتان خوش برگشتید</h1>
              <p className="wl-lead">شمارهٔ موبایلتان را بزنید؛ یک کد کوتاه پیامک می‌کنیم. رمز عبور لازم نیست.</p>
              {phoneField}
              <Message id="lg-msg" error={error}>
                <Icon name="shield" size="s" />
                اطلاعات دفترتان فقط برای خودتان و همکارانتان دیده می‌شود.
              </Message>
              <p className="lg-switch">
                دفترتان هنوز در کلید حساب ندارد؟
                <button type="button" className="lnk lg-link" onClick={() => switchTo('signup')}>ثبت‌نام دفتر تازه</button>
              </p>
            </>
          )}

          {step === 'details' && (
            <>
              <span className="eb">ثبت‌نام دفتر تازه</span>
              <h1 id="lg-title" className="wl-h">دفترتان را در کلید بسازیم</h1>
              <p className="wl-lead">همین سه مورد کافی است. نام‌ها را بعداً از تنظیمات هم می‌شود عوض کرد.</p>
              <div className="wl-fields">
                <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} enterKeyHint="next" placeholder="مثلاً علی رضایی" autoComplete="name" /></label>
                <label className="lbl">نام دفتر<input className="fld wl-fld" value={office} onChange={(e) => setOffice(e.target.value)} maxLength={200} enterKeyHint="next" placeholder="مثلاً املاک پارسا" autoComplete="organization" /></label>
              </div>
              {phoneField}
              <Message id="lg-msg" error={error}>
                {ticket ? (
                  <><Icon name="check" size="s" />این شماره همین الان تأیید شد؛ کد دوباره لازم نیست.</>
                ) : (
                  <><Icon name="shield" size="s" />برای تأیید شماره یک کد پیامک می‌کنیم.</>
                )}
              </Message>
              {!ticket && (
                <p className="lg-switch">
                  حساب دارید؟
                  <button type="button" className="lnk lg-link" onClick={() => switchTo('login')}>ورود</button>
                </p>
              )}
            </>
          )}

          {step === 'code' && (
            <>
              <span className="eb">{mode === 'login' ? 'ورود · قدم ۲' : 'ثبت‌نام · قدم ۲'}</span>
              <h1 id="lg-title" className="wl-h">کد پیامک‌شده را بنویسید</h1>
              <p className="wl-lead">
                به <b className="lg-num" dir="ltr">{formatPhone(phone)}</b> فرستادیم.{' '}
                <button type="button" className="lnk lg-link" onClick={() => go(mode === 'login' ? 'phone' : 'details')}>تغییر شماره</button>
              </p>
              <div className={`lg-otp${error ? ' bad' : ''}${busy ? ' busy' : ''}${shake ? ' shake' : ''}`} onAnimationEnd={() => setShake(false)} onClick={() => codeRef.current?.focus()}>
                <input
                  ref={codeRef}
                  className="lg-otp-in"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  enterKeyHint="done"
                  maxLength={LEN}
                  value={code}
                  onChange={(e) => onCode(e.target.value)}
                  aria-label="کد شش‌رقمی"
                  aria-invalid={!!error}
                  aria-describedby="lg-msg"
                  readOnly={busy}
                />
                {Array.from({ length: LEN }, (_, i) => (
                  <span key={i} className={`lg-cell${i < code.length ? ' on' : ''}${i === Math.min(code.length, LEN - 1) ? ' cur' : ''}`} aria-hidden="true">
                    {code[i] ? toFaDigits(code[i]!) : ''}
                  </span>
                ))}
              </div>
              <Message id="lg-msg" error={error}>
                {left > 0 ? (
                  <span className="mute">ارسال دوباره تا <b className="lg-num">{clock(left)}</b></span>
                ) : (
                  <button type="button" className="lnk lg-link" onClick={() => void sendCode()} disabled={busy}>
                    <Icon name="sync" size="s" />
                    کد نرسید؟ دوباره بفرست
                  </button>
                )}
              </Message>
              {api?.demoCode && <span className="lg-demo">پیش‌نمایش: کد <b>{toFaDigits(api.demoCode)}</b> است</span>}
            </>
          )}

          {step === 'nouser' && (
            <>
              <span className="eb">حسابی پیدا نشد</span>
              <h1 id="lg-title" className="wl-h">این شماره هنوز در کلید حساب ندارد</h1>
              <p className="wl-lead">
                اگر دفترتان حساب دارد، با شماره‌ای وارد شوید که در دفتر ثبت شده. اگر نه، همین حالا با{' '}
                <b className="lg-num" dir="ltr">{formatPhone(phone)}</b> دفتر تازه بسازید؛ کد دوباره لازم نیست.
              </p>
              <Message id="lg-msg" error={error} />
            </>
          )}
        </div>

        <footer className="wl-ft">
          {back && <button type="button" className="btn btn-g btn-lg" onClick={() => go(back, back === 'nouser' || back === 'phone' ? 'login' : mode)} disabled={busy}>{step === 'nouser' ? 'شمارهٔ دیگر' : 'قبلی'}</button>}
          <span className="sp" />
          <button type="submit" className="btn btn-p btn-lg wl-primary" disabled={busy || (step === 'code' && code.length < LEN)} aria-busy={busy}>
            {busy
              ? step === 'phone' || (step === 'details' && !ticket) ? 'در حال فرستادن…' : 'لحظه‌ای صبر کنید…'
              : step === 'phone' ? 'دریافت کد'
              : step === 'details' ? (ticket ? 'ساختن دفتر و ورود' : 'دریافت کد')
              : step === 'code' ? (mode === 'login' ? 'ورود' : 'ساختن دفتر')
              : 'ساختن دفتر تازه'}
            <Icon name="chl" size="s" />
          </button>
        </footer>
      </form>
    </div>
  );
}

function Message({ id, error, children }: { id: string; error: string; children?: ReactNode }) {
  return (
    <p id={id} className={`lg-msg${error ? ' err' : ''}`} role={error ? 'alert' : undefined} aria-live="polite">
      {error ? (
        <>
          <Icon name="warn" size="s" />
          {error}
        </>
      ) : (
        children
      )}
    </p>
  );
}
