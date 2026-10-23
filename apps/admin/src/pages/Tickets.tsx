import { type FormEvent, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Icon, Skeleton } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import type { AdminApi, TicketDetail, TicketStatus, TicketTopic } from '../api';
import { useAuth } from '../auth';
import { ago, errorText, Phone, toListTop, useEnter, useLoad, useSlow, useToast } from '../ui';

const TOPIC: Record<TicketTopic, { label: string; tone: '' | 'ok' | 'warn' }> = {
  problem: { label: 'مشکل', tone: 'warn' },
  question: { label: 'سؤال', tone: '' },
  billing: { label: 'اشتراک', tone: 'ok' },
  idea: { label: 'پیشنهاد', tone: '' },
};
const STATUS: Record<TicketStatus, { label: string; tone: '' | 'ok' | 'warn' }> = {
  open: { label: 'منتظر پاسخ ما', tone: 'warn' },
  answered: { label: 'پاسخ داده شد', tone: 'ok' },
  closed: { label: 'بسته', tone: '' },
};
const PLATFORM: Record<string, string> = { web: 'مرورگر', pwa: 'گوشی', desktop: 'ویندوز', '': 'نامعلوم' };
const TABS: Array<{ value: TicketStatus; label: string }> = [
  { value: 'open', label: 'باز' },
  { value: 'answered', label: 'پاسخ داده‌شده' },
  { value: 'closed', label: 'بسته' },
];

function Empty({ icon, text }: { icon: 'msg' | 'check' | 'warn'; text: string }) {
  return (
    <div className="card ad-empty">
      <Icon name={icon} size="l" />
      <span>{text}</span>
    </div>
  );
}

