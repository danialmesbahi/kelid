import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon, Skeleton } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import type { ClientError, Feedback, FeedbackKind } from '../api';
import { useAuth } from '../auth';
import { ago, errorText, Phone, toListTop, useEnter, useLoad, useSlow, useToast } from '../ui';

type Tab = 'feedback' | 'errors';

const KIND: Record<FeedbackKind, { label: string; tone: '' | 'ok' | 'warn' }> = {
  problem: { label: 'مشکل', tone: 'warn' },
  idea: { label: 'پیشنهاد', tone: '' },
  praise: { label: 'تعریف', tone: 'ok' },
};
const PLATFORM: Record<string, string> = { web: 'مرورگر', pwa: 'گوشی', desktop: 'ویندوز', '': 'نامعلوم' };

/** دورهٔ بتا: نظر کاربرها و خطاهای برنامه، هر دو زنده؛ هر هفته باز‌ها را می‌بینیم و رسیدگی‌شده می‌زنیم. */
export function Beta() {
  const [params, setParams] = useSearchParams();
  const tools = useRef<HTMLDivElement>(null);
  const tab: Tab = params.get('t') === 'errors' ? 'errors' : 'feedback';
  const done = params.get('s') === 'done';
  const stats = useLoad('stats', (a, t) => a.stats(t));
  const set = (k: string, v: string | null) => (
    toListTop(tools.current),
    setParams((p) => (v ? p.set(k, v) : p.delete(k), p), { replace: true, preventScrollReset: true })
  );

  return (
    <>
      <header className="hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">پنل فروشنده</span>
          <h1 className="t1">نظرها و خطاها</h1>
          <span className="mute sm ad-sub">آنچه دفترها از داخل برنامه فرستاده‌اند و خطاهایی که روی دستگاه‌هایشان پیش آمده؛ تکرارهای یک خطا یک ردیف‌اند.</span>
        </div>
      </header>
      <div className="bd">
        <div className="ad-tools" ref={tools}>
          <div className="seg" role="tablist" aria-label="بخش">
            <button type="button" role="tab" aria-selected={tab === 'feedback'} onClick={() => set('t', null)}>
              نظرها{stats.data?.openFeedback ? ` (${toFaDigits(stats.data.openFeedback)})` : ''}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'errors'} onClick={() => set('t', 'errors')}>
              خطاها{stats.data?.openErrors ? ` (${toFaDigits(stats.data.openErrors)})` : ''}
            </button>
          </div>
          <div className="seg" role="tablist" aria-label="وضعیت">
            <button type="button" role="tab" aria-selected={!done} onClick={() => set('s', null)}>
              باز
            </button>
            <button type="button" role="tab" aria-selected={done} onClick={() => set('s', 'done')}>
              رسیدگی‌شده
            </button>
          </div>
        </div>
        {tab === 'feedback' ? <FeedbackList done={done} /> : <ErrorList done={done} />}
      </div>
    </>
  );
}

function Empty({ icon, text }: { icon: 'msg' | 'check' | 'warn'; text: string }) {
  return (
    <div className="card ad-empty">
      <Icon name={icon} size="l" />
      <span>{text}</span>
    </div>
  );
}

function Loading() {
  return (
    <div className="card" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ad-fb">
          <Skeleton w="30%" h={16} />
          <Skeleton w="90%" h={18} />
          <Skeleton w="50%" h={14} />
        </div>
      ))}
    </div>
  );
}

