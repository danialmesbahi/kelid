import { afterEach, describe, expect, it, vi } from 'vitest';
import { S3, signV4 } from './s3';

const cfg = { endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir', region: 'ir-thr-at1', bucket: 'kelid-photos', accessKeyId: 'AKIAKELIDTEST', secretAccessKey: 'secretKELIDtest/abc+123' };
const key = '0b6c1c2e-0000-4000-8000-000000000001/p_1-x/full';
const at = () => new Date('2026-10-08T10:00:00Z');

afterEach(() => vi.unstubAllGlobals());

function capture(status = 200, body = '') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : body, { status });
  });
  return calls;
}

describe('S3 (SigV4)', () => {
  it('matches the AWS test suite (get-vanilla)', () => {
    expect(
      signV4({
        method: 'GET',
        path: '/',
        host: 'example.amazonaws.com',
        headers: { 'X-Amz-Date': '20150830T123600Z' },
        payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        amzDate: '20150830T123600Z',
        region: 'us-east-1',
        service: 'service',
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      }),
    ).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
  });

  // امضاهای مرجع از botocore (کتابخانهٔ رسمی AWS) با همین ورودی‌ها ساخته شده‌اند.
  it('signs a PUT and a GET exactly like the AWS SDK', async () => {
    const calls = capture();
    const s3 = new S3(cfg, at);
    await s3.put(key, Buffer.from('hello'), 'image/webp');
    await s3.get(key);
    const [put, get] = calls;
    expect(put!.url).toBe(`https://s3.ir-thr-at1.arvanstorage.ir/kelid-photos/${key}`);
    expect(put!.init.method).toBe('PUT');
    expect((put!.init.headers as Record<string, string>).authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAKELIDTEST/20261008/ir-thr-at1/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=3ebc5d1cb42380768374e96c87607df37cc9a55da01124012078c8e650d51105',
    );
    expect((get!.init.headers as Record<string, string>).authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAKELIDTEST/20261008/ir-thr-at1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=12b47281df27fdfe0f29ba3d1bbe045532752a1dcf3b2f2da03bb355f5f3a21d',
    );
  });

  it('returns null for a missing object and throws on other errors without leaking the body', async () => {
    capture(404, '<Error>NoSuchKey</Error>');
    expect(await new S3(cfg, at).get(key)).toBeNull();
    capture(403, '<Error>secret account details</Error>');
    await expect(new S3(cfg, at).get(key)).rejects.toThrow(/^S3 GET failed: 403$/);
    await expect(new S3(cfg, at).put(key, Buffer.from('x'), 'image/webp')).rejects.toThrow(/^S3 PUT failed: 403$/);
  });
});
