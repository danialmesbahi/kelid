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

export const STATUS: Record<TicketStatus, { label: string; tone: 'warn' | 'ok' | '' }> = {
  open: { label: 'در انتظار پاسخ', tone: 'warn' },
  answered: { label: 'پاسخ داده شد', tone: 'ok' },
  closed: { label: 'بسته شد', tone: '' },
};

// بعد از پاسخ پشتیبانی: پرسش و دکمهٔ بستن به موضوع تیکت می‌خورد؛ سؤال و پیشنهاد «مشکل» نیستند.
export const AFTER_ANSWER: Record<TicketTopic, { ask: string; hint: string; close: string }> = {
  problem: { ask: 'مشکل حل شد؟', hint: 'اگر مشکل برطرف شد تیکت را ببندید؛ اگر نه، توضیح بیشتری بنویسید.', close: 'حل شد، ببند' },
  question: { ask: 'جوابتان را گرفتید؟', hint: 'اگر جواب کافی بود تیکت را ببندید؛ اگر نه، توضیح بیشتری بنویسید.', close: 'جوابم را گرفتم، ببند' },
  billing: { ask: 'کارتان انجام شد؟', hint: 'اگر کارتان انجام شد تیکت را ببندید؛ اگر نه، توضیح بیشتری بنویسید.', close: 'انجام شد، ببند' },
  idea: { ask: 'ممنون از پیشنهادتان', hint: 'اگر توضیح دیگری ندارید، تیکت را ببندید.', close: 'بستن تیکت' },
};

export function ticketFailText(e: ApiError | null): string {
  if (e?.code === 'offline') return 'برای فرستادن، اینترنت لازم است.';
  if (e?.code === 'closed') return 'این تیکت بسته شده است؛ برای موضوع تازه، تیکت تازه بزنید.';
  if (e?.code === 'too_big') return 'جمع پیوست‌های هر پیام حداکثر ۵ مگابایت است.';
  if (e?.code === 'quota') return 'سقف پیوست امروز شما پر شده؛ پیام را بی پیوست بفرستید یا فردا دوباره امتحان کنید.';
  if (e?.code === 'bad_file') return 'این نوع فایل پذیرفته نیست؛ فقط عکس، PDF، Word، Excel یا متن.';
  if (e?.code === 'too_many') return 'پیام‌ها زیاد شد؛ کمی بعد دوباره بفرستید.';
  return 'فرستاده نشد؛ دوباره امتحان کنید.';
}
