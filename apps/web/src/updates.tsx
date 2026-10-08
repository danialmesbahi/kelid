import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { useToast } from './layout/Toasts';

/** همان UpdateState در apps/desktop/src/updater.ts. */
export interface UpdateState {
  phase: 'off' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  current: string;
  version?: string;
  percent?: number;
  notes?: string;
  justUpdated?: { version: string; notes: string };
}

export interface UpdateBridge {
  get(): Promise<UpdateState>;
  check(): Promise<void>;
  install(): Promise<void>;
  onChange(fn: (s: UpdateState) => void): () => void;
}

// یک وضعیت برای همهٔ برنامه؛ پروسهٔ اصلی Electron هر تغییر را خودش می‌فرستد.
let state: UpdateState | null = null;
const listeners = new Set<() => void>();
let started = false;
const bridge = () => (typeof window === 'undefined' ? undefined : window.kelid?.updates);

function subscribe(fn: () => void) {
  listeners.add(fn);
  const b = bridge();
  if (b && !started) {
    started = true;
    const put = (s: UpdateState) => {
      state = s;
      listeners.forEach((l) => l());
    };
    b.onChange(put);
    void b.get().then(put);
  }
  return () => void listeners.delete(fn);
}

/** null = وب یا گوشی (به‌روزرسانی خودکار مال برنامهٔ ویندوز است). */
export function useUpdateState(): UpdateState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

// شمارهٔ نسخه با رقم لاتین: «۰» فارسی کنار نقطه‌ها خودش شبیه نقطه است و «۰.۲.۰» خوانا نیست.
const Ver = ({ v }: { v: string }) => <bdi dir="ltr">{v}</bdi>;

/** بعد از نصب نسخهٔ تازه، یک بار در هر اجرا؛ کار کاربر را قطع نمی‌کند. */
let greeted = false;
export function useUpdatedToast() {
  const s = useUpdateState();
  const toast = useToast();
  const navigate = useNavigate();
  const v = s?.justUpdated?.version;
  useEffect(() => {
    if (!v || greeted) return;
    greeted = true;
    toast(`کلید به نسخهٔ ${v} به‌روز شد`, { label: 'تازه‌ها', run: () => navigate('/settings#app-version', { viewTransition: true }) });
  }, [v, toast, navigate]);
}

function Notes({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className="upd-notes">
      {lines.map((l, i) => <li key={i}>{toFaDigits(l)}</li>)}
    </ul>
  );
}

/** کارت «نسخهٔ برنامه» در تنظیمات؛ فقط در برنامهٔ ویندوز. */
export function UpdateSection() {
  const s = useUpdateState();
  const [asked, setAsked] = useState(false);
  // پیوند «تازه‌ها» از اعلان: همین کارت جلوی چشم بیاید.
  useEffect(() => {
    if (s && location.hash.endsWith('#app-version')) document.getElementById('app-version')?.scrollIntoView({ block: 'center' });
  }, [s]);
  if (!s) return null;

  const b = bridge();
  let title: ReactNode = 'کلید به‌روز است';
  let detail: string | null = null;
  let tone: 'ok' | 'busy' | 'quiet' = 'ok';
  if (s.phase === 'off') {
    title = 'نسخهٔ برنامه';
    tone = 'quiet';
  } else if (s.phase === 'checking') {
    title = 'در حال بررسی نسخهٔ تازه';
    tone = 'busy';
  } else if (s.phase === 'downloading') {
    title = s.version ? <>در حال دریافت نسخهٔ <Ver v={s.version} /></> : 'در حال دریافت نسخهٔ تازه';
    detail = 'پشت صحنه دریافت می‌شود؛ کارتان را ادامه دهید.';
    tone = 'busy';
  } else if (s.phase === 'ready') {
    title = <>نسخهٔ <Ver v={s.version ?? ''} /> آماده است</>;
    detail = 'دفعهٔ بعد که کلید را باز کنید، خودبه‌خود نصب می‌شود. اطلاعاتتان دست نمی‌خورد.';
  } else if (s.phase === 'error') {
    title = 'نسخهٔ تازه بررسی نشد';
    detail = 'احتمالاً اینترنت وصل نیست؛ کمی بعد خودش دوباره امتحان می‌کند.';
    tone = 'quiet';
  }
  const notes = s.phase === 'ready' || s.phase === 'downloading' ? s.notes : s.justUpdated?.notes;

  return (
    <section id="app-version" aria-labelledby="upd" className="card col" style={{ padding: 24, gap: 14 }}>
      <div className="rw" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span className="ib" style={{ width: 52, height: 52, border: 0, borderRadius: 16, background: tone === 'quiet' ? 'var(--sunk)' : 'var(--pri-tint)', color: tone === 'quiet' ? 'var(--ink2)' : 'var(--pri-text)' }}>
          <Icon name={s.phase === 'ready' ? 'spark' : 'pc'} size="l" />
        </span>
        <div className="col sp" style={{ gap: 2, flex: '1 1 240px' }}>
          <h2 id="upd" className="t2">{title}</h2>
          <span className="mute sm" style={{ lineHeight: 1.8 }}>
            نسخهٔ نصب‌شده: <Ver v={s.current} />
            {detail && <><br />{detail}</>}
          </span>
        </div>
        {s.phase === 'ready' && b && (
          <button type="button" className="btn btn-s" onClick={() => void b.install()}>
            همین حالا نصب و باز کردن دوباره
          </button>
        )}
        {(s.phase === 'idle' || s.phase === 'error') && b && (
          <button type="button" className="btn btn-g" disabled={asked} onClick={() => (setAsked(true), void b.check())}>
            {asked ? 'بررسی شد' : 'بررسی نسخهٔ تازه'}
          </button>
        )}
      </div>
      {s.phase === 'downloading' && (
        <span className="bar" role="progressbar" aria-label="دریافت نسخهٔ تازه" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent ?? 0}>
          <span style={{ width: `${s.percent ?? 0}%`, transition: 'width .3s ease' }} />
        </span>
      )}
      {notes && (
        <div className="col soft" style={{ gap: 6, padding: '14px 16px', borderRadius: 14 }}>
          <span className="sb">تازه‌های نسخهٔ <Ver v={(s.phase === 'ready' || s.phase === 'downloading' ? s.version : s.justUpdated?.version) ?? ''} /></span>
          <Notes text={notes} />
        </div>
      )}
    </section>
  );
}
