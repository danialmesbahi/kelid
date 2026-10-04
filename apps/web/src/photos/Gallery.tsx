import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Cover, Icon } from '@kelid/ui';
import { toFaDigits, type Listing, type PhotoThumb } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { photoUrl, prefetchFullPhoto, useFullPhotoUrl, usePhotoUpload } from './photos';

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
  const [first, ...rest] = photos;
  const small = rest.slice(0, 4);
  const more = photos.length - 5;

  if (!first) {
    // هنوز عکسی نیست: همان چیدمان با تصویرسازی، و دعوت به افزودن عکس
    return (
      <div className="gallery">
        <span className="hero" style={{ viewTransitionName: `cover-${listing.id}` }}>
          <Cover variant={listing.cover} style={{ height: '100%' }} />
        </span>
        {(['i', 'j', 'g', 'i'] as const).map((v, i) => <Cover key={i} variant={v} style={{ borderRadius: 14 }} />)}
        {loaded && (
          <button type="button" onClick={onPick} className="col" style={{ position: 'absolute', inset: 0, border: 0, borderRadius: 18, background: 'color-mix(in srgb, var(--deep) 58%, transparent)', color: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: 16 }}>
            <Icon name="cam" size="l" />
            <span className="b" style={{ fontSize: 17 }}>هنوز عکسی نیست</span>
            <span className="sm" style={{ opacity: 0.85 }}>عکس‌ها را اینجا بکشید یا برای انتخاب بزنید</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="gallery">
      <button type="button" className="hero" onClick={() => onOpen(0)} aria-label="نمایش عکس‌ها" style={{ viewTransitionName: `cover-${listing.id}` }}>
        <Cover variant={listing.cover} src={thumbSrc(first)} style={{ height: '100%' }}>
          <FullPhotoLayer photoId={first.id} />
        </Cover>
      </button>
      {small.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(i + 1)} aria-label={`عکس ${toFaDigits(i + 2)}`} style={{ padding: 0, border: 0, borderRadius: 14, overflow: 'hidden' }}>
          <Cover variant={listing.cover} src={thumbSrc(p)} style={{ height: '100%' }}>
            {i === 3 && more > 0 && (
              <span className="col" style={{ position: 'absolute', inset: 0, background: 'rgba(12,13,12,.55)', color: '#FFFFFF', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                همهٔ {toFaDigits(photos.length)} عکس
              </span>
            )}
          </Cover>
        </button>
      ))}
    </div>
  );
}

/**
 * برای سطح‌های بزرگ: داخل یک Cover که تصویر کوچک را نشان می‌دهد قرار می‌گیرد
 * و وقتی نسخهٔ کامل آماده شد روی آن می‌نشیند.
 */
export function FullPhotoLayer({ photoId }: { photoId: string | undefined }) {
  const full = useFullPhotoUrl(photoId);
  if (!full) return null;
  return <img className="photo fade" src={full} alt="" draggable={false} />;
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

/** نمایش تمام‌صفحهٔ عکس‌ها؛ ←/→ ورق می‌زند و Esc می‌بندد. */
function Lightbox({ photos, start, onClose }: { photos: PhotoThumb[]; start: number; onClose: () => void }) {
  const store = useStore();
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = photos.length;
  const idx = Math.min(i, n - 1);
  const p = photos[idx];
  const full = useFullPhotoUrl(p?.id);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus();
  }, []);

  useEffect(() => {
    prefetchFullPhoto(store, photos[(idx + 1) % n]?.id);
  }, [store, photos, idx, n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setI((x) => (x + 1) % n);
      else if (e.key === 'ArrowRight') setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, onClose]);

  if (!p) return null;
  const navBtn = { width: 52, height: 52, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(18,20,18,.55)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;

  return (
    <div role="dialog" aria-modal="true" aria-label="عکس‌های فایل" className="overlay col" style={{ background: 'rgba(10,11,10,.97)', alignItems: 'stretch', justifyContent: 'stretch' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rw" style={{ gap: 12, padding: '14px 18px', color: '#FFFFFF' }}>
        <span className="num sm" style={{ opacity: 0.8 }}>{toFaDigits(idx + 1)} از {toFaDigits(n)}</span>
        <span className="sp" />
        <button ref={closeRef} type="button" onClick={onClose} className="rw sb sm" style={{ gap: 8, height: 44, padding: '0 16px', borderRadius: 12, background: 'rgba(18,20,18,.55)', border: '1px solid rgba(255,255,255,.14)', color: '#FFFFFF' }}>
          <Icon name="x" size="s" />
          بستن
        </button>
      </div>
      <div className="rw" style={{ flex: 1, minHeight: 0, gap: 12, padding: '0 14px 20px' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {n > 1 && <button type="button" aria-label="عکس قبلی" onClick={() => setI((idx - 1 + n) % n)} style={navBtn}><Icon name="chr" size="l" /></button>}
        <span className="sp" style={{ height: '100%', position: 'relative' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <img key={p.id} src={full ?? thumbSrc(p)} alt="" className="fade" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', filter: full ? 'none' : 'blur(6px)' }} />
        </span>
        {n > 1 && <button type="button" aria-label="عکس بعدی" onClick={() => setI((idx + 1) % n)} style={navBtn}><Icon name="chl" size="l" /></button>}
      </div>
    </div>
  );
}
