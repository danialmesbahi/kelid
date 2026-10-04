import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckBox, Cover, Icon, Plaque, Segmented } from '@kelid/ui';
import { bestMatches, dealLabel, describeMatch, formatToman, listingTitle, toFaDigits, type Client } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { usePhone } from '../layout/usePhone';

type Kind = 'all' | 'buy' | 'rent';

export function initial(name: string): string {
  return name.replace(/^(آقای|خانم|خانوادهٔ)\s*/, '').charAt(0);
}

function needSummary(c: Client): string {
  const n = c.need;
  const parts = [dealLabel[n.deal]];
  if (n.bedroomsMin) parts.push(`${toFaDigits(n.bedroomsMin)} خواب`);
  if (n.neighborhoods[0]) parts.push(n.neighborhoods[0]);
  if (n.budgetMax) parts.push(`تا ${formatToman(n.budgetMax, true)}`);
  return parts.join(' · ');
}

function budgetText(c: Client): string {
  const n = c.need;
  if (n.deal === 'rent' && n.rentMax) return `${n.budgetMax ? `ودیعه ${formatToman(n.budgetMax)}` : 'ودیعه —'} · اجاره ${formatToman(n.rentMax)}`;
  return n.budgetMax ? formatToman(n.budgetMax) : '—';
}