/** صف تیکت‌های پشتیبانی، زنده؛ باز‌ها از قدیمی‌ترین تا کسی بیشتر منتظر نماند. */
export function Tickets() {
  const [params, setParams] = useSearchParams();
  const tools = useRef<HTMLDivElement>(null);
  const status = TABS.find((t) => t.value === params.get('s'))?.value ?? 'open';
  const stats = useLoad('stats', (a, t) => a.stats(t));
  const list = useLoad(`tickets:${status}`, (a, t) => a.tickets(t, status), undefined, true);
  const enter = useEnter(`tickets:${status}`);
  const slow = useSlow(!list.data && list.pending);

  return (
    <>
      <header className="hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">پنل فروشنده</span>
          <h1 className="t1">پشتیبانی</h1>
          <span className="mute sm ad-sub">تیکت‌هایی که دفترها از داخل برنامه زده‌اند. پاسخ شما همان لحظه در برنامهٔ کاربر نشان می‌خورد.</span>
        </div>
      </header>
      <div className="bd">
        <div className="ad-tools" ref={tools}>
          <div className="seg" role="tablist" aria-label="وضعیت">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={status === t.value}
                onClick={() => (
                  toListTop(tools.current),
                  setParams((p) => (t.value === 'open' ? p.delete('s') : p.set('s', t.value), p), { replace: true, preventScrollReset: true })
                )}
              >
                {t.label}
                {t.value === 'open' && stats.data?.openTickets ? ` (${toFaDigits(stats.data.openTickets)})` : ''}
              </button>
            ))}
          </div>
        </div>
        {list.error && !list.data ? (
          <Empty icon="warn" text={errorText(list.error)} />
        ) : !list.data ? (
          slow && (
            <div className="card" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="ad-fb">
                  <Skeleton w="30%" h={16} />
                  <Skeleton w="70%" h={18} />
                  <Skeleton w="50%" h={14} />
                </div>
              ))}
            </div>
          )
        ) : !list.data.length ? (
          <Empty icon={status === 'open' ? 'check' : 'msg'} text={status === 'open' ? 'تیکتی منتظر پاسخ نیست.' : 'تیکتی در این بخش نیست.'} />
        ) : (
          <div className={`card ${enter}${list.stale ? ' ad-stale' : ''}`}>
            {list.data.map((t) => (
              <Link key={`${t.office.id}/${t.id}`} to={`/tickets/${t.office.id}/${t.id}`} viewTransition className="ad-fb ad-tk-row">
                <div className="ad-meta">
                  <span className={`tag ${TOPIC[t.topic].tone}`}>{TOPIC[t.topic].label}</span>
                  <span className="b sm">{t.office.name}</span>
                  {t.office.pilot && <span className="ad-pilot">بتا</span>}
                  <span className="sm mute">
                    {t.user.name}، <Phone value={t.user.phone} />
                  </span>
                  <span className="sp" />
                  <span className="xs mute">{ago(t.updatedAt)}</span>
                </div>
                <span className="b">{t.subject}</span>
                <span className="sm mute ad-tk-last">
                  {t.last.from === 'support' ? 'ما: ' : ''}
                  {t.last.body}
                </span>
                <span className="xs mute">{toFaDigits(t.messages)} پیام</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** یک تیکت: رشتهٔ پیام‌ها، پاسخ و تغییر وضعیت. با هر تغییر همان دفتر بی‌صدا تازه می‌شود. */
export function TicketPage() {
  const { office = '', id = '' } = useParams();
  const { call } = useAuth();
  const toast = useToast();
  const detail = useLoad(`ticket:${office}/${id}`, (a, t) => a.ticket(t, office, id), office);
  const slow = useSlow(!detail.data && detail.pending);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: (a: AdminApi, t: string) => Promise<TicketDetail>, done?: string) => {
    setBusy(true);
    try {
      detail.set(await call(fn));
      if (done) toast(done);
      return true;
    } catch (e) {
      toast(errorText(e), { bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    if (await run((a, t) => a.replyTicket(t, office, id, body), 'پاسخ فرستاده شد.')) setDraft('');
  };

  const back = (
    <Link to="/tickets" viewTransition className="ad-back sm">
      <Icon name="chr" size="s" />
      همهٔ تیکت‌ها
    </Link>
  );

  if (!detail.data) {
    return (
      <>
        <header className="hd">
          <div className="col" style={{ gap: 6 }}>
            {back}
            {slow && <Skeleton w={260} h={34} />}
          </div>
        </header>
        <div className="bd">{detail.error ? <Empty icon="warn" text={errorText(detail.error)} /> : null}</div>
      </>
    );
  }

  const { ticket: t, messages } = detail.data;
  return (
    <>
      <header className="hd ad-ohd">
        <div className="col sp ad-hd-main" style={{ gap: 6, minWidth: 0 }}>
          {back}
          <span className="rw" style={{ gap: 12, flexWrap: 'wrap' }}>
            <h1 className="t1" style={{ overflowWrap: 'anywhere' }}>
              {t.subject}
            </h1>
            <span className={`tag ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>
          </span>
          <span className="sm mute ad-facts-line">
            <span className={`tag ${TOPIC[t.topic].tone}`}>{TOPIC[t.topic].label}</span>
            <Link to={`/offices/${t.office.id}`} viewTransition className="b">
              {t.office.name}
            </Link>
            <span>
              {t.user.name}، <Phone value={t.user.phone} />
            </span>
            <span>
              صفحهٔ <bdi dir="ltr">{t.page || '/'}</bdi> · {PLATFORM[t.platform] ?? t.platform}
              {t.appVersion && ` · نسخهٔ ${toFaDigits(t.appVersion)}`}
            </span>
          </span>
        </div>
        {t.status === 'closed' ? (
          <button
            type="button"
            className="btn btn-g"
            disabled={busy}
            onClick={() => void run((a, tk) => a.setTicketStatus(tk, office, id, 'open'), 'تیکت دوباره باز شد.')}
          >
            <Icon name="msg" size="s" />
            باز کردن دوباره
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-g"
            disabled={busy}
            onClick={() => void run((a, tk) => a.setTicketStatus(tk, office, id, 'closed'), 'تیکت بسته شد.')}
          >
            <Icon name="check" size="s" />
            بستن تیکت
          </button>
        )}
      </header>
      <div className="bd" style={{ maxWidth: 860 }}>
        <ol className="ad-thread" aria-label="پیام‌ها">
          {messages.map((m) => (
            <li key={m.id} className={m.from === 'support' ? 'ad-msg us' : 'ad-msg'}>
              <span className="xs b">{m.from === 'support' ? `پشتیبانی · ${m.author}` : m.author}</span>
              <p className="ad-fb-body" style={{ margin: 0 }}>
                {m.body}
              </p>
              <span className="xs mute">{ago(m.createdAt)}</span>
            </li>
          ))}
        </ol>
        <form className="card ad-reply" onSubmit={(e) => void send(e)}>
          <textarea
            className="fld"
            rows={4}
            maxLength={4000}
            aria-label="پاسخ به کاربر"
            placeholder="پاسخ به کاربر… (Ctrl+Enter می‌فرستد)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && void send()}
            style={{ lineHeight: 1.9, resize: 'vertical' }}
          />
          <div className="rw ad-reply-ft">
            <span className="xs mute sp">کاربر پاسخ را در بخش «پشتیبانی» برنامه می‌بیند و کنارش نشان می‌خورد.</span>
            <button type="submit" className="btn btn-p" disabled={busy || !draft.trim()}>
              <Icon name="send" size="s" />
              فرستادن پاسخ
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
