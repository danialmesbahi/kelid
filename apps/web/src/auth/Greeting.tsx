import { useEffect, useRef, useState } from 'react';
import { Icon } from '@kelid/ui';
import { callName } from '../prefs';
import './greeting.css';

const SHOW_MS = 5200;

/**
 * لحظهٔ خوش‌آمد بعد از ورود یا ثبت‌نام: یک کارت کوتاه بالای صفحهٔ امروز، با همان شب و پلاک صحنهٔ ورود.
 * خودش کنار می‌رود (با نگه داشتن نشانگر روی آن صبر می‌کند)؛ Esc یا ضربدر هم می‌بندد. هیچ انیمیشن بی‌پایانی ندارد.
 */
export function Greeting({ kind, name, office, onClose, onStart }: { kind: 'back' | 'new'; name: string; office: string; onClose: () => void; onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const left = useRef(SHOW_MS);
  const who = callName(name);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // شمارش معکوس با مکث؛ زمان باقی‌مانده نگه داشته می‌شود تا بعد از مکث از همان‌جا ادامه دهد.
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const id = setTimeout(() => closeRef.current(), left.current);
    return () => {
      clearTimeout(id);
      left.current = Math.max(0, left.current - (Date.now() - start));
    };
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="gr-wrap" role="status" aria-live="polite">
      <section
        className={`gr${leaving ? ' out' : ''}${paused ? ' paused' : ''}`}
        style={{ ['--gr-ms' as string]: `${SHOW_MS}ms` }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
      >
        <div className="gr-night" aria-hidden="true">
          <span className="gr-moon" />
          <span className="gr-star s1" />
          <span className="gr-star s2" />
          <span className="gr-star s3" />
          <span className="plq gr-plq">کلید</span>
          <span className="gr-sky" />
        </div>
        <div className="gr-txt">
          <span className="gr-eb">{kind === 'new' ? 'دفترتان آماده است' : 'ورود موفق'}</span>
          <b className="gr-h">{kind === 'new' ? `خوش آمدید${who ? `، ${who}` : ''}!` : `${who ? `${who}، ` : ''}خوش برگشتید`}</b>
          <span className="gr-sub">
            {kind === 'new' ? (
              <>«{office}» در کلید ساخته شد. با ثبت اولین فایل شروع کنید.</>
            ) : (
              <>همه‌چیز «{office}» سر جایش است؛ از همین‌جا ادامه دهید.</>
            )}
          </span>
          {kind === 'new' && (
            <button
              type="button"
              className="btn btn-p gr-cta"
              onClick={() => {
                onStart();
                close();
              }}
            >
              <Icon name="plus" size="s" />
              ثبت اولین فایل
            </button>
          )}
        </div>
        <button type="button" className="ib ghost gr-x" aria-label="بستن پیام خوش‌آمد" onClick={close}>
          <Icon name="x" size="s" />
        </button>
        <span className="gr-bar" aria-hidden="true" />
      </section>
    </div>
  );
}
