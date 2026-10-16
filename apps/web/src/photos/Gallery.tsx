import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { Cover, Icon } from '@kelid/ui';
import { toFaDigits, type Listing, type PhotoThumb } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { coverUrl, forgetPhotoUrls, photoUrl, prefetchFullPhoto, useCoverThumbs, useFullPhotoUrl, usePhotoUpload } from './photos';

const thumbSrc = (p: PhotoThumb) => photoUrl(p.id, 'thumb', p.thumb, p.mime);
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

/** گالری عکس پروندهٔ فایل: نمایش، افزودن (انتخاب، کشیدن، دوربین گوشی)، مرتب‌سازی و حذف. */
export function PhotoGallery({ listing }: { listing: Listing }) {
  const photos = useQuery(`photos:${listing.id}`, (s) => s.listPhotos(listing.id));
  const { add, progress } = usePhotoUpload(listing.id);
  const [managing, setManaging] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches);

  const list = photos ?? [];
  const onFiles = (files: FileList | null) => {
    if (files?.length) void add(files);
  };

  return (
    <section
      aria-labelledby="ph"
      className="col"
      style={{ gap: 12 }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDropping(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="rw" style={{ gap: 10, flexWrap: 'wrap' }}>
        <h2 id="ph" className="t2">عکس‌ها</h2>
        {list.length > 0 && <span className="xs mute num">{toFaDigits(list.length)} عکس</span>}
        <span className="sp" />
        {progress && (
          <span className="rw xs mute" role="status" style={{ gap: 10, minWidth: 180 }}>
            آماده‌سازی {toFaDigits(progress.done)} از {toFaDigits(progress.total)}
            <span className="bar sp"><span style={{ width: `${(progress.done / progress.total) * 100}%`, transition: 'width .2s ease' }} /></span>
          </span>
        )}
        {list.length > 1 && (
          <button type="button" className="btn btn-g" aria-pressed={managing} onClick={() => setManaging((m) => !m)}>
            <Icon name={managing ? 'check' : 'edit'} size="s" />
            {managing ? 'تمام' : 'مرتب‌سازی'}
          </button>
        )}
        {touch && (
          <button type="button" className="btn btn-s" onClick={() => camRef.current?.click()}>
            <Icon name="cam" size="s" />
            گرفتن عکس
          </button>
        )}
        <button type="button" className="btn btn-s" onClick={() => pickRef.current?.click()}>
          <Icon name="up" size="s" />
          افزودن عکس
        </button>
        <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div style={{ position: 'relative', borderRadius: 18, outline: dropping ? '2px dashed var(--pri-text)' : 'none', outlineOffset: 4, transition: 'outline-color .15s' }}>
        {managing && list.length > 0 ? (
          <PhotoManager listing={listing} photos={list} />
        ) : (
          <PhotoGrid listing={listing} photos={list} loaded={photos !== undefined} onOpen={setViewing} onPick={() => pickRef.current?.click()} />
        )}
        {dropping && (
          <span className="col" style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'color-mix(in srgb, var(--paper) 82%, transparent)', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            <Icon name="up" size="l" className="lnk" />
            <span className="b">رها کنید تا عکس‌ها اضافه شوند</span>
          </span>
        )}
      </div>

      {viewing !== null && list.length > 0 && <Lightbox photos={list} start={Math.min(viewing, list.length - 1)} onClose={() => setViewing(null)} />}
    </section>
  );
}

function PhotoGrid({ listing, photos, loaded, onOpen, onPick }: { listing: Listing; photos: PhotoThumb[]; loaded: boolean; onOpen: (i: number) => void; onPick: () => void }) {
  const thumbs = useCoverThumbs();
  const first = photos[0];

  if (!first) {
    // هنوز عکسی نیست: تصویرسازی و دعوت به افزودن عکس.
    // تا فهرست عکس‌ها برسد، کاور کوچکِ آماده نشان داده می‌شود تا عکسِ در حال پرواز جای خالی نبیند.
    return (
      <div className="pgal-empty vt-cover" style={{ viewTransitionName: `cover-${listing.id}` }}>
        <Cover variant={listing.cover} src={loaded ? undefined : coverUrl(thumbs, listing.id)} style={{ height: '100%' }} />
        {loaded && (
          <button type="button" onClick={onPick} className="col" style={{ position: 'absolute', inset: 0, border: 0, background: 'color-mix(in srgb, var(--deep) 58%, transparent)', color: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: 16 }}>
            <Icon name="cam" size="l" />
            <span className="b" style={{ fontSize: 17 }}>هنوز عکسی نیست</span>
            <span className="sm" style={{ opacity: 0.85 }}>عکس‌ها را اینجا بکشید یا برای انتخاب بزنید</span>
          </button>
        )}
      </div>
    );
  }

  return <PhotoStage listing={listing} photos={photos} onOpen={onOpen} />;
}

/**
 * عکس کامل و بی‌برش، روی نسخهٔ محو خودش (مثل حالت نمایش به مشتری). ورق زدن: کشیدن انگشت، فلش‌ها
 * یا بندانگشتی‌های پایین؛ زدن روی عکس، نمایش تمام‌صفحه. نسخهٔ کامل فقط برای عکس جاری و بعدی بارگذاری می‌شود.
 */
function PhotoStage({ listing, photos, onOpen }: { listing: Listing; photos: PhotoThumb[]; onOpen: (i: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [at, setAt] = useState(0);
  const [reach, setReach] = useState(1);
  const n = photos.length;
  const cur = Math.min(at, n - 1);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const strip = stripRef.current;
    const th = strip?.children[cur] as HTMLElement | undefined;
    // فقط نوار بندانگشتی اسکرول می‌خورد، نه خود صفحه
    if (th && strip) strip.scrollTo({ left: th.offsetLeft - (strip.clientWidth - th.offsetWidth) / 2, behavior: 'smooth' });
  }, [cur]);

  const go = (k: number) => {
    const el = trackRef.current;
    if (!el) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // راست‌به‌چپ: جلو رفتن یعنی scrollLeft منفی‌تر
    el.scrollTo({ left: -((k + n) % n) * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
  };

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      if (!el || !el.clientWidth) return;
      const k = Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
      setAt(k);
      setReach((r) => Math.max(r, k + 1));
    });
  };

  return (
    <div className="pstage-wrap">
      <div className="pstage">
        <div ref={trackRef} className="pstage-track" onScroll={onScroll}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={i === 0 ? 'pstage-slide vt-cover' : 'pstage-slide'}
              onClick={() => onOpen(i)}
              aria-label={`نمایش بزرگ عکس ${toFaDigits(i + 1)} از ${toFaDigits(n)}`}
              style={i === 0 ? { viewTransitionName: `cover-${listing.id}` } : undefined}
            >
              <StagePhoto photo={p} load={i <= reach} />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="pstage-nav pstage-prev" aria-label="عکس قبلی" onClick={() => go(cur - 1)}><Icon name="chr" /></button>
            <button type="button" className="pstage-nav pstage-next" aria-label="عکس بعدی" onClick={() => go(cur + 1)}><Icon name="chl" /></button>
            <span className="pstage-count num" aria-hidden="true">{toFaDigits(cur + 1)} / {toFaDigits(n)}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div ref={stripRef} className="pstage-strip" aria-label="عکس‌های فایل">
          {photos.map((p, i) => (
            <button key={p.id} type="button" className="pstage-th" aria-current={i === cur} aria-label={`عکس ${toFaDigits(i + 1)}`} onClick={() => go(i)}>
              <img src={thumbSrc(p)} alt="" draggable={false} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** پس‌زمینهٔ محو + عکس کامل بی‌برش؛ بندانگشتی تا رسیدن نسخهٔ کامل جای آن را نگه می‌دارد. */
function StagePhoto({ photo, load }: { photo: PhotoThumb; load: boolean }) {
  const full = useFullPhotoUrl(load ? photo.id : undefined);
  const [ready, setReady] = useState<string>();
  const sharp = !!full && ready === full;
  const thumb = thumbSrc(photo);
  return (
    <>
      <img className="pstage-bg" src={thumb} alt="" draggable={false} />
      <img className="pstage-img" src={thumb} alt="" draggable={false} style={{ opacity: sharp ? 0 : 1 }} />
      {full && <img className="pstage-img" src={full} alt="" draggable={false} decoding="async" onLoad={() => setReady(full)} style={{ opacity: sharp ? 1 : 0 }} />}
    </>
  );
}

/**
 * برای سطح‌های بزرگ: داخل یک Cover که تصویر کوچک را نشان می‌دهد قرار می‌گیرد
 * و وقتی نسخهٔ کامل بارگذاری و آماده شد، نرم روی آن ظاهر می‌شود (بدون چشمک و نیمه‌کاره دیده شدن).
 */
export function FullPhotoLayer({ photoId }: { photoId: string | undefined }) {
  const full = useFullPhotoUrl(photoId);
  const [ready, setReady] = useState<string>();
  if (!full) return null;
  return <img className="photo" src={full} alt="" draggable={false} decoding="async" onLoad={() => setReady(full)} style={{ opacity: ready === full ? 1 : 0, transition: 'opacity .25s ease' }} />;
}

function PhotoManager({ listing, photos }: { listing: Listing; photos: PhotoThumb[] }) {
  const store = useStore();
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const ids = photos.map((p) => p.id);

  const moveTo = (id: string, to: number) => {
    const next = ids.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    void store.reorderPhotos(listing.id, next);
  };

  return (
    <ol className="pgrid" aria-label="ترتیب عکس‌ها؛ عکس اول کاور فایل است">
      {photos.map((p, i) => (
        <li
          key={p.id}
          draggable
          onDragStart={(e) => {
            setDragId(p.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => {
            if (dragId && dragId !== p.id) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragId) moveTo(dragId, i);
            setDragId(null);
          }}
          className="col card"
          style={{ gap: 8, padding: 8, opacity: dragId === p.id ? 0.4 : 1, cursor: 'grab' }}
        >
          <Cover variant={listing.cover} src={thumbSrc(p)} style={{ height: 110, borderRadius: 10 }}>
            {i === 0 && <span className="tag ok tagon" style={{ height: 24 }}>کاور</span>}
            <button
              type="button"
              className="ib"
              aria-label="حذف عکس"
              style={{ position: 'absolute', top: 6, left: 6, width: 32, height: 32, borderRadius: 9, border: 0, background: 'rgba(18,20,18,.62)', color: '#FFFFFF' }}
              onClick={async () => {
                await store.deletePhoto(p.id);
                forgetPhotoUrls(p.id);
                toast('عکس حذف شد', { label: 'برگرداندن', run: () => void store.restorePhoto(p.id) });
              }}
            >
              <Icon name="x" size="s" />
            </button>
          </Cover>
          <div className="rw" style={{ gap: 2 }}>
            <button type="button" className="ib ghost" aria-label="جابه‌جایی به قبل" disabled={i === 0} onClick={() => moveTo(p.id, i - 1)} style={{ width: 34, height: 34, opacity: i === 0 ? 0.35 : 1 }}><Icon name="chr" size="s" /></button>
            <button type="button" className="ib ghost" aria-label="جابه‌جایی به بعد" disabled={i === photos.length - 1} onClick={() => moveTo(p.id, i + 1)} style={{ width: 34, height: 34, opacity: i === photos.length - 1 ? 0.35 : 1 }}><Icon name="chl" size="s" /></button>
            <span className="sp" />
            {i > 0 && <button type="button" className="btn btn-g" onClick={() => moveTo(p.id, 0)} style={{ height: 34, padding: '0 8px', fontSize: 13 }}>کاور شود</button>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * نمایش تمام‌صفحهٔ عکس‌ها. گوشی: با کشیدن انگشت ورق می‌خورد؛ کامپیوتر: دکمه‌ها و ←/→. Esc می‌بندد.
 * فقط عکس جاری و دو همسایه‌اش با کیفیت کامل بارگذاری می‌شوند.
 */
function Lightbox({ photos, start, onClose }: { photos: PhotoThumb[]; start: number; onClose: () => void }) {
  const store = useStore();
  const [i, setI] = useState(start);
  const [seen, setSeen] = useState(() => new Set([start]));
  const closeRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const n = photos.length;
  const idx = Math.min(i, n - 1);

  const slideAt = (k: number) => trackRef.current?.children[k] as HTMLElement | undefined;
  const go = (k: number) => {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    slideAt((k + n) % n)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', inline: 'center', block: 'nearest' });
  };

  useLayoutEffect(() => {
    slideAt(start)?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
    // فقط بار اول؛ بعد از آن جای عکس با اسکرول خود کاربر عوض می‌شود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame.current);
      prev?.focus();
    };
  }, []);

  useEffect(() => {
    prefetchFullPhoto(store, photos[(idx + 1) % n]?.id);
    prefetchFullPhoto(store, photos[(idx - 1 + n) % n]?.id);
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [store, photos, idx, n]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      if (!el || !el.clientWidth) return;
      const k = Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
      setI(k);
      setSeen((s) => (s.has(k) ? s : new Set(s).add(k)));
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(idx + 1);
      else if (e.key === 'ArrowRight') go(idx - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="عکس‌های فایل" className="overlay lb">
      <div className="lb-top">
        <span className="num sm" style={{ opacity: 0.8 }}>{toFaDigits(idx + 1)} از {toFaDigits(n)}</span>
        <span className="sp" />
        <button ref={closeRef} type="button" onClick={onClose} className="lb-close">
          <Icon name="x" size="s" />
          بستن
        </button>
      </div>
      <div className="lb-stage">
        <div ref={trackRef} className="lb-track" onScroll={onScroll}>
          {photos.map((p, k) => (
            <div key={p.id} className="lb-slide" onClick={(e) => e.target === e.currentTarget && onClose()}>
              <LightboxPhoto photo={p} load={Math.abs(k - idx) <= 1 || seen.has(k)} alt={`عکس ${toFaDigits(k + 1)} از ${toFaDigits(n)}`} />
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="lb-nav lb-prev" aria-label="عکس قبلی" onClick={() => go(idx - 1)}><Icon name="chr" size="l" /></button>
            <button type="button" className="lb-nav lb-next" aria-label="عکس بعدی" onClick={() => go(idx + 1)}><Icon name="chl" size="l" /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <div ref={stripRef} className="lb-strip" aria-label="همهٔ عکس‌ها">
          {photos.map((p, k) => (
            <button key={p.id} type="button" className="lb-th" aria-current={k === idx} aria-label={`عکس ${toFaDigits(k + 1)}`} onClick={() => go(k)}>
              <img src={thumbSrc(p)} alt="" draggable={false} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** بندانگشتیِ محو تا نسخهٔ کامل برسد؛ بعد فقط عکس واضح می‌ماند (بی هالهٔ محو دورش). */
function LightboxPhoto({ photo, load, alt }: { photo: PhotoThumb; load: boolean; alt: string }) {
  const full = useFullPhotoUrl(load ? photo.id : undefined);
  const [ready, setReady] = useState<string>();
  const sharp = !!full && ready === full;
  return (
    <>
      <img className="lb-img lb-thumb" src={thumbSrc(photo)} alt="" draggable={false} style={{ opacity: sharp ? 0 : 1 }} />
      {full && <img className="lb-img" src={full} alt={alt} draggable={false} decoding="async" onLoad={() => setReady(full)} style={{ opacity: sharp ? 1 : 0 }} />}
    </>
  );
}
