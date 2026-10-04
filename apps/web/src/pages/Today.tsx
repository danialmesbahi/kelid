import { Link } from 'react-router';
import { CheckBox, Cover, Icon, Plaque, type IconName } from '@kelid/ui';
import { dealLabel, formatLongDate, formatTime, headlinePrice, listingTitle, secondaryPrice, tehranToday, toFaDigits, type Listing, type Visit } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';

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
  const now = new Date();
  const dayStart = new Date(`${tehranToday()}T00:00:00+03:30`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();

  const data = useQuery(`today:${dayStart}`, async (s) => {
    const [visits, todos, listings, clients] = await Promise.all([s.listVisits(dayStart, dayEnd), s.listTodos(), s.listListings(), s.listClients()]);
    return { visits, todos, listings, clients };
  });

  if (!data) return <PageSkeleton aside />;
  const { visits, todos, listings, clients } = data;
  const byId = new Map(listings.map((l) => [l.id, l] as const));
  const nextVisit = visits.find((v) => !v.done && v.endsAt > now.toISOString());
  const left = todos.filter((t) => !t.done).length;
  const visitCount = visits.filter((v) => v.kind === 'visit').length;
  const recent = listings.slice(0, 4);

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
              <Link viewTransition className="lnk sm" to="/calendar" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>تقویم کامل</Link>
            </div>
            {visits.length === 0 && <p className="mute">برای امروز قراری ثبت نشده.</p>}
            {visits.map((v) => (
              <AgendaRow key={v.id} v={v} listing={v.listingId ? byId.get(v.listingId) : undefined} isNext={v.id === nextVisit?.id} showNow={v.id === nextVisit?.id} />
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
                <button type="button" className="btn btn-s" style={{ height: 36, padding: '0 12px', fontSize: 14 }}>
                  <Icon name={ACTION_ICON[t.action].icon} size="s" />
                  {ACTION_ICON[t.action].label}
                </button>
              </div>
            ))}
          </section>
        </div>

        <section aria-labelledby="nf" className="col" style={{ gap: 12 }}>
          <div className="rw" style={{ gap: 12 }}>
            <h2 id="nf" className="t2">تازه‌ترین فایل‌ها</h2>
            <span className="sp" style={{ height: 1, background: 'var(--line)' }} />
            <Link viewTransition className="lnk sm" to="/files" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>همهٔ فایل‌ها</Link>
          </div>
          <div className="hgrid stagger">
            {recent.map((l) => (
              <Link key={l.id} viewTransition className="hcard lift" to={`/files/${l.id}`}>
                <Cover variant={l.cover} style={{ viewTransitionName: `cover-${l.id}` }} />
                <span className="hcard-top">
                  <Plaque value={l.plaque} deal={l.deal} />
                  <span className="hcard-deal">{dealLabel[l.deal]}</span>
                </span>
                <span className="hcard-ov">
                  <span className="hcard-t">{listingTitle(l)}</span>
                  <span className="hcard-loc"><Icon name="pin" size="s" />{l.neighborhood}{l.street ? `، ${l.street}` : ''}</span>
                  <span className="hcard-facts">
                    <span><b className="num">{toFaDigits(l.area)}</b> متر</span>
                    <span><b className="num">{toFaDigits(l.bedrooms)}</b> خواب</span>
                  </span>
                  <span className="hcard-pr">
                    <span className="col">
                      <b className="num">{headlinePrice(l)}</b>
                      <small className="num">{secondaryPrice(l)}</small>
                    </span>
                    <span className="hcard-go" aria-hidden="true"><Icon name="chl" size="s" /></span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
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

function AgendaRow({ v, listing, isNext, showNow }: { v: Visit; listing?: Listing; isNext: boolean; showNow: boolean }) {
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
        <span className="col" style={{ flex: 1, minWidth: 0 }}>
          <span className="sb">{v.title}</span>
          <span className="xs mute rw" style={{ gap: 8, flexWrap: 'wrap' }}>
            {listing && <Plaque value={listing.plaque} deal={listing.deal} size="s" />}
            {listing ? `${listing.neighborhood}، ${listing.street}` : v.done ? 'انجام شد' : ''}
          </span>
        </span>
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
