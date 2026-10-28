import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { Db } from '../db';
import type { S3 } from '../storage/s3';
import { sniffImage } from '../storage/photos';

// پیوست تیکت: هر پیام تا سه فایل که روی هم تا ۵ مگابایت باشند. نوع فایل را سرور از خود بایت‌ها می‌فهمد، نه از نام یا حرف دستگاه.
// مگابایت دهدهی، همان که دستگاه‌ها نشان می‌دهند.
export const FILE_MAX = 5_000_000;
export const FILES_MAX = 3;
const NAME_MAX = 120;
/** جای base64 (یک‌سوم بیشتر) و خود JSON پیام. */
export const FILES_BODY_LIMIT = Math.ceil((FILE_MAX * 4) / 3) + 64 * 1024;

export const filesSchema = {
  type: 'array',
  maxItems: FILES_MAX,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'data'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      data: { type: 'string', minLength: 1, maxLength: Math.ceil((FILE_MAX * 4) / 3) + 4 },
    },
  },
} as const;

export interface FileIn {
  name: string;
  data: string;
}

export interface ParsedFile {
  name: string;
  mime: string;
  bytes: Buffer;
}

const ZIP_KINDS: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** نام بی مسیر و بی نویسهٔ کنترلی؛ نام خالی «پیوست» می‌شود. */
function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex -- نویسه‌های کنترلی عمداً پاک می‌شوند
  const base = raw.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (!base) return 'پیوست';
  if (base.length <= NAME_MAX) return base;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : '';
  return base.slice(0, NAME_MAX - ext.length) + ext;
}

/** نوع واقعی فایل: عکس، PDF، Word/Excel، یا متن ساده. هر چیز دیگری null. */
export function sniffFile(b: Buffer, name: string): string | null {
  const image = sniffImage(b);
  if (image) return image;
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return ZIP_KINDS[ext] ?? null;
  if (ext === 'txt' && !b.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b);
      return 'text/plain; charset=utf-8';
    } catch {
      return null;
    }
  }
  return null;
}

/** پیوست‌های درخواست؛ رشته یعنی کد خطا. */
export function parseFiles(input: FileIn[] | undefined): ParsedFile[] | 'bad_file' | 'too_big' {
  const out: ParsedFile[] = [];
  let total = 0;
  for (const f of input ?? []) {
    const bytes = Buffer.from(f.data, 'base64');
    if (!bytes.length) return 'bad_file';
    total += bytes.length;
    if (total > FILE_MAX) return 'too_big';
    const name = cleanName(f.name);
    const mime = sniffFile(bytes, name);
    if (!mime) return 'bad_file';
    out.push({ name, mime, bytes });
  }
  return out;
}

export interface FileMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
}

interface Stored {
  name: string;
  mime: string;
  size: number;
  bytes: Buffer | null;
  key: string | null;
}

/**
 * بایت پیوست‌ها: مثل عکس فایل‌ها، با S3 در فضای ذخیره‌سازی و بی آن در خود دیتابیس. مشخصات همیشه در support_files پشت RLS است.
 * بالا رفتن به S3 پیش از تراکنش است تا کندی S3 اتصال دیتابیس را نگیرد؛ کلید را سرور می‌سازد، نه ورودی کاربر.
 */
export class SupportFiles {
  constructor(private readonly s3: S3 | null) {}

  async upload(office: string, files: ParsedFile[]): Promise<Array<ParsedFile & { id: string; key: string | null }>> {
    const out = [];
    for (const f of files) {
      const id = randomUUID();
      let key: string | null = null;
      if (this.s3) {
        key = `support/${office}/${id}/${randomBytes(16).toString('hex')}`;
        await this.s3.put(key, f.bytes, f.mime);
      }
      out.push({ ...f, id, key });
    }
    return out;
  }

  /** داخل همان تراکنشی که پیام را می‌نویسد. */
  async insert(db: Db, office: string, ticket: string, message: string, files: Array<ParsedFile & { id: string; key: string | null }>) {
    for (const f of files) {
      await db.query(
        `insert into support_files (office_id, id, ticket_id, message_id, name, mime, size, bytes, object_key) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [office, f.id, ticket, message, f.name, f.mime, f.bytes.length, f.key ? null : f.bytes, f.key],
      );
    }
  }

  /** پیوست‌های یک تیکت، دسته‌شده بر اساس پیام. */
  async ofTicket(db: Db, office: string, ticket: string): Promise<Map<string, FileMeta[]>> {
    const { rows } = await db.query<{ id: string; message_id: string; name: string; mime: string; size: number }>(
      'select id, message_id, name, mime, size from support_files where office_id = $1 and ticket_id = $2 order by created_at, name',
      [office, ticket],
    );
    const by = new Map<string, FileMeta[]>();
    for (const r of rows) {
      const list = by.get(r.message_id) ?? [];
      list.push({ id: r.id, name: r.name, mime: r.mime, size: r.size });
      by.set(r.message_id, list);
    }
    return by;
  }

  async find(db: Db, office: string, ticket: string, id: string): Promise<Stored | null> {
    const { rows } = await db.query<{ name: string; mime: string; size: number; bytes: Buffer | null; object_key: string | null }>(
      'select name, mime, size, bytes, object_key from support_files where office_id = $1 and ticket_id = $2 and id = $3',
      [office, ticket, id],
    );
    const r = rows[0];
    return r ? { name: r.name, mime: r.mime, size: r.size, bytes: r.bytes, key: r.object_key } : null;
  }

  /** همیشه دانلود، هرگز باز شدن در خود صفحه؛ nosniff را سربرگ‌های امنیتی سرور می‌گذارند. */
  async send(reply: FastifyReply, f: Stored | null) {
    const bytes = f && (f.bytes ?? (f.key && this.s3 ? await this.s3.get(f.key) : null));
    if (!f || !bytes) return reply.status(404).send({ error: 'not_found' });
    const ascii = f.name.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '_');
    return reply
      .header('content-type', f.mime)
      .header('content-disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`)
      .send(bytes);
  }
}
