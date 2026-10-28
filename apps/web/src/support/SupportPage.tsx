import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Icon, Logo, Skeleton } from '@kelid/ui';
import { newId, toFaDigits } from '@kelid/core';
import { useAuth } from '../auth/AuthContext';
import { seen } from '../auth/AccountSection';
import { ApiError, type Ticket, type TicketThread } from '../auth/api';
import { useSlow } from '../data';
import { useFirstVisit } from '../layout/useFirstVisit';
import { useToast } from '../layout/Toasts';
import { NewTicketDialog } from './NewTicketDialog';
import { AFTER_ANSWER, STATUS, ticketFailText, topicIcon, topicLabel } from './topics';
import { setSupportUnread } from './unread';
import './support.css';

// آخرین دادهٔ دیده‌شده تا برگشتن به پشتیبانی فوری باشد؛ تازه‌اش پشت صحنه می‌آید.
let listCache: Ticket[] | null = null;
const threadCache = new Map<string, TicketThread>();

function NeedAccount() {
  return (
    <div className="bd" style={{ paddingTop: 26, maxWidth: 900 }}>
      <h1 className="t1">پشتیبانی</h1>
      <div className="card tk-empty">
        <Icon name="msg" size="l" />
        <span className="t2">برای پیام به پشتیبانی وارد حساب کلید شوید</span>
        <Link viewTransition className="btn btn-p" to="/settings">
          رفتن به تنظیمات
        </Link>
      </div>
    </div>
  );
}

