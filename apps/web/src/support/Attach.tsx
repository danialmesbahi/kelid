import { FileChips } from '@kelid/ui';
import { useAuth } from '../auth/AuthContext';
import type { TicketFile } from '../auth/api';
import { resizePhoto } from '../photos/photos';

/** پیوست‌های یک پیام تیکت؛ بایت‌ها با توکن همین کاربر از سرور می‌آیند. */
export function TicketFiles({ ticketId, files }: { ticketId: string; files: TicketFile[] }) {
  const { api, withToken } = useAuth();
  return (
    <FileChips
      files={files}
      open={(f) => {
        if (!api) return Promise.reject(new Error('signed out'));
        return withToken((t) => api.ticketFile(t, ticketId, f.id));
      }}
    />
  );
}

/**
 * عکس پیوست با همان Worker عکس فایل‌ها کوچک می‌شود (ضلع بلند ۱۶۰۰ پیکسل): عکس ۴ مگابایتی گوشی حدود ۳۰۰ کیلوبایت می‌شود،
 * هم اینترنت کاربر کمتر مصرف می‌شود هم فضای سرور. عکس کوچک یا عکسی که کوچک‌تر نشد همان‌طور می‌ماند.
 */
export async function shrinkImage(f: File): Promise<File> {
  if (f.size < 400_000) return f;
  const p = await resizePhoto(f);
  if (p.bytes.length >= f.size) return f;
  const ext = p.mime === 'image/webp' ? 'webp' : 'jpg';
  return new File([new Uint8Array(p.bytes)], `${f.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: p.mime });
}
