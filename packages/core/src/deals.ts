import type { Deal, DealStage, DealType } from './model';

/** ستون‌های خط معامله به ترتیب. */
export const DEAL_STAGES: Array<{ id: Exclude<DealStage, 'lost'>; label: string; hint: string }> = [
  { id: 'talking', label: 'مذاکره', hint: 'قیمت و شرایط' },
  { id: 'deposit', label: 'بیعانه', hint: 'قولنامه و پیش‌پرداخت' },
  { id: 'signed', label: 'امضا شد', hint: 'تا تحویل و تسویه' },
  { id: 'done', label: 'تمام شد', hint: 'کمیسیون گرفته شد' },
];

/** چک‌لیست قرارداد؛ فروش با محضر و سند، اجاره و رهن با کد رهگیری و تحویل. */
export const DEAL_CHECKLIST: Record<'sale' | 'lease', Array<{ id: string; label: string }>> = {
  sale: [
    { id: 'ids', label: 'مدارک شناسایی خریدار و فروشنده' },
    { id: 'deed', label: 'کپی سند و استعلام ثبتی' },
    { id: 'city', label: 'مفاصاحساب شهرداری و پایان کار' },
    { id: 'tax', label: 'مفاصاحساب دارایی' },
    { id: 'bills', label: 'قبض‌های پرداخت‌شده' },
    { id: 'contract', label: 'قولنامه و کد رهگیری' },
    { id: 'notary', label: 'وقت محضر و انتقال سند' },
    { id: 'handover', label: 'تحویل کلید' },
  ],
  lease: [
    { id: 'ids', label: 'مدارک شناسایی موجر و مستأجر' },
    { id: 'deed', label: 'کپی سند یا وکالت‌نامهٔ مالک' },
    { id: 'contract', label: 'اجاره‌نامه و کد رهگیری' },
    { id: 'payment', label: 'رسید ودیعه' },
    { id: 'bills', label: 'قبض‌ها و شارژ تا روز تحویل' },
    { id: 'handover', label: 'صورت‌جلسهٔ تحویل و کلید' },
  ],
};

export function checklistFor(type: DealType) {
  return DEAL_CHECKLIST[type === 'sale' ? 'sale' : 'lease'];
}

/**
 * کمیسیون پیشنهادی از هر طرف، گرد به صد هزار تومان. فقط پیشنهاد است و مشاور عوضش می‌کند.
 * فروش: نیم درصد قیمت. اجاره و رهن: یک‌چهارم اجارهٔ یک ماه، که ودیعه با ۳٪ در ماه به اجاره تبدیل می‌شود.
 */
export function suggestedCommission(type: DealType, price = 0, rent = 0): number {
  const raw = type === 'sale' ? price * 0.005 : (rent + price * 0.03) * 0.25;
  return Math.round(raw / 100_000) * 100_000;
}

export function dealCommission(d: Pick<Deal, 'commissionBuyer' | 'commissionSeller'>): number {
  return (d.commissionBuyer ?? 0) + (d.commissionSeller ?? 0);
}
