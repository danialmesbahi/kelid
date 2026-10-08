import { useState, type FormEvent } from 'react';
import { Icon } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { api, ApiError, DEMO } from './api';
import { useAuth } from './auth';

function loginError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'ورود انجام نشد؛ دوباره امتحان کنید.';
  if (e.code === 'bad_login') return 'شماره، رمز یا کد دومرحله‌ای درست نیست.';
  if (e.code === 'locked') return `چند بار اشتباه وارد شد؛ ${toFaDigits(Math.max(1, Math.ceil(e.retryAfter / 60)))} دقیقهٔ دیگر دوباره امتحان کنید.`;
  if (e.code === 'too_many') return 'چند بار پشت هم امتحان شد؛ کمی بعد دوباره بزنید.';
  if (e.code === 'offline') return 'به سرور وصل نشد؛ اینترنت را بررسی کنید.';
  return 'ورود انجام نشد؛ دوباره امتحان کنید.';
}

const digits = (s: string) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** ورود تیم کلید: شماره، رمز و کد شش‌رقمی برنامهٔ دومرحله‌ای. حساب فقط از خط فرمان سرور ساخته می‌شود. */
export function Login() {
  const { signIn, reason } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!phone || !password || code.length !== 6) {
      setError(code.length !== 6 && phone && password ? 'کد شش‌رقمی برنامهٔ دومرحله‌ای را وارد کنید.' : 'شماره، رمز و کد را کامل کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(digits(phone), password, code);
    } catch (err) {
      setError(loginError(err));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <div className="ad-login">
      <form className="card ad-login-card enter" onSubmit={submit} noValidate aria-labelledby="ad-login-title">
        <div className="rw" style={{ gap: 12 }}>
          <span className="plq l" aria-hidden="true">
            کلید
          </span>
          <span className="col">
            <h1 id="ad-login-title" className="t2">
              پنل فروشنده
            </h1>
            <span className="sm mute">فقط برای تیم کلید</span>
          </span>
        </div>

        {!api ? (
          <p className="ad-note bad">نشانی سرور برای این نسخه تنظیم نشده است (VITE_ADMIN_API_URL).</p>
        ) : (
          <>
            {(error || reason) && (
              <p className={`ad-note ${error ? 'bad' : ''}`} role="alert">
                <Icon name={error ? 'warn' : 'lock'} size="s" />
                {error || reason}
              </p>
            )}
            <label className="lbl">
              شمارهٔ موبایل
              <input
                className="fld num"
                type="tel"
                inputMode="numeric"
                dir="ltr"
                autoComplete="username"
                placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </label>
            <label className="lbl">
              رمز
              <span className="ad-pass">
                <input
                  className="fld"
                  type={show ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="ib ghost"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
                  aria-pressed={show}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size="s" />
                </button>
              </span>
            </label>
            <label className="lbl">
              کد دومرحله‌ای
              <input
                className="fld num ad-code"
                inputMode="numeric"
                dir="ltr"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="۰۰۰۰۰۰"
                value={toFaDigits(code)}
                onChange={(e) => setCode(digits(e.target.value).replace(/\D/g, '').slice(0, 6))}
              />
              <span className="hint">عدد شش‌رقمی برنامهٔ Google Authenticator یا برنامهٔ مشابه روی گوشی‌تان.</span>
            </label>
            <button type="submit" className="btn btn-p btn-lg btn-w" disabled={busy} aria-busy={busy}>
              {busy ? 'لحظه‌ای صبر کنید…' : 'ورود'}
            </button>
            {DEMO && (
              <p className="xs mute" style={{ margin: 0, textAlign: 'center' }}>
                پیش‌نمایش: شمارهٔ <span className="num">۰۹۱۲۰۰۰۰۰۰۰</span>، رمز <span className="num">۱۲۳۴۵۶۷۸</span> و هر کد شش‌رقمی
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
