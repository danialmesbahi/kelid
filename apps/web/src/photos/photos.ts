import { useCallback, useEffect, useState } from 'react';
import { toFaDigits, type CoverThumbs, type KelidStore, type NewPhoto } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { coverThumbsQuery } from '../queries';
import { useToast } from '../layout/Toasts';
import { fetchFullPhoto } from '../sync/state';

type WorkerReply = { id: number; ok: true; mime: string; width: number; height: number; bytes: ArrayBuffer; thumb: ArrayBuffer } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: WorkerReply) => void>();

/** اگر Worker از کار بیفتد، همهٔ درخواست‌های منتظر رد می‌شوند تا بارگذاری گیر نکند؛ دفعهٔ بعد Worker تازه ساخته می‌شود. */
function failAll(error: string) {
  for (const [id, done] of pending) done({ id, ok: false, error });
  pending.clear();
  worker?.terminate();
  worker = null;
}

function resizeWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./resize.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
    worker.onerror = (e) => {
      e.preventDefault();
      failAll(e.message || 'resize worker failed');
    };
    worker.onmessageerror = () => failAll('resize worker message error');
  }
  return worker;
}

/** همان کار Worker روی رشتهٔ اصلی؛ فقط برای مرورگرهای قدیمی بدون OffscreenCanvas. */
async function resizeOnMainThread(file: Blob): Promise<NewPhoto> {
  const bitmap = await createImageBitmap(file);
  const encode = async (max: number, quality: number) => {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('encode failed');
    return { blob, w: canvas.width, h: canvas.height };
  };
  const full = await encode(1600, 0.8);
  const thumb = await encode(400, 0.72);
  bitmap.close();
  return { mime: full.blob.type, width: full.w, height: full.h, bytes: new Uint8Array(await full.blob.arrayBuffer()), thumb: new Uint8Array(await thumb.blob.arrayBuffer()) };
}

export function resizePhoto(file: Blob): Promise<NewPhoto> {
  if (typeof OffscreenCanvas === 'undefined') return resizeOnMainThread(file);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (r) => {
      if (r.ok) resolve({ mime: r.mime, width: r.width, height: r.height, bytes: new Uint8Array(r.bytes), thumb: new Uint8Array(r.thumb) });
      else reject(new Error(r.error));
    });
    resizeWorker().postMessage({ id, file });
  });
}

/**
 * آدرس موقت (blob:) برای نمایش عکس. بایت‌های هر عکس هیچ‌وقت عوض نمی‌شوند، پس آدرس با شناسهٔ عکس
 * نگه داشته می‌شود تا با هر تغییر داده تصویرها دوباره بارگذاری نشوند و چشمک نزنند.
 * عکس‌های کامل حجیم‌اند؛ فقط آخرین‌ها نگه داشته می‌شوند.
 */
const thumbUrls = new Map<string, string>();
const fullUrls = new Map<string, string>();
const FULL_KEEP = 40;
// تصویرهای کوچک سبک‌اند ولی با صدها فایل باز هم حافظه را پر می‌کنند.
const THUMB_KEEP = 400;

export function photoUrl(photoId: string, kind: 'thumb' | 'full', bytes: Uint8Array, mime: string): string {
  const cache = kind === 'thumb' ? thumbUrls : fullUrls;
  let url = cache.get(photoId);
  if (url) {
    // جدیدترین استفاده به ته صف می‌رود
    cache.delete(photoId);
  } else {
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  }
  cache.set(photoId, url);
  if (cache.size > (kind === 'thumb' ? THUMB_KEEP : FULL_KEEP)) {
    const [oldId, oldUrl] = cache.entries().next().value as [string, string];
    cache.delete(oldId);
    URL.revokeObjectURL(oldUrl);
  }
  return url;
}

