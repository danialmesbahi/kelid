import { describe, expect, it } from 'vitest';
import { FILE_MAX, parseFiles, sniffFile } from './files';

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);

describe('support attachments', () => {
  it('reads the real type from the bytes, not from the name', () => {
    expect(sniffFile(png, 'x.pdf')).toBe('image/png');
    expect(sniffFile(Buffer.from('%PDF-1.7'), 'a.pdf')).toBe('application/pdf');
    expect(sniffFile(zip, 'گزارش.xlsx')).toMatch(/spreadsheetml/);
    expect(sniffFile(zip, 'a.zip')).toBeNull();
    expect(sniffFile(Buffer.from('سلام'), 'note.txt')).toBe('text/plain; charset=utf-8');
    expect(sniffFile(Buffer.from([0xff, 0xfe, 0]), 'note.txt')).toBeNull();
    expect(sniffFile(Buffer.from('MZ\x90\x00'), 'setup.pdf')).toBeNull();
  });

  it('cleans names and enforces the size cap', () => {
    expect(parseFiles([{ name: 'C:\\Users\\x\\"عکس"\n.png', data: b64(png) }])).toEqual([{ name: 'عکس.png', mime: 'image/png', bytes: png }]);
    expect(parseFiles([{ name: `${'a'.repeat(300)}.pdf`, data: b64('%PDF-1') }])).toMatchObject([{ name: `${'a'.repeat(116)}.pdf` }]);
    // ۵ مگابایت دهدهی، همان که مک و گوشی نشان می‌دهند: فایل «۵٫۲ مگابایتی» رد می‌شود
    const pdf = (n: number) => b64(Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(n - 5)]));
    expect(FILE_MAX).toBe(5_000_000);
    expect(parseFiles([{ name: 'ok.pdf', data: pdf(FILE_MAX) }])).toHaveLength(1);
    expect(parseFiles([{ name: 'big.pdf', data: pdf(FILE_MAX + 1) }])).toBe('too_big');
    expect(parseFiles([{ name: 'big.pdf', data: pdf(5_200_000) }])).toBe('too_big');
    expect(parseFiles([{ name: 'x.exe', data: b64('MZ') }])).toBe('bad_file');
    expect(parseFiles(undefined)).toEqual([]);
  });
});
