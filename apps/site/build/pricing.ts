// بخش قیمت سایت: هم موقع ساخت (HTML کامل برای گوگل و مرورگر بی جاوااسکریپت) و هم در مرورگر با فهرست تازهٔ سرور
// (src/live.ts) از همین تابع ساخته می‌شود تا هر پلنی که پنل کلید بسازد یا بردارد همان لحظه در سایت باشد.
import { bestTerm, perMonthOf, priceOf, type Catalog, type Plan, type Term } from '../../../packages/core/src/plans';
import { toFaDigits } from '../../../packages/core/src/persian';
import { icon } from './icon';

// متن پلن‌ها را پنل می‌نویسد؛ پیش از رفتن در HTML بی‌خطر می‌شود.
// رقم‌ها فارسی می‌شوند چون کادرهای پنل رقم را انگلیسی می‌گیرند.
const esc = (s: string) => toFaDigits(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// قیمت‌ها به میلیون تومان، همان‌طور که در بازار گفته می‌شود (۳٫۶۵ میلیون)
const mil = (n: number) => toFaDigits(String(Math.round(n / 10_000) / 100)).replace('.', '٫');
const kTooman = (n: number) => `${toFaDigits(Math.round(n / 1000))} هزار تومان`;
const access = (t: Term) => t.months + t.gift;
const perk = (t: Term) => (t.gift ? `${toFaDigits(t.gift)} ماه هدیه` : t.off ? `${toFaDigits(t.off)}٪ تخفیف` : '');

// خط افق شهر ته کارت پیشنهادی؛ همان شب صفحهٔ اول، کوچک
const MINI_CITY = '<svg class="plan-city" viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70V44h18V30h16v14h10V20h22v24h8V36h14v34h6V26l12-8 12 8v44h8V40h20v30h6V14h4V4h4v10h4v56h8V34h18v36h6V46h14V28h20v42h8V38h12v32h6V22h20v48h8V42h16v28h8V32h18v38z"/><path class="lit" d="M22 36h4v4h-4zM48 26h4v4h-4zM56 34h4v4h-4zM100 26h4v4h-4zM108 40h4v4h-4zM134 46h4v4h-4zM166 22h4v4h-4zM166 34h4v4h-4zM194 40h4v4h-4zM232 34h4v4h-4zM258 44h4v4h-4zM282 28h4v4h-4zM290 40h4v4h-4zM318 48h4v4h-4zM342 38h4v4h-4z"/></svg>';

function card(p: Plan, terms: Term[], trialDays: string): string {
  const hot = !!p.badge;
  const avatars = ['ر', 'م', 'س', 'ن', 'ک'].slice(0, Math.min(p.seats, 4));
  const more = p.seats > 4 ? `<span class="av plus">+${toFaDigits(p.seats - 4)}</span>` : '';
  const cls = (t: Term) => `per per-${t.id}`;
  const note = (t: Term) =>
    t.months === 1 && !t.gift && !t.off
      ? `پرداخت ماهانه · روزی ${kTooman(priceOf(p, t) / 30)}`
      : `${esc(t.name)} ${mil(priceOf(p, t))} میلیون برای ${toFaDigits(access(t))} ماه · روزی ${kTooman(priceOf(p, t) / (access(t) * 30))}`;
  return `<article class="plan${hot ? ' hot' : ''}">
${hot ? `<span class="plan-badge">${icon('spark', 's')}${esc(p.badge!)}</span>` : ''}
<div class="plan-hd"><span class="plan-ic">${icon(p.seats === 1 ? 'user' : p.extra ? 'gem' : 'users')}</span><span><h3 class="plan-name">${esc(p.name)}</h3><p class="plan-blurb">${esc(p.blurb)}</p></span></div>
<div class="plan-price">
<p class="pp">${terms.map((t) => `<b class="num ${cls(t)}">${mil(perMonthOf(p, t))}</b>`).join('')}<span>میلیون تومان<br>در ماه</span></p>
${terms
  .filter((t) => perk(t))
  .map((t) => `<p class="pwas ${cls(t)}"><s class="num">${mil(p.monthly)} میلیون</s><span class="save">${perk(t)}</span></p>`)
  .join('\n')}
${terms.map((t) => `<p class="pnote ${cls(t)}">${note(t)}</p>`).join('\n')}
</div>
<a class="btn btn-lg btn-w ${hot ? 'btn-gold' : 'btn-d'}" href="#download">شروع ${trialDays} روز رایگان${icon('chl', 's')}</a>
<p class="plan-safe">${icon('check', 's')}بدون کارت بانکی · بدون تعهد</p>
<div class="plan-seats"><span class="avs">${avatars.map((a) => `<span class="av">${a}</span>`).join('')}${more}</span><b>${p.seats === 1 ? 'برای یک نفر' : `تا ${toFaDigits(p.seats)} همکار`}</b></div>
<ul class="plan-feats">${p.features.map((f) => `<li>${icon('check', 's')}${esc(f)}</li>`).join('')}</ul>
${hot ? MINI_CITY : ''}
</article>`;
}

/**
 * انتخاب مدت و کارت‌ها. مدت فقط با CSS عوض می‌شود (قیمت همهٔ مدت‌ها در HTML هست)؛ پیش‌فرض ارزان‌ترین ماه است
 * و مرورگر بی :has همان را نشان می‌دهد. شناسهٔ مدت‌ها فقط حرف کوچک انگلیسی است (سرور همین را می‌پذیرد).
 */
export function pricingHtml(c: Catalog, trialDays: number, checked?: string): string {
  const terms = c.terms.filter((t) => /^[a-z]{2,20}$/.test(t.id));
  const best = bestTerm(terms);
  const on = terms.find((t) => t.id === checked) ?? best;
  if (!on || !c.plans.length) return '';
  const others = terms.filter((t) => t !== best);
  const css = [
    `.per:not(.per-${best!.id}){display:none}`,
    ...others.map((t) => `.pricing:has(#p-${t.id}:checked) .per-${best!.id}{display:none}.pricing:has(#p-${t.id}:checked) .per-${t.id}{display:revert}.pricing:has(#p-${t.id}:checked) .pwas.per-${t.id}{display:flex}`),
  ].join('');
  const days = toFaDigits(trialDays);
  return `<style>${css}</style>
<div class="period" role="radiogroup" aria-label="دورهٔ پرداخت" style="--n:${terms.length}">
${terms.map((t) => `<input type="radio" name="period" id="p-${t.id}"${t === on ? ' checked' : ''}><label for="p-${t.id}">${esc(t.name)}${perk(t) ? ` <span class="tag ok">${perk(t)}</span>` : ''}</label>`).join('\n')}
</div>
<div class="plans" style="--n:${Math.min(c.plans.length, 4)}">${c.plans.map((p) => card(p, terms, days)).join('\n')}</div>`;
}

/** نشانی کوتاه یک فهرست، تا مرورگر فقط وقتی فهرست سرور فرق دارد بخش قیمت را دوباره بسازد. */
export function catalogStamp(c: Catalog, trialDays: number): string {
  let h = 0;
  for (const ch of JSON.stringify([c, trialDays])) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
