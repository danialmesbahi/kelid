import { useRef, useState } from 'react';
import { toFaDigits } from '@kelid/core';
import { Icon } from './components';
import type { IconName } from './icons';

// پیوست پیام‌های پشتیبانی؛ همان سقف سرور: هر پیام تا سه فایل که روی هم تا ۵ مگابایت باشند.
// مگابایتِ دهدهی (میلیون بایت)، همان که مک و گوشی‌ها نشان می‌دهند؛ فایلی که آنجا «۵٫۲ مگابایت» است اینجا هم بزرگ است.
export const FILE_MAX = 5_000_000;
export const FILES_MAX = 3;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.txt';
const EXT = new Set(ACCEPT.split(',').map((x) => x.slice(1)));

export interface AttachedFile {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export function fileSize(n: number): string {
  if (n < 1_000_000) return `${toFaDigits(Math.max(1, Math.round(n / 1000)))} کیلوبایت`;
  // رو به بالا، تا فایل کمی بزرگ‌تر از ۵ مگابایت «۵٫۰» دیده نشود.
  return `${toFaDigits((Math.ceil(n / 100_000) / 10).toFixed(1).replace('.', '٫'))} مگابایت`;
}

const iconOf = (name: string, mime = ''): IconName => (mime.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name) ? 'cam' : 'doc');

/** فایل‌های انتخاب‌شده به شکلی که سرور می‌گیرد: نام و بایت‌ها به base64. */
export async function readFiles(files: File[]): Promise<Array<{ name: string; data: string }>> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<{ name: string; data: string }>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve({ name: f.name, data: String(r.result).split(',', 2)[1] ?? '' });
          r.onerror = () => reject(r.error ?? new Error('read'));
          r.readAsDataURL(f);
        }),
    ),
  );
}

/** دکمهٔ «پیوست فایل» و فایل‌های انتخاب‌شده؛ نوع و حجم همین‌جا سنجیده می‌شود تا کسی منتظر سرور نماند. */
export function AttachPicker({ files, onChange, onError }: { files: File[]; onChange: (f: File[]) => void; onError: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const add = (picked: FileList | null) => {
    const next = [...files];
    for (const f of picked ?? []) {
      const ext = f.name.toLowerCase().split('.').pop() ?? '';
      if (!EXT.has(ext)) return onError(`«${f.name}» پذیرفته نیست؛ فقط عکس، PDF، Word، Excel یا متن.`);
      if (f.size > FILE_MAX) return onError(`«${f.name}» بزرگ‌تر از ۵ مگابایت است.`);
      if (next.length >= FILES_MAX) return onError('هر پیام حداکثر ۳ پیوست دارد.');
      if (next.reduce((n, x) => n + x.size, f.size) > FILE_MAX) return onError(`با «${f.name}» جمع پیوست‌ها از ۵ مگابایت بیشتر می‌شود.`);
      next.push(f);
    }
    onChange(next);
  };
  return (
    <div className="att">
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn btn-g att-add" disabled={files.length >= FILES_MAX} onClick={() => input.current?.click()}>
        <Icon name="doc" size="s" />
        پیوست فایل
      </button>
      {files.length === 0 ? (
        <span className="xs mute">تا ۳ فایل، روی هم تا ۵ مگابایت؛ عکس، PDF، Word یا Excel</span>
      ) : (
        files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="att-file">
            <Icon name={iconOf(f.name, f.type)} size="s" />
            <span className="att-name">{f.name}</span>
            <span className="xs mute">{fileSize(f.size)}</span>
            <button type="button" className="att-x" aria-label={`برداشتن ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
              <Icon name="x" size="s" />
            </button>
          </span>
        ))
      )}
    </div>
  );
}

/** پیوست‌های یک پیام؛ زدن هر کدام بایت‌ها را می‌گیرد و فایل را روی دستگاه ذخیره می‌کند. */
export function FileChips({ files, open }: { files: AttachedFile[]; open: (f: AttachedFile) => Promise<Blob> }) {
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');
  if (!files.length) return null;
  const save = async (f: AttachedFile) => {
    if (busy) return;
    setBusy(f.id);
    setFailed('');
    try {
      const url = URL.createObjectURL(await open(f));
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(f.id);
    }
    setBusy('');
  };
  return (
    <div className="att att-list">
      {files.map((f) => (
        <button key={f.id} type="button" className="att-file hov" aria-busy={busy === f.id} onClick={() => void save(f)}>
          <Icon name={iconOf(f.name, f.mime)} size="s" />
          <span className="att-name">{f.name}</span>
          <span className="xs mute">{failed === f.id ? 'دریافت نشد؛ دوباره بزنید' : fileSize(f.size)}</span>
          <Icon name="download" size="s" />
        </button>
      ))}
    </div>
  );
}
