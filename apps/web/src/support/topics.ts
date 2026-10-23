import type { ApiError, TicketStatus, TicketTopic } from '../auth/api';

export const TOPICS: Array<{ value: TicketTopic; label: string }> = [
  { value: 'problem', label: 'مشکل' },
  { value: 'question', label: 'سؤال' },
  { value: 'billing', label: 'اشتراک' },
  { value: 'idea', label: 'پیشنهاد' },
];

export const topicLabel = (t: TicketTopic) => TOPICS.find((x) => x.value === t)?.label ?? '';

export const STATUS: Record<TicketStatus, { label: string; tone: '' | 'ok' }> = {
  open: { label: 'در انتظار پاسخ', tone: '' },
  answered: { label: 'پاسخ داده شد', tone: 'ok' },
  closed: { label: 'بسته', tone: '' },
};

export function ticketFailText(e: ApiError | null): string {
  if (e?.code === 'offline') return 'برای فرستادن، اینترنت لازم است.';
  if (e?.code === 'too_many') return 'پیام‌ها زیاد شد؛ کمی بعد دوباره بفرستید.';
  return 'فرستاده نشد؛ دوباره امتحان کنید.';
}