export function ClientsPage() {
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>('all');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const store = useStore();
  const toast = useToast();
  const phone = usePhone();
  const data = useQuery('clients', async (s) => ({ clients: await s.listClients(), listings: await s.listListings() }));
  if (!data) return <PageSkeleton />;

  const list = data.clients.filter((c) => kind === 'all' || (kind === 'buy' ? c.need.deal === 'sale' : c.need.deal !== 'sale'));
  const cur = list.find((c) => c.id === params.get('c')) ?? list[0];
  const matches = cur ? bestMatches(data.listings, cur.need).slice(0, 5) : [];
  const pickedIds = matches.filter((m) => picked[m.listing.id]).map((m) => m.listing.id);
  // روی گوشی یا فهرست دیده می‌شود یا پروفایل یک مشتری، نه هر دو زیر هم.
  const chosen = !!params.get('c');
  const showList = !phone || !chosen;
  const showProfile = !phone || chosen;

  return (
    <>
      <div className="hd" style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        <div className="col" style={{ gap: 2 }}>
          <h1 className="t1">مشتری‌ها</h1>
          <span className="mute sm">{toFaDigits(data.clients.length)} مشتری در جستجو · {toFaDigits(data.clients.filter((c) => c.waitingForNews).length)} نفر منتظر خبر شما</span>
        </div>
        <span className="sp" />
        <Segmented<Kind> label="نوع درخواست" value={kind} onChange={setKind} options={[{ value: 'all', label: 'همه' }, { value: 'buy', label: 'خرید' }, { value: 'rent', label: 'اجاره' }]} />
        <Link viewTransition className="btn btn-p" to="/clients/new"><Icon name="plus" size="s" thick />مشتری جدید</Link>
      </div>

      {data.clients.length === 0 && (
        <div className="col" style={{ padding: '64px 16px', textAlign: 'center', gap: 6, alignItems: 'center' }}>
          <span className="t2">هنوز مشتری‌ای ثبت نشده</span>
          <span className="mute sm">نیاز هر خریدار یا مستأجر را ثبت کنید تا فایل‌های مناسب خودشان پیدا شوند.</span>
          <Link viewTransition className="btn btn-p" to="/clients/new" style={{ marginTop: 10 }}>ثبت اولین مشتری</Link>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
        {showList && <section aria-label="فهرست مشتری‌ها" className="col" style={{ flex: '1 1 340px', minWidth: 0, borderLeft: '1px solid var(--line)', padding: '12px 10px 24px', gap: 2 }}>
          {list.map((c) => {
            const on = c.id === cur?.id;
            return (
              <button key={c.id} type="button" aria-pressed={on} className={`row hov ${on ? 'sel' : ''}`} onClick={() => setParams({ c: c.id })}
                style={{ border: 0, background: 'transparent', textAlign: 'right', width: '100%' }}>
                <span className={`av ${on ? 'on' : ''}`}>{initial(c.name)}</span>
                <span className="col sp" style={{ minWidth: 0, lineHeight: 1.5 }}>
                  <span className="sb">{c.name}</span>
                  <span className="xs mute" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{needSummary(c)}</span>
                </span>
                {c.waitingForNews && <span className="dot" style={{ background: 'var(--brass)' }} aria-label="منتظر خبر" />}
              </button>
            );
          })}
        </section>}

        {cur && showProfile && (
          <section key={cur.id} aria-label="پروفایل مشتری" className="col enter" style={{ flex: '999 1 520px', minWidth: 0, padding: '24px 30px 36px', gap: 24 }}>
            {phone && (
              <button type="button" className="btn btn-g" onClick={() => setParams({})} style={{ alignSelf: 'flex-start', padding: '0 12px' }}>
                <Icon name="back" size="s" />مشتری‌ها
              </button>
            )}
            <div className="rw" style={{ flexWrap: 'wrap', gap: 14 }}>
              <span className="av on" style={{ width: 56, height: 56, fontSize: 20 }}>{initial(cur.name)}</span>
              <div className="col" style={{ flex: '1 1 220px' }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.45 }}>{cur.name}</h2>
                <span className="mute sm">{needSummary(cur)}</span>
              </div>
              <a className="ib" href={`tel:${cur.phone}`} aria-label={`تماس با ${cur.name}`}><Icon name="phone" /></a>
              <a className="ib" href={`sms:${cur.phone}`} aria-label={`پیامک به ${cur.name}`}><Icon name="msg" /></a>
              <Link viewTransition className="ib" to={`/clients/${cur.id}/edit`} aria-label={`ویرایش ${cur.name}`}><Icon name="edit" /></Link>
              <button
                type="button"
                className="ib ghost"
                aria-label={`بایگانی ${cur.name}`}
                onClick={async () => {
                  await store.archiveClient(cur.id);
                  setParams({});
                  toast(`${cur.name} بایگانی شد`, { label: 'برگرداندن', run: () => { void store.restoreClient(cur.id).then(() => setParams({ c: cur.id })); } });
                }}
              >
                <Icon name="x" />
              </button>
            </div>

            <section aria-labelledby="nd" className="col" style={{ gap: 10 }}>
              <h3 id="nd" className="t3">دنبال چه می‌گردد</h3>
              <div className="facts" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                <div><small>معامله</small><b>{dealLabel[cur.need.deal]}</b></div>
                <div><small>محله‌ها</small><b style={{ fontSize: 15 }}>{cur.need.neighborhoods.join('، ') || 'فرقی ندارد'}</b></div>
                <div><small>متراژ</small><b>{cur.need.areaMin ? toFaDigits(cur.need.areaMin) : '—'} تا {cur.need.areaMax ? toFaDigits(cur.need.areaMax) : '—'}</b></div>
                <div><small>بودجه</small><b style={{ fontSize: cur.need.rentMax ? 15 : undefined }}>{budgetText(cur)}</b></div>
              </div>
            </section>

            {cur.notes && (
              <section aria-labelledby="nt" className="soft col" style={{ padding: '14px 16px', gap: 4 }}>
                <h3 id="nt" className="t3 rw" style={{ gap: 6 }}><Icon name="lock" size="s" />یادداشت دفتر</h3>
                <p className="sm" style={{ margin: 0, lineHeight: 1.9, color: 'var(--ink2)', whiteSpace: 'pre-wrap' }}>{cur.notes}</p>
              </section>
            )}

            <section aria-labelledby="mf" className="col" style={{ gap: 10 }}>
              <div className="rw" style={{ gap: 10 }}><h3 id="mf" className="t3">فایل‌های مناسب</h3><span className="xs mute">تیک بزنید تا در نمایش بیاید</span></div>
              {matches.length === 0 && <p className="mute">فعلاً فایلی با این نیاز جور نیست. با ثبت فایل تازه خبرتان می‌کنیم.</p>}
              {matches.map((m) => {
                const on = !!picked[m.listing.id];
                return (
                  <div key={m.listing.id} className={`row ${on ? 'sel' : ''}`} style={{ border: '1px solid var(--line)' }}>
                    <CheckBox checked={on} size={26} label="افزودن به نمایش" onChange={(v) => setPicked((p) => ({ ...p, [m.listing.id]: v }))} />
                    <Cover variant={m.listing.cover} style={{ flex: '0 0 76px', height: 58, borderRadius: 10 }} />
                    <Link viewTransition to={`/files/${m.listing.id}`} className="col sp" style={{ minWidth: 0, gap: 2, lineHeight: 1.5 }}>
                      <span className="rw" style={{ gap: 8 }}><Plaque value={m.listing.plaque} deal={m.listing.deal} size="s" /><span className="sb">{listingTitle(m.listing)} · {m.listing.neighborhood}</span></span>
                      <span className="xs mute">{describeMatch(m)}</span>
                    </Link>
                    <span className="num" style={{ fontSize: 20, fontWeight: 300, color: 'var(--pri-text)' }}>{toFaDigits(m.score)}٪</span>
                  </div>
                );
              })}
              {matches.length > 0 && (
                <div className="deep rw" style={{ gap: 12, padding: '12px 14px', borderRadius: 16, marginTop: 4 }}>
                  <Icon name="show" className="" />
                  <span className="sp">{pickedIds.length ? `${toFaDigits(pickedIds.length)} فایل برای نمایش به ${cur.name} آماده است` : 'فایل‌هایی را که می‌خواهید نشان دهید تیک بزنید'}</span>
                  <Link viewTransition className="btn" to={`/show?f=${(pickedIds.length ? pickedIds : matches.map((m) => m.listing.id)).join(',')}`} style={{ background: 'var(--deep-ink)', color: 'var(--deep)', height: 42 }}>شروع نمایش</Link>
                </div>
              )}
            </section>
          </section>
        )}
      </div>
    </>
  );
}
