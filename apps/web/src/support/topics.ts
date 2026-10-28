import type { IconName } from '@kelid/ui';
import type { ApiError, TicketStatus, TicketTopic } from '../auth/api';

export const TOPICS: Array<{ value: TicketTopic; label: string; icon: IconName }> = [
  { value: 'problem', label: 'مشکل', icon: 'warn' },
  { value: 'question', label: 'سؤال', icon: 'msg' },
  { value: 'billing', label: 'اشتراک', icon: 'card' },
  { value: 'idea', label: 'پیشنهاد', icon: 'spark' },
];

export const topicLabel = (t: TicketTopic) => TOPICS.find((x) => x.value === t)?.label ?? '';
export const topicIcon = (t: TicketTopic): IconName => TOPICS.find((x) => x.value === t)?.icon ?? 'msg';

// بسته یعنی مشکل حل شد؛ برای کاربر «حل شد» روشن‌تر از «بسته» است.
export const STATUS: Record<TicketStatus, { label: string; tone: 'warn' | 'ok' | '' }> = {
  open: { label: 'در انتظار پاسخ', tone: 'warn' },
  answered: { label: 'پاسخ داده شد', tone: 'ok' },
  closed: { label: 'حل شد', tone: '' },
};

export function ticketFailText(e: ApiError | null): string {
  if (e?.code === 'offline') return 'برای فرستادن، اینترنت لازم است.';
  if (e?.code === 'closed') return 'این تیکت بسته شده است؛ برای موضوع تازه، تیکت تازه بزنید.';
  if (e?.code === 'too_many') return 'پیام‌ها زیاد شد؛ کمی بعد دوباره بفرستید.';
  return 'فرستاده نشد؛ دوباره امتحان کنید.';
}
