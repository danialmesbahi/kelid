import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Cover, Icon } from '@kelid/ui';
import { dealLabel, floorLabel, headlinePrice, listingTitle, secondaryPrice, toFaDigits, type Listing, type PhotoThumb } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { coverUrl, photoUrl, prefetchFullPhoto, useCoverThumbs, useFullPhotoUrl } from '../photos/photos';
import { usePrefsContext } from '../App';
import { usePhone } from '../layout/usePhone';
import './show.css';

/**
 * حالت نمایش به مشتری: تمام‌صفحه، بدون اطلاعات مالک.
 * فایل‌ها از ?f=id1,id2 می‌آیند؛ اگر نبود، تازه‌ترین فایل‌ها.
 * عکس کامل دیده می‌شود (بدون بریدن و زوم)؛ پشتش نسخهٔ محوِ همان عکس جای خالی را پر می‌کند.
 */
export function ShowPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const store = useStore();
  const ids = (params.get('f') ?? '').split(',').filter(Boolean);
  const all = useQuery('files-all', (s) => s.listListings());
  const thumbs = useCoverThumbs();
  const [i, setI] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  // عکسِ در حال نمایش هر ملک؛ برگشتن به یک ملک همان عکس را نشان می‌دهد.
  const [photoAt, setPhotoAt] = useState<Record<string, number>>({});
  // فقط عکس: ستون اطلاعات کنار می‌رود تا عکس همهٔ صفحه را بگیرد.
  const [focus, setFocus] = useState(false);
  const officeName = usePrefsContext().officeName.trim();

  const list = all ? (ids.length ? ids.map((id) => all.find((l) => l.id === id)).filter((l) => l !== undefined) : all.slice(0, 5)) : [];
  const n = list.length;
  const p = list[i];
  const photos = useQuery(`photos:${p?.id ?? ''}`, (s) => (p ? s.listPhotos(p.id) : Promise.resolve([])));
  const pn = photos?.length ?? 0;
  const pi = p ? Math.min(photoAt[p.id] ?? 0, Math.max(0, pn - 1)) : 0;
  const ph = photos?.[pi];
  const thumb = ph ? photoUrl(ph.id, 'thumb', ph.thumb, ph.mime) : p ? coverUrl(thumbs, p.id) : undefined;
  const full = useFullPhotoUrl(ph?.id ?? (p ? thumbs[p.id]?.photoId : undefined));
  const stripRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const phone = usePhone();
  // گوشی: زدن روی عکس آن را تمام‌صفحه باز می‌کند (همچنان کشیدنی).
  const [viewer, setViewer] = useState(false);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // عکس بعدی از قبل آماده می‌شود تا ورق زدن جلوی مشتری مکث نداشته باشد.
  useEffect(() => {
    if (photos && pn > 1) prefetchFullPhoto(store, photos[(pi + 1) % pn]?.id);
  }, [store, photos, pi, pn]);

  // بندانگشتیِ عکس جاری همیشه در دید نوار پایین بماند.
  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [pi, p?.id]);

  // برگشت به همان جایی که نمایش از آن شروع شد؛ اگر مستقیم باز شده، به «امروز».
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { viewTransition: true });
  };

  const goListing = (k: number, photo = 0) => {
    const q = list[(k + n) % n];
    if (!q) return;
    setPhotoAt((m) => ({ ...m, [q.id]: photo }));
    setI((k + n) % n);
  };

  // ورق زدن عکس‌ها؛ بعد از آخرین عکس به ملک بعدی می‌رود (و برعکس).
  const step = (d: 1 | -1) => {
    if (!p) return;
    const next = pi + d;
    if (next >= 0 && next < pn) return setPhotoAt((m) => ({ ...m, [p.id]: next }));
    if (n < 2) return setPhotoAt((m) => ({ ...m, [p.id]: (next + pn) % Math.max(1, pn) }));
    const q = list[(i + d + n) % n];
    goListing(i + d, d === 1 || !q ? 0 : Math.max(0, q.photoCount - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(1);
      else if (e.key === 'ArrowRight') step(-1);
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') goListing(i + 1);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') goListing(i - 1);
      else if (e.key === 'Escape') {
        if (viewer) setViewer(false);
        else if (focus) setFocus(false);
        else close();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, i, pi, pn, focus, viewer]);

  if (!p) return null;
  const isLiked = !!liked[p.id];
  const nextListing = n > 1 ? list[(i + 1) % n] : undefined;

  if (phone) {
    const slides = photos ?? [];
    const pick = (k: number) => setPhotoAt((m) => ({ ...m, [p.id]: k }));
    return (
      <div className="app dark shm">
        <section className="shm-hero" aria-label="عکس‌ها">
          {slides.length > 0 ? (
            <SwipeTrack photos={slides} pi={pi} listingId={p.id} alt={listingTitle(p)} onPick={pick} onTap={() => setViewer(true)} />
          ) : (
            <div className="shm-slide">
              {thumb ? <><img className="sh-bg" src={thumb} alt="" aria-hidden /><img className="sh-img" src={full ?? thumb} alt={listingTitle(p)} /></> : <Cover variant={p.cover} className="sh-cover" />}
            </div>
          )}
          <div className="shm-top">
            <button type="button" className="shm-ib" aria-label="پایان نمایش" onClick={close}><Icon name="x" /></button>
            <span className="sp" />
            {n > 1 && (
              <span className="shm-nav" role="group" aria-label="ملک‌ها">
                <button type="button" aria-label="ملک قبلی" onClick={() => goListing(i - 1)}><Icon name="chr" size="s" /></button>
                <span className="num" aria-live="polite">ملک {toFaDigits(i + 1)} از {toFaDigits(n)}</span>
                <button type="button" aria-label="ملک بعدی" onClick={() => goListing(i + 1)}><Icon name="chl" size="s" /></button>
              </span>
            )}
          </div>
          {pn > 1 && (
            <div className="shm-dots" aria-hidden>
              {pn <= 10 ? slides.map((x, k) => <i key={x.id} className={k === pi ? 'on' : ''} />) : <span className="num">{toFaDigits(pi + 1)} از {toFaDigits(pn)}</span>}
            </div>
          )}
        </section>

        <article className="shm-sheet" key={p.id}>
          <div className="sh-info-in fade">
            <InfoBody p={p} />
            <span className="shm-private"><Icon name="lock" size="s" />اطلاعات مالک پنهان است{officeName ? ` · ${officeName}` : ''}</span>
          </div>
        </article>

        {viewer && slides.length > 0 && (
          <div className="shm-viewer" role="dialog" aria-modal="true" aria-label="عکس‌ها">
            <SwipeTrack photos={slides} pi={pi} listingId={p.id} alt={listingTitle(p)} onPick={pick} plain />
            <div className="shm-top">
              <button type="button" className="shm-ib" aria-label="بستن عکس" onClick={() => setViewer(false)}><Icon name="x" /></button>
              <span className="sp" />
              {pn > 1 && <span className="shm-nav num" style={{ padding: '0 14px' }}>{toFaDigits(pi + 1)} از {toFaDigits(pn)}</span>}
            </div>
          </div>
        )}

        <div className="shm-bar">
          <button type="button" aria-pressed={isLiked} className={`sh-like${isLiked ? ' on' : ''}`} onClick={() => setLiked((l) => ({ ...l, [p.id]: !isLiked }))}>
            <span key={String(isLiked)} className={isLiked ? 'pop-in' : ''} style={{ display: 'flex' }}><Icon name="heart" className={isLiked ? 'filled' : ''} /></span>
            {isLiked ? 'پسندیدید' : 'می‌پسندم'}
          </button>
          {nextListing && (
            <button type="button" className="shm-next" onClick={() => goListing(i + 1)}>
              ملک بعدی
              <Icon name="chl" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`app dark sh${focus ? ' focus' : ''}`}>
      <header className="sh-top">
        <span className="plq" style={{ height: 30, padding: '0 11px', fontSize: 14 }}>کلید</span>
        {/* این صفحه جلوی مشتری است: نام واقعی دفتر، یا هیچ (نه متن نمونه). */}
        {officeName && <span className="sh-office">{officeName}</span>}
        <span className="sp" />
        {n > 1 && (
          <span className="sh-nav" role="group" aria-label="ملک‌ها">
            <button type="button" className="sh-ib" aria-label="ملک قبلی" onClick={() => goListing(i - 1)}><Icon name="chr" size="s" /></button>
            <span className="num" aria-live="polite">ملک {toFaDigits(i + 1)} از {toFaDigits(n)}</span>
            <button type="button" className="sh-ib" aria-label="ملک بعدی" onClick={() => goListing(i + 1)}><Icon name="chl" size="s" /></button>
          </span>
        )}
        <span className="sh-pill sh-hide-s"><Icon name="lock" size="s" />اطلاعات مالک پنهان است</span>
        <button type="button" className="sh-btn" aria-label="پایان نمایش" onClick={close}><Icon name="x" size="s" /><span className="sh-hide-s">پایان نمایش</span></button>
      </header>

      <main className="sh-body">
        <section className="sh-gallery" aria-label="عکس‌ها">
          <div
            className="sh-stage"
            onClick={() => setFocus((f) => !f)}
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const x0 = touchX.current;
              const x1 = e.changedTouches[0]?.clientX;
              touchX.current = null;
              // راست‌به‌چپ: کشیدن به راست = عکس بعدی
              if (x0 !== null && x1 !== undefined && Math.abs(x1 - x0) > 50) step(x1 > x0 ? 1 : -1);
            }}
          >
            {thumb ? (
              <>
                <img key={`bg:${ph?.id ?? p.id}`} className="sh-bg" src={thumb} alt="" aria-hidden draggable={false} />
                <img key={`im:${ph?.id ?? p.id}`} className="sh-img fade" src={full ?? thumb} alt={`${listingTitle(p)}، عکس ${toFaDigits(pi + 1)}`} draggable={false} />
              </>
            ) : (
              <Cover key={p.id} variant={p.cover} className="sh-cover fade" />
            )}
            {pn > 1 && (
              <>
                <button type="button" className="sh-arrow prev" aria-label="عکس قبلی" onClick={(e) => { e.stopPropagation(); step(-1); }}><Icon name="chr" size="l" /></button>
                <button type="button" className="sh-arrow next" aria-label="عکس بعدی" onClick={(e) => { e.stopPropagation(); step(1); }}><Icon name="chl" size="l" /></button>
                <span className="sh-count num">عکس {toFaDigits(pi + 1)} از {toFaDigits(pn)}</span>
              </>
            )}
            <button type="button" className="sh-focus sh-hide-s" aria-pressed={focus} onClick={(e) => { e.stopPropagation(); setFocus((f) => !f); }}>
              <Icon name={focus ? 'list' : 'eye'} size="s" />
              {focus ? 'نمایش مشخصات' : 'فقط عکس'}
            </button>
          </div>
          {pn > 1 && (
            <div className="sh-strip" ref={stripRef}>
              {photos!.map((x, k) => (
                <button key={x.id} type="button" aria-label={`عکس ${toFaDigits(k + 1)}`} aria-current={k === pi} onClick={() => setPhotoAt((m) => ({ ...m, [p.id]: k }))}>
                  <img src={photoUrl(x.id, 'thumb', x.thumb, x.mime)} alt="" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="sh-info" key={p.id}>
          <div className="sh-info-in fade">
            <InfoBody p={p} />

            <div className="sh-actions">
              <button type="button" aria-pressed={isLiked} className={`sh-like${isLiked ? ' on' : ''}`} onClick={() => setLiked((l) => ({ ...l, [p.id]: !isLiked }))}>
                <span key={String(isLiked)} className={isLiked ? 'pop-in' : ''} style={{ display: 'flex' }}><Icon name="heart" className={isLiked ? 'filled' : ''} /></span>
                {isLiked ? 'پسندیدید' : 'می‌پسندم'}
              </button>
              {nextListing && <NextCard l={nextListing} src={coverUrl(thumbs, nextListing.id)} onClick={() => goListing(i + 1)} />}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function NextCard({ l, src, onClick }: { l: Listing; src: string | undefined; onClick: () => void }) {
  return (
    <button type="button" className="sh-next" onClick={onClick}>
      <Cover variant={l.cover} src={src} className="sh-next-ph" />
      <span className="col" style={{ minWidth: 0, flex: 1, gap: 2 }}>
        <small>ملک بعدی</small>
        <b>{listingTitle(l)}</b>
        <span className="num">{l.neighborhood} · {headlinePrice(l)}</span>
      </span>
      <Icon name="chl" />
    </button>
  );
}

/** مشخصات ملک برای مشتری؛ بدون اطلاعات مالک. */
function InfoBody({ p }: { p: Listing }) {
  return (
    <>
      <span className="sh-kicker">
        <span className={`sh-deal ${p.deal}`}>{dealLabel[p.deal]}</span>
        <span className="rw" style={{ gap: 4 }}><Icon name="pin" size="s" />{p.neighborhood}</span>
      </span>
      <h1>{listingTitle(p)}</h1>
      <div className="sh-price">
        <b className="num">{headlinePrice(p)}{p.deal === 'sale' ? <small> تومان</small> : null}</b>
        <span>{secondaryPrice(p)}</span>
      </div>
      <dl className="sh-specs">
        <div><dt>متراژ</dt><dd className="num">{toFaDigits(p.area)} متر</dd></div>
        <div><dt>اتاق خواب</dt><dd className="num">{toFaDigits(p.bedrooms)}</dd></div>
        <div><dt>طبقه</dt><dd className="num">{floorLabel(p)}</dd></div>
        <div><dt>سال ساخت</dt><dd className="num">{p.yearBuilt ? toFaDigits(p.yearBuilt) : '—'}</dd></div>
      </dl>
      {p.features.length > 0 && (
        <ul className="sh-feat" aria-label="امکانات">
          {p.features.map((f) => <li key={f}><Icon name="check" size="s" />{f}</li>)}
        </ul>
      )}
      {p.description?.trim() && <p className="sh-desc">{p.description}</p>}
    </>
  );
}

/**
 * گالری کشیدنی گوشی (اسکرول با snap). با عوض شدن عکس از بیرون (ملک بعدی، دکمه‌ها)
 * همان‌جا می‌رود؛ وقتی خود کاربر کشیده، دوباره تنظیم نمی‌شود.
 * نوار چپ‌به‌راست است و عکس‌ها وارونه چیده می‌شوند (عکس اول همچنان سمت راست): scrollLeft در حالت راست‌به‌چپ
 * در مرورگرهای قدیمی گوشی علامت دیگری دارد و گالری را به هم می‌ریخت.
 */
function SwipeTrack({ photos, pi, listingId, alt, onPick, onTap, plain }: { photos: PhotoThumb[]; pi: number; listingId: string; alt: string; onPick: (k: number) => void; onTap?: () => void; plain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const fromSwipe = useRef(false);
  const shown = useRef<string | undefined>(undefined);
  const n = photos.length;
  // پیش از نقاشی، تا عکس اشتباه یک لحظه هم دیده نشود.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const same = shown.current === listingId;
    shown.current = listingId;
    if (fromSwipe.current && same) {
      fromSwipe.current = false;
      return;
    }
    el.scrollTo({ left: (n - 1 - pi) * el.clientWidth, behavior: same ? 'smooth' : 'auto' });
  }, [listingId, pi, n]);
  return (
    <div
      className={`shm-track${plain ? ' plain' : ''}`}
      dir="ltr"
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        const k = n - 1 - Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        if (k !== pi && k >= 0 && k < n) {
          fromSwipe.current = true;
          onPick(k);
        }
      }}
    >
      {photos.map((_, j) => {
        const k = n - 1 - j;
        const x = photos[k]!;
        return <Slide key={x.id} x={x} near={Math.abs(k - pi) <= 1} alt={`${alt}، عکس ${toFaDigits(k + 1)}`} onTap={onTap} />;
      })}
    </div>
  );
}

/** یک عکس گالری گوشی؛ نسخهٔ کامل فقط برای عکس جاری و دو همسایه‌اش بار می‌شود. */
function Slide({ x, near, alt, onTap }: { x: PhotoThumb; near: boolean; alt: string; onTap?: () => void }) {
  const thumb = photoUrl(x.id, 'thumb', x.thumb, x.mime);
  const full = useFullPhotoUrl(near ? x.id : undefined);
  return (
    <div className="shm-slide" onClick={onTap}>
      <img className="sh-bg" src={thumb} alt="" aria-hidden draggable={false} />
      <img className="sh-img" src={full ?? thumb} alt={alt} draggable={false} loading={near ? 'eager' : 'lazy'} />
    </div>
  );
}
