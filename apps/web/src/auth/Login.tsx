import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Icon, Logo } from '@kelid/ui';
import { toEnDigits, toFaDigits } from '@kelid/core';
import { usePrefsContext } from '../App';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { usePhone } from '../layout/usePhone';
import { WelcomeHero } from '../welcome/WelcomeHero';
import { ApiError, deviceLabel, type InviteInfo, type Session } from './api';
import { formatPhone, phoneDigits } from './phone';
import { useAuth } from './AuthContext';
import '../welcome/welcome.css';
import './login.css';

export type AuthMode = 'login' | 'signup' | 'join';
/** password: شماره و رمز (راه اصلی). code: ورود با کد پیامکی یا فراموشی رمز. signup: دفتر تازه. */
type Flow = 'password' | 'code' | 'signup';
/** join: شماره‌ای که دفتری دعوتش کرده، بعد از کد درست. */
type Step = 'phone' | 'otp' | 'details' | 'code' | 'nouser' | 'newpass' | 'join';
const LEN = 6;
const MIN_PASSWORD = 8;

function errorText(e: unknown, step: Step): string {
  if (!(e instanceof ApiError)) return 'مشکلی پیش آمد. دوباره امتحان کنید.';
  switch (e.code) {
    case 'bad_phone':
      return 'این شمارهٔ موبایل درست نیست؛ مثل ۰۹۱۲ ۳۴۵ ۶۷۸۹ بنویسید.';
    case 'wrong':
      if (step === 'phone') return 'شماره یا رمز عبور درست نیست.';
      if (step === 'newpass') return 'مهلت گذاشتن رمز تمام شد؛ از تنظیمات ‹حساب› رمز تازه بگذارید.';
      return e.attemptsLeft ? `کد درست نیست. ${toFaDigits(e.attemptsLeft)} بار دیگر می‌توانید امتحان کنید.` : 'کد درست نیست.';
    case 'bad_password':
      return `رمز عبور دست‌کم ${toFaDigits(MIN_PASSWORD)} نویسه باشد.`;
    case 'bad_code':
      return 'کد شش رقم است.';
    case 'expired':
      return 'این کد دیگر معتبر نیست؛ یک کد تازه بگیرید.';
    case 'too_many':
      if (step === 'phone') return `چند بار رمز اشتباه زده شد. ${waitText(e.retryAfter ?? 60)} دیگر دوباره امتحان کنید، یا همین حالا با کد پیامکی وارد شوید.`;
      return `چند بار پشت هم درخواست شد. ${waitText(e.retryAfter ?? 60)} دیگر دوباره امتحان کنید.`;
    case 'sms_failed':
      return 'پیامک فرستاده نشد. چند لحظه بعد دوباره بزنید.';
    case 'offline':
      return 'به اینترنت وصل نیستید. اولین ورود اینترنت می‌خواهد؛ بعد از آن کلید بدون اینترنت هم کار می‌کند.';
    case 'bad_name':
      return step === 'join' ? 'نامتان را بنویسید.' : 'نام شما و نام دفتر را بنویسید.';
    case 'no_seat':
      return 'در این دفتر جای خالی نمانده. به مدیر دفتر بگویید یک جا آزاد کند، بعد دوباره امتحان کنید.';
    case 'not_found':
      return 'این دعوت دیگر برقرار نیست. اگر لازم است، مدیر دفتر دوباره دعوتتان کند؛ یا دفتر خودتان را بسازید.';
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
 * ورود و ثبت‌نام.
 * ورود: شماره و رمز عبور، در یک صفحه. کد پیامکی راه دوم است (رمز یادش نیست یا نمی‌خواهد رمز بزند)؛ بعد از «فراموشی رمز» همان‌جا رمز تازه می‌گذارد.
 * ثبت‌نام: نام شما، نام دفتر، شماره و رمز ← کد پیامکی برای تأیید شماره ← آشنایی کوتاه.
 * این‌که شماره‌ای حساب دارد یا نه نه از رمز اشتباه معلوم می‌شود و نه پیش از کد درست، تا کسی نتواند شماره‌ها را امتحان کند.
 */
export function Login({ onDone }: { onDone: (mode: AuthMode) => void }) {
  const { api, signIn } = useAuth();
  const prefs = usePrefsContext();
  const store = useStore();
  const toast = useToast();
  const isPhone = usePhone();
  const [flow, setFlow] = useState<Flow>('password');
  const [step, setStep] = useState<Step>('phone');
  // از «فراموش کردید؟» آمده: بعد از کد، رمز تازه.
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState('');
  // ورود با کد انجام شد و حالا رمز تازه می‌گذارد؛ نشست تا آن موقع کنار نگه داشته می‌شود.
  const [pending, setPending] = useState<Session | null>(null);
  // فقط سرور توسعه: کدی که به‌جای پیامک روی صفحه می‌آید.
  const [devCode, setDevCode] = useState('');
  const [dir, setDir] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // کد درست بود ولی شماره حساب نداشت: ساختن دفتر دیگر کد تازه نمی‌خواهد.
  const [ticket, setTicket] = useState('');
  // دفتری که این شماره را دعوت کرده (بعد از کد درست).
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState('');
  const [office, setOffice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // کدام فیلد قرمز شود: رمز اشتباه نباید شماره را هم اشتباه نشان دهد.
  const [errCode, setErrCode] = useState('');
  const [shake, setShake] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const order: Step[] = ['phone', 'otp', 'details', 'code', 'nouser', 'newpass', 'join'];
  const go = (s: Step, f: Flow = flow) => {
    setDir(order.indexOf(s) >= order.indexOf(step) ? 1 : -1);
    setError('');
    setFlow(f);
    setStep(s);
  };

  // هر قدم تازه، فیلد اصلی‌اش فوکوس می‌گیرد (روی گوشی هم، تا صفحه‌کلید همان لحظه باز شود).
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLInputElement>('input:not([readonly])')?.focus({ preventScroll: isPhone });
  }, [step, flow, isPhone]);

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
    setError(errorText(e, step));
    setErrCode(e instanceof ApiError ? e.code : '');
    setShake(true);
  };

  const validPhone = () => {
    if (phone.length === 11 && phone.startsWith('09')) return true;
    fail(new ApiError('bad_phone'));
    return false;
  };

  /** راه اصلی: شماره و رمز. */
  const logIn = async () => {
    if (!api || busy || !validPhone()) return;
    if (!password) return passRef.current?.focus();
    setBusy(true);
    setError('');
    try {
      await finish(await api.login(phone, password, deviceLabel()), 'login');
    } catch (e) {
      fail(e);
      passRef.current?.select();
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    if (!api || busy || !validPhone()) return;
    setBusy(true);
    setError('');
    try {
      const { retryAfter, devCode: dev } = await api.requestOtp(phone);
      setDevCode(dev ?? '');
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
    if (await store.hasSampleData()) await store.clearSampleData();
    if (kind === 'signup') {
      // دفتر تازه: آشنایی کوتاه همیشه می‌آید، حتی اگر این مرورگر قبلاً آشنایی را دیده باشد؛ بی‌فاصله جای این صفحه را می‌گیرد.
      prefs.setWelcomed(false);
      return onDone(kind);
    }
    // دستگاه تازه در دفتری که از قبل هست: آشنایی لازم نیست و نمونه‌ها نباید کنار فایل‌های واقعی دفتر بنشینند.
    prefs.setWelcomed(true);
    setLeaving(true);
    setTimeout(() => onDone(kind), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520);
  };

  const createOffice = async (t: string) => {
    if (!api) return;
    await finish(await api.signup(t, name.trim(), office.trim(), password, deviceLabel()), 'signup');
  };

  const verify = async (value = code) => {
    if (!api || busy || value.length !== LEN) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.verify(phone, value, deviceLabel());
      if ('session' in r) {
        // ثبت‌نام با شماره‌ای که از قبل حساب دارد: همان حساب و همان رمز قبلی باز می‌شود، چیزی دوباره ساخته نمی‌شود.
        if (flow === 'signup') toast('این شماره از قبل در کلید حساب داشت؛ وارد همان حساب شدید');
        // رمز را فراموش کرده یا هنوز رمزی ندارد: همین‌جا رمز تازه، بدون رمز قبلی.
        if (flow === 'code' && (forgot || r.session.user.hasPassword === false)) {
          setPending(r.session);
          setPassword('');
          go('newpass');
        } else await finish(r.session, 'login');
      } else if (r.invite) {
        // دعوت شده: پیوستن به همان دفتر راه اصلی است؛ ساختن دفتر جدا هم یک دکمه آن‌طرف‌تر است.
        setTicket(r.signupToken);
        setInvite(r.invite);
        if (!name.trim()) setName(r.invite.name);
        if (flow !== 'signup') setPassword('');
        go('join');
      } else if (flow === 'signup') {
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
    if (!ticket && !validPhone()) return false;
    if (password.length < MIN_PASSWORD) return fail(new ApiError('bad_password')), passRef.current?.focus(), false;
    return true;
  };

  /** رمز تازه بعد از ورود با کد؛ «بعداً» هم همان ورود است، بی‌رمز. */
  const saveNewPassword = async (skip = false) => {
    if (!api || !pending || busy) return;
    if (skip) return void finish(pending, 'login');
    if (password.length < MIN_PASSWORD) return fail(new ApiError('bad_password'));
    setBusy(true);
    setError('');
    try {
      await api.setPassword(pending.accessToken, password);
      toast('رمز تازه ذخیره شد؛ دفعهٔ بعد با همین رمز وارد شوید');
      await finish({ ...pending, user: { ...pending.user, hasPassword: true } }, 'login');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** پیوستن به دفتری که دعوت کرده: نام و رمز، بی‌کد دوباره. */
  const joinOffice = async () => {
    if (!api || busy || !invite) return;
    if (!name.trim()) return void fail(new ApiError('bad_name'));
    if (password.length < MIN_PASSWORD) return fail(new ApiError('bad_password')), passRef.current?.focus();
    setBusy(true);
    setError('');
    try {
      await finish(await api.join(ticket, name.trim(), password, deviceLabel()), 'join');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'expired') {
        // بلیت ربع ساعت اعتبار دارد؛ بعدش یک کد تازه.
        setTicket('');
        setInvite(null);
        go('otp', 'code');
      } else if (e instanceof ApiError && e.code === 'not_found') setInvite(null);
      fail(e);
    } finally {
      setBusy(false);
    }
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
    if (step === 'phone') void logIn();
    else if (step === 'otp') void sendCode();
    else if (step === 'details') void submitDetails();
    else if (step === 'code') void verify();
    else if (step === 'newpass') void saveNewPassword();
    else if (step === 'join') void (invite ? joinOffice() : go('details', 'signup'));
    else go('details', 'signup');
  };

  const onCode = (raw: string) => {
    const v = toEnDigits(raw).replace(/\D/g, '').slice(0, LEN);
    setCode(v);
    if (error) setError('');
    // رقم ششم = ورود، بدون زدن دکمه (پر شدن خودکار از پیامک هم همین‌طور)
    if (v.length === LEN) void verify(v);
  };

  const switchTo = (f: Flow, isForgot = false) => {
    setTicket('');
    setInvite(null);
    setCode('');
    setForgot(isForgot);
    if (f !== 'code') setPassword('');
    go(f === 'password' ? 'phone' : f === 'code' ? 'otp' : 'details', f);
  };

  // ورود با رمز یک صفحه است و نقطهٔ قدم ندارد.
  const steps: Step[] =
    step === 'join'
      ? flow === 'signup' ? ['details', 'code', 'join'] : ['otp', 'code', 'join']
      : flow === 'signup' ? ['details', 'code'] : flow === 'code' ? (forgot || step === 'newpass' ? ['otp', 'code', 'newpass'] : ['otp', 'code']) : [];
  const idx = step === 'nouser' ? 1 : steps.indexOf(step);
  const back: Step | null =
    step === 'code' ? (flow === 'signup' ? 'details' : 'otp') : step === 'otp' ? 'phone' : step === 'nouser' ? 'otp' : step === 'details' && ticket ? (invite ? 'join' : 'nouser') : null;
  const backFlow = (s: Step): Flow => (s === 'phone' ? 'password' : s === 'otp' || s === 'nouser' ? 'code' : flow);

  const phoneBad = !!error && (errCode === 'bad_phone' || step === 'otp');
  const passBad = !!error && errCode !== 'bad_phone' && errCode !== 'bad_name';
  const phoneField = (
    <label className="lbl lg-field">
      شمارهٔ موبایل
      <span className={`lg-phone${phoneBad ? ' bad' : ''}${shake && phoneBad ? ' shake' : ''}${ticket ? ' done' : ''}`} onAnimationEnd={() => setShake(false)}>
        <Icon name={ticket ? 'check' : 'mobile'} />
        <input
          className="lg-input"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          autoComplete={step === 'otp' ? 'tel-national' : 'username'}
          enterKeyHint={step === 'otp' ? 'send' : 'next'}
          placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
          value={formatPhone(phone)}
          readOnly={!!ticket}
          onChange={(e) => {
            setPhone(phoneDigits(e.target.value));
            if (error) setError('');
          }}
          aria-invalid={phoneBad}
          aria-describedby="lg-msg"
        />
      </span>
    </label>
  );

  return (
    <div className={`wl lg${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lg-title">
      <WelcomeHero office={step === 'join' ? (invite?.officeName ?? '') : flow === 'signup' ? office : ''} />

      <form className="wl-main" onSubmit={submit} noValidate>
        <header className="wl-top">
          <Logo size={34} word className="lg-brand" />
          <span className="sp" />
          {steps.length > 0 && (
            <ol className="wl-dots" aria-label={`قدم ${toFaDigits(idx + 1)} از ${toFaDigits(steps.length)}`}>
              {steps.map((s, i) => <li key={s} className={i === idx ? 'on' : i < idx ? 'past' : ''} aria-current={i === idx ? 'step' : undefined} />)}
            </ol>
          )}
        </header>

        <div ref={bodyRef} key={`${flow}-${step}`} className={`wl-body ${dir > 0 ? 'fwd' : 'back'}`}>
          {step === 'phone' && (
            <>
              <span className="eb">ورود</span>
              <h1 id="lg-title" className="wl-h">به دفترتان خوش برگشتید</h1>
              <p className="wl-lead">با شمارهٔ موبایل و رمز عبورتان وارد شوید.</p>
              {phoneField}
              <PasswordField
                inputRef={passRef}
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (error) setError('');
                }}
                autoComplete="current-password"
                bad={passBad}
                shake={shake && passBad}
                onShakeEnd={() => setShake(false)}
                aside={<button type="button" className="lnk lg-link" onClick={() => switchTo('code', true)}>فراموش کردید؟</button>}
              />
              {/* بی‌خطا جای خالی نمی‌گیرد تا راه دوم ورود درست زیر رمز بنشیند. */}
              {error && <Message id="lg-msg" error={error} />}
              <button type="button" className="lg-alt" onClick={() => switchTo('code')}>
                <Icon name="mobile" size="s" />
                <span>نمی‌خواهید رمز بزنید؟ <b>ورود با کد پیامکی</b></span>
                <Icon name="chl" size="s" />
              </button>
              <p className="lg-switch">
                دفترتان هنوز در کلید حساب ندارد؟
                <button type="button" className="lnk lg-link" onClick={() => switchTo('signup')}>ثبت‌نام دفتر تازه</button>
              </p>
              {api?.demoCode && <span className="lg-demo">پیش‌نمایش: شمارهٔ <b className="lg-num" dir="ltr">{formatPhone('09120000000')}</b> با رمز <b className="lg-num">۱۲۳۴۵۶۷۸</b></span>}
            </>
          )}

          {step === 'otp' && (
            <>
              <span className="eb">{forgot ? 'فراموشی رمز' : 'ورود با کد پیامکی'}</span>
              <h1 id="lg-title" className="wl-h">{forgot ? 'با یک کد پیامکی وارد شوید' : 'ورود بدون رمز'}</h1>
              <p className="wl-lead">
                {forgot ? 'شماره‌تان را بزنید؛ کدی پیامک می‌کنیم و بعد از ورود، همان‌جا رمز تازه می‌گذارید.' : 'شمارهٔ موبایلتان را بزنید؛ یک کد کوتاه پیامک می‌کنیم.'}
              </p>
              {phoneField}
              <Message id="lg-msg" error={error}>
                <Icon name="shield" size="s" />
                اطلاعات دفترتان فقط برای خودتان و همکارانتان دیده می‌شود.
              </Message>
              <p className="lg-switch">
                رمزتان را می‌دانید؟
                <button type="button" className="lnk lg-link" onClick={() => switchTo('password')}>ورود با رمز عبور</button>
              </p>
            </>
          )}

          {step === 'details' && (
            <>
              <span className="eb">ثبت‌نام دفتر تازه</span>
              <h1 id="lg-title" className="wl-h">دفترتان را در کلید بسازیم</h1>
              <p className="wl-lead">همین چند مورد کافی است. نام‌ها را بعداً از تنظیمات هم می‌شود عوض کرد.</p>
              <div className="wl-fields">
                <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} enterKeyHint="next" placeholder="مثلاً علی رضایی" autoComplete="name" /></label>
                <label className="lbl">نام دفتر<input className="fld wl-fld" value={office} onChange={(e) => setOffice(e.target.value)} maxLength={200} enterKeyHint="next" placeholder="مثلاً املاک پارسا" autoComplete="organization" /></label>
              </div>
              {phoneField}
              <PasswordField
                inputRef={passRef}
                label="رمز عبور برای ورودهای بعدی"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (error) setError('');
                }}
                autoComplete="new-password"
                bad={errCode === 'bad_password'}
                aside={<span className="xs mute">دست‌کم {toFaDigits(MIN_PASSWORD)} نویسه</span>}
              />
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
                  <button type="button" className="lnk lg-link" onClick={() => switchTo('password')}>ورود</button>
                </p>
              )}
            </>
          )}

          {step === 'code' && (
            <>
              <span className="eb">{flow === 'signup' ? 'ثبت‌نام · قدم ۲' : forgot ? 'فراموشی رمز · قدم ۲' : 'ورود با کد · قدم ۲'}</span>
              <h1 id="lg-title" className="wl-h">کد پیامک‌شده را بنویسید</h1>
              <p className="wl-lead">
                به <b className="lg-num" dir="ltr">{formatPhone(phone)}</b> فرستادیم.{' '}
                <button type="button" className="lnk lg-link" onClick={() => go(flow === 'signup' ? 'details' : 'otp')}>تغییر شماره</button>
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
              {(devCode || api?.demoCode) && <span className="lg-demo">نسخهٔ آزمایشی (پیامک واقعی فرستاده نمی‌شود): کد <b className="lg-num">{toFaDigits(devCode || api?.demoCode || '')}</b></span>}
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

          {step === 'join' && (
            <>
              <span className="eb">دعوت به دفتر</span>
              {invite ? (
                <>
                  <h1 id="lg-title" className="wl-h">به «{invite.officeName}» بپیوندید</h1>
                  <p className="wl-lead">
                    {invite.invitedBy} شما را به‌عنوان <b>{invite.role === 'manager' ? 'مدیر' : 'مشاور'}</b> به دفتر دعوت کرده است. نامتان را ببینید و یک رمز عبور بگذارید.
                  </p>
                  <div className="wl-fields lg-one">
                    <label className="lbl">نام شما<input className="fld wl-fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} enterKeyHint="next" placeholder="مثلاً سارا نوری" autoComplete="name" /></label>
                  </div>
                  {phoneField}
                  <PasswordField
                    inputRef={passRef}
                    label="رمز عبور برای ورودهای بعدی"
                    value={password}
                    onChange={(v) => {
                      setPassword(v);
                      if (error) setError('');
                    }}
                    autoComplete="new-password"
                    bad={errCode === 'bad_password'}
                    shake={shake && errCode === 'bad_password'}
                    onShakeEnd={() => setShake(false)}
                    aside={<span className="xs mute">دست‌کم {toFaDigits(MIN_PASSWORD)} نویسه</span>}
                  />
                  <Message id="lg-msg" error={error}>
                    <Icon name="check" size="s" />
                    شماره‌تان همین الان تأیید شد؛ کد دوباره لازم نیست.
                  </Message>
                </>
              ) : (
                <>
                  <h1 id="lg-title" className="wl-h">دعوت برقرار نیست</h1>
                  <Message id="lg-msg" error={error} />
                </>
              )}
            </>
          )}

          {step === 'newpass' && (
            <>
              <span className="eb">{forgot ? 'فراموشی رمز · قدم ۳' : 'وارد شدید'}</span>
              <h1 id="lg-title" className="wl-h">{forgot ? 'رمز تازه بگذارید' : 'یک رمز عبور بگذارید'}</h1>
              <p className="wl-lead">از این به بعد با شماره و همین رمز، بی‌معطلیِ پیامک وارد می‌شوید.</p>
              <PasswordField
                inputRef={passRef}
                label="رمز تازه"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (error) setError('');
                }}
                autoComplete="new-password"
                bad={!!error}
                shake={shake}
                onShakeEnd={() => setShake(false)}
                aside={<span className="xs mute">دست‌کم {toFaDigits(MIN_PASSWORD)} نویسه</span>}
              />
              <Message id="lg-msg" error={error}>
                <Icon name="shield" size="s" />
                رمز را فقط خودتان بدانید؛ کلید هیچ‌وقت آن را از شما نمی‌پرسد.
              </Message>
            </>
          )}
        </div>

        <footer className="wl-ft">
          {back && <button type="button" className="btn btn-g btn-lg" onClick={() => go(back, backFlow(back))} disabled={busy}>{step === 'nouser' ? 'شمارهٔ دیگر' : 'قبلی'}</button>}
          {step === 'newpass' && <button type="button" className="btn btn-g btn-lg" onClick={() => void saveNewPassword(true)} disabled={busy}>بعداً</button>}
          {step === 'join' && invite && <button type="button" className="btn btn-g btn-lg" onClick={() => go('details', 'signup')} disabled={busy}>دفتر جدا می‌سازم</button>}
          <span className="sp" />
          <button type="submit" className="btn btn-p btn-lg wl-primary" disabled={busy || (step === 'code' && code.length < LEN)} aria-busy={busy}>
            {busy
              ? step === 'otp' || (step === 'details' && !ticket) ? 'در حال فرستادن…' : 'لحظه‌ای صبر کنید…'
              : step === 'phone' ? 'ورود'
              : step === 'otp' ? 'دریافت کد'
              : step === 'details' ? (ticket ? 'ساختن دفتر و ورود' : 'دریافت کد')
              : step === 'code' ? (flow === 'signup' ? 'ساختن دفتر' : 'ورود')
              : step === 'newpass' ? 'ذخیره و ورود'
              : step === 'join' && invite ? 'پیوستن به دفتر'
              : 'ساختن دفتر تازه'}
            <Icon name="chl" size="s" />
          </button>
        </footer>
      </form>
    </div>
  );
}

/** رمز عبور با دکمهٔ نمایش؛ مدیر رمز مرورگر از روی autoComplete پیدایش می‌کند. */
function PasswordField(props: {
  inputRef: RefObject<HTMLInputElement | null>;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  bad?: boolean;
  shake?: boolean;
  onShakeEnd?: () => void;
  aside?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="lbl lg-field">
      <span className="lg-lblrow">
        <label htmlFor={id}>{props.label ?? 'رمز عبور'}</label>
        {props.aside}
      </span>
      <span className={`lg-phone lg-pass${props.bad ? ' bad' : ''}${props.shake ? ' shake' : ''}`} onAnimationEnd={props.onShakeEnd}>
        <Icon name="lock" />
        <input
          ref={props.inputRef}
          id={id}
          className="lg-input"
          type={show ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          enterKeyHint="go"
          maxLength={128}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={props.bad}
          aria-describedby="lg-msg"
        />
        {/* با موس فوکوس در فیلد می‌ماند تا Enter بعدی فرم را بفرستد، نه دوباره دکمه را بزند. */}
        <button type="button" className="ib ghost lg-eye" onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((v) => !v)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </span>
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
