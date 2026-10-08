import { randomBytes } from 'node:crypto';
import { withOffice, type Db, type Pool } from '../db';
import type { S3 } from './s3';

export type PhotoPart = 'full' | 'thumb';
export type ImageMime = 'image/webp' | 'image/jpeg' | 'image/png';

/** نوع تصویر از چند بایت اولش؛ هر چیز دیگری null. */
export function sniffImage(b: Buffer): ImageMime | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export interface StoredRef {
  mime: string;
  /** بایت‌ها وقتی در خود دیتابیس‌اند. */
  bytes: Buffer | null;
  /** کلید شیء در S3 وقتی آنجاست. */
  key: string | null;
}

export interface NewPhoto {
  mime: ImageMime;
  bytes: Buffer;
  thumb: Buffer;
  thumbMime: ImageMime;
}

/**
 * بایت عکس‌ها: با S3 در فضای ذخیره‌سازی، بی آن (توسعه و تست) در خود دیتابیس. مشخصات همیشه در photo_blobs پشت RLS است،
 * پس هیچ دستگاهی بی ردیفِ دفتر خودش به شیء S3 نمی‌رسد؛ کلید شیء هم با شناسهٔ دفتر توکن ساخته می‌شود، نه با ورودی کاربر.
 */
export class PhotoBlobs {
  constructor(private readonly s3: S3 | null) {}

  get where(): 'db' | 's3' {
    return this.s3 ? 's3' : 'db';
  }

  /**
   * عکس یک بار نوشته می‌شود و دیگر عوض نمی‌شود. بالا رفتن به S3 بیرون از تراکنش است تا کندی S3 اتصال‌های دیتابیس را
   * نگیرد؛ هر بار کلید یکتای خودش را دارد، پس ارسال هم‌زمان یا تکراری هیچ‌وقت عکس ثبت‌شده را بازنویسی نمی‌کند.
   * created وقتی عکس تازه ثبت شد و در همان تراکنش صدا زده می‌شود. true یعنی تازه بود.
   */
  async put(pool: Pool, office: string, id: string, p: NewPhoto, created: (db: Db) => Promise<void>): Promise<boolean> {
    const exists = (db: Db) => db.query('select 1 from photo_blobs where id = $1', [id]).then((r) => !!r.rowCount);
    const insert = (key: string | null) =>
      withOffice(pool, office, async (db) => {
        const r = await db.query(
          `insert into photo_blobs (id, mime, bytes, thumb, stored, object_key, size, thumb_mime) values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (office_id, id) do nothing`,
          [id, p.mime, key ? null : p.bytes, key ? null : p.thumb, this.where, key, p.bytes.length, p.thumbMime],
        );
        if (r.rowCount) await created(db);
        return !!r.rowCount;
      });
    const s3 = this.s3;
    if (!s3) return insert(null);
    // دستگاه‌ها بعد از هر قطعی دوباره می‌فرستند؛ عکسی که هست دوباره بالا نمی‌رود.
    if (await withOffice(pool, office, exists)) return false;
    const key = `${office}/${id}/${randomBytes(16).toString('hex')}`;
    await s3.put(`${key}/thumb`, p.thumb, p.thumbMime);
    await s3.put(`${key}/full`, p.bytes, p.mime);
    return insert(key);
  }

  /** مشخصات (و اگر در دیتابیس است، خود بایت‌ها)؛ داخل withOffice صدا زده می‌شود. */
  async ref(db: Db, id: string, part: PhotoPart): Promise<StoredRef | null> {
    const { rows } = await db.query<{ mime: string; thumb_mime: string | null; object_key: string | null; data: Buffer | null }>(
      `select mime, thumb_mime, object_key, case when $2 = 'full' then bytes else thumb end as data from photo_blobs where id = $1`,
      [id, part],
    );
    const r = rows[0];
    if (!r) return null;
    const mime = part === 'full' ? r.mime : (r.thumb_mime ?? (r.data && sniffImage(r.data)) ?? r.mime);
    return { mime, bytes: r.data, key: r.object_key && `${r.object_key}/${part}` };
  }

  /** بایت‌ها بیرون از تراکنش دیتابیس خوانده می‌شوند تا اتصال دیتابیس منتظر شبکه نماند. */
  async bytes(ref: StoredRef): Promise<Buffer | null> {
    if (!ref.key) return ref.bytes;
    if (!this.s3) throw new Error('photo is in S3 but S3 is not configured');
    return this.s3.get(ref.key);
  }
}
