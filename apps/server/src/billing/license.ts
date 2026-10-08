import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { encodeLicense, OFFLINE_GRACE_DAYS, type LicensePayload } from '@kelid/core/plans';

/**
 * فقط برای توسعه و تست؛ کلید عمومی‌اش پیش‌فرض برنامهٔ وب در حالت توسعه است. config آن را در production رد می‌کند.
 * کلید واقعی: npm run license-keys -w @kelid/server
 */
export const DEV_LICENSE_SEED = '6DRgv6GzCSEgWdku0sTM9UM1jt3Kpn9y0wJ2sH91a2o';

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');

/** کلید خصوصی Ed25519 از ۳۲ بایت دانهٔ base64url (همان LICENSE_PRIVATE_KEY). */
export function licenseKey(seed: string): KeyObject {
  const raw = Buffer.from(seed, 'base64url');
  if (raw.length !== 32) throw new Error('LICENSE_PRIVATE_KEY باید ۳۲ بایت base64url باشد');
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, raw]), format: 'der', type: 'pkcs8' });
}

/** کلید عمومی خام (۳۲ بایت base64url) که برنامه با آن می‌سنجد: VITE_KELID_LICENSE_KEY. */
export function publicKeyOf(key: KeyObject): string {
  return createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
}

export interface LicenseFacts {
  office: string;
  plan: LicensePayload['plan'];
  seats: number;
  trial: boolean;
  expiresAt: Date;
  suspended?: boolean;
}

/** مجوز امضاشدهٔ «داده.امضا». هر سر زدن به سرور مجوز تازه می‌دهد، پس مهلت بی‌اینترنت از آخرین سر زدن حساب می‌شود. */
export function signLicense(key: KeyObject, f: LicenseFacts, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const body = encodeLicense({
    v: 1,
    off: f.office,
    plan: f.plan,
    seats: f.seats,
    trial: f.trial,
    exp: Math.floor(f.expiresAt.getTime() / 1000),
    iat,
    chk: iat + OFFLINE_GRACE_DAYS * 86_400,
    ...(f.suspended ? { sus: true } : {}),
  });
  return `${body}.${sign(null, Buffer.from(body), key).toString('base64url')}`;
}

/** برای تست‌ها؛ برنامه همین کار را با WebCrypto می‌کند (apps/web/src/billing/license.ts). */
export function verifyLicense(publicKey: string, token: string): boolean {
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const pub = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'base64url')]),
    format: 'der',
    type: 'spki',
  });
  return verify(null, Buffer.from(body), pub, Buffer.from(sig, 'base64url'));
}
