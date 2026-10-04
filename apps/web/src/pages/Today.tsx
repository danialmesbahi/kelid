import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CheckBox, Cover, Icon, Plaque, type IconName } from '@kelid/ui';
import { dealLabel, floorLabel, formatLongDate, formatTime, headlinePrice, listingTitle, secondaryPrice, tehranToday, toFaDigits, type Listing, type Visit, type VisitKind } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';

const ACTION_ICON: Record<'sms' | 'call' | 'camera', { icon: IconName; label: string }> = {
  sms: { icon: 'msg', label: 'پیامک' },
  call: { icon: 'phone', label: 'تماس' },
  camera: { icon: 'cam', label: 'دوربین' },
};

const KIND_ICON: Record<VisitKind, IconName> = { visit: 'key', call: 'phone', signing: 'doc', task: 'check' };

function greeting(d: Date): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(d));
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  return 'عصر بخیر';
}

// «۴۰ دقیقه دیگر» یا «۱ ساعت و ۱۰ دقیقه دیگر»؛ برای قراری که شروع شده «در حال انجام».
function untilLabel(v: Visit, now: Date): string {
  const min = Math.ceil((Date.parse(v.startsAt) - now.getTime()) / 60_000);
  if (min <= 0) return 'در حال انجام';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${toFaDigits(m)} دقیقه دیگر`;
  return m ? `${toFaDigits(h)} ساعت و ${toFaDigits(m)} دقیقه دیگر` : `${toFaDigits(h)} ساعت دیگر`;
}

// صفحه باز می‌ماند؛ هر دقیقه زمان را تازه می‌کنیم تا «قرار بعدی» و خط «اکنون» درست بمانند.
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TodayPage() {
  const store = useStore();
  const toast = useToast();
  const now = useMinute();
  const dayStart = new Date(`${tehranToday()}T00:00:00+03:30`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();

  const data = useQuery(`today:${dayStart}`, async (s) => {
    const [visits, todos, listings, clients] = await Promise.all([s.listVisits(dayStart, dayEnd), s.listTodos(), s.listListings(), s.listClients()]);
    return { visits, todos, listings, clients };
  });

  if (!data) return <PageSkeleton aside />;
  const { visits, todos, listings, clients } = data;
  const byId = new Map(listings.map((l) => [l.id, l] as const));
  const iso = now.toISOString();
  const nextVisit = visits.find((v) => !v.done && v.endsAt > iso);
  const nextListing = nextVisit?.listingId ? byId.get(nextVisit.listingId) : undefined;
  // خط «اکنون» پیش از اولین قراری می‌نشیند که هنوز شروع نشده.
  const nowAt = visits.findIndex((v) => v.startsAt > iso);
  const left = todos.filter((t) => !t.done).length;
  const doneTodos = todos.length - left;
  const visitCount = visits.filter((v) => v.kind === 'visit').length;
  const visitsDone = visits.filter((v) => v.done || v.endsAt <= iso).length;
  const recent = listings.slice(0, 4);


  const nowLine = (
    <li className="tl-now" aria-hidden="true">
      <span className="num">{formatTime(iso)}</span>
      <span className="tl-now-dot" />
      <span className="tl-now-ln" />
    </li>
  );

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
      </div>

      <div className="bd enter">
        <div className="tdy-top">
          <section aria-labelledby="nx" className={`nxt${nextListing ? ' has-ph' : ''}`}>
            {nextListing && <Cover variant={nextListing.cover} className="nxt-ph" />}
            <div className="nxt-bd">
              {nextVisit ? (
                <>
                  <span className="nxt-eb">
                    <span className="nxt-dot pulse" />
                    <span id="nx">قرار بعدی</span>
                    <span className="nxt-sep" />
                    <span className="num">{untilLabel(nextVisit, now)}</span>
                  </span>
                  <span className="nxt-time num">
                    {formatTime(nextVisit.startsAt)}
                    <small>تا {formatTime(nextVisit.endsAt)}</small>
                  </span>
                  <span className="nxt-t">{nextVisit.title}</span>
                  {nextListing && (
                    <span className="nxt-loc">
                      <Plaque value={nextListing.plaque} deal={nextListing.deal} size="s" />
                      <Icon name="pin" size="s" />
                      {nextListing.neighborhood}{nextListing.street ? `، ${nextListing.street}` : ''}
                    </span>
                  )}
                  <span className="nxt-act">
                    <Link viewTransition className="btn nxt-btn" to={nextListing ? `/show?f=${nextListing.id}` : '/show'}>
                      <Icon name="show" size="s" />
                      آماده‌سازی نمایش
                    </Link>
                    <button type="button" className="ib nxt-ib" aria-label="تماس">
                      <Icon name="phone" size="s" />
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="nxt-eb">
                    <span id="nx">برنامهٔ امروز</span>
                  </span>
                  <span className="nxt-t nxt-done">{visits.length ? 'قرارهای امروز تمام شد.' : 'امروز قراری ندارید.'}</span>
                  <span className="nxt-sub">{visits.length ? `${toFaDigits(visitsDone)} قرار پشت سر گذاشتید؛ خسته نباشید.` : 'وقت خوبی برای تماس با مشتری‌های منتظر است.'}</span>
                  <span className="nxt-act">
                    <Link viewTransition className="btn nxt-btn" to="/calendar">
                      <Icon name="cal" size="s" />
                      تقویم کامل
                    </Link>
                  </span>
                </>
              )}
            </div>
          </section>

          <div className="tdy-stats stagger">
            <StatTile to="/calendar" icon="cal" label="قرار امروز" value={visits.length} sub={`${toFaDigits(visitsDone)} انجام شد`} />
            <StatTile icon="check" label="کار مانده" value={left} sub={`از ${toFaDigits(todos.length)} کار`} />
            <StatTile to="/files" icon="files" label="فایل فعال" value={listings.length} sub="همهٔ فایل‌ها" />
            <StatTile to="/clients" icon="users" label="مشتری در جستجو" value={clients.length} sub="همهٔ مشتری‌ها" />
          </div>
        </div>

        <div className="tdy-grid">
          <section aria-labelledby="ag" className="card tdy-card">
            <div className="tdy-card-hd">
              <h2 id="ag" className="t2">برنامهٔ امروز</h2>
              <span className="sp" />
              <Link viewTransition className="lnk sm tdy-lnk" to="/calendar">تقویم کامل</Link>
            </div>
            {visits.length === 0 ? (
              <p className="tdy-empty mute">برای امروز قراری ثبت نشده.</p>
            ) : (
              <ol className="tl">
                {visits.map((v, i) => (
                  <AgendaItem
                    key={v.id}
                    v={v}
                    nowLine={i === nowAt ? nowLine : null}
                    listing={v.listingId ? byId.get(v.listingId) : undefined}
                    isNext={v.id === nextVisit?.id}
                    past={v.done || v.endsAt <= iso}
                  />
                ))}
                {nowAt === -1 && nowLine}
              </ol>
            )}
          </section>

          <section aria-labelledby="td" className="card tdy-card">
            <div className="tdy-card-hd">
              <h2 id="td" className="t2">کارهای امروز</h2>
              <span className="sp" />
              <span className="xs mute num">{toFaDigits(doneTodos)} از {toFaDigits(todos.length)}</span>
            </div>
            <span className="prog" role="progressbar" aria-label="پیشرفت کارهای امروز" aria-valuemin={0} aria-valuemax={todos.length} aria-valuenow={doneTodos}>
              <span style={{ width: `${todos.length ? (doneTodos / todos.length) * 100 : 0}%` }} />
            </span>
            <ul className="td">
              {todos.map((t) => (
                <li key={t.id} className={`td-i${t.done ? ' done' : ''}`}>
                  <CheckBox
                    checked={t.done}
                    label={`انجام شد: ${t.title}`}
                    onChange={(v) => {
                      void store.setTodoDone(t.id, v);
                      if (v) toast('آفرین؛ یک کار کمتر', { label: 'برگرداندن', run: () => void store.setTodoDone(t.id, false) });
                    }}
                  />
                  <span className="td-bd">
                    <span className="td-t">{t.title}</span>
                    {t.detail && <span className="td-d">{t.detail}</span>}
                    {t.action && !t.done && (
                      <button type="button" className="td-act">
                        <Icon name={ACTION_ICON[t.action].icon} size="s" />
                        {ACTION_ICON[t.action].label}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="nf" className="col" style={{ gap: 14 }}>
          <div className="rw" style={{ gap: 12 }}>
            <h2 id="nf" className="t2">تازه‌ترین فایل‌ها</h2>
            <span className="sp" style={{ height: 1, background: 'var(--line)' }} />
            <Link viewTransition className="lnk sm tdy-lnk" to="/files">همهٔ فایل‌ها</Link>
          </div>
          <div className="fgrid tdy-files stagger">
            {recent.map((l) => (
              <Link key={l.id} viewTransition className="fcard lift" to={`/files/${l.id}`}>
                <Cover variant={l.cover} style={{ viewTransitionName: `cover-${l.id}` }}>
                  <Plaque value={l.plaque} deal={l.deal} className="tagon" />
                </Cover>
                <span className="fcard-bd">
                  <span className="xs mute">{dealLabel[l.deal]}</span>
                  <span className="fcard-t">{listingTitle(l)}</span>
                  <span className="fcard-loc xs mute"><Icon name="pin" size="s" />{l.neighborhood}{l.street ? `، ${l.street}` : ''}</span>
                  <span className="fcard-facts">
                    <span><b className="num">{toFaDigits(l.area)}</b> متر</span>
                    <span><b className="num">{toFaDigits(l.bedrooms)}</b> خواب</span>
                    {l.floor !== undefined && <span>طبقهٔ <b className="num">{floorLabel(l)}</b></span>}
                  </span>
                  <span className="fcard-pr">
                    <b className="num">{headlinePrice(l)}</b>
                    <span className="xs mute num">{secondaryPrice(l)}</span>
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

function StatTile({ to, icon, label, value, sub }: { to?: string; icon: IconName; label: string; value: number; sub: string }) {
  const body = (
    <>
      <span className="st-ic"><Icon name={icon} size="s" /></span>
      <span className="st-v num">{toFaDigits(value)}</span>
      <span className="st-l">{label}</span>
      <span className="st-s num">{sub}{to && <Icon name="chl" size="s" />}</span>
    </>
  );
  return to ? (
    <Link viewTransition className="st lift" to={to}>{body}</Link>
  ) : (
    <span className="st">{body}</span>
  );
}

function AgendaItem({ v, listing, isNext, past, nowLine }: { v: Visit; listing?: Listing; isNext: boolean; past: boolean; nowLine: ReactNode }) {
  return (
    <>
      {nowLine}
      <li className={`tl-i${isNext ? ' next' : ''}${past ? ' past' : ''}`}>
        <span className="tl-time num">
          {formatTime(v.startsAt)}
          <small>{formatTime(v.endsAt)}</small>
        </span>
        <span className="tl-rail">
          <span className="tl-dot"><Icon name={past ? 'check' : KIND_ICON[v.kind]} size="s" /></span>
        </span>
        <span className="tl-bd">
          <span className="tl-main">
            <span className="tl-t">{v.title}</span>
            <span className="tl-meta">
              {listing && <Plaque value={listing.plaque} deal={listing.deal} size="s" />}
              {listing ? `${listing.neighborhood}${listing.street ? `، ${listing.street}` : ''}` : past ? 'انجام شد' : ''}
            </span>
          </span>
          {isNext && (
            <Link viewTransition className="btn btn-p tl-show" to={listing ? `/show?f=${listing.id}` : '/show'}>
              <Icon name="show" size="s" />
              آماده‌سازی نمایش
            </Link>
          )}
          <button type="button" className="ib tl-call" aria-label="تماس">
            <Icon name="phone" size="s" />
          </button>
        </span>
      </li>
    </>
  );
}