/** یک ردیف فهرست: موضوع، عنوان، آخرین پیام و وضعیت. */
function TicketRow({ t }: { t: Ticket }) {
  const cls = ['tk-row', 'hov', t.unread && 'new', t.status === 'closed' && 'done'].filter(Boolean).join(' ');
  return (
    <Link viewTransition to={`/support/${t.id}`} className={cls}>
      <span className="tk-ic" aria-hidden="true">
        <Icon name={t.status === 'closed' ? 'check' : topicIcon(t.topic)} />
      </span>
      <span className="col sp" style={{ gap: 3, minWidth: 0 }}>
        <span className="rw" style={{ gap: 8, minWidth: 0 }}>
          <span className="tk-subj">{t.subject}</span>
          {t.unread && <span className="tag ok tk-newtag">پاسخ تازه</span>}
        </span>
        <span className="tk-last sm mute">
          {t.last.from === 'support' ? 'پشتیبانی: ' : 'شما: '}
          {t.last.body}
        </span>
      </span>
      <span className="col tk-side">
        <span className={`tag ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
        <span className="xs mute">
          {topicLabel(t.topic)} · {seen(t.updatedAt)}
        </span>
      </span>
    </Link>
  );
}

/** پشتیبانی: تیکت‌های همین کاربر با تیم کلید؛ در جریان‌ها بالا، بسته‌شده‌ها پایین. */
export function SupportPage() {
  const { status, api, withToken } = useAuth();
  const first = useFirstVisit('support');
  const [list, setList] = useState(listCache);
  const [failed, setFailed] = useState<ApiError | null>(null);
  const [creating, setCreating] = useState(false);
  const slow = useSlow(!list && !failed);

  useEffect(() => {
    if (!api || status !== 'signedIn') return;
    void withToken((t) => api.tickets(t)).then(
      (l) => {
        listCache = l;
        setList(l);
        setFailed(null);
        setSupportUnread(l.filter((x) => x.unread).length);
      },
      (e: unknown) => setFailed(e instanceof ApiError ? e : new ApiError('server')),
    );
  }, [api, status, withToken]);

  if (status !== 'signedIn') return <NeedAccount />;

  const active = list?.filter((t) => t.status !== 'closed') ?? [];
  const done = list?.filter((t) => t.status === 'closed') ?? [];

  return (
    <div className={first ? 'bd enter' : 'bd'} style={{ paddingTop: 26, maxWidth: 900 }}>
      <div className="rw" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="col sp" style={{ gap: 4, minWidth: 220 }}>
          <h1 className="t1">پشتیبانی</h1>
          <span className="mute sm">سؤال، مشکل یا درخواستی دارید؟ تیکت بزنید؛ تیم کلید همین‌جا جواب می‌دهد.</span>
        </div>
        <button type="button" className="btn btn-p" onClick={() => setCreating(true)}>
          <Icon name="plus" size="s" thick />
          تیکت تازه
        </button>
      </div>

      {!list && failed && (
        <div className="card tk-empty">
          <Icon name="warn" size="l" />
          <span>{failed.code === 'offline' ? 'برای دیدن تیکت‌ها اینترنت لازم است.' : 'تیکت‌ها باز نشدند؛ کمی بعد دوباره سر بزنید.'}</span>
        </div>
      )}
      {!list && !failed && slow && (
        <div className="col" style={{ gap: 10 }} aria-hidden="true">
          <Skeleton h={76} r={18} />
          <Skeleton h={76} r={18} />
        </div>
      )}
      {list && list.length === 0 && (
        <div className="card tk-empty">
          <span className="tk-empty-ic" aria-hidden="true">
            <Icon name="msg" size="l" />
          </span>
          <span className="t2">هنوز تیکتی نزده‌اید</span>
          <span className="mute sm">هر وقت سؤال یا مشکلی داشتید، یک تیکت بزنید؛ جوابش همین‌جا می‌آید.</span>
        </div>
      )}
      {active.length > 0 && (
        <section className="col" style={{ gap: 10 }}>
          <h2 className="tk-h">در جریان</h2>
          <div className="card tk-list stagger">
            {active.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section className="col" style={{ gap: 10 }}>
          <h2 className="tk-h">بسته‌شده</h2>
          <div className="card tk-list stagger">
            {done.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
      {creating && <NewTicketDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/** هر تیکت حالت خودش را دارد؛ رفتن از تیکتی به تیکت دیگر از صفر شروع می‌شود. */
export function TicketRoute() {
  const { id = '' } = useParams();
  return <TicketPage key={id} id={id} />;
}

/** یک تیکت: درخواست و پاسخ‌ها مثل نامه، نه چت؛ بسته‌شده یعنی کارش تمام شد و دیگر پیام نمی‌گیرد. */
function TicketPage({ id }: { id: string }) {
  const { status, api, withToken } = useAuth();
  const toast = useToast();
  const [thread, setThread] = useState(() => threadCache.get(id) ?? null);
  const [failed, setFailed] = useState<ApiError | null>(null);
  const [writing, setWriting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slow = useSlow(!thread && !failed);
  const msgId = useRef(newId());

  const show = useCallback(
    (t: TicketThread) => {
      threadCache.set(id, t);
      setThread(t);
      if (listCache) listCache = listCache.map((x) => (x.id === t.ticket.id ? t.ticket : x));
    },
    [id],
  );

  useEffect(() => {
    if (!api || status !== 'signedIn') return;
    void withToken((t) => api.ticket(t, id)).then(
      (t) => {
        show(t);
        setFailed(null);
        // باز کردن تیکت پاسخش را دیده‌شده کرد؛ نشان کنار «پشتیبانی» همان لحظه درست می‌شود.
        void withToken((tk) => api.unreadTickets(tk)).then(setSupportUnread, () => {});
      },
      (e: unknown) => setFailed(e instanceof ApiError ? e : new ApiError('server')),
    );
  }, [api, status, withToken, id, show]);

  if (status !== 'signedIn') return <NeedAccount />;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError('چند کلمه بنویسید.');
      return;
    }
    if (!api || busy) return;
    setBusy(true);
    try {
      show(await withToken((t) => api.replyTicket(t, id, { id: msgId.current, body })));
      msgId.current = newId();
      setDraft('');
      setError('');
      setWriting(false);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(ticketFailText(apiErr));
      // تیکت را جای دیگری بسته‌اند؛ همان حالت تازه دیده شود.
      if (apiErr?.code === 'closed') void withToken((t) => api.ticket(t, id)).then(show, () => {});
    }
    setBusy(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter می‌فرستد؛ Enter تنها خط تازه است تا توضیح بلند راحت نوشته شود.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
    if (e.key === 'Escape' && !draft.trim()) {
      e.stopPropagation();
      setWriting(false);
    }
  };

  const close = async () => {
    if (!api || busy) return;
    setBusy(true);
    try {
      show(await withToken((t) => api.closeTicket(t, id)));
      setConfirming(false);
      setWriting(false);
      toast('تیکت بسته شد.');
    } catch (err) {
      toast(ticketFailText(err instanceof ApiError ? err : null));
    }
    setBusy(false);
  };

  const back = (
    <Link viewTransition className="btn btn-g" to="/support" style={{ padding: '0 12px', alignSelf: 'flex-start' }}>
      <Icon name="back" size="s" />
      تیکت‌ها
    </Link>
  );

  if (!thread) {
    return (
      <div className="bd" style={{ paddingTop: 22, maxWidth: 900 }}>
        {back}
        {failed ? (
          <div className="card tk-empty">
            <Icon name="warn" size="l" />
            <span>
              {failed.code === 'not_found'
                ? 'این تیکت پیدا نشد.'
                : failed.code === 'offline'
                  ? 'برای دیدن تیکت اینترنت لازم است.'
                  : 'تیکت باز نشد؛ کمی بعد دوباره سر بزنید.'}
            </span>
          </div>
        ) : (
          slow && (
            <div className="col" style={{ gap: 12 }} aria-hidden="true">
              <Skeleton h={96} r={18} />
              <Skeleton h={120} r={18} />
            </div>
          )
        )}
      </div>
    );
  }

  const t = thread.ticket;
  const closed = t.status === 'closed';
  return (
    <div className="bd tk-page" style={{ paddingTop: 22, maxWidth: 900 }}>
      {back}
      <header className="card tk-head">
        <span className="tk-ic" aria-hidden="true">
          <Icon name={topicIcon(t.topic)} />
        </span>
        <div className="col sp" style={{ gap: 6, minWidth: 0 }}>
          <h1 className="t2 tk-title">{t.subject}</h1>
          <span className="xs mute">
            {topicLabel(t.topic)} · فرستاده {seen(t.createdAt)}
          </span>
        </div>
        <span className={`tag ${STATUS[t.status].tone}`}>
          {closed && <Icon name="check" size="s" />}
          {STATUS[t.status].label}
        </span>
      </header>

      <ol className="tk-letters" aria-label="درخواست و پاسخ‌ها">
        {thread.messages.map((m, i) => (
          <li key={m.id} className={m.from === 'support' ? 'card tk-letter kelid' : 'card tk-letter'}>
            <div className="tk-from">
              <span className="tk-av" aria-hidden="true">
                {m.from === 'support' ? <Logo size={30} /> : <Icon name="user" size="s" />}
              </span>
              <span className="b sm">{m.from === 'support' ? 'پاسخ پشتیبانی کلید' : i === 0 ? 'درخواست شما' : 'توضیح شما'}</span>
              <span className="sp" />
              <span className="xs mute">{seen(m.createdAt)}</span>
            </div>
            <p>{m.body}</p>
          </li>
        ))}
      </ol>

      {closed ? (
        <div className="card tk-done">
          <span className="tk-done-ic" aria-hidden="true">
            <Icon name="check" thick />
          </span>
          <div className="col sp" style={{ gap: 2, minWidth: 200 }}>
            <span className="b">این تیکت بسته شده است.</span>
            <span className="sm mute">سؤال، مشکل یا پیشنهاد تازه‌ای دارید؟ یک تیکت تازه بزنید.</span>
          </div>
          <button type="button" className="btn btn-s" onClick={() => setCreating(true)}>
            <Icon name="plus" size="s" thick />
            تیکت تازه
          </button>
        </div>
      ) : writing ? (
        <form className="card tk-reply" onSubmit={(e) => void send(e)}>
          <span className="b sm">توضیح بیشتر</span>
          <textarea
            aria-label="توضیح بیشتر"
            className="fld"
            rows={4}
            maxLength={4000}
            autoFocus
            placeholder="هر توضیحی که لازم است بنویسید…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
            onKeyDown={onKeyDown}
            style={{ lineHeight: 1.9, resize: 'vertical' }}
          />
          <div className="rw" style={{ gap: 10, flexWrap: 'wrap' }}>
            {error && (
              <span role="alert" className="tag bad">
                {error}
              </span>
            )}
            <span className="sp" />
            {draft.length > 3800 && <span className="xs mute num">{toFaDigits(4000 - draft.length)}</span>}
            <button type="button" className="btn btn-g" onClick={() => setWriting(false)}>
              انصراف
            </button>
            <button type="submit" className="btn btn-p" disabled={busy}>
              <Icon name="send" size="s" />
              فرستادن
            </button>
          </div>
        </form>
      ) : confirming ? (
        <div className="card tk-next" role="alert">
          <div className="col sp" style={{ gap: 2, minWidth: 200 }}>
            <span className="b">تیکت بسته شود؟</span>
            <span className="sm mute">بعد از بستن دیگر نمی‌شود به این تیکت پیام داد؛ برای موضوع تازه، تیکت تازه می‌زنید.</span>
          </div>
          <div className="rw" style={{ gap: 8 }}>
            <button type="button" className="btn btn-g" onClick={() => setConfirming(false)}>
              نه
            </button>
            <button type="button" className="btn btn-p" disabled={busy} onClick={() => void close()}>
              <Icon name="check" size="s" />
              بله، ببند
            </button>
          </div>
        </div>
      ) : (
        <div className="card tk-next">
          <div className="col sp" style={{ gap: 2, minWidth: 200 }}>
            {t.status === 'answered' ? (
              <>
                <span className="b">{AFTER_ANSWER[t.topic].ask}</span>
                <span className="sm mute">{AFTER_ANSWER[t.topic].hint}</span>
              </>
            ) : (
              <>
                <span className="b">درخواستتان به تیم کلید رسید.</span>
                <span className="sm mute">جواب همین‌جا می‌آید و کنار «پشتیبانی» نشان پاسخ تازه روشن می‌شود.</span>
              </>
            )}
          </div>
          <div className="rw" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-s" onClick={() => setWriting(true)}>
              <Icon name="edit" size="s" />
              توضیح بیشتر
            </button>
            {t.status === 'answered' && (
              <button type="button" className="btn btn-p" onClick={() => setConfirming(true)}>
                <Icon name="check" size="s" />
                {AFTER_ANSWER[t.topic].close}
              </button>
            )}
          </div>
        </div>
      )}
      {creating && <NewTicketDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
