import { FileChips } from '@kelid/ui';
import { useAuth } from '../auth/AuthContext';
import type { TicketFile } from '../auth/api';

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