/** آدرس‌های موقت عکس حذف‌شده آزاد می‌شوند؛ اگر برگردانده شود، دوباره ساخته می‌شوند. */
export function forgetPhotoUrls(photoId: string) {
  for (const cache of [thumbUrls, fullUrls]) {
    const url = cache.get(photoId);
    if (url) URL.revokeObjectURL(url);
    cache.delete(photoId);
  }
}

/**
 * آدرس عکس با کیفیت کامل. عمداً از useQuery استفاده نمی‌شود چون حافظهٔ آن هیچ‌وقت خالی نمی‌شود؛
 * اینجا فقط آدرس‌های اخیر نگه داشته می‌شوند.
 */
export function useFullPhotoUrl(photoId: string | undefined): string | undefined {
  const store = useStore();
  const [url, setUrl] = useState(() => (photoId ? fullUrls.get(photoId) : undefined));
  useEffect(() => {
    if (!photoId) {
      setUrl(undefined);
      return;
    }
    const hit = fullUrls.get(photoId);
    setUrl(hit);
    if (hit) return;
    let alive = true;
    void loadFull(store, photoId).then((u) => {
      if (alive && u) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [store, photoId]);
  return url;
}

/** عکس بعدی را از قبل آماده می‌کند تا ورق زدن مکث نداشته باشد. */
export function prefetchFullPhoto(store: KelidStore, photoId: string | undefined) {
  if (!photoId || fullUrls.has(photoId)) return;
  void loadFull(store, photoId);
}

/** از دیتابیس محلی؛ اگر فقط بندانگشتی از دستگاه دیگر رسیده، عکس کامل همان لحظه از سرور. */
async function loadFull(store: KelidStore, photoId: string): Promise<string | undefined> {
  const p = (await store.getPhoto(photoId)) ?? ((await fetchFullPhoto(photoId)) ? await store.getPhoto(photoId) : undefined);
  return p && photoUrl(photoId, 'full', p.bytes, p.mime);
}

/** تصویر کوچک کاور همهٔ فایل‌ها؛ برای فهرست‌ها و کارت‌ها. */
export function useCoverThumbs(): CoverThumbs {
  return useQuery(coverThumbsQuery.key, coverThumbsQuery.fn) ?? {};
}

export function coverUrl(thumbs: CoverThumbs, listingId: string): string | undefined {
  const t = thumbs[listingId];
  return t ? photoUrl(t.photoId, 'thumb', t.thumb, t.mime) : undefined;
}

const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name);

/**
 * افزودن عکس به یک فایل: کوچک کردن یکی‌یکی در Worker و ذخیرهٔ چندتایی،
 * تا با تعداد زیاد عکس هم رابط کاربری روان بماند و پیشرفت دیده شود.
 */
export function usePhotoUpload(listingId: string) {
  const store = useStore();
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const add = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input).filter(isImage);
      if (files.length === 0) {
        toast('فقط فایل عکس اضافه می‌شود');
        return;
      }
      setProgress({ done: 0, total: files.length });
      let batch: NewPhoto[] = [];
      let saved = 0;
      let failed = 0;
      // هر خطایی (حتی در ذخیره) نباید نوار پیشرفت را برای همیشه روی صفحه نگه دارد.
      try {
        for (const [i, file] of files.entries()) {
          try {
            batch.push(await resizePhoto(file));
          } catch {
            failed++;
          }
          if (batch.length === 4 || i === files.length - 1) {
            if (batch.length) await store.addPhotos(listingId, batch);
            saved += batch.length;
            batch = [];
          }
          setProgress({ done: i + 1, total: files.length });
        }
      } catch {
        toast('ذخیرهٔ عکس‌ها انجام نشد؛ دوباره امتحان کنید');
      } finally {
        setProgress(null);
      }
      if (saved) toast(`${toFaDigits(saved)} عکس اضافه شد`);
      if (failed) toast(`${toFaDigits(failed)} عکس خوانده نشد؛ قالب JPG یا PNG را امتحان کنید`);
    },
    [store, toast, listingId],
  );

  return { add, progress };
}
