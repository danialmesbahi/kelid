import { generateKeyPairSync, sign } from 'node:crypto';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { verifyUpdate, type SignedInfo } from '../src/updateSignature';
// @ts-expect-error اسکریپت انتشار JS ساده است و نوع ندارد.
import { manifest, signedText } from './release.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
const sha512 = 'kXq1+/abc==';
const signed = (version: string, hash = sha512) => sign(null, Buffer.from(signedText(version, hash)), privateKey).toString('base64');
const parse = (yml: string) => load(yml) as SignedInfo & { releaseNotes: string; stagingPercentage?: number };

describe('desktop update manifest', () => {
  it('writes a latest.yml that electron-updater reads and the app accepts', () => {
    const yml = manifest({ version: '0.2.0', file: 'Kelid-Setup-0.2.0.exe', sha512, size: 1234, notes: 'جست‌وجوی سریع‌تر\n- عکس‌ها: «بندانگشتی» اول', staging: 20, signature: signed('0.2.0') });
    const info = parse(yml);
    expect(info).toMatchObject({ version: '0.2.0', path: 'Kelid-Setup-0.2.0.exe', sha512, stagingPercentage: 20, releaseNotes: 'جست‌وجوی سریع‌تر\n- عکس‌ها: «بندانگشتی» اول' });
    expect(info.files).toEqual([{ url: 'Kelid-Setup-0.2.0.exe', sha512, size: 1234 }]);
    expect(verifyUpdate(pub, info)).toBe(true);
  });

  it('rejects anything the release key did not sign', () => {
    const base = { version: '0.2.0', file: 'Kelid-Setup-0.2.0.exe', sha512, size: 1, notes: '' };
    // نصب‌کنندهٔ دیگری با امضای نسخهٔ واقعی
    expect(verifyUpdate(pub, parse(manifest({ ...base, sha512: 'other==', signature: signed('0.2.0') })))).toBe(false);
    // امضای نسخهٔ قدیمی روی شمارهٔ نسخهٔ تازه
    expect(verifyUpdate(pub, parse(manifest({ ...base, signature: signed('0.1.0') })))).toBe(false);
    // کلید دیگر
    const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    expect(verifyUpdate(other, parse(manifest({ ...base, signature: signed('0.2.0') })))).toBe(false);
    // بی امضا، فایل اضافه، یا کلید خراب
    const ok = parse(manifest({ ...base, signature: signed('0.2.0') }));
    expect(verifyUpdate(pub, { ...ok, kelidSignature: undefined })).toBe(false);
    expect(verifyUpdate(pub, { ...ok, files: [...ok.files!, { url: 'x.exe', sha512 }] })).toBe(false);
    expect(verifyUpdate('not-a-key', ok)).toBe(false);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    expect(verifyUpdate(rsa, ok)).toBe(false);
  });
});
