import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Segmented } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { useToast } from '../layout/Toasts';
import { queueFeedback, type FeedbackKind } from './beta';

const KINDS: Array<{ value: FeedbackKind; label: string }> = [
  { value: 'problem', label: 'مشکلی دیدم' },
  { value: 'idea', label: 'پیشنهاد دارم' },
  { value: 'praise', label: 'راضی‌ام' },
];
const HINT: Record<FeedbackKind, string> = {
  problem: 'بنویسید چه کار می‌کردید و چه شد؛ مثلاً «فایل را ذخیره زدم ولی در فهرست نیامد».',
  idea: 'چه چیزی کارتان را راحت‌تر می‌کند؟',
  praise: 'چه چیزی را دوست دارید؟ خوشحال می‌شویم بدانیم.',
};
const MAX = 2000;

/** نظر یا گزارش مشکل برای تیم کلید. بی‌اینترنت هم ثبت می‌شود و بعد خودش می‌رود. */
export function FeedbackDialog({ onClose, initial = 'problem', text = '' }: { onClose: () => void; initial?: FeedbackKind; text?: string }) {
  const toast = useToast();
  const [kind, setKind] = useState<FeedbackKind>(initial);
  const [body, setBody] = useState(text);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // روی گوشی فوکوس روی متن، صفحه‌کلید را باز می‌کند و نیمی از برگه را می‌پوشاند.
    if (matchMedia('(max-width: 767px)').matches) dialogRef.current?.focus();
    else textRef.current?.focus();
    return () => prev?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button, textarea')].filter((el) => !el.hasAttribute('disabled'));
    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('چند کلمه بنویسید.');
      textRef.current?.focus();
      return;
    }
    queueFeedback(kind, body);
    toast(navigator.onLine ? 'ممنون! پیامتان به تیم کلید رسید.' : 'ممنون! با وصل شدن اینترنت فرستاده می‌شود.');
    onClose();
  };

  return createPortal(
    <div
      className="overlay vd-ov"
      onMouseDown={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
        tabIndex={-1}
        className="vd pop fb"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <form onSubmit={submit} className="vd-form">
          <div className="vd-hd rw" style={{ gap: 10 }}>
            <h2 id="fb-title" className="t2 sp">
              نظر شما برای تیم کلید
            </h2>
            <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
          <div className="vd-bd col">
            <div className="vd-fill">
              <Segmented<FeedbackKind> label="نوع پیام" value={kind} onChange={setKind} options={KINDS} />
            </div>
            <label className="lbl">
              {HINT[kind]}
              <textarea
                ref={textRef}
                className="fld"
                rows={6}
                maxLength={MAX}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setError('');
                }}
                aria-describedby="fb-note"
                style={{ lineHeight: 1.9, resize: 'vertical' }}
              />
            </label>
            <span id="fb-note" className="xs mute rw" style={{ gap: 8 }}>
              <span className="sp">تیم کلید می‌خواند و اگر لازم شد با شمارهٔ خودتان تماس می‌گیرد. صفحه‌ای که در آن بودید هم همراهش می‌رود.</span>
              {body.length > MAX - 200 && <span className="num">{toFaDigits(MAX - body.length)}</span>}
            </span>
          </div>
          <div className="vd-ft rw">
            {error && (
              <span role="alert" className="tag bad">
                {error}
              </span>
            )}
            <span className="sp" />
            <button type="button" className="btn btn-g" onClick={onClose}>
              انصراف
            </button>
            <button type="submit" className="btn btn-p">
              فرستادن
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
