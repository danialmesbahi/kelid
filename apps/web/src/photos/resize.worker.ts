/// <reference lib="webworker" />

/**
 * کوچک کردن عکس در Worker تا رابط کاربری حتی با ۲۰ عکس هم روان بماند.
 * عکس اصلی: ضلع بلند ۱۶۰۰ پیکسل (حدود ۲۰۰ کیلوبایت)؛ تصویر کوچک برای فهرست‌ها.
 */
const FULL = 1600;
const THUMB = 400;
const TARGET_BYTES = 320_000;

async function encode(bitmap: ImageBitmap, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  // سافاری WebP نمی‌سازد و بی‌صدا PNG برمی‌گرداند؛ آنجا JPEG بهتر است.
  if (blob.type !== 'image/webp') blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, w, h };
}

self.onmessage = async (e: MessageEvent<{ id: number; file: Blob }>) => {
  const { id, file } = e.data;
  try {
    // جهت عکس (EXIF) را خود مرورگر اعمال می‌کند.
    const bitmap = await createImageBitmap(file);
    let full = await encode(bitmap, FULL, 0.82);
    if (full.blob.size > TARGET_BYTES) full = await encode(bitmap, FULL, 0.68);
    const thumb = await encode(bitmap, THUMB, 0.72);
    bitmap.close();
    const bytes = await full.blob.arrayBuffer();
    const thumbBytes = await thumb.blob.arrayBuffer();
    self.postMessage({ id, ok: true, mime: full.blob.type, width: full.w, height: full.h, bytes, thumb: thumbBytes }, [bytes, thumbBytes]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
