/**
 * ساعت منطقی ترکیبی (HLC): زمان دیوار + شمارنده + شناسهٔ دستگاه، به شکل رشته‌ای که مرتب‌سازی حرفی‌اش همان ترتیب زمانی است.
 * اگر دستگاهی تغییری با زمان جلوتر ببیند، تغییرهای بعدی خودش حتماً بعد از آن حساب می‌شوند؛ حتی اگر ساعتش عقب باشد.
 */
const WALL = 10; // رقم مبنای ۳۶؛ تا سال ۵۰۰۰ کافی است
const COUNT = 5;

export interface HlcParts {
  wall: number;
  count: number;
  node: string;
}

export function encodeHlc({ wall, count, node }: HlcParts): string {
  return `${wall.toString(36).padStart(WALL, '0')}-${count.toString(36).padStart(COUNT, '0')}-${node}`;
}

export function decodeHlc(h: string): HlcParts | null {
  const m = /^([0-9a-z]{10})-([0-9a-z]{5})-([0-9a-z]{1,16})$/.exec(h);
  if (!m) return null;
  return { wall: parseInt(m[1]!, 36), count: parseInt(m[2]!, 36), node: m[3]! };
}

export const isHlc = (h: unknown): h is string => typeof h === 'string' && decodeHlc(h) !== null;

export class Hlc {
  private wall = 0;
  private count = 0;
  constructor(
    readonly node: string,
    private readonly clock: () => number = Date.now,
  ) {
    if (!/^[0-9a-z]{1,16}$/.test(node)) throw new Error('bad hlc node');
  }

  /** زمان یک تغییر تازه؛ همیشه از هر زمانی که قبلاً دیده یا ساخته بزرگ‌تر است. */
  now(): string {
    const t = this.clock();
    if (t > this.wall) {
      this.wall = t;
      this.count = 0;
    } else {
      this.count++;
    }
    return encodeHlc({ wall: this.wall, count: this.count, node: this.node });
  }

  /** زمانی که از جای دیگر آمده؛ ساعت جلو می‌رود تا تغییر بعدی از آن عقب‌تر نیفتد. */
  receive(h: string | null | undefined): void {
    const r = h ? decodeHlc(h) : null;
    if (!r) return;
    if (r.wall > this.wall) {
      this.wall = r.wall;
      this.count = r.count;
    } else if (r.wall === this.wall && r.count > this.count) {
      this.count = r.count;
    }
  }
}
