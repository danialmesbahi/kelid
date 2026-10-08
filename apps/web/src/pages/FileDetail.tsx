import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon, Plaque, Segmented } from '@kelid/ui';
import { dealLabel, floorLabel, headlinePrice, listingTitle, matchListing, secondaryPrice, toFaDigits } from '@kelid/core';
import { useMember } from '../auth/AuthContext';
import { useQuery, useStore } from '../data';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { VisitDialog } from '../visits/VisitDialog';
import { statusOptions } from './ListingForm';
import { PhotoGallery } from '../photos/Gallery';
import { cachedListing } from '../queries';

export function FileDetailPage() {
  const { id = '' } = useParams();
  const [showPhone, setShowPhone] = useState(false);
  const { ownerPhones } = useMember();
  const [visitOpen, setVisitOpen] = useState(false);
  const store = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const data = useQuery(`file:${id}`, async (s) => ({ l: await s.getListing(id), clients: await s.listClients() }), () => cachedListing(id));

  if (!data) return <PageSkeleton aside />;
  const l = data.l;
  if (!l) {
    return (
      <div className="bd" style={{ paddingTop: 40 }}>
        <h1 className="t1">این فایل پیدا نشد</h1>
        <Link viewTransition className="lnk" to="/files">بازگشت به فایل‌ها</Link>
      </div>
    );
  }

  const matches = data.clients
    .map((c) => ({ c, m: matchListing(l, c.need) }))
    .filter((x) => x.m.score >= 60)
    .sort((a, b) => b.m.score - a.m.score);

  return (
    <div className="bd" style={{ paddingTop: 22 }}>
      <div className="rw" style={{ flexWrap: 'wrap', gap: 10 }}>
        <Link viewTransition className="btn btn-g" to="/files" style={{ padding: '0 12px' }}><Icon name="back" size="s" />فایل‌ها</Link>
        <span className="sp" />
        <button
          type="button"
          className="ib ghost"
          aria-label="بایگانی فایل"
          onClick={async () => {
            await store.archiveListing(l.id);
            navigate('/files', { viewTransition: true });
            toast(`فایل ${listingTitle(l)} بایگانی شد`, { label: 'برگرداندن', run: () => void store.restoreListing(l.id) });
          }}
        >
          <Icon name="x" />
        </button>
        <button type="button" className="ib ghost" aria-label="چاپ برگهٔ فایل" onClick={() => window.print()}><Icon name="print" /></button>
        <Link viewTransition className="btn btn-s" to={`/files/${l.id}/edit`}><Icon name="edit" size="s" />ویرایش</Link>
        <button type="button" className="btn btn-s"><Icon name="send" size="s" />ارسال برای مشتری</button>
        <button type="button" className="btn btn-s" onClick={() => setVisitOpen(true)}><Icon name="cal" size="s" />ثبت بازدید</button>
        <Link viewTransition className="btn btn-p" to={`/show?f=${l.id}`}><Icon name="show" size="s" />نمایش به مشتری</Link>
      </div>

      <div className="rw" style={{ flexWrap: 'wrap', gap: 18 }}>
        <span style={{ viewTransitionName: `plaque-${l.id}` }}><Plaque value={l.plaque} deal={l.deal} size="l" /></span>
        <div className="col" style={{ flex: '1 1 360px', gap: 2 }}>
          <h1 className="t1">{listingTitle(l)}</h1>
          <span className="mute rw" style={{ flexWrap: 'wrap', gap: '6px 14px' }}>
            <span className="rw" style={{ gap: 6 }}><Icon name="pin" size="s" />{l.neighborhood}، {l.street}</span>
            <span>{dealLabel[l.deal]}</span>
          </span>
        </div>
        <Segmented
          label="وضعیت فایل"
          value={l.status}
          options={statusOptions(l.deal, l.status)}
          onChange={async (status) => {
            const prev = l.status;
            if (status === prev) return;
            await store.updateListing(l.id, { status });
            const label = statusOptions(l.deal, status).find((o) => o.value === status)?.label ?? '';
            toast(`وضعیت فایل: ${label}`, { label: 'برگرداندن', run: () => void store.updateListing(l.id, { status: prev }) });
          }}
        />
        <Link viewTransition className="btn btn-s" to={`/deals?new=${l.id}`}>
          <Icon name="deal" size="s" />
          شروع معامله
        </Link>
      </div>

      <PhotoGallery listing={l} />

      {/* هر بار که پرونده باز می‌شود، جزئیات پشت عکسِ در حال پرواز آرام بالا می‌آیند */}
      <div className="arrive" style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        <div className="col" style={{ flex: '3 1 480px', minWidth: 0, gap: 28 }}>
          <section aria-labelledby="fx" className="col" style={{ gap: 12 }}>
            <h2 id="fx" className="t2">مشخصات</h2>
            <div className="facts">
              <div><small>متراژ</small><b>{toFaDigits(l.area)} متر</b></div>
              <div><small>اتاق خواب</small><b>{toFaDigits(l.bedrooms)}</b></div>
              <div><small>طبقه</small><b>{floorLabel(l)}</b></div>
              <div><small>سال ساخت</small><b>{l.yearBuilt ? toFaDigits(l.yearBuilt) : '—'}</b></div>
            </div>
          </section>
          {l.features.length > 0 && (
            <section aria-labelledby="am" className="col" style={{ gap: 12 }}>
              <h2 id="am" className="t2">امکانات</h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px 20px' }}>
                {l.features.map((f) => (
                  <li key={f} className="rw" style={{ gap: 10 }}><Icon name="check" size="s" className="lnk" />{f}</li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="ab" className="col" style={{ gap: 10 }}>
            <h2 id="ab" className="t2">دربارهٔ این ملک</h2>
            <p className="mute" style={{ margin: 0, fontSize: 16, lineHeight: 2 }}>{l.description ?? 'توضیحی ثبت نشده. نورگیری، وضعیت ساختمان و دسترسی‌ها را اینجا بنویسید.'}</p>
          </section>
        </div>

        <div className="col" style={{ flex: '2 1 330px', minWidth: 0, gap: 18 }}>
          <section aria-label="قیمت" className="card col" style={{ padding: '22px 24px', gap: 4 }}>
            <span className="eb">{l.deal === 'sale' ? 'قیمت کل' : l.deal === 'rent' ? 'ودیعه و اجاره' : 'رهن کامل'}</span>
            <span className="big" style={{ fontSize: 40 }}>{headlinePrice(l)}</span>
            <span className="mute">{secondaryPrice(l)}{l.negotiable ? ' · قابل مذاکره' : ''}</span>
          </section>

          <section aria-labelledby="ow" className="deep col" style={{ padding: '22px 24px', gap: 14 }}>
            <div className="rw" style={{ justifyContent: 'space-between' }}>
              <h2 id="ow" className="t3" style={{ color: 'var(--deep-mute)', fontWeight: 600 }}>مالک</h2>
              <span className="rw xs" style={{ gap: 6, color: 'var(--brass)' }}><Icon name="lock" size="s" />فقط برای دفتر</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{l.owner.name}</span>
            {l.owner.phone ? (
              <div className="rw" style={{ gap: 8 }}>
                <a className="btn sp" href={`tel:${l.owner.phone}`} style={{ background: 'var(--deep-ink)', color: 'var(--deep)' }}><Icon name="phone" size="s" />تماس</a>
                <button type="button" className="btn sp" onClick={() => setShowPhone((v) => !v)} style={{ borderColor: 'var(--deep-line)', background: 'transparent', color: 'var(--deep-ink)', direction: 'ltr' }}>
                  {showPhone ? toFaDigits(l.owner.phone) : 'نمایش شماره'}
                </button>
              </div>
            ) : (
              <span className="rw sm" style={{ gap: 8, color: 'var(--deep-mute)', lineHeight: 1.8 }}>
                <Icon name={ownerPhones ? 'phone' : 'lock'} size="s" />
                {ownerPhones ? 'شماره‌ای ثبت نشده است.' : 'شمارهٔ مالک را مدیر دفتر دارد؛ برای تماس با او هماهنگ کنید.'}
              </span>
            )}
          </section>

          {matches.length > 0 && (
            <section aria-labelledby="mc" className="card col" style={{ padding: '18px 20px', gap: 4 }}>
              <h2 id="mc" className="t3" style={{ marginBottom: 6 }}>مشتری‌های مناسب</h2>
              {matches.map(({ c, m }) => (
                <Link key={c.id} viewTransition className="row hov" to={`/clients?c=${c.id}`} style={{ padding: 8 }}>
                  <span className="av">{c.name.replace(/^(آقای|خانم|خانوادهٔ)\s*/, '').charAt(0)}</span>
                  <span className="col sp" style={{ lineHeight: 1.5 }}><span className="sb">{c.name}</span><span className="xs mute">{m.reasons.join('، ')} جور است</span></span>
                  <span className="num b lnk">{toFaDigits(m.score)}٪</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      </div>
      {visitOpen && <VisitDialog preset={{ listingId: l.id }} onClose={() => setVisitOpen(false)} />}
    </div>
  );
}
