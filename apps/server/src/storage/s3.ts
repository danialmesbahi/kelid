import { createHash, createHmac } from 'node:crypto';

/**
 * کمترین کلاینت S3 که لازم داریم (PUT و GET یک شیء) با امضای AWS SigV4، بدون SDK سنگین.
 * با فضای ذخیره‌سازی ابری آروان، لیارا و MinIO کار می‌کند (آدرس path-style: endpoint/bucket/key).
 */
export interface S3Config {
  /** مثلاً https://s3.ir-thr-at1.arvanstorage.ir */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const sha256hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest();

/** کدگذاری RFC 3986 که امضای S3 می‌خواهد (encodeURIComponent چند نویسه را باز می‌گذارد). */
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export interface SignInput {
  method: string;
  /** مسیر خام، با / اول؛ هر تکه جدا کدگذاری می‌شود. */
  path: string;
  host: string;
  headers: Record<string, string>;
  payloadHash: string;
  /** YYYYMMDD'T'HHMMSS'Z' */
  amzDate: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** سرآیند Authorization نسخهٔ ۴ امضای AWS. host و هر سرآیند دیگری که داده شود امضا می‌شود. */
export function signV4(i: SignInput): string {
  const all: Record<string, string> = { host: i.host };
  for (const [k, v] of Object.entries(i.headers)) all[k.toLowerCase()] = v.trim().replace(/\s+/g, ' ');
  const names = Object.keys(all).sort();
  const canonical = [
    i.method,
    i.path.split('/').map(rfc3986).join('/'),
    '',
    names.map((n) => `${n}:${all[n]}\n`).join(''),
    names.join(';'),
    i.payloadHash,
  ].join('\n');
  const day = i.amzDate.slice(0, 8);
  const scope = `${day}/${i.region}/${i.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', i.amzDate, scope, sha256hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secretAccessKey}`, day), i.region), i.service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${i.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
}

export class S3 {
  private readonly base: URL;
  constructor(
    private readonly cfg: S3Config,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.base = new URL(cfg.endpoint);
  }

  private async send(method: 'PUT' | 'GET', key: string, body?: Buffer, contentType?: string): Promise<Response> {
    const path = `${this.base.pathname.replace(/\/+$/, '')}/${this.cfg.bucket}/${key}`;
    const amzDate = this.now().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const payloadHash = sha256hex(body ?? '');
    const headers: Record<string, string> = { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    if (contentType) headers['content-type'] = contentType;
    const authorization = signV4({
      method,
      path,
      host: this.base.host,
      headers,
      payloadHash,
      amzDate,
      region: this.cfg.region,
      service: 's3',
      accessKeyId: this.cfg.accessKeyId,
      secretAccessKey: this.cfg.secretAccessKey,
    });
    const url = `${this.base.origin}${path.split('/').map(rfc3986).join('/')}`;
    return fetch(url, { method, headers: { ...headers, authorization }, body: body ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(30_000) });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.send('PUT', key, body, contentType);
    // متن خطای S3 ممکن است جزئیات حساب داشته باشد؛ فقط کد وضعیت به لاگ می‌رود.
    if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`);
    await res.arrayBuffer();
  }

  /** null یعنی چنین شیئی نیست. */
  async get(key: string): Promise<Buffer | null> {
    const res = await this.send('GET', key);
    if (res.status === 404) {
      await res.arrayBuffer();
      return null;
    }
    if (!res.ok) throw new Error(`S3 GET failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
