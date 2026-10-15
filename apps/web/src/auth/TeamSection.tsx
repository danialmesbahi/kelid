import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon, Segmented, Skeleton, Switch } from '@kelid/ui';
import { Link } from 'react-router';
import { PLANS, toFaDigits } from '@kelid/core';
import { useSlow } from '../data';
import { useToast } from '../layout/Toasts';
import { useSyncStatus } from '../sync/state';
import { ApiError, type Invite, type Member, type NewInvite, type Role, type Team } from './api';
import { seen } from './AccountSection';
import { useAuth, useMember } from './AuthContext';
import { formatPhone, phoneDigits } from './phone';
import './team.css';

const roleName: Record<Role, string> = { manager: 'مدیر', agent: 'مشاور' };
const roleHint: Record<Role, string> = {
  manager: 'مدیر همکاران را دعوت و مدیریت می‌کند، نام دفتر را عوض می‌کند و شمارهٔ همهٔ مالک‌ها را می‌بیند.',
  agent: 'مشاور فایل‌ها، مشتری‌ها، قرارها و معامله‌های دفتر را می‌بیند و ثبت می‌کند.',
};
const phonesHint = 'بدون این اجازه، شمارهٔ مالک‌ها اصلاً به دستگاه‌های این همکار فرستاده نمی‌شود.';

function failText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : '';
  switch (code) {
    case 'offline':
      return 'برای این کار اینترنت لازم است.';
    case 'bad_phone':
      return 'شمارهٔ موبایل درست نیست؛ مثل ۰۹۱۲ ۳۴۵ ۶۷۸۹ بنویسید.';
    case 'bad_name':
      return 'نام همکار را بنویسید.';
    case 'member':
      return 'این شماره همین حالا عضو دفتر است.';
    case 'no_seat':
      return 'همهٔ جاهای دفتر پر است. یک دعوت باز را لغو کنید یا همکاری را بردارید.';
    case 'last_manager':
      return 'دفتر دست‌کم یک مدیر لازم دارد؛ اول همکار دیگری را مدیر کنید.';
    case 'forbidden':
      return 'این کار فقط از دست مدیر دفتر برمی‌آید.';
    case 'too_many':
      return 'دعوت‌های زیادی پشت هم ثبت شد؛ کمی بعد دوباره امتحان کنید.';
    case 'not_alone':
      return 'در دفتر فعلی‌تان همکار دارید؛ اول مدیر همان دفتر باید شما را از دفتر بردارد.';
    default:
      return 'انجام نشد؛ دوباره امتحان کنید.';
  }
}

/** متنی که مدیر برای همکار تازه می‌فرستد؛ دعوت خودش پیامک نمی‌فرستد. */
function inviteText(i: { name: string; phone: string }, office: string): string {
  const site = typeof window !== 'undefined' && !window.kelid && /^https:/.test(location.origin) ? `\n${location.origin}` : '';
  return `سلام ${i.name}، شما را به دفتر «${office}» در کلید دعوت کرده‌ام. کلید را باز کنید، «ورود با کد پیامکی» را بزنید و با شمارهٔ ${formatPhone(i.phone)} وارد شوید.${site}`;
}

