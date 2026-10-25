// سرویس‌های گفتار فارسی (آوانگار) فقط wav/mp3 می‌پذیرند و با ۱۶ کیلوهرتز تک‌کاناله بهترین نتیجه را می‌دهند؛
// ضبط مرورگر webm/opus است، پس پیش از فرستادن همین‌جا تبدیل می‌شود.

export const WAV_RATE = 16_000;

/** نمونه‌های float (‎-1..1) → فایل WAV با PCM شانزده‌بیتی. */
export function encodeWav(pcm: Float32Array, rate = WAV_RATE): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // تک‌کاناله
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]!));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** ضبط مرورگر → WAV شانزده کیلوهرتز تک‌کاناله (OfflineAudioContext خودش کانال‌ها را یکی و نرخ را عوض می‌کند). */
export async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * WAV_RATE)), WAV_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return encodeWav((await off.startRendering()).getChannelData(0));
  } finally {
    void ctx.close().catch(() => {});
  }
}
