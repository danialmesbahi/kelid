import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Icon, Skeleton, Switch } from '@kelid/ui';
import { formatGrouped, PLANS, termOf, toFaDigits, type PlanId } from '@kelid/core';
import type { Note, OfficeDetail } from '../api';
import { useAuth } from '../auth';
import { ago, dateText, Dialog, errorText, leftText, payTag, Phone, planName, statusTag, toman, useLoad, useSlow, useToast } from '../ui';

const noteMark: Record<Note['kind'], { icon: 'msg' | 'cal' | 'lock' | 'check'; label: string }> = {
  note: { icon: 'msg', label: 'یادداشت' },
  extend: { icon: 'cal', label: 'تمدید' },
  suspend: { icon: 'lock', label: 'تعلیق' },
  resume: { icon: 'check', label: 'رفع تعلیق' },
};

/** یک دفتر: اشتراک، همکاران، پرداخت‌ها و سابقهٔ پشتیبانی؛ تمدید، تعلیق و یادداشت از همین‌جا. */
export function OfficePage() {
  const { id = '' } = useParams();
  const { call } = useAuth();
  const toast = useToast();
  const d = useLoad(`office:${id}`, (a, t) => a.office(t, id), id);
  const slow = useSlow(!d.data && d.pending);
  const [dialog, setDialog] = useState<'extend' | 'suspend' | null>(null);
  const [busy, setBusy] = useState(false);

  const resume = async () => {
    const o = d.data!.office;
    const reason = o.suspendReason ?? 'تعلیق دوباره';
    setBusy(true);
    try {
      d.set(await call((a, t) => a.resume(t, id, '')));
      toast('تعلیق برداشته شد؛ دفتر دوباره می‌تواند ثبت کند.', {
        action: {
          label: 'برگرداندن',
          run: () => void call((a, t) => a.suspend(t, id, reason)).then(d.set, (e: unknown) => toast(errorText(e), { bad: true })),
        },
      });
    } catch (e) {
      toast(errorText(e), { bad: true });
      d.reload();
    } finally {
      setBusy(false);
    }
  };

  // برچسب بتا برگشت‌پذیر است؛ بی پرسش، با «برگرداندن».
  const togglePilot = async () => {
    const next = !d.data!.office.pilot;
    setBusy(true);
    try {
      d.set(await call((a, t) => a.setPilot(t, id, next)));
      toast(next ? 'به دفترهای بتا اضافه شد.' : 'از دفترهای بتا بیرون آمد.', {
        action: {
          label: 'برگرداندن',
          run: () => void call((a, t) => a.setPilot(t, id, !next)).then(d.set, (e: unknown) => toast(errorText(e), { bad: true })),
        },
      });
    } catch (e) {
      toast(errorText(e), { bad: true });
    } finally {
      setBusy(false);
    }
  };

  if (!d.data) {
    return (
      <div className="bd" style={{ paddingTop: 26 }}>
        <BackLink />
        {d.error ? (
          <div className="card ad-empty">
            <Icon name="warn" size="l" />
            <span>{errorText(d.error)}</span>
            <button type="button" className="btn btn-s" onClick={d.reload}>
              دوباره امتحان کنید
            </button>
          </div>
        ) : (
          slow && (
            <div className="col" style={{ gap: 18 }} aria-hidden="true">
              <Skeleton w="40%" h={36} />
              <Skeleton h={84} r={14} />
              <Skeleton h={260} r={18} />
            </div>
          )
        )}
      </div>
    );
  }

  const { office: o, members, invites, payments, notes } = d.data;
  const tag = statusTag[o.status];
  const suspended = o.status === 'suspended';

  return (
    <>
      <header className="hd ad-ohd">
        <div className="col sp ad-hd-main" style={{ gap: 6, minWidth: 0 }}>
          <BackLink />
          <span className="rw" style={{ gap: 12, flexWrap: 'wrap' }}>
            <h1 className="t1">{o.name}</h1>
            <span className={`tag ${tag.tone}`}>{tag.label}</span>
            {o.pilot && <span className="ad-pilot">دفتر بتا</span>}
          </span>
          <span className="sm mute ad-facts-line">
            <span>ثبت‌نام {dateText(o.createdAt)}</span>
            {o.manager && (
              <span>
                مدیر: {o.manager.name}، <Phone value={o.manager.phone} />
              </span>
            )}
            <span>آخرین فعالیت {ago(o.lastSeenAt)}</span>
          </span>
        </div>
        <div className="rw ad-acts">
          <button type="button" className="btn btn-g" onClick={togglePilot} disabled={busy} aria-pressed={o.pilot}>
            <Icon name="spark" size="s" />
            {o.pilot ? 'بیرون از بتا' : 'افزودن به بتا'}
          </button>
          {suspended ? (
            <button type="button" className="btn btn-s" onClick={resume} disabled={busy}>
              <Icon name="check" size="s" />
              رفع تعلیق
            </button>
          ) : (
            <button type="button" className="btn btn-s ad-danger" onClick={() => setDialog('suspend')}>
              <Icon name="lock" size="s" />
              تعلیق
            </button>
          )}
          <button type="button" className="btn btn-p" onClick={() => setDialog('extend')}>
            <Icon name="cal" size="s" />
            تمدید یا تغییر پلن
          </button>
        </div>
      </header>

      <div className="bd">
        {suspended && (
          <div className="ad-banner bad enter" role="status">
            <Icon name="lock" />
            <span className="col">
              <span className="b">این دفتر از {o.suspendedAt ? dateText(o.suspendedAt) : ''} معلق است.</span>
              <span className="sm">دلیل: {o.suspendReason}. همکاران اطلاعاتشان را می‌بینند ولی تا رفع تعلیق چیزی ثبت یا پرداخت نمی‌کنند.</span>
            </span>
          </div>
        )}

        <div className="facts ad-facts">
          <div>
            <small>پلن</small>
            <b>{planName(o.plan)}</b>
            <span className="xs mute">{o.trial ? 'دورهٔ آزمایشی' : 'خریداری‌شده'}</span>
          </div>
          <div>
            <small>اعتبار تا</small>
            <b>{dateText(o.expiresAt)}</b>
            <span className={`xs ${o.status === 'expired' ? 'ad-bad' : o.status === 'ending' ? 'ad-warn' : 'mute'}`}>{leftText(o.expiresAt)}</span>
          </div>
          <div>
            <small>همکاران</small>
            <b>
              {toFaDigits(members.length)} از {toFaDigits(o.seats)}
            </b>
            <span className="xs mute">{invites.length ? `${toFaDigits(invites.length)} دعوت در انتظار` : 'نفر'}</span>
          </div>
          <div>
            <small>مجموع پرداخت</small>
            <b>{formatGrouped(o.paidTotal)}</b>
            <span className="xs mute">تومان</span>
          </div>
        </div>

        <div className="ad-split">
          <section className="card ad-card" aria-labelledby="ad-notes">
            <h2 id="ad-notes" className="t3">
              یادداشت‌ها و سابقه
            </h2>
            <NoteBox officeId={id} onSaved={d.set} />
            {notes.length === 0 ? (
              <p className="sm mute" style={{ margin: 0 }}>
                هنوز یادداشتی نیست. تماس‌ها، قول‌ها و هر چیزی که پشتیبانی بعدی باید بداند را این‌جا بنویسید.
              </p>
            ) : (
              <ol className="ad-timeline stagger">
                {notes.map((n) => (
                  <li key={n.id} className={`k-${n.kind}`}>
                    <span className="ad-tl-ic" aria-hidden="true">
                      <Icon name={noteMark[n.kind].icon} size="s" />
                    </span>
                    <span className="col" style={{ minWidth: 0 }}>
                      <span className="xs mute">
                        {noteMark[n.kind].label}، {n.admin}، {ago(n.createdAt)}
                      </span>
                      <span className="sm ad-note-body">{n.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="col" style={{ gap: 18, minWidth: 0 }}>
            <section className="card ad-card" aria-labelledby="ad-team">
              <h2 id="ad-team" className="t3">
                همکاران
              </h2>
              <ul className="ad-list">
                {members.map((m) => (
                  <li key={m.id}>
                    <span className="av" aria-hidden="true">
                      {m.name.trim()[0]}
                    </span>
                    <span className="col sp" style={{ minWidth: 0 }}>
                      <span className="sm sb ad-ell">{m.name}</span>
                      <span className="xs mute ad-facts-line">
                        <Phone value={m.phone} />
                        <span>{ago(m.lastSeenAt)}</span>
                      </span>
                    </span>
                    <span className="tag">{m.role === 'manager' ? 'مدیر' : 'مشاور'}</span>
                  </li>
                ))}
                {invites.map((i) => (
                  <li key={i.phone} className="ad-invite">
                    <span className="av" aria-hidden="true">
                      <Icon name="user" size="s" />
                    </span>
                    <span className="col sp" style={{ minWidth: 0 }}>
                      <span className="sm sb ad-ell">{i.name}</span>
                      <span className="xs mute ad-facts-line">
                        <Phone value={i.phone} />
                        <span>دعوت {ago(i.createdAt)}</span>
                      </span>
                    </span>
                    <span className="tag">در انتظار</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card ad-card" aria-labelledby="ad-pays">
              <h2 id="ad-pays" className="t3">
                پرداخت‌ها
              </h2>
              {payments.length === 0 ? (
                <p className="sm mute" style={{ margin: 0 }}>
                  این دفتر هنوز پرداختی نداشته است.
                </p>
              ) : (
                <ul className="ad-list">
                  {payments.map((p) => (
                    <li key={p.id}>
                      <span className="col sp" style={{ minWidth: 0 }}>
                        <span className="sm sb">
                          پلن {planName(p.plan)}، {termOf(p.period).name}
                        </span>
                        <span className="xs mute">
                          {dateText(p.paidAt ?? p.createdAt)}
                          {p.refId && (
                            <>
                              ، کد پیگیری <span className="num">{toFaDigits(p.refId)}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                        <span className="sm b num">{toman(p.amount)}</span>
                        <span className={`tag ${payTag[p.status].tone}`} style={{ height: 24, fontSize: 12.5 }}>
                          {payTag[p.status].label}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {dialog === 'extend' && <ExtendDialog data={d.data} onClose={() => setDialog(null)} onDone={d.set} />}
      {dialog === 'suspend' && <SuspendDialog data={d.data} onClose={() => setDialog(null)} onDone={d.set} />}
    </>
  );
}

function BackLink() {
  return (
    <Link to="/" viewTransition className="ad-back sm">
      <Icon name="chr" size="s" />
      همهٔ دفترها
    </Link>
  );
}

function NoteBox({ officeId, onSaved }: { officeId: string; onSaved: (d: OfficeDetail) => void }) {
  const { call } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      onSaved(await call((a, t) => a.addNote(t, officeId, body)));
      setText('');
    } catch (err) {
      toast(errorText(err), { bad: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="ad-notebox" onSubmit={submit}>
      <textarea
        className="fld"
        rows={2}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(e);
        }}
        placeholder="یادداشت تازه، مثلاً «تماس گرفتند، راهنمایی شد»"
        aria-label="یادداشت تازه"
      />
      <button type="submit" className="btn btn-s" disabled={!text.trim() || busy}>
        <Icon name="plus" size="s" />
        ثبت یادداشت
      </button>
    </form>
  );
}

const DAY_CHOICES = [
  { days: 7, label: '۷ روز' },
  { days: 30, label: '۱ ماه' },
  { days: 90, label: '۳ ماه' },
  { days: 365, label: '۱ سال' },
];

/** تمدید دستی (مثلاً پرداخت کارت‌به‌کارت یا هدیهٔ پشتیبانی) و تغییر پلن؛ دلیلش در سابقهٔ دفتر می‌ماند. */
function ExtendDialog({ data, onClose, onDone }: { data: OfficeDetail; onClose: () => void; onDone: (d: OfficeDetail) => void }) {
  const { call } = useAuth();
  const toast = useToast();
  const o = data.office;
  const used = data.members.length + data.invites.length;
  const [plan, setPlan] = useState<PlanId>((PLANS.find((p) => p.id === o.plan)?.id ?? 'office') as PlanId);
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState('');
  const [trial, setTrial] = useState(o.trial);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const n = custom ? Number(custom) : days;
  const valid = Number.isInteger(n) && n >= 1 && n <= 1095;
  const from = Math.max(Date.parse(o.expiresAt), Date.now());
  const until = valid ? new Date(from + n * 86_400_000).toISOString() : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!valid) return setError('تعداد روز باید بین ۱ و ۱۰۹۵ باشد.');
    if (!note.trim()) return setError('دلیل تمدید را بنویسید؛ در سابقهٔ دفتر می‌ماند.');
    setBusy(true);
    setError('');
    try {
      onDone(await call((a, t) => a.extend(t, o.id, { days: n, plan, trial, note: note.trim() })));
      toast(`اعتبار «${o.name}» تا ${dateText(until!)} تمدید شد.`);
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog title="تمدید یا تغییر پلن" onClose={onClose} wide>
      <form className="ad-dlg-bd" onSubmit={submit}>
        <fieldset className="ad-fs">
          <legend className="lbl">پلن</legend>
          <div className="ad-plans">
            {PLANS.map((p) => {
              const small = p.seats < used;
              return (
                <label key={p.id} className={`ad-plan${plan === p.id ? ' on' : ''}${small ? ' off' : ''}`}>
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={plan === p.id}
                    disabled={small}
                    onChange={() => setPlan(p.id)}
                    className="visually-hidden"
                  />
                  <span className="b">{p.name}</span>
                  <span className="xs mute">تا {toFaDigits(p.seats)} نفر</span>
                  {small && <span className="xs ad-warn">دفتر {toFaDigits(used)} نفر دارد</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="ad-fs">
          <legend className="lbl">چند روز اضافه شود؟</legend>
          <div className="rw" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="seg" role="group" aria-label="مدت">
              {DAY_CHOICES.map((c) => (
                <button
                  key={c.days}
                  type="button"
                  aria-pressed={!custom && days === c.days}
                  onClick={() => {
                    setDays(c.days);
                    setCustom('');
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="ad-days">
              <input
                className="fld num"
                inputMode="numeric"
                placeholder="روز دلخواه"
                aria-label="تعداد روز دلخواه"
                value={custom}
                onChange={(e) =>
                  setCustom(
                    e.target.value
                      .replace(/[۰-۹]/g, (x) => String(x.charCodeAt(0) - 0x06f0))
                      .replace(/\D/g, '')
                      .slice(0, 4),
                  )
                }
              />
            </label>
          </div>
        </fieldset>

        <div className="chk ad-chk">
          <span className="col sp">
            <span className="sm sb">هنوز دورهٔ آزمایشی است</span>
            <span className="xs mute">خاموش یعنی دفتر این مدت را خریده است (مثلاً کارت به کارت).</span>
          </span>
          <Switch checked={trial} onChange={setTrial} label="هنوز دورهٔ آزمایشی است" />
        </div>

        <label className="lbl">
          دلیل
          <textarea
            className="fld"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثلاً «کارت به کارت ۱۲ مهر، رسید ۴۵۲۱» یا «جبران قطعی سرور»"
            data-autofocus
          />
        </label>

        <div className="ad-sum">
          <span className="sm mute">اعتبار تازه</span>
          <span className="b">{until ? `تا ${dateText(until)}` : 'تعداد روز را درست وارد کنید'}</span>
          <span className="xs mute">
            پلن {planName(plan)}، {o.status === 'expired' ? 'از امروز' : 'بعد از پایان اعتبار فعلی'}
          </span>
        </div>

        {error && (
          <p className="ad-note bad" role="alert">
            <Icon name="warn" size="s" />
            {error}
          </p>
        )}
        <div className="ad-dlg-ft">
          <button type="button" className="btn btn-g" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="btn btn-p" disabled={busy}>
            {busy ? 'لحظه‌ای صبر کنید…' : 'تمدید'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SuspendDialog({ data, onClose, onDone }: { data: OfficeDetail; onClose: () => void; onDone: (d: OfficeDetail) => void }) {
  const { call } = useAuth();
  const toast = useToast();
  const o = data.office;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!reason.trim()) return setError('دلیل تعلیق را بنویسید؛ در سابقهٔ دفتر می‌ماند.');
    setBusy(true);
    try {
      onDone(await call((a, t) => a.suspend(t, o.id, reason.trim())));
      toast(`«${o.name}» معلق شد.`);
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <Dialog title={`تعلیق «${o.name}»`} onClose={onClose}>
      <form className="ad-dlg-bd" onSubmit={submit}>
        <p className="sm" style={{ margin: 0, lineHeight: 1.9 }}>
          همکاران این دفتر اطلاعاتشان را می‌بینند ولی تا رفع تعلیق نمی‌توانند چیزی ثبت یا ویرایش کنند و پرداختی هم انجام نمی‌شود. روی دستگاه‌هایشان حداکثر تا ۱۵
          دقیقهٔ دیگر اعمال می‌شود. هر وقت خواستید از همین صفحه برش می‌دارید.
        </p>
        <label className="lbl">
          دلیل
          <textarea
            className="fld"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً «پرداخت برگشت خورد» یا «درخواست خود مدیر دفتر»"
            data-autofocus
          />
        </label>
        {error && (
          <p className="ad-note bad" role="alert">
            <Icon name="warn" size="s" />
            {error}
          </p>
        )}
        <div className="ad-dlg-ft">
          <button type="button" className="btn btn-g" onClick={onClose}>
            انصراف
          </button>
          <button type="submit" className="btn ad-btn-bad" disabled={busy}>
            {busy ? 'لحظه‌ای صبر کنید…' : 'معلق شود'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
