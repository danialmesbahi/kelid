import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CheckBox, Cover, Icon, Plaque, type IconName } from '@kelid/ui';
import { formatLongDate, formatTime, headlinePrice, listingTitle, tehranToday, toFaDigits, type Listing, type Visit } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { coverUrl, useCoverThumbs } from '../photos/photos';
import { VisitDialog } from '../visits/VisitDialog';

const ACTION_ICON: Record<'sms' | 'call' | 'camera', { icon: IconName; label: string }> = {
  sms: { icon: 'msg', label: 'پیامک' },
  call: { icon: 'phone', label: 'تماس' },
  camera: { icon: 'cam', label: 'دوربین' },
};

function greeting(d: Date): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(d));
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  return 'عصر بخیر';
}

export function TodayPage() {
  const store = useStore();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ visit?: Visit } | null>(null);
  const [newTodo, setNewTodo] = useState('');
  const now = new Date();
  const dayStart = new Date(`${tehranToday()}T00:00:00+03:30`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();

  const data = useQuery(`today:${dayStart}`, async (s) => {
    const [visits, todos, listings, clients] = await Promise.all([s.listVisits(dayStart, dayEnd), s.listTodos(), s.listListings(), s.listClients()]);
    return { visits, todos, listings, clients };
  });
  const thumbs = useCoverThumbs();

  if (!data) return <PageSkeleton aside />;
  const { visits, todos, listings, clients } = data;
  const byId = new Map(listings.map((l) => [l.id, l] as const));
  const nextVisit = visits.find((v) => !v.done && v.endsAt > now.toISOString());
  const left = todos.filter((t) => !t.done).length;
  const visitCount = visits.filter((v) => v.kind === 'visit').length;
  const recent = listings.slice(0, 4);

  const addTodo = async (e: FormEvent) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title) return;
    await store.addTodo({ title });
    setNewTodo('');
  };

  return (
    <>
      <div className="hd enter">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">{formatLongDate(now)}</span>
          <h1 className="t1">{greeting(now)}</h1>
          <span className="mute">
            امروز <b style={{ color: 'var(--ink)' }}>{toFaDigits(visitCount)} بازدید</b> و <b style={{ color: 'var(--ink)' }}>{toFaDigits(left)} کار مانده</b> دارید.
          </span>
        </div>
        <span className="sp" />
        <div className="rw" style={{ border: '1px solid var(--line)', borderRadius: 14 }}>
          <Stat label="فایل فعال" value={toFaDigits(listings.length)} border />
          <Stat label="مشتری در جستجو" value={toFaDigits(clients.length)} />
        </div>
      </div>

      <div className="bd enter">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <section aria-labelledby="ag" className="card" style={{ flex: '3 1 480px', minWidth: 0, padding: '20px 22px' }}>
            <div className="rw" style={{ gap: 10, marginBottom: 8 }}>
              <h2 id="ag" className="t2">برنامهٔ امروز</h2>
              <span className="sp" />
              <button type="button" className="btn btn-s" onClick={() => setDialog({})} style={{ height: 38, padding: '0 12px' }}>
                <Icon name="plus" size="s" />
                بازدید جدید
              </button>
              <Link viewTransition className="lnk sm" to="/calendar" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>تقویم کامل</Link>
            </div>
            {visits.length === 0 && <p className="mute">برای امروز قراری ثبت نشده.</p>}
            {visits.map((v) => (
              <AgendaRow key={v.id} v={v} listing={v.listingId ? byId.get(v.listingId) : undefined} isNext={v.id === nextVisit?.id} showNow={v.id === nextVisit?.id} onEdit={() => setDialog({ visit: v })} />
            ))}
          </section>

          <section aria-labelledby="td" className="card col" style={{ flex: '2 1 340px', minWidth: 0, padding: '20px 22px', gap: 6 }}>
            <div className="rw" style={{ gap: 10, marginBottom: 6 }}>
              <h2 id="td" className="t2">کارهای امروز</h2>
              <span className="sp" />
              <span className="xs mute num">{toFaDigits(todos.length - left)} از {toFaDigits(todos.length)} انجام شد</span>
            </div>
            {todos.map((t) => (
              <div key={t.id} className="row hov" style={{ alignItems: 'flex-start', padding: '10px 6px', borderTop: '1px solid var(--line)', borderRadius: 0 }}>
                <span style={{ marginTop: 2 }}>
                  <CheckBox checked={t.done} label={`انجام شد: ${t.title}`} onChange={(v) => { void store.setTodoDone(t.id, v); if (v) toast('آفرین؛ یک کار کمتر', { label: 'برگرداندن', run: () => void store.setTodoDone(t.id, false) }); }} />
                </span>
                <span className="col" style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.55 : 1, transition: 'opacity .25s ease' }}>
                  <span className="sb" style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                  <span className="xs mute">{t.detail}</span>
                </span>
                {t.action && (
                  <button type="button" className="btn btn-s" style={{ height: 36, padding: '0 12px', fontSize: 14 }}>
                    <Icon name={ACTION_ICON[t.action].icon} size="s" />
                    {ACTION_ICON[t.action].label}
                  </button>
                )}
                <button
                  type="button"
                  className="ib ghost"
                  aria-label={`حذف کار: ${t.title}`}
                  style={{ width: 36, height: 36 }}
                  onClick={async () => {
                    await store.deleteTodo(t.id);
                    toast('کار حذف شد', { label: 'برگرداندن', run: () => void store.restoreTodo(t.id) });
                  }}
                >
                  <Icon name="x" size="s" />
                </button>
              </div>
            ))}
            <form onSubmit={addTodo} className="rw" style={{ gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <input className="fld" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} placeholder="کار تازه… (Enter)" aria-label="کار تازه" style={{ height: 44, flex: 1 }} />
              <button type="submit" className="ib" aria-label="افزودن کار" disabled={!newTodo.trim()}><Icon name="plus" size="s" /></button>
            </form>
          </section>
        </div>

        <section aria-labelledby="nf" className="col" style={{ gap: 12 }}>
          <div className="rw" style={{ gap: 12 }}>
            <h2 id="nf" className="t2">تازه‌ترین فایل‌ها</h2>
            <span className="sp" style={{ height: 1, background: 'var(--line)' }} />
            <Link viewTransition className="lnk sm" to="/files" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>همهٔ فایل‌ها</Link>
          </div>
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 18 }}>
            {recent.map((l) => (
              <Link key={l.id} viewTransition className="lift col" to={`/files/${l.id}`} style={{ gap: 10, borderRadius: 16 }}>
                <span style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', display: 'block', viewTransitionName: `cover-${l.id}` }}>
                <Cover variant={l.cover} src={coverUrl(thumbs, l.id)} style={{ height: 150 }} />
                  <Plaque value={l.plaque} deal={l.deal} className="tagon" />
                </span>
                <span className="col" style={{ padding: '0 2px', lineHeight: 1.55 }}>
                  <span className="sb">{listingTitle(l)}</span>
                  <span className="xs mute">{l.neighborhood}</span>
                  <span className="num b" style={{ marginTop: 4 }}>{headlinePrice(l)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      {dialog && <VisitDialog visit={dialog.visit} onClose={() => setDialog(null)} />}
    </>
  );
}

function Stat({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <span className="col" style={{ padding: '10px 20px', borderLeft: border ? '1px solid var(--line)' : undefined }}>
      <span className="xs mute">{label}</span>
      <span className="num" style={{ fontSize: 22, fontWeight: 300 }}>{value}</span>
    </span>
  );
}

function AgendaRow({ v, listing, isNext, showNow, onEdit }: { v: Visit; listing?: Listing; isNext: boolean; showNow: boolean; onEdit: () => void }) {
  return (
    <div>
      {showNow && (
        <div className="rw" style={{ gap: 12, padding: '2px 0 6px' }}>
          <span className="num xs b" style={{ width: 52, color: 'var(--brass-text)' }}>اکنون</span>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brass)' }} />
          <span className="sp" style={{ height: 1, background: 'var(--brass)' }} />
        </div>
      )}
      <div className={`row ${isNext ? 'sel' : ''}`} style={{ padding: '12px 8px', opacity: v.done ? 0.5 : 1 }}>
        <span className="num sb" style={{ width: 52 }}>{formatTime(v.startsAt)}</span>
        <button type="button" onClick={onEdit} aria-label={`ویرایش قرار: ${v.title}`} className="col" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, textAlign: 'right' }}>
          <span className="sb">{v.title}</span>
          <span className="xs mute rw" style={{ gap: 8, flexWrap: 'wrap' }}>
            {listing && <Plaque value={listing.plaque} deal={listing.deal} size="s" />}
            {listing ? `${listing.neighborhood}، ${listing.street}` : v.done ? 'انجام شد' : ''}
          </span>
        </button>
        {isNext && (
          <Link viewTransition className="btn btn-p" to={listing ? `/show?f=${listing.id}` : '/show'} style={{ height: 40, padding: '0 14px' }}>
            <Icon name="show" size="s" />
            آماده‌سازی نمایش
          </Link>
        )}
        <button type="button" className="ib" aria-label="تماس" style={{ width: 40, height: 40 }}>
          <Icon name="phone" size="s" />
        </button>
      </div>
    </div>
  );
}
