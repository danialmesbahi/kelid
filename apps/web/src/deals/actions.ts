import { DEAL_STAGES, formatGrouped, formatPlaque, toEnDigits, type Deal, type DealStage, type Listing, type ListingStatus } from '@kelid/core';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';

export const STAGE_LABEL: Record<DealStage, string> = {
  talking: 'مذاکره', deposit: 'بیعانه', signed: 'امضا شد', done: 'تمام شد', lost: 'منصرف شد',
};

/**
 * وضعیت فایل همراه مرحلهٔ معامله: «تمام شد» یعنی فروخته شد یا اجاره رفت، «منصرف شد» فایل را دوباره موجود می‌کند
 * و بقیهٔ مرحله‌ها «در مذاکره». undefined یعنی دست نخورد.
 */
export function listingStatusFor(stage: DealStage, cur: ListingStatus): ListingStatus | undefined {
  if (stage === 'done') return cur === 'closed' ? undefined : 'closed';
  if (stage === 'lost') return cur === 'negotiating' || cur === 'reserved' ? 'active' : undefined;
  return cur === 'active' || cur === 'closed' ? 'negotiating' : undefined;
}

/** بردن معامله به مرحلهٔ دیگر، با وضعیت فایل و یک «برگرداندن» برای هر دو. */
export function useMoveDeal() {
  const store = useStore();
  const toast = useToast();
  return async (d: Deal, l: Listing | undefined, stage: DealStage) => {
    if (d.stage === stage) return;
    const prevStage = d.stage;
    const prevClosedAt = d.closedAt;
    const prevStatus = l?.status;
    const status = l ? listingStatusFor(stage, l.status) : undefined;
    await store.updateDeal(d.id, { stage });
    if (l && status) await store.updateListing(l.id, { status });
    const file = l ? `فایل ${formatPlaque(l.plaque)}` : 'فایل';
    const text =
      stage === 'done' ? `معامله شد · ${file} «${l?.deal === 'sale' ? 'فروخته شد' : 'اجاره رفت'}» خورد`
        : stage === 'lost' ? `معامله کنار رفت${status === 'active' ? ` · ${file} دوباره موجود است` : ''}`
          : `معامله به «${STAGE_LABEL[stage]}» رفت`;
    toast(text, {
      label: 'برگرداندن',
      run: () => {
        void store.updateDeal(d.id, { stage: prevStage, closedAt: prevClosedAt });
        if (l && status && prevStatus) void store.updateListing(l.id, { status: prevStatus });
      },
    });
  };
}

export const STAGES = DEAL_STAGES;

/** «۲۸٬۰۰۰٬۰۰۰٬۰۰۰» برای فیلد مبلغ */
export const amountText = (n?: number) => (n ? formatGrouped(n) : '');

export function parseAmount(s: string): number | undefined {
  const n = Number(toEnDigits(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
