// قیمت‌ها از سرور: پنل کلید پلنی بسازد، عوض کند یا بردارد، کارت‌های سایت هم همان لحظه همان می‌شوند.
// صفحه بی این اسکریپت هم کامل است (فهرست زمان ساخت)؛ این فقط اگر فهرست سرور فرق داشت بخش قیمت را عوض می‌کند.
import { catalogStamp, pricingHtml } from '../build/pricing';
import type { Catalog } from '../../../packages/core/src/plans';

const box = document.getElementById('pricing-live');
const api = box?.dataset.api;

const valid = (c: unknown): c is Catalog & { trialDays: number } => {
  const x = c as Partial<Catalog & { trialDays: number }> | null;
  return !!x && Array.isArray(x.plans) && Array.isArray(x.terms) && typeof x.trialDays === 'number';
};

if (box && api) {
  fetch(`${api}/plans`, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : null))
    .then((c: unknown) => {
      if (!valid(c) || !c.plans.length || !c.terms.length) return;
      const stamp = catalogStamp({ plans: c.plans, terms: c.terms }, c.trialDays);
      if (stamp === box.dataset.v) return;
      const picked = box.querySelector<HTMLInputElement>('input[name="period"]:checked')?.id.slice(2);
      box.innerHTML = pricingHtml(c, c.trialDays, picked);
      box.dataset.v = stamp;
    })
    .catch(() => {});
}