function FeedbackList({ done }: { done: boolean }) {
  const { call } = useAuth();
  const toast = useToast();
  const list = useLoad(`feedback:${done ? 'done' : 'open'}`, (a, t) => a.feedback(t, done ? 'done' : 'open'), undefined, true);
  const enter = useEnter(`feedback:${done}`);
  const slow = useSlow(!list.data && list.pending);

  // رسیدگی‌شده زدن برگشت‌پذیر است: همان لحظه از فهرست می‌رود و «برگرداندن» دارد.
  const mark = async (f: Feedback, to: boolean) => {
    list.set((list.data ?? []).filter((x) => x.id !== f.id));
    try {
      await call((a, t) => a.markFeedback(t, f.office.id, f.id, to));
      toast(to ? 'رسیدگی‌شده شد.' : 'دوباره باز شد.', {
        action: { label: 'برگرداندن', run: () => void call((a, t) => a.markFeedback(t, f.office.id, f.id, !to)).then(list.reload, list.reload) },
      });
    } catch (e) {
      toast(errorText(e), { bad: true });
      list.reload();
    }
  };

  if (list.error && !list.data) return <Empty icon="warn" text={errorText(list.error)} />;
  if (!list.data) return slow ? <Loading /> : null;
  if (!list.data.length) return <Empty icon={done ? 'msg' : 'check'} text={done ? 'هنوز نظری رسیدگی نشده است.' : 'نظر تازه‌ای نیست.'} />;
  return (
    <div className={`card ${enter}${list.stale ? ' ad-stale' : ''}`}>
      {list.data.map((f) => (
        <article key={f.id} className="ad-fb">
          <div className="ad-meta">
            <span className={`tag ${KIND[f.kind].tone}`}>{KIND[f.kind].label}</span>
            <Link to={`/offices/${f.office.id}`} viewTransition className="b sm">
              {f.office.name}
            </Link>
            {f.office.pilot && <span className="ad-pilot">بتا</span>}
            <span className="sm mute">
              {f.user.name}، <Phone value={f.user.phone} />
            </span>
            <span className="sp" />
            <span className="xs mute">{ago(f.createdAt)}</span>
          </div>
          <p className="ad-fb-body" style={{ margin: 0 }}>
            {f.body}
          </p>
          <div className="ad-meta">
            <span className="xs mute">
              صفحهٔ <bdi dir="ltr">{f.page || '/'}</bdi> · {PLATFORM[f.platform] ?? f.platform}
              {f.appVersion && ` · نسخهٔ ${toFaDigits(f.appVersion)}`}
            </span>
            <span className="sp" />
            <button type="button" className="btn btn-s" onClick={() => void mark(f, !done)}>
              <Icon name={done ? 'msg' : 'check'} size="s" />
              {done ? 'باز کردن دوباره' : 'رسیدگی شد'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ErrorList({ done }: { done: boolean }) {
  const { call } = useAuth();
  const toast = useToast();
  const list = useLoad(`errors:${done ? 'resolved' : 'open'}`, (a, t) => a.errors(t, done ? 'resolved' : 'open'), undefined, true);
  const enter = useEnter(`errors:${done}`);
  const slow = useSlow(!list.data && list.pending);

  const mark = async (e: ClientError, to: boolean) => {
    list.set((list.data ?? []).filter((x) => x.fingerprint !== e.fingerprint));
    try {
      await call((a, t) => a.resolveError(t, e.fingerprint, to));
      toast(to ? 'حل‌شده زده شد؛ اگر دوباره پیش بیاید خودش باز می‌شود.' : 'دوباره باز شد.', {
        action: { label: 'برگرداندن', run: () => void call((a, t) => a.resolveError(t, e.fingerprint, !to)).then(list.reload, list.reload) },
      });
    } catch (err) {
      toast(errorText(err), { bad: true });
      list.reload();
    }
  };

  if (list.error && !list.data) return <Empty icon="warn" text={errorText(list.error)} />;
  if (!list.data) return slow ? <Loading /> : null;
  if (!list.data.length) return <Empty icon="check" text={done ? 'هنوز خطایی حل‌شده زده نشده است.' : 'خطای بازی نیست.'} />;
  return (
    <div className={`card ${enter}${list.stale ? ' ad-stale' : ''}`}>
      {list.data.map((e) => (
        <article key={e.fingerprint} className="ad-fb">
          <div className="ad-meta">
            <span className="tag warn num">{toFaDigits(e.count)} بار</span>
            <span className="sm">در {toFaDigits(e.offices)} دفتر</span>
            <span className="sm mute">
              {e.recent.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && '، '}
                  <Link to={`/offices/${o.id}`} viewTransition>
                    {o.name}
                  </Link>
                </span>
              ))}
            </span>
            <span className="sp" />
            <span className="xs mute">آخرین بار {ago(e.lastSeen)}</span>
          </div>
          <div className="ad-err-msg">{e.message}</div>
          {e.stack && (
            <details className="ad-stack">
              <summary className="xs mute">جزئیات فنی</summary>
              <pre>{e.stack}</pre>
            </details>
          )}
          <div className="ad-meta">
            <span className="xs mute">
              صفحهٔ <bdi dir="ltr">{e.page || '/'}</bdi> · {PLATFORM[e.platform] ?? e.platform}
              {e.appVersion && ` · نسخهٔ ${toFaDigits(e.appVersion)}`} · اولین بار {ago(e.firstSeen)}
            </span>
            <span className="sp" />
            <button type="button" className="btn btn-s" onClick={() => void mark(e, !done)}>
              <Icon name={done ? 'warn' : 'check'} size="s" />
              {done ? 'باز کردن دوباره' : 'حل شد'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
