import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Icon, Skeleton } from '@kelid/ui';
import { newId, toFaDigits } from '@kelid/core';
import { useAuth } from '../auth/AuthContext';
import { seen } from '../auth/AccountSection';
import { ApiError, type Ticket, type TicketThread } from '../auth/api';
import { useSlow } from '../data';
import { useFirstVisit } from '../layout/useFirstVisit';
import { useToast } from '../layout/Toasts';
import { NewTicketDialog } from './NewTicketDialog';
import { STATUS, ticketFailText, topicLabel } from './topics';
import { onSupportChange, setSupportUnread } from './unread';
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

/** پشتیبانی: تیکت‌های همین کاربر با تیم کلید. */
export function SupportPage() {
  const { status, api, withToken } = useAuth();
  const first = useFirstVisit('support');
  const [list, setList] = useState(listCache);
  const [failed, setFailed] = useState<ApiError | null>(null);
  const [creating, setCreating] = useState(false);
  const slow = useSlow(!list && !failed);

  useEffect(() => {
    if (!api || status !== 'signedIn') return;
    const load = () =>
      void withToken((t) => api.tickets(t)).then(
        (l) => {
          listCache = l;
          setList(l);
          setFailed(null);
          setSupportUnread(l.filter((x) => x.unread).length);
        },
        (e: unknown) => setFailed(e instanceof ApiError ? e : new ApiError('server')),
      );
    load();
    return onSupportChange(load);
  }, [api, status, withToken]);

  if (status !== 'signedIn') return <NeedAccount />;

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
          <Icon name="msg" size="l" />
          <span className="t2">هنوز تیکتی نزده‌اید</span>
          <span className="mute sm">هر وقت سؤال یا مشکلی داشتید، یک تیکت بزنید؛ جوابش همین‌جا می‌آید.</span>
        </div>
      )}
      {list && list.length > 0 && (
        <div className="card tk-list stagger">
          {list.map((t) => (
            <Link key={t.id} viewTransition to={`/support/${t.id}`} className={t.unread ? 'tk-row hov new' : 'tk-row hov'}>
              <span className="tk-ic" aria-hidden="true">
                <Icon name="msg" />
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
          ))}
        </div>
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

/** یک تیکت: رشتهٔ پیام‌ها، پاسخ و بستن. */
function TicketPage({ id }: { id: string }) {
  const { status, api, withToken } = useAuth();
  const toast = useToast();
  const [thread, setThread] = useState(() => threadCache.get(id) ?? null);
  const [failed, setFailed] = useState<ApiError | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const slow = useSlow(!thread && !failed);
  const msgId = useRef(newId());
  const endRef = useRef<HTMLDivElement>(null);

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
    const load = () =>
      void withToken((t) => api.ticket(t, id)).then(
        (t) => {
          show(t);
          setFailed(null);
          // باز کردن تیکت پاسخش را دیده‌شده کرد؛ نشان کنار «پشتیبانی» همان لحظه درست می‌شود.
          void withToken((tk) => api.unreadTickets(tk)).then(setSupportUnread, () => {});
        },
        (e: unknown) => setFailed(e instanceof ApiError ? e : new ApiError('server')),
      );
    load();
    return onSupportChange(load);
  }, [api, status, withToken, id, show]);

  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  if (status !== 'signedIn') return <NeedAccount />;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) {
      setError('چند کلمه بنویسید.');
      return;
    }
    if (!api || sending) return;
    setSending(true);
    try {
      show(await withToken((t) => api.replyTicket(t, id, { id: msgId.current, body })));
      msgId.current = newId();
      setDraft('');
      setError('');
    } catch (err) {
      setError(ticketFailText(err instanceof ApiError ? err : null));
    }
    setSending(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter می‌فرستد؛ Enter تنها خط تازه است تا پیام بلند راحت نوشته شود.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
  };

  const close = async () => {
    if (!api) return;
    try {
      show(await withToken((t) => api.closeTicket(t, id)));
      toast('تیکت بسته شد. اگر باز هم پیام بدهید، دوباره باز می‌شود.');
    } catch (err) {
      toast(ticketFailText(err instanceof ApiError ? err : null));
    }
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
              <Skeleton w="50%" h={34} />
              <Skeleton h={90} r={18} />
              <Skeleton h={70} r={18} />
            </div>
          )
        )}
      </div>
    );
  }

  const t = thread.ticket;
  return (
    <div className="bd tk-page" style={{ paddingTop: 22, maxWidth: 900 }}>
      <div className="rw" style={{ gap: 10, flexWrap: 'wrap' }}>
        {back}
        <span className="sp" />
        {t.status !== 'closed' && (
          <button type="button" className="btn btn-g" onClick={() => void close()}>
            <Icon name="check" size="s" />
            بستن تیکت
          </button>
        )}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <h1 className="t1 tk-title">{t.subject}</h1>
        <span className="rw sm mute" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className={`tag ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
          {topicLabel(t.topic)} · {seen(t.createdAt)}
        </span>
      </div>

      <ol className="tk-thread" aria-label="پیام‌ها">
        {thread.messages.map((m) => (
          <li key={m.id} className={m.from === 'support' ? 'tk-msg kelid' : 'tk-msg'}>
            <span className="xs b tk-who">{m.from === 'support' ? 'پشتیبانی کلید' : 'شما'}</span>
            <p>{m.body}</p>
            <span className="xs mute">{seen(m.createdAt)}</span>
          </li>
        ))}
      </ol>
      <div ref={endRef} />

      <form className="card tk-reply" onSubmit={(e) => void send(e)}>
        {t.status === 'closed' && <span className="xs mute">این تیکت بسته است؛ با پیام تازه دوباره باز می‌شود.</span>}
        <textarea
          aria-label="پاسخ شما"
          className="fld"
          rows={3}
          maxLength={4000}
          placeholder="پاسخ یا توضیح بیشتر…"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          onKeyDown={onKeyDown}
          style={{ lineHeight: 1.9, resize: 'vertical' }}
        />
        <div className="rw" style={{ gap: 10 }}>
          {error && (
            <span role="alert" className="tag bad">
              {error}
            </span>
          )}
          <span className="sp" />
          {draft.length > 3800 && <span className="xs mute num">{toFaDigits(4000 - draft.length)}</span>}
          <button type="submit" className="btn btn-p" disabled={sending}>
            <Icon name="send" size="s" />
            فرستادن
          </button>
        </div>
      </form>
    </div>
  );
}
