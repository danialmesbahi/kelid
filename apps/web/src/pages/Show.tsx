import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Cover, Icon } from '@kelid/ui';
import { dealLabel, floorLabel, headlinePrice, listingTitle, secondaryPrice, toFaDigits } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { FullPhotoLayer } from '../photos/Gallery';
import { coverUrl, photoUrl, prefetchFullPhoto, useCoverThumbs } from '../photos/photos';
import { usePrefsContext } from '../App';

/**
 * حالت نمایش به مشتری: تمام‌صفحه، بدون اطلاعات مالک.
 * فایل‌ها از ?f=id1,id2 می‌آیند؛ اگر نبود، تازه‌ترین فایل‌ها.
 */
export function ShowPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = (params.get('f') ?? '').split(',').filter(Boolean);
  const all = useQuery('files-all', (s) => s.listListings());
  const thumbs = useCoverThumbs();
  const [i, setI] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  // عکسِ در حال نمایش هر ملک؛ برگشتن به یک ملک همان عکس را نشان می‌دهد.
  const [photoAt, setPhotoAt] = useState<Record<string, number>>({});
  const store = useStore();
  const officeName = usePrefsContext().officeName.trim();

  const list = all ? (ids.length ? ids.map((id) => all.find((l) => l.id === id)).filter((l) => l !== undefined) : all.slice(0, 5)) : [];
  const n = list.length;
  const p = list[i];
  const photos = useQuery(`photos:${p?.id ?? ''}`, (s) => (p ? s.listPhotos(p.id) : Promise.resolve([])));
  const pn = photos?.length ?? 0;
  const pi = p ? Math.min(photoAt[p.id] ?? 0, Math.max(0, pn - 1)) : 0;
  const ph = photos?.[pi];

  // عکس بعدی از قبل آماده می‌شود تا ورق زدن جلوی مشتری مکث نداشته باشد.
  useEffect(() => {
    if (photos && pn > 1) prefetchFullPhoto(store, photos[(pi + 1) % pn]?.id);
  }, [store, photos, pi, pn]);

  // ورق زدن عکس‌ها؛ بعد از آخرین عکس به ملک بعدی می‌رود (و برعکس).
  const step = (d: 1 | -1) => {
    if (!p) return;
    const next = pi + d;
    if (next >= 0 && next < pn) return setPhotoAt((m) => ({ ...m, [p.id]: next }));
    if (n < 2) return setPhotoAt((m) => ({ ...m, [p.id]: (next + pn) % Math.max(1, pn) }));
    const k = (i + d + n) % n;
    const q = list[k];
    if (q) setPhotoAt((m) => ({ ...m, [q.id]: d === 1 ? 0 : Math.max(0, q.photoCount - 1) }));
    setI(k);
  };
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // برگشت به همان جایی که نمایش از آن شروع شد؛ اگر مستقیم باز شده، به «امروز».
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { viewTransition: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(1);
      else if (e.key === 'ArrowRight') step(-1);
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, i, pi, pn]);

  if (!p) return null;
  const isLiked = !!liked[p.id];

  return (
    <div
      className="col showpage"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        const x1 = e.changedTouches[0]?.clientX;
        touchX.current = null;
        // راست‌به‌چپ: کشیدن به راست = عکس بعدی
        if (x0 !== null && x1 !== undefined && Math.abs(x1 - x0) > 50) step(x1 > x0 ? 1 : -1);
      }}
      style={{ position: 'relative', minHeight: '100vh', background: '#0B0C0B', color: '#fff', overflow: 'hidden', fontSize: 16 }}>
      <span key={`${p.id}:${ph?.id ?? ''}`} className="fade" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Cover variant={p.cover} src={ph ? photoUrl(ph.id, 'thumb', ph.thumb, ph.mime) : coverUrl(thumbs, p.id)} className="kenburns" style={{ position: 'absolute', inset: 0 }}>
          <FullPhotoLayer photoId={ph?.id ?? thumbs[p.id]?.photoId} />
        </Cover>
      </span>
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,12,11,.94) 0%, rgba(11,12,11,.68) 32%, rgba(11,12,11,0) 62%), linear-gradient(to bottom, rgba(11,12,11,.55) 0%, rgba(11,12,11,0) 18%)' }} />

      <header className="rw" style={{ position: 'relative', flexWrap: 'wrap', gap: 14, padding: '24px 44px' }}>
        <span className="plq" style={{ height: 32, padding: '0 12px', fontSize: 15 }}>کلید</span>
        {/* این صفحه جلوی مشتری است: نام واقعی دفتر، یا هیچ (نه متن نمونه). */}
        {officeName && <span className="sm" style={{ color: 'rgba(255,255,255,.75)' }}>{officeName}</span>}
        <span className="sp" />
        {pn > 1 && (
          <span className="num xs" aria-live="polite" style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', borderRadius: 99, background: 'rgba(18,20,18,.55)', border: '1px solid rgba(255,255,255,.14)' }}>
            عکس {toFaDigits(pi + 1)} از {toFaDigits(pn)}
          </span>
        )}
        <span className="rw xs" style={{ gap: 8, height: 40, padding: '0 14px', borderRadius: 99, background: 'rgba(18,20,18,.55)', border: '1px solid rgba(255,255,255,.14)' }}>
          <Icon name="lock" size="s" />
          اطلاعات مالک پنهان است
        </span>
        <button type="button" onClick={close} className="rw sb sm" style={{ gap: 8, height: 44, padding: '0 18px', borderRadius: 12, background: 'rgba(18,20,18,.55)', border: '1px solid rgba(255,255,255,.14)', color: '#fff' }}>
          <Icon name="x" size="s" />
          پایان نمایش
        </button>
      </header>
      <div className="sp" />
      {pn > 1 && (
        <div className="rw" style={{ position: 'relative', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0 24px' }}>
          <button type="button" aria-label="عکس قبلی" onClick={() => step(-1)} className="showarrow"><Icon name="chr" size="l" /></button>
          <button type="button" aria-label="عکس بعدی" onClick={() => step(1)} className="showarrow"><Icon name="chl" size="l" /></button>
        </div>
      )}
      <div className="sp" />

      <div className="rw" style={{ position: 'relative', flexWrap: 'wrap', alignItems: 'flex-end', gap: 32, padding: '0 44px 40px' }}>
        <div key={p.id} className="col fade" style={{ flex: '1 1 520px', gap: 10 }}>
          <span className="rw sm sb" style={{ gap: 10, color: '#C9A86F' }}>
            <span style={{ width: 24, height: 1, background: '#C9A86F' }} />
            {p.neighborhood} · {dealLabel[p.deal]}
          </span>
          <h1 style={{ margin: 0, fontSize: 52, fontWeight: 700, lineHeight: 1.3 }}>{listingTitle(p)}</h1>
          <span className="num showprice" style={{ fontSize: 40, fontWeight: 300, lineHeight: 1.4 }}>{headlinePrice(p)}{p.deal === 'sale' ? ' تومان' : ''}</span>
          <span className="rw" style={{ flexWrap: 'wrap', gap: '8px 20px', fontSize: 18, color: 'rgba(255,255,255,.85)' }}>
            <span>{toFaDigits(p.bedrooms)} خواب</span><span style={{ opacity: 0.35 }}>|</span>
            <span>طبقهٔ {floorLabel(p)}</span><span style={{ opacity: 0.35 }}>|</span>
            <span>{secondaryPrice(p)}</span>
          </span>
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 16 }}>
          <div className="rw" style={{ gap: 8 }}>
            {list.map((x, k) => (
              <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`ملک ${toFaDigits(k + 1)}`} aria-current={k === i}
                style={{ position: 'relative', width: 84, height: 58, padding: 0, borderRadius: 10, border: 0, overflow: 'hidden', opacity: k === i ? 1 : 0.6, boxShadow: k === i ? '0 0 0 2px #fff' : 'none' }}>
                <Cover variant={x.cover} src={coverUrl(thumbs, x.id)} style={{ position: 'absolute', inset: 0 }} />
              </button>
            ))}
          </div>
          <div className="rw" style={{ gap: 12 }}>
            <button type="button" aria-pressed={isLiked} onClick={() => setLiked((l) => ({ ...l, [p.id]: !isLiked }))} className="rw b"
              style={{ gap: 10, height: 60, padding: '0 22px', borderRadius: 16, border: `1px solid ${isLiked ? '#C9A86F' : 'rgba(255,255,255,.2)'}`, background: isLiked ? '#C9A86F' : 'rgba(18,20,18,.55)', color: isLiked ? '#0B0C0B' : '#fff' }}>
              <span key={String(isLiked)} className={isLiked ? 'pop-in' : ''} style={{ display: 'flex' }}><Icon name="heart" className={isLiked ? 'filled' : ''} /></span>
              {isLiked ? 'پسندیدید' : 'می‌پسندم'}
            </button>
            <span className="num sm" style={{ color: 'rgba(255,255,255,.7)', minWidth: 48, textAlign: 'center' }}>{toFaDigits(i + 1)} / {toFaDigits(n)}</span>
            <button type="button" aria-label="ملک قبلی" onClick={() => setI((i - 1 + n) % n)} style={{ width: 60, height: 60, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(18,20,18,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chr" size="l" /></button>
            <button type="button" aria-label="ملک بعدی" onClick={() => setI((i + 1) % n)} style={{ width: 60, height: 60, borderRadius: '50%', border: 0, background: '#fff', color: '#0B0C0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chl" size="l" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
