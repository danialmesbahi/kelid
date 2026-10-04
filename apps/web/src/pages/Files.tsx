import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Cover, Icon, Plaque, Segmented } from '@kelid/ui';
import { dealLabel, floorLabel, headlinePrice, listingTitle, secondaryPrice, toFaDigits, bestMatches, type DealType, type Listing } from '@kelid/core';
import { useQuery } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { FullPhotoLayer } from '../photos/Gallery';
import { coverUrl, useCoverThumbs } from '../photos/photos';

type DealFilter = 'all' | DealType;
type View = 'list' | 'cards';

const statusLabel: Partial<Record<Listing['status'], string>> = { reserved: 'رزرو', negotiating: 'در مذاکره', closed: 'معامله شد' };

export function FilesPage() {
  const [deal, setDeal] = useState<DealFilter>('all');
  const [view, setView] = useState<View>('list');
  const [selId, setSelId] = useState<string>();
  const navigate = useNavigate();

  const data = useQuery('files', async (s) => ({ all: await s.listListings(), clients: await s.listClients() }));
  const thumbs = useCoverThumbs();
  if (!data) return <PageSkeleton rows={8} aside />;

  const list = data.all.filter((l) => deal === 'all' || l.deal === deal);
  const sel = list.find((l) => l.id === selId) ?? list[0];
  const count = (d: DealFilter) => toFaDigits(data.all.filter((l) => d === 'all' || l.deal === d).length);
  const matchCount = sel ? data.clients.filter((c) => bestMatches([sel], c.need).length > 0).length : 0;

  const dealOption = (d: DealType) => (
    <>
      <span className={`plq s ${d === 'rent' ? 'r' : d === 'full' ? 'f' : ''}`} style={{ minWidth: 14, width: 14, height: 14, padding: 0, borderRadius: 3, boxShadow: 'none' }} />
      {dealLabel[d]} <span className="num faint" style={{ fontWeight: 500 }}>{count(d)}</span>
    </>
  );

  return (
    <>
      <div className="hd" style={{ paddingBottom: 14 }}>
        <div className="col" style={{ gap: 2 }}>
          <h1 className="t1">فایل‌ها</h1>
          <span className="mute sm">{toFaDigits(list.length)} فایل</span>
        </div>
        <span className="sp" />
        <Segmented<View>
          label="نوع نمایش"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: <><Icon name="list" size="s" />فهرست</> },
            { value: 'cards', label: <><Icon name="grid" size="s" />کارت</> },
          ]}
        />
      </div>

      <div className="rw" style={{ flexWrap: 'wrap', gap: 8, padding: '0 28px 16px', borderBottom: '1px solid var(--line)' }}>
        <Segmented<DealFilter>
          label="نوع معامله"
          value={deal}
          onChange={setDeal}
          options={[
            { value: 'all', label: <>همه <span className="num faint" style={{ fontWeight: 500 }}>{count('all')}</span></> },
            { value: 'sale', label: dealOption('sale') },
            { value: 'rent', label: dealOption('rent') },
            { value: 'full', label: dealOption('full') },
          ]}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <section aria-label="نتایج" style={{ flex: '999 1 520px', minWidth: 0 }}>
          {list.length === 0 && (
            <div className="col" style={{ padding: '64px 16px', textAlign: 'center', gap: 6, alignItems: 'center' }}>
              <span className="t2">فایلی با این مشخصات نیست</span>
              <Link viewTransition className="btn btn-p" to="/add" style={{ marginTop: 10 }}>ثبت اولین فایل</Link>
            </div>
          )}

          {view === 'list' && list.length > 0 && (
            <div style={{ padding: '8px 16px 24px', overflowX: 'auto' }}>
              <div className="stagger" style={{ minWidth: 600 }}>
                <div className="listgrid xs faint sb" style={{ padding: '10px 12px' }}>
                  <span>پلاک</span><span>ملک</span><span>متراژ</span><span>خواب</span><span>قیمت</span>
                </div>
                {list.map((l) => (
                  <button key={l.id} type="button" aria-pressed={l.id === sel?.id} className={`listgrid hov ${l.id === sel?.id ? 'sel' : ''}`}
                    onClick={() => setSelId(l.id)} onDoubleClick={() => navigate(`/files/${l.id}`, { viewTransition: true })}
                    style={{ width: '100%', padding: '10px 12px', border: 0, borderTop: '1px solid var(--line)', borderRadius: 12, background: 'transparent', textAlign: 'right' }}>
                    <span><Plaque value={l.plaque} deal={l.deal} /></span>
                    <span className="rw" style={{ gap: 12, minWidth: 0 }}>
                      <Cover variant={l.cover} src={coverUrl(thumbs, l.id)} style={{ flex: '0 0 56px', height: 42, borderRadius: 8 }} />
                      <span className="col" style={{ minWidth: 0, lineHeight: 1.5 }}>
                        <span className="sb" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{listingTitle(l)}</span>
                        <span className="xs mute">{l.neighborhood}، {l.street}{statusLabel[l.status] ? ` · ${statusLabel[l.status]}` : ''}</span>
                      </span>
                    </span>
                    <span className="num">{toFaDigits(l.area)} م</span>
                    <span className="num">{toFaDigits(l.bedrooms)}</span>
                    <span className="col" style={{ lineHeight: 1.5 }}>
                      <span className="num b">{headlinePrice(l)}</span>
                      <span className="xs mute">{secondaryPrice(l)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'cards' && (
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18, padding: '20px 24px 28px' }}>
              {list.map((l) => (
                <button key={l.id} type="button" className="lift col" onClick={() => setSelId(l.id)} onDoubleClick={() => navigate(`/files/${l.id}`, { viewTransition: true })}
                  style={{ gap: 10, padding: '0 0 10px', border: 0, background: 'transparent', textAlign: 'right', borderRadius: 16 }}>
                  <Cover variant={l.cover} src={coverUrl(thumbs, l.id)} style={{ width: '100%', height: 150, borderRadius: 14, boxShadow: l.id === sel?.id ? '0 0 0 2px var(--paper), 0 0 0 4px var(--pri-text)' : 'none', transition: 'box-shadow .25s ease' }}>
                    <Plaque value={l.plaque} deal={l.deal} className="tagon" />
                  </Cover>
                  <span className="col" style={{ padding: '0 2px', lineHeight: 1.55 }}>
                    <span className="sb">{listingTitle(l)}</span>
                    <span className="xs mute">{l.neighborhood} · {toFaDigits(l.bedrooms)} خواب</span>
                    <span className="num b" style={{ marginTop: 4 }}>{headlinePrice(l)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {sel && (
          <aside key={sel.id} aria-label="پیش‌نمایش فایل" className="col enter" style={{ flex: '1 1 360px', minWidth: 0, maxWidth: '100%', borderRight: '1px solid var(--line)', padding: '20px 22px 26px', gap: 16, background: 'var(--paper2)', borderRadius: '0 0 0 20px' }}>
            <span style={{ display: 'block', borderRadius: 16, overflow: 'hidden', position: 'relative', viewTransitionName: `cover-${sel.id}` }}>
              <Cover variant={sel.cover} src={coverUrl(thumbs, sel.id)} style={{ height: 200 }}>
                <FullPhotoLayer photoId={thumbs[sel.id]?.photoId} />
                <span className="cnt">{sel.photoCount ? `${toFaDigits(sel.photoCount)} عکس` : 'بدون عکس'}</span>
              </Cover>
            </span>
            <div className="rw" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span className="col sp">
                <span className="xs mute">{dealLabel[sel.deal]} · {sel.neighborhood}، {sel.street}</span>
                <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5 }}>{listingTitle(sel)}</span>
              </span>
              <span style={{ viewTransitionName: `plaque-${sel.id}` }}><Plaque value={sel.plaque} deal={sel.deal} size="l" /></span>
            </div>
            <div className="col">
              <span className="big" style={{ fontSize: 30 }}>{headlinePrice(sel)} {sel.deal === 'sale' ? 'تومان' : ''}</span>
              <span className="sm mute">{secondaryPrice(sel)}</span>
            </div>
            <div className="facts" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', background: 'var(--paper)' }}>
              <div><small>متراژ</small><b>{toFaDigits(sel.area)} متر</b></div>
              <div><small>خواب</small><b>{toFaDigits(sel.bedrooms)}</b></div>
              <div><small>طبقه</small><b>{floorLabel(sel)}</b></div>
            </div>
            {sel.features.length > 0 && <span className="sm" style={{ color: 'var(--ink2)' }}>{sel.features.join(' · ')}</span>}
            {matchCount > 0 && (
              <Link viewTransition to="/clients" className="rw sm sb" style={{ gap: 10, padding: '12px 14px', borderRadius: 14, background: 'var(--pri-tint)', color: 'var(--pri-text)' }}>
                <Icon name="user" />
                <span className="sp">{toFaDigits(matchCount)} مشتری دنبال چنین فایلی‌اند</span>
                <Icon name="chl" size="s" />
              </Link>
            )}
            <div className="rw" style={{ gap: 8 }}>
              <Link viewTransition className="btn btn-p sp" to={`/show?f=${sel.id}`}><Icon name="show" size="s" />نمایش به مشتری</Link>
              <Link viewTransition className="btn btn-s" to={`/files/${sel.id}`}>پرونده</Link>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
