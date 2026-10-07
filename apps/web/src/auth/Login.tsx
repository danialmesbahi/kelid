import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon } from '@kelid/ui';
import { toEnDigits, toFaDigits } from '@kelid/core';
import { usePrefsContext } from '../App';
import { usePhone } from '../layout/usePhone';
import { WelcomeHero } from '../welcome/WelcomeHero';
import { ApiError, deviceLabel, type Session } from './api';
import { formatPhone, phoneDigits } from './phone';
import { useAuth } from './AuthContext';
import '../welcome/welcome.css';
import './login.css';

type Step = 'phone' | 'code' | 'signup';
const STEPS: Step[] = ['phone', 'code', 'signup'];
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
 * ورود با موبایل: شماره ← کد پیامکی ← (فقط بار اول) نام دفتر. بدون رمز عبور.
 * همان صحنهٔ شب آشنایی کنارش است تا اولین چیزی که کاربر می‌بیند آشنا و آرام باشد.
 */
export function Login({ onClosed, handOff = false }: { onClosed: () => void; /** آشنایی بلافاصله جایش را می‌گیرد؛ بدون محو شدن. */ handOff?: boolean }) {
  const { api, signIn } = useAuth();
  const prefs = usePrefsContext();
  const isPhone = usePhone();
  const [step, setStep] = useState<Step>('phone');
  const [dir, setDir] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [name, setName] = useState(prefs.userName);
  const [office, setOffice] = useState(prefs.officeName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const go = (s: Step) => {
    setDir(STEPS.indexOf(s) > STEPS.indexOf(step) ? 1 : -1);
    setError('');
    setStep(s);
  };

  // هر قدم تازه، فیلد اصلی‌اش فوکوس می‌گیرد (روی گوشی هم، تا صفحه‌کلید عددی همان لحظه باز شود).
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: isPhone });
  }, [step, isPhone]);

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

  const finish = async (s: Session) => {
    await signIn(s);
    // نام‌ها از این به بعد از سرور می‌آیند؛ همان‌ها در منو و خوش‌آمد دیده می‌شوند.
    if (s.user.name) prefs.setUserName(s.user.name);
    if (s.office.name) prefs.setOfficeName(s.office.name);
    if (handOff) return onClosed();
    setLeaving(true);
    setTimeout(onClosed, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  };

  const verify = async (value = code) => {
    if (!api || busy || value.length !== LEN) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.verify(phone, value, deviceLabel());
      if ('session' in r) await finish(r.session);
      else {
        setTicket(r.signupToken);
        go('signup');
      }
    } catch (e) {
      setCode('');
      fail(e);
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const signup = async () => {
    if (!api || busy) return;
    if (!name.trim() || !office.trim()) return fail(new ApiError('bad_name'));
    setBusy(true);
    setError('');
    try {
      await finish(await api.signup(ticket, name.trim(), office.trim(), deviceLabel()));
    } catch (e) {
      fail(e);
      // بلیت ساختن دفتر ربع ساعت اعتبار دارد؛ بعدش از اول.
      if (e instanceof ApiError && e.code === 'expired') go('phone');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'phone') void sendCode();
    else if (step === 'code') void verify();
    else void signup();
  };

  const onCode = (raw: string) => {
    const v = toEnDigits(raw).replace(/\D/g, '').slice(0, LEN);
    setCode(v);
    if (error) setError('');
    // رقم ششم = ورود، بدون زدن دکمه (پر شدن خودکار از پیامک هم همین‌طور)
    if (v.length === LEN) void verify(v);
  };

  const idx = STEPS.indexOf(step);

  return (
    <div className={`wl lg${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lg-title">
      <WelcomeHero office={office} />

      <form className="wl-main" onSubmit={submit} noValidate>
        <header className="wl-top">
          <span className="plq lg-brand">کلید</span>
          <span className="sp" />
          <ol className="wl-dots" aria-label={`قدم ${toFaDigits(idx + 1)} از ${toFaDigits(STEPS.length)}`}>
            {STEPS.map((s, i) => <li key={s} className={i === idx ? 'on' : i < idx ? 'past' : ''} aria-current={i === idx ? 'step' : undefined} />)}
          </ol>
        </header>

        <div ref={bodyRef} key={step} className={`wl-body ${dir > 0 ? 'fwd' : 'back'}`}>
          {step === 'phone' && (
            <>
              <span className="eb">ورود یا ساختن حساب</span>
              <h1 id="lg-title" className="wl-h">با شمارهٔ موبایل وارد شوید</h1>
              <p className="wl-lead">رمز عبور لازم نیست؛ یک کد کوتاه برایتان پیامک می‌کنیم.</p>
              <label className="lbl lg-field">
                شمارهٔ موبایل
                <span className={`lg-phone${error ? ' bad' : ''}${shake ? ' shake' : ''}`} onAnimationEnd={() => setShake(false)}>
                  <Icon name="mobile" />
                  <input
                    className="lg-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    dir="ltr"
                    enterKeyHint="send"
                    placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                    value={formatPhone(phone)}
                    onChange={(e) => {
                      setPhone(phoneDigits(e.target.value));
                      if (error) setError('');
                    }}
                    aria-invalid={!!error}
                    aria-describedby="lg-msg"
                  />
                </span>
              </label>
              <Message id="lg-msg" error={error}>
                <Icon name="shield" size="s" />
                اطلاعات دفترتان فقط برای خودتان و همکارانتان دیده می‌شود.
              </Message>
            </>
          )}

          {step === 'code' && (
            <>
              <span className="eb">قدم ۲</span>
              <h1 id="lg-title" className="wl-h">کد پیامک‌شده را بنویسید</h1>
              <p className="wl-lead">
                به <b className="lg-num" dir="ltr">{formatPhone(phone)}</b> فرستادیم.{' '}
                <button type="button" className="lnk lg-link" onClick={() => go('phone')}>تغییر شماره</button>
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

          {step === 'signup' && (
            <>
              <span className="eb">دفتر تازه</span>
              <h1 id="lg-title" className="wl-h">خوش آمدید! دفترتان را بسازیم</h1>
              <p className="wl-lead">این شماره هنوز در کلید دفتری ندارد. همین دو مورد کافی است؛ بعداً از تنظیمات عوض می‌شوند.</p>
              <div className="wl-fields">
                <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} enterKeyHint="next" placeholder="مثلاً علی رضایی" autoComplete="name" /></label>
                <label className="lbl">نام دفتر<input className="fld wl-fld" value={office} onChange={(e) => setOffice(e.target.value)} maxLength={200} enterKeyHint="done" placeholder="مثلاً املاک پارسا" autoComplete="organization" /></label>
              </div>
              <Message id="lg-msg" error={error} />
            </>
          )}
        </div>

        <footer className="wl-ft">
          {step !== 'phone' && <button type="button" className="btn btn-g btn-lg" onClick={() => go('phone')} disabled={busy}>قبلی</button>}
          <span className="sp" />
          <button type="submit" className="btn btn-p btn-lg wl-primary" disabled={busy || (step === 'code' && code.length < LEN)} aria-busy={busy}>
            {busy ? (step === 'phone' ? 'در حال فرستادن…' : 'لحظه‌ای صبر کنید…') : step === 'phone' ? 'دریافت کد' : step === 'code' ? 'ورود' : 'ساختن دفتر و ورود'}
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
