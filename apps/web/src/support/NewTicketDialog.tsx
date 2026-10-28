import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AttachPicker, Icon, readFiles, Segmented } from '@kelid/ui';
import { newId, toFaDigits } from '@kelid/core';
import { useAuth } from '../auth/AuthContext';
import { ApiError, type TicketThread, type TicketTopic } from '../auth/api';
import { APP_VERSION, currentPage, platform } from '../beta/beta';
import { TOPICS, ticketFailText } from './topics';
import { shrinkImage } from './Attach';

const HINT: Record<TicketTopic, string> = {
  problem: 'بنویسید چه کار می‌کردید و چه شد؛ مثلاً «فایل را ذخیره زدم ولی در فهرست نیامد».',
  question: 'سؤالتان را بنویسید؛ همکاران ما همین‌جا جواب می‌دهند.',
  billing: 'دربارهٔ تمدید، تغییر پلن یا پرداخت چه کمکی لازم دارید؟',
  idea: 'چه چیزی کارتان را راحت‌تر می‌کند؟',
};
const MAX = 4000;

/** تیکت تازه برای تیم کلید: موضوع، عنوان و متن. بعد از فرستادن، خود تیکت باز می‌شود. */
export function NewTicketDialog({
  onClose,
  topic: initial = 'problem',
  subject: s0 = '',
  text = '',
}: {
  onClose: () => void;
  topic?: TicketTopic;
  subject?: string;
  text?: string;
}) {
  const { api, withToken } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<TicketTopic>(initial);
  const [subject, setSubject] = useState(s0);
  const [body, setBody] = useState(text);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // شناسه یک بار ساخته می‌شود تا «دوباره فرستادن» بعد از قطعی، تیکت دوم نسازد.
  const id = useRef(newId());
  const dialogRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // روی گوشی فوکوس روی فیلد، صفحه‌کلید را باز می‌کند و نیمی از برگه را می‌پوشاند.
    if (matchMedia('(max-width: 767px)').matches) dialogRef.current?.focus();
    else (s0 ? textRef : subjectRef).current?.focus();
    return () => prev?.focus();
  }, [s0]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, textarea')].filter((el) => !el.hasAttribute('disabled') && !el.hidden);
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('یک عنوان کوتاه بنویسید.');
      subjectRef.current?.focus();
      return;
    }
    if (!body.trim()) {
      setError('چند کلمه بنویسید.');
      textRef.current?.focus();
      return;
    }
    if (!api || busy) return;
    setBusy(true);
    try {
      const attached = await readFiles(files);
      const t: TicketThread = await withToken((tk) =>
        api.openTicket(tk, {
          id: id.current,
          topic,
          subject: subject.trim(),
          body: body.trim(),
          page: currentPage(),
          appVersion: APP_VERSION,
          platform: platform(),
          files: attached,
        }),
      );
      onClose();
      void navigate(`/support/${t.ticket.id}`, { viewTransition: true });
    } catch (err) {
      setError(ticketFailText(err instanceof ApiError ? err : null));
      setBusy(false);
    }
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
        aria-labelledby="tk-title"
        tabIndex={-1}
        className="vd pop fb"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <form onSubmit={(e) => void submit(e)} className="vd-form">
          <div className="vd-hd rw" style={{ gap: 10 }}>
            <h2 id="tk-title" className="t2 sp">
              تیکت تازه برای پشتیبانی
            </h2>
            <button type="button" className="ib ghost" aria-label="بستن" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
          <div className="vd-bd col">
            <div className="vd-fill">
              <Segmented<TicketTopic> label="موضوع" value={topic} onChange={setTopic} options={TOPICS.map((t) => ({ value: t.value, label: t.label }))} />
            </div>
            <label className="lbl">
              عنوان
              <input
                ref={subjectRef}
                className="fld"
                maxLength={120}
                value={subject}
                placeholder="مثلاً «عکس فایل ذخیره نمی‌شود»"
                onChange={(e) => {
                  setSubject(e.target.value);
                  setError('');
                }}
              />
            </label>
            <label className="lbl">
              {HINT[topic]}
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
                aria-describedby="tk-note"
                style={{ lineHeight: 1.9, resize: 'vertical' }}
              />
            </label>
            <AttachPicker
              files={files}
              onChange={(f) => {
                setFiles(f);
                setError('');
              }}
              onError={setError}
              shrink={shrinkImage}
            />
            <span id="tk-note" className="xs mute rw" style={{ gap: 8 }}>
              <span className="sp">جواب همین‌جا در بخش «پشتیبانی» می‌آید و کنارش نشان می‌خورد.</span>
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
            <button type="submit" className="btn btn-p" disabled={busy}>
              <Icon name="send" size="s" />
              فرستادن
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.getElementById('root') ?? document.body,
  );
}
