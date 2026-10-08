import { createPublicKey, verify } from 'node:crypto';

/**
 * امضای خودمان روی هر نسخه، جدا از امضای کد ویندوز: اگر سرور به‌روزرسانی هم دست کس دیگری بیفتد،
 * نصب‌کننده‌ای که با کلید خصوصی دفتر کلید امضا نشده هرگز نصب نمی‌شود.
 * متن امضا همان است که scripts/release.mjs می‌سازد؛ نسخه هم در آن است تا نصب‌کنندهٔ امضاشدهٔ نسخهٔ دیگری جا زده نشود.
 */
export const signedText = (version: string, sha512: string) => `kelid-update\n${version}\n${sha512}`;

export interface SignedInfo {
  version: string;
  files?: Array<{ url: string; sha512: string }>;
  kelidSignature?: unknown;
}

/** electron-updater درستی بایت‌های دریافتی را با sha512 همین فهرست می‌سنجد؛ اینجا خود فهرست سنجیده می‌شود. */
export function verifyUpdate(publicKeyBase64: string, info: SignedInfo): boolean {
  try {
    const files = info.files ?? [];
    // فقط یک نصب‌کننده؛ فایل دیگری در فهرست یعنی چیزی که ما نساخته‌ایم.
    if (files.length !== 1 || !files[0]!.url.endsWith('.exe') || typeof info.kelidSignature !== 'string') return false;
    const key = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') return false;
    return verify(null, Buffer.from(signedText(info.version, files[0]!.sha512)), key, Buffer.from(info.kelidSignature, 'base64'));
  } catch {
    return false;
  }
}