/** همکاران دفتر در تنظیمات: مدیر دعوت می‌کند، نقش و اجازه‌ها را عوض می‌کند و کسی را برمی‌دارد؛ مشاور فقط فهرست را می‌بیند. */
export function TeamSection() {
  const { session, api, withToken } = useAuth();
  const { manager, ownerPhones } = useMember();
  const toast = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [failed, setFailed] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sent, setSent] = useState<NewInvite | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const slow = useSlow(!team && !failed);

  const load = useCallback(() => {
    if (!api) return;
    setFailed(false);
    withToken((t) => api.team(t)).then(setTeam, () => setFailed(true));
  }, [api, withToken]);
  useEffect(load, [load]);

  if (!session || !api) return null;
  const office = session.office.name;
  const used = team ? team.members.length + team.invites.length : 0;
  const full = !!team && used >= team.seats;

  const share = async (i: { name: string; phone: string }) => {
    const text = inviteText(i, office);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) return void (await navigator.share({ text }));
      await navigator.clipboard.writeText(text);
      toast('متن دعوت کپی شد؛ در پیام‌رسان برای همکارتان بفرستید');
    } catch (e) {
      // بستن پنجرهٔ اشتراک خطا نیست.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast('کپی نشد؛ متن را از کادر دعوت بردارید');
    }
  };

  const act = async (fn: (t: string) => Promise<void>, next: (t: Team) => Team, done?: string): Promise<boolean> => {
    if (!team) return false;
    const before = team;
    // تغییر همان لحظه دیده می‌شود؛ اگر سرور نپذیرفت برمی‌گردد.
    setTeam(next(team));
    try {
      await withToken(fn);
      if (done) toast(done);
      return true;
    } catch (e) {
      setTeam(before);
      toast(failText(e));
      return false;
    }
  };

  const setMember = (m: Member, p: { role?: Role; seeOwnerPhones?: boolean }) => {
    const role = p.role ?? m.role;
    const see = role === 'manager' || (p.seeOwnerPhones ?? m.seeOwnerPhones);
    void act(
      (t) => api.updateMember(t, m.id, p),
      (t) => ({ ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, role, seeOwnerPhones: see } : x)) }),
      p.role ? `${m.name} حالا ${roleName[p.role]} است` : undefined,
    );
  };

  const remove = (m: Member) => {
    setOpen(null);
    void act((t) => api.removeMember(t, m.id), (t) => ({ ...t, members: t.members.filter((x) => x.id !== m.id) }), `${m.name} از دفتر برداشته شد`);
  };

  const cancel = async (i: Invite) => {
    if (!(await act((t) => api.cancelInvite(t, i.phone), (t) => ({ ...t, invites: t.invites.filter((x) => x.phone !== i.phone) })))) return;
    // لغو دعوت برگشت‌پذیر است: همان دعوت دوباره ثبت می‌شود.
    toast(`دعوت ${i.name} لغو شد`, {
      label: 'برگرداندن',
      run: () => void withToken((t) => api.invite(t, { phone: i.phone, name: i.name, role: i.role, seeOwnerPhones: i.seeOwnerPhones })).then(load, (e) => toast(failText(e))),
    });
  };

  return (
    <section aria-labelledby="team" className="card col tm" style={{ padding: 24, gap: 18 }}>
      <InviteBanner />
      <div className="tm-head">
        <span className="ib tm-ic" aria-hidden="true"><Icon name="users" size="l" /></span>
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <h2 id="team" className="t2">همکاران دفتر</h2>
          <span className="mute sm">
            {team ? `${toFaDigits(used)} از ${toFaDigits(team.seats)} جای دفتر پر است` : 'همه با یک حساب دفتر، هر کس با شمارهٔ خودش'}
          </span>
        </div>
        {manager && !inviting && (
          <button type="button" className="btn btn-p" onClick={() => (setInviting(true), setSent(null))} disabled={!team || full} title={full ? 'همهٔ جاهای دفتر پر است' : undefined}>
            <Icon name="plus" size="s" />
            دعوت همکار
          </button>
        )}
      </div>
      {team && (
        <span className="tm-meter" role="meter" aria-label="جاهای پر دفتر" aria-valuemin={0} aria-valuemax={team.seats} aria-valuenow={used}>
          <span style={{ width: `${Math.min(100, (used / team.seats) * 100)}%` }} className={full ? 'full' : ''} />
        </span>
      )}
      {manager && full && team && PLANS.some((p) => (p.extra?.max ?? p.seats) > team.seats) && (
        <span className="sm mute">
          همهٔ جاهای دفتر پر است. برای همکار بیشتر،{' '}
          <Link className="b" style={{ color: 'var(--pri-text)' }} to="/plans" viewTransition>پلن بزرگ‌تر</Link> بگیرید.
        </span>
      )}

      {inviting && team && (
        <InviteForm
          onCancel={() => setInviting(false)}
          onDone={(i) => {
            setInviting(false);
            setSent(i);
            load();
          }}
        />
      )}
      {sent && (
        <div className="soft tm-sent enter" role="status">
          <Icon name="check" />
          <span className="col" style={{ minWidth: 0, lineHeight: 1.8 }}>
            <span className="sb">{sent.name} دعوت شد</span>
            <span className="xs mute">
              به {sent.name} بگویید کلید را باز کند، «ورود با کد پیامکی» را بزند و با شمارهٔ <span className="tm-num" dir="ltr">{formatPhone(sent.phone)}</span> وارد شود؛ همان‌جا به «{office}» می‌پیوندد.
            </span>
          </span>
          <span className="acc-ask">
            <button type="button" className="btn btn-g" onClick={() => setSent(null)}>بستن</button>
            <button type="button" className="btn btn-s" onClick={() => void share(sent)}><Icon name="msg" size="s" />متن دعوت</button>
          </span>
        </div>
      )}

      {failed ? (
        <span className="rw xs mute" style={{ gap: 8 }}>
          برای دیدن همکاران اینترنت لازم است.
          <button type="button" className="lnk xs" style={{ border: 0, background: 'none', padding: 0 }} onClick={load}>دوباره</button>
        </span>
      ) : !team ? (
        slow && <><Skeleton h={62} r={14} /><Skeleton h={62} r={14} /></>
      ) : (
        <ul className="acc-list" aria-label="اعضای دفتر">
          {team.members.map((m) => {
            const self = m.id === session.user.id;
            const editable = manager && !self;
            return (
              <li key={m.id} className="soft tm-row">
                <div className="tm-line">
                  <span className={`av${m.role === 'manager' ? ' on' : ''}`} aria-hidden="true">{m.name.charAt(0) || <Icon name="user" size="s" />}</span>
                  <span className="col tm-who">
                    <span className="sb">
                      {m.name}
                      {self && <span className="tag" style={{ marginInlineStart: 8 }}>شما</span>}
                    </span>
                    <span className="xs mute tm-sub">
                      <span className="tm-num" dir="ltr">{formatPhone(m.phone)}</span>
                      <span>{m.lastSeenAt ? `آخرین استفاده: ${seen(m.lastSeenAt)}` : 'هنوز وارد نشده'}</span>
                    </span>
                  </span>
                  <span className="tm-tags">
                    <span className={m.role === 'manager' ? 'tag ok' : 'tag'}>{roleName[m.role]}</span>
                    {!m.seeOwnerPhones && <span className="tag" title="شمارهٔ مالک‌ها را نمی‌بیند"><Icon name="lock" size="s" />بی‌شمارهٔ مالک</span>}
                  </span>
                  {editable && (
                    <button type="button" className="btn btn-s tm-edit-btn" aria-expanded={open === m.id} aria-label={`${open === m.id ? 'بستن' : 'تغییر'} نقش و دسترسی ${m.name}`} onClick={() => setOpen(open === m.id ? null : m.id)}>
                      <Icon name={open === m.id ? 'x' : 'edit'} size="s" />
                      {open === m.id ? 'بستن' : 'تغییر'}
                    </button>
                  )}
                </div>
                {editable && open === m.id && <MemberEditor m={m} onChange={(p) => setMember(m, p)} onRemove={() => remove(m)} />}
              </li>
            );
          })}
        </ul>
      )}

      {team && team.invites.length > 0 && (
        <div className="col" style={{ gap: 10 }}>
          <span className="sb">منتظر پیوستن</span>
          <ul className="acc-list" aria-label="دعوت‌های باز">
            {team.invites.map((i) => (
              <li key={i.phone} className="tm-row tm-inv">
                <div className="tm-line">
                  <span className="av tm-wait" aria-hidden="true"><Icon name="user" size="s" /></span>
                  <span className="col tm-who">
                    <span className="sb">{i.name}</span>
                    <span className="xs mute tm-sub">
                      <span className="tm-num" dir="ltr">{formatPhone(i.phone)}</span>
                      <span>{i.invitedBy ? `${i.invitedBy} دعوت کرد، ` : 'دعوت شده، '}{seen(i.createdAt)}</span>
                    </span>
                  </span>
                  <span className="tm-tags"><span className="tag">{roleName[i.role]}</span></span>
                  {manager && (
                    <span className="tm-inv-act">
                      <button type="button" className="btn btn-s" onClick={() => void share(i)}><Icon name="msg" size="s" />متن دعوت</button>
                      <button type="button" className="ib ghost" aria-label={`لغو دعوت ${i.name}`} onClick={() => void cancel(i)}><Icon name="x" /></button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!manager && (
        <p className="xs mute tm-note">
          <Icon name={ownerPhones ? 'phone' : 'lock'} size="s" />
          {ownerPhones
            ? 'شمارهٔ مالک‌ها برای شما نمایش داده می‌شود. دعوت و مدیریت همکاران با مدیر دفتر است.'
            : 'شمارهٔ مالک‌ها فقط برای مدیر دفتر و همکارانی که اجازه دارند نمایش داده می‌شود. دعوت و مدیریت همکاران با مدیر دفتر است.'}
        </p>
      )}
    </section>
  );
}

function MemberEditor({ m, onChange, onRemove }: { m: Member; onChange: (p: { role?: Role; seeOwnerPhones?: boolean }) => void; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="tm-editor enter">
      <div className="tm-field">
        <span className="sb tm-label">نقش</span>
        <Segmented<Role> label={`نقش ${m.name}`} value={m.role} onChange={(role) => role !== m.role && onChange({ role })} options={[{ value: 'agent', label: 'مشاور' }, { value: 'manager', label: 'مدیر' }]} />
        <span className="xs mute tm-hint">{roleHint[m.role]}</span>
      </div>
      {m.role === 'agent' && (
        <div className="tm-field">
          <span className="sb tm-label">شمارهٔ مالک‌ها</span>
          <span className="rw" style={{ gap: 10 }}>
            <Switch checked={m.seeOwnerPhones} onChange={(v) => onChange({ seeOwnerPhones: v })} label={`${m.name} شمارهٔ مالک‌ها را ببیند`} />
            <span className="sm">{m.seeOwnerPhones ? 'می‌بیند' : 'نمی‌بیند'}</span>
          </span>
          <span className="xs mute tm-hint">{phonesHint}</span>
        </div>
      )}
      <div className="tm-remove">
        {asking ? (
          <span className="acc-ask">
            <span className="xs mute">{m.name} از دفتر برداشته شود؟ همهٔ دستگاه‌هایش همان لحظه از حساب دفتر خارج می‌شوند؛ فایل‌ها و مشتری‌هایی که ثبت کرده در دفتر می‌مانند.</span>
            <button type="button" className="btn btn-g" onClick={() => setAsking(false)}>انصراف</button>
            <button type="button" className="btn btn-d" onClick={onRemove}>بله، برداشته شود</button>
          </span>
        ) : (
          <button type="button" className="lnk tm-danger" onClick={() => setAsking(true)}><Icon name="out" size="s" />برداشتن از دفتر</button>
        )}
      </div>
    </div>
  );
}

function InviteForm({ onCancel, onDone }: { onCancel: () => void; onDone: (i: NewInvite) => void }) {
  const { api, withToken } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('agent');
  const [phones, setPhones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!api) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return setError(failText(new ApiError('bad_name')));
    if (!/^09\d{9}$/.test(phone)) return setError(failText(new ApiError('bad_phone')));
    setBusy(true);
    setError('');
    const i: NewInvite = { name: name.trim(), phone, role, seeOwnerPhones: role === 'manager' || phones };
    try {
      await withToken((t) => api.invite(t, i));
      onDone(i);
    } catch (err) {
      setError(failText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="soft tm-form enter" onSubmit={submit} noValidate aria-label="دعوت همکار">
      <div className="tm-grid">
        <label className="lbl">نام همکار<input className="fld" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="مثلاً سارا نوری" autoComplete="off" autoFocus /></label>
        <label className="lbl">
          شمارهٔ موبایل
          <input
            className="fld tm-num"
            type="tel"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
            value={formatPhone(phone)}
            onChange={(e) => {
              setPhone(phoneDigits(e.target.value));
              if (error) setError('');
            }}
          />
        </label>
      </div>
      <div className="tm-field">
        <span className="sb tm-label">نقش</span>
        <Segmented<Role> label="نقش همکار" value={role} onChange={setRole} options={[{ value: 'agent', label: 'مشاور' }, { value: 'manager', label: 'مدیر' }]} />
        <span className="xs mute tm-hint">{roleHint[role]}</span>
      </div>
      {role === 'agent' && (
        <div className="tm-field">
          <span className="sb tm-label">شمارهٔ مالک‌ها</span>
          <span className="rw" style={{ gap: 10 }}>
            <Switch checked={phones} onChange={setPhones} label="شمارهٔ مالک‌ها را ببیند" />
            <span className="sm">{phones ? 'می‌بیند' : 'نمی‌بیند'}</span>
          </span>
          <span className="xs mute tm-hint">{phonesHint} بعداً هم می‌شود عوضش کرد.</span>
        </div>
      )}
      {error && <p className="acc-err xs" role="alert"><Icon name="warn" size="s" />{error}</p>}
      <span className="acc-ask">
        <button type="button" className="btn btn-g" onClick={onCancel} disabled={busy}>انصراف</button>
        <button type="submit" className="btn btn-p" disabled={busy} aria-busy={busy}>{busy ? 'لحظه‌ای صبر کنید…' : 'ثبت دعوت'}</button>
      </span>
    </form>
  );
}

/** دفتر دیگری شما را دعوت کرده (شما دفتر خودتان را دارید). */
function InviteBanner() {
  const { session, acceptInvite, dropInvite, api, withToken } = useAuth();
  const toast = useToast();
  const pending = useSyncStatus()?.pending ?? 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invite = session?.invite;
  if (!invite || !api) return null;

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await acceptInvite();
      // ادامه با بررسی دفتر در App: اطلاعات دفتر قبلی از این دستگاه پاک و دفتر تازه گرفته می‌شود.
      toast(`به «${invite.officeName}» پیوستید`);
    } catch (e) {
      setError(failText(e));
      setBusy(false);
    }
  };

  const decline = async () => {
    try {
      await withToken((t) => api.declineInvite(t));
      await dropInvite();
      toast('دعوت رد شد');
    } catch (e) {
      toast(failText(e));
    }
  };

  return (
    <div className="tm-invite enter" role="region" aria-label="دعوت به دفتر دیگر">
      <Icon name="users" />
      <span className="col" style={{ minWidth: 0, lineHeight: 1.8 }}>
        <span className="sb">«{invite.officeName}» شما را دعوت کرده است</span>
        <span className="xs">
          {invite.invitedBy} شما را به‌عنوان {roleName[invite.role]} دعوت کرده. با پیوستن، این دستگاه اطلاعات «{invite.officeName}» را می‌گیرد و
          اطلاعات «{session?.office.name}» از روی آن پاک می‌شود (روی سرور، در همان حساب، می‌ماند).
        </span>
        {pending > 0 && <span className="xs tm-warn">{toFaDigits(pending)} تغییر هنوز به سرور نرسیده؛ اول «همگام‌سازی» را بزنید.</span>}
        {error && <span className="xs tm-warn" role="alert">{error}</span>}
      </span>
      <span className="acc-ask">
        <button type="button" className="btn btn-g" onClick={() => void decline()} disabled={busy}>رد دعوت</button>
        <button type="button" className="btn btn-p" onClick={() => void join()} disabled={busy} aria-busy={busy}>{busy ? 'لحظه‌ای صبر کنید…' : 'پیوستن'}</button>
      </span>
    </div>
  );
}
