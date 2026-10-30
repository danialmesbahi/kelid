// تکه‌های HTML که موقع ساخت تولید می‌شوند تا صفحه بی هیچ جاوااسکریپتی کامل به مرورگر و گوگل برسد.
import { iconPaths, type IconName } from '../../../packages/ui/src/icons';
import { PLANS, TRIAL_DAYS, perMonthOf, priceOf, termOf, type Period } from '../../../packages/core/src/plans';
import { toFaDigits } from '../../../packages/core/src/persian';

export interface SiteConfig {
  /** نشانی خود سایت؛ canonical و نقشهٔ سایت با آن ساخته می‌شوند. */
  site: string;
  /** برنامهٔ وب (همان نسخهٔ گوشی). */
  app: string;
  /** نصب‌کنندهٔ ویندوز. */
  windows: string;
  /** نصب‌کنندهٔ مک (dmg). */
  mac: string;
}

export function icon(name: string, cls = ''): string {
  const paths = (iconPaths as Record<string, string>)[name as IconName];
  if (!paths) throw new Error(`unknown icon: ${name}`);
  return `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

// همان مولد تصادفی صحنهٔ آشنایی برنامه؛ با دانهٔ ثابت تا هر ساخت همان شهر را بکشد.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1440;
const H = 360;
const f = (n: number) => String(Math.round(n));

/** شب تهران: البرز، برج میلاد و پنجره‌هایی که از وسط به دو طرف روشن می‌شوند. */
export function skyline(): string {
  const r = rng(1405);
  const box = (x: number, y: number, w: number) => `M${f(x)} ${H}V${f(y)}H${f(x + w)}V${H}Z`;

  let mid = '';
  for (let x = -6; x < W; ) {
    const w = 34 + r() * 40;
    const h = 110 + r() * 120;
    // جای برج میلاد خالی می‌ماند تا قامتش دیده شود
    if (x + w > 300 && x < 352) { x = 354; continue; }
    mid += box(x, H - h, w);
    x += w + 4 + r() * 12;
  }

  // پنجره‌ها در شش موج روشن می‌شوند؛ هر موج یک گروه است تا HTML سبک بماند.
  const waves: string[] = ['', '', '', '', '', ''];
  let near = '';
  for (let x = -10; x < W; ) {
    const w = 44 + r() * 52;
    const h = 50 + r() * 96;
    const y = H - h;
    near += box(x, y, w);
    const cols = Math.floor((w - 10) / 14);
    const rows = Math.floor((h - 18) / 18);
    const ox = x + (w - cols * 14 + 7) / 2;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() > 0.36) continue;
        const wx = ox + i * 14;
        const wave = Math.min(5, Math.floor((Math.abs(wx - W / 2) / (W / 2)) * 5.5 + r() * 0.8));
        waves[wave] += `M${f(wx)} ${f(y + 12 + j * 18)}h7v10h-7z`;
      }
    }
    x += w + 3 + r() * 8;
  }

  let stars = '';
  for (let i = 0; i < 90; i++) {
    stars += `<circle cx="${f(r() * W)}" cy="${f(r() * 620)}" r="${(0.5 + r() * 1).toFixed(1)}" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }

  return `<div class="sky" aria-hidden="true">
<svg class="stars" viewBox="0 0 ${W} 900" preserveAspectRatio="xMidYMin slice">${stars}</svg>
<span class="moon"></span>
<svg class="city far" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><path d="M-10 360V214L70 186 140 200 230 150 290 168 380 112 440 140 520 104 600 146 680 124 760 162 850 116 920 140 1010 98 1090 136 1170 118 1250 150 1330 120 1450 160V360Z"/><path class="snow" d="M366 120 380 112 410 132 394 130ZM506 112 520 104 548 124 530 122ZM996 106 1010 98 1040 118 1022 116ZM1158 124 1170 118 1192 132 1178 130Z"/></svg>
<svg class="city mid" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><path d="${mid}"/><path class="milad" d="M322 360 325 110H331L334 360ZM326.6 20H329.4V88H326.6ZM304 96C304 86 352 86 352 96L338 110H318ZM314 86C314 79 342 79 342 86Z"/><rect class="milad-ring" x="306" y="94" width="44" height="3" rx="1.5"/><circle class="beacon" cx="328" cy="18" r="3"/></svg>
<svg class="city near" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"><path d="${near}"/>${waves.map((d, i) => `<path class="lit w${i}" d="${d}"/>`).join('')}</svg>
</div>`;
}

// قیمت‌ها به میلیون تومان، همان‌طور که در بازار گفته می‌شود (۳٫۶۵ میلیون)
const mil = (n: number) => toFaDigits(String(Math.round(n / 10_000) / 100)).replace('.', '٫');

const kTooman = (n: number) => `${toFaDigits(Math.round(n / 1000))} هزار تومان`;

/** آنچه هر پلن به دفتر می‌دهد؛ همهٔ پلن‌ها همهٔ امکانات را دارند و فرق فقط در همکاران است. */
const PLAN_FEATS: Record<string, string[]> = {
  solo: ['فایل، مشتری، بازدید و قرارداد در یک‌جا', 'پیدا کردن خودکار فایل جور برای هر مشتری', 'کار کامل بدون اینترنت', 'روی ویندوز، مک و گوشی با هم'],
  office: ['هر همکار روی دستگاه خودش، همه هماهنگ', 'نقش مدیر و مشاور برای همکاران', 'شمارهٔ مالک فقط برای کسی که مدیر بخواهد', 'همهٔ امکانات پلن تک‌نفره'],
  pro: ['تا ۱۰ همکار؛ هر نفر بیشتر ماهی ۵۰۰ هزار تومان', 'دعوت همکار فقط با شمارهٔ موبایل', 'نقش‌ها و دسترسی‌های جدا', 'همهٔ امکانات پلن دفتر'],
};
const PLAN_ICON: Record<string, string> = { solo: 'user', office: 'users', pro: 'gem' };

// خط افق شهر ته کارت پیشنهادی؛ همان شب صفحهٔ اول، کوچک
const MINI_CITY = '<svg class="plan-city" viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70V44h18V30h16v14h10V20h22v24h8V36h14v34h6V26l12-8 12 8v44h8V40h20v30h6V14h4V4h4v10h4v56h8V34h18v36h6V46h14V28h20v42h8V38h12v32h6V22h20v48h8V42h16v28h8V32h18v38z"/><path class="lit" d="M22 36h4v4h-4zM48 26h4v4h-4zM56 34h4v4h-4zM100 26h4v4h-4zM108 40h4v4h-4zM134 46h4v4h-4zM166 22h4v4h-4zM166 34h4v4h-4zM194 40h4v4h-4zM232 34h4v4h-4zM258 44h4v4h-4zM282 28h4v4h-4zM290 40h4v4h-4zM318 48h4v4h-4zM342 38h4v4h-4z"/></svg>';

/** نام کوتاه هر مدت در کلاس‌های CSS (per-m / per-h / per-y). */
const PER: Record<Period, string> = { month: 'm', half: 'h', year: 'y' };
const gift = (p: Period) => toFaDigits(termOf(p).gift);
const accessMonths = (p: Period) => termOf(p).months + termOf(p).gift;

/** کارت‌های قیمت؛ سالانه پیش‌فرض است و دوره فقط با CSS عوض می‌شود. */
export function plans(): string {
  return PLANS.map((p) => {
    const hot = p.id === 'office';
    const avatars = ['ر', 'م', 'س', 'ن', 'ک'].slice(0, Math.min(p.seats, 4));
    const more = p.seats > 4 ? `<span class="av plus">+${toFaDigits(p.seats - 4)}</span>` : '';
    const feats = PLAN_FEATS[p.id] ?? [];
    const per = (t: Period) => perMonthOf(p, t);
    const note = (t: Period) => `${termOf(t).name} ${mil(priceOf(p, t))} میلیون برای ${toFaDigits(accessMonths(t))} ماه · روزی ${kTooman(priceOf(p, t) / (accessMonths(t) * 30))}`;
    return `<article class="plan${hot ? ' hot' : ''}">
${hot ? `<span class="plan-badge">${icon('spark', 's')}محبوب‌ترین پلن دفترها</span>` : ''}
<div class="plan-hd"><span class="plan-ic">${icon(PLAN_ICON[p.id] ?? 'user')}</span><span><h3 class="plan-name">${p.name}</h3><p class="plan-blurb">${p.blurb}</p></span></div>
<div class="plan-price">
<p class="pp">${(['year', 'half', 'month'] as const).map((t) => `<b class="num per-${PER[t]}">${mil(per(t))}</b>`).join('')}<span>میلیون تومان<br>در ماه</span></p>
${(['year', 'half'] as const).map((t) => `<p class="pwas per-${PER[t]}"><s class="num">${mil(p.monthly)} میلیون</s><span class="save">${gift(t)} ماه هدیه</span></p>`).join('\n')}
${(['year', 'half'] as const).map((t) => `<p class="pnote per-${PER[t]}">${note(t)}</p>`).join('\n')}
<p class="pnote per-m">پرداخت ماهانه · روزی ${kTooman(p.monthly / 30)}</p>
</div>
<a class="btn btn-lg btn-w ${hot ? 'btn-gold' : 'btn-d'}" href="#download">شروع ${trialDays} روز رایگان${icon('chl', 's')}</a>
<p class="plan-safe">${icon('check', 's')}بدون کارت بانکی · بدون تعهد</p>
<div class="plan-seats"><span class="avs">${avatars.map((a) => `<span class="av">${a}</span>`).join('')}${more}</span><b>${p.seats === 1 ? 'برای یک نفر' : `تا ${toFaDigits(p.seats)} همکار`}</b></div>
<ul class="plan-feats">${feats.map((f) => `<li>${icon('check', 's')}${f}</li>`).join('')}</ul>
${hot ? MINI_CITY : ''}
</article>`;
  }).join('\n');
}

export const trialDays = toFaDigits(TRIAL_DAYS);
export const yearGift = gift('year');
export const halfGift = gift('half');

export interface Faq {
  q: string;
  a: string;
}

/** پرسش‌ها هم در صفحه‌اند و هم در داده‌های ساخت‌یافتهٔ گوگل (FAQPage)؛ برای همین یک جا نوشته می‌شوند. */
export const faqs: Faq[] = [
  {
    q: 'کلید چیست و به چه کاری می‌آید؟',
    a: 'کلید نرم‌افزار مدیریت املاک برای مشاوران و دفترهای املاک است: فایل‌های فروش، رهن و اجاره و رهن کامل، مشتری‌ها، بازدیدها، کارها و قراردادها را یک‌جا و مرتب نگه می‌دارد و برای هر مشتری فایل‌های جورش را پیدا می‌کند.',
  },
  {
    q: 'بدون اینترنت هم کار می‌کند؟',
    a: 'بله. اطلاعات دفتر روی خود دستگاه ذخیره می‌شود و همهٔ کارها بدون اینترنت انجام می‌شوند. هر وقت وصل شدید، تغییرات خودکار با دستگاه‌های همکاران هماهنگ می‌شود.',
  },
  {
    q: 'روی مک و گوشی هم کار می‌کند؟',
    a: 'بله. کلید روی ویندوز، مک، آیفون، اندروید و در مرورگر کار می‌کند. روی گوشی، نسخهٔ وب را در Safari یا Chrome باز کنید و «افزودن به صفحهٔ اصلی» را بزنید تا مثل یک برنامه نصب شود.',
  },
  {
    q: 'اطلاعات دفتر و شمارهٔ مالک‌ها امن است؟',
    a: 'اطلاعات روی دستگاه رمزگذاری‌شده نگه داشته می‌شود و فقط دفتر خودتان به آن دسترسی دارد. مدیر دفتر تعیین می‌کند کدام همکار شمارهٔ مالک‌ها را ببیند.',
  },
  {
    q: 'چند نفر از همکاران می‌توانند با هم کار کنند؟',
    a: 'بسته به پلن، از یک نفر تا ده همکار، و بیشتر با هزینهٔ هر نفر. مدیر دفتر همکاران را با شمارهٔ موبایل دعوت می‌کند و هر کس روی دستگاه خودش کار می‌کند.',
  },
  {
    q: 'دورهٔ رایگان چطور است؟',
    a: `هر دفتر تازه ${trialDays} روز همهٔ امکانات کلید را رایگان دارد و کارت بانکی لازم نیست. بعد از آن یکی از پلن‌ها را از داخل برنامه و با درگاه پرداخت امن خریداری می‌کنید.`,
  },
  {
    q: 'اگر اشتراکم تمام شود، اطلاعاتم پاک می‌شود؟',
    a: 'نه. اطلاعات دفتر سر جایش می‌ماند و همچنان می‌توانید همه‌چیز را ببینید؛ فقط ثبت و ویرایش تا تمدید اشتراک بسته می‌شود.',
  },
  {
    q: 'کلید با سایت‌های آگهی ملک چه فرقی دارد؟',
    a: 'کلید سایت آگهی نیست و فایل‌های شما را جایی منتشر نمی‌کند. کلید نرم‌افزار داخلی دفتر خودتان است؛ فایل‌ها، مشتری‌ها و شمارهٔ مالک‌ها فقط پیش شما می‌ماند.',
  },
];

export function faqHtml(): string {
  // name یکسان: با باز شدن یک پرسش بقیه خودشان بسته می‌شوند، بی جاوااسکریپت.
  return faqs.map((x, i) => `<details class="qa" name="faq"${i === 0 ? ' open' : ''}><summary><h3>${x.q}</h3>${icon('down', 'qa-i')}</summary><p>${x.a}</p></details>`).join('\n');
}

/** داده‌های ساخت‌یافته برای گوگل: سازمان، سایت، نرم‌افزار با قیمت‌ها، و پرسش‌ها. */
export function jsonLd(c: SiteConfig): string {
  const prices = PLANS.flatMap((p) => [perMonthOf(p, 'year') * 10, p.monthly * 10]); // درگاه و schema.org ریال می‌خواهند
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${c.site}/#org`, name: 'کلید', alternateName: 'Kelid', url: `${c.site}/`, logo: `${c.site}/icons/icon-192.png` },
      { '@type': 'WebSite', '@id': `${c.site}/#site`, url: `${c.site}/`, name: 'کلید', alternateName: ['Kelid', 'نرم‌افزار املاک کلید'], inLanguage: 'fa-IR', publisher: { '@id': `${c.site}/#org` } },
      {
        '@type': 'SoftwareApplication',
        name: 'کلید',
        alternateName: 'نرم‌افزار املاک کلید',
        description: 'نرم‌افزار مدیریت املاک برای مشاوران و دفترهای املاک: فایل‌ها، مشتری‌ها، بازدیدها و قراردادها؛ روی ویندوز، مک، وب و گوشی، حتی بدون اینترنت.',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'نرم‌افزار املاک',
        operatingSystem: 'Windows 10, Windows 11, macOS, Android, iOS, Web',
        inLanguage: 'fa-IR',
        url: `${c.site}/`,
        downloadUrl: new URL(c.windows, `${c.site}/`).href,
        image: `${c.site}/og.png`,
        publisher: { '@id': `${c.site}/#org` },
        offers: { '@type': 'AggregateOffer', priceCurrency: 'IRR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: PLANS.length },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** سال جاری شمسی برای پانویس. */
export function faYear(): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date()).replace(/[^۰-۹]/g, '');
}

/** آرم سیستم‌عامل‌ها برای دکمه‌های دانلود. */
export function brand(name: string): string {
  const d: Record<string, string> = {
    win: '<path d="M3 5.6 10.4 4.6v7H3zM11.4 4.4 21 3v8.6h-9.6zM3 12.6h7.4v7L3 18.5zM11.4 12.6H21V21l-9.6-1.4z"/>',
    mac: '<path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.9.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1.1.1 2.1-.5 2.8-1.3z"/>',
    and: '<path d="M7.2 9.5h9.6a.6.6 0 0 1 .6.6v7a1.6 1.6 0 0 1-1.6 1.6h-.6v2.4a1.1 1.1 0 0 1-2.2 0v-2.4h-2v2.4a1.1 1.1 0 0 1-2.2 0v-2.4h-.6a1.6 1.6 0 0 1-1.6-1.6v-7a.6.6 0 0 1 .6-.6zM4.9 9.5a1.1 1.1 0 0 1 1.1 1.1v4.6a1.1 1.1 0 0 1-2.2 0v-4.6a1.1 1.1 0 0 1 1.1-1.1zm14.2 0a1.1 1.1 0 0 1 1.1 1.1v4.6a1.1 1.1 0 0 1-2.2 0v-4.6a1.1 1.1 0 0 1 1.1-1.1zM6.7 8.6a5.3 5.3 0 0 1 2.9-4.3l-.9-1.6a.25.25 0 0 1 .43-.25l.92 1.6a5.6 5.6 0 0 1 3.9 0l.92-1.6a.25.25 0 0 1 .43.25l-.9 1.6a5.3 5.3 0 0 1 2.9 4.3zm3-2.2a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2zm4.6 0a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2z"/>',
  };
  const p = d[name];
  if (!p) throw new Error(`unknown brand: ${name}`);
  return `<svg class="os-logo" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}

/** نشان «کلید شمسه»: شمسهٔ هشت‌پر با نگین برنجی، سر کلید روی کاشی زمردی. شناسهٔ گرادیان برای هر جای صفحه جداست. */
export function mark(id: string): string {
  return `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="kg-${id}" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#17654F"/><stop offset=".55" stop-color="#0E4D3F"/><stop offset="1" stop-color="#0A3A30"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#kg-${id})"/><path fill="#fff" fill-rule="evenodd" d="M32 8.42L35.98 12.4L41.6 12.4L41.6 18.02L45.58 22L41.6 25.98L41.6 31.6L35.98 31.6L32 35.58L28.02 31.6L22.4 31.6L22.4 25.98L18.42 22L22.4 18.02L22.4 12.4L28.02 12.4ZM26.4 22a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0-11.2 0Z"/><circle cx="32" cy="22" r="2.9" fill="#C9A86F"/><path fill="#fff" d="M29 31.5H35V43.4H41.6V47.6H35V49.2H39.8V53.4H31.6A2.6 2.6 0 0 1 29 50.8Z"/></svg>`;
}

export const menuIcon = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"></path></svg>';

/** آیفون ۱۷/۱۸ پرومکس با iOS 27: نوار وضعیت دو طرف Dynamic Island، نوار زبانه‌ی شیشه‌ای شناور، فهرست گروه‌بندی‌شده. رنگ بدنه سخت‌افزار است و با پوسته عوض نمی‌شود. */
export function iphone(): string {
  const rows: [string, string, string, string, string, string][] = [
    ['', '۰۵۲', 'آپارتمان ۱۰۵ متری', 'ونک، ملاصدرا', '۲۴ میلیارد', 'متری ۲۲۸ میلیون'],
    ['', '۰۵۱', 'آپارتمان ۹۵ متری', 'یوسف‌آباد', '۱۹ میلیارد', 'متری ۲۰۰ میلیون'],
    ['r', '۰۵۰', 'آپارتمان ۸۰ متری', 'پونک، حصارک', 'ودیعه ۹۰۰ م', 'اجاره ۲۰ میلیون'],
    ['', '۰۲۷', 'آپارتمان ۱۲۰ متری', 'سعادت‌آباد', '۲۸ میلیارد', 'متری ۲۳۳ میلیون'],
    ['f', '۰۴۲', 'آپارتمان ۷۰ متری', 'تهرانپارس', 'رهن ۲٫۲ میلیارد', 'بدون اجاره'],
    ['r', '۰۳۱', 'آپارتمان ۸۵ متری', 'پونک', 'ودیعه ۸۰۰ م', 'اجاره ۲۲ میلیون'],
    ['', '۰۲۹', 'ویلایی ۲۴۰ متری', 'شهران', '۳۱ میلیارد', 'متری ۱۲۹ میلیون'],
    ['r', '۰۲۲', 'آپارتمان ۶۵ متری', 'جنت‌آباد', 'ودیعه ۵۰۰ م', 'اجاره ۱۸ میلیون'],
    ['', '۰۱۸', 'آپارتمان ۱۴۰ متری', 'زعفرانیه', '۵۲ میلیارد', 'متری ۳۷۱ میلیون'],
    ['f', '۰۱۵', 'آپارتمان ۹۰ متری', 'نارمک', 'رهن ۳ میلیارد', 'بدون اجاره'],
  ];
  // آنتن، وای‌فای و باتری با همان اندازه‌های نوار وضعیت iOS (نقطه)
  const signal = `<svg viewBox="0 0 17 11">${[3.6, 5.8, 8.2, 11].map((h, i) => `<rect x="${i * 4.6}" y="${11 - h}" width="3" height="${h}" rx="1"/>`).join('')}</svg>`;
  const sector = (r0: number, r1: number): string => {
    const at = (r: number, deg: number) => `${(8 + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(11.5 + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
    return r0 === 0
      ? `M8 11.5L${at(r1, 225)}A${r1} ${r1} 0 0 1 ${at(r1, 315)}Z`
      : `M${at(r1, 225)}A${r1} ${r1} 0 0 1 ${at(r1, 315)}L${at(r0, 315)}A${r0} ${r0} 0 0 0 ${at(r0, 225)}Z`;
  };
  const wifi = `<svg viewBox="0 0 16 12"><path d="${sector(0, 3.6)}${sector(5.3, 7.9)}${sector(9.5, 11.4)}" stroke="currentColor" stroke-width=".6" stroke-linejoin="round"/></svg>`;
  const battery = '<svg viewBox="0 0 27 13"><rect x=".6" y=".6" width="23.4" height="11.8" rx="3.9" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".38"/><rect x="2.4" y="2.4" width="16.4" height="8.2" rx="2.2"/><path d="M25.4 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" opacity=".42"/></svg>';
  return `<div class="iph" aria-hidden="true">
<i class="iph-b act"></i><i class="iph-b vu"></i><i class="iph-b vd"></i><i class="iph-b pw"></i><i class="iph-b cc"></i>
<div class="iph-scr"><div class="ios">
<div class="ios-bar" dir="ltr"><b>9:41</b><i></i><span>${signal}${wifi}${battery}</span></div>
<span class="ios-island"></span>
<div class="ka">
<div class="ka-nav"><span class="plq s">کلید</span><span class="glass ka-btns">${icon('set')}${icon('more')}</span></div>
<div class="ka-hd"><b>فایل‌ها</b><small>۱۲۸ فایل · ۳ تای تازه امروز</small></div>
<div class="ka-search">${icon('search')}<span>جستجو در فایل‌ها، مشتری‌ها</span>${icon('mic')}</div>
<div class="ka-seg"><span class="on">همه</span><span><i class="sw-s"></i>فروش</span><span><i class="sw-r"></i>رهن و اجاره</span></div>
<div class="ka-list">${rows.map(([c, n, t, pl, pr, sub]) => `<div class="ka-row"><span class="plq s${c ? ` ${c}` : ''}">${n}</span><span class="ka-t"><b>${t}</b><small>${pl}</small></span><span class="ka-p"><b>${pr}</b><small>${sub}</small></span>${icon('chl', 'chev')}</div>`).join('')}</div>
</div>
<div class="ka-tabs"><div class="glass ka-tab"><span>${icon('today')}امروز</span><span class="on">${icon('files')}فایل‌ها</span><span>${icon('users')}مشتری‌ها</span><span>${icon('set')}تنظیمات</span></div><span class="glass ka-add">${icon('plus')}</span></div>
<span class="ios-home"></span>
</div></div>
</div>`;
}

/** تصویر واکنش‌گرا: AVIF و WebP در سه پهنا، تنبل، با اندازهٔ ثابت تا صفحه موقع بار شدن نپرد. */
function art(name: string, widths: number[], sizes: string, alt = ''): string {
  const set = (ext: string) => widths.map((w) => `/art/${name}-${w}.${ext} ${w}w`).join(', ');
  return `<picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/art/${name}-${widths[0]}.webp" srcset="${set('webp')}" sizes="${sizes}" width="1200" height="800" alt="${alt}" loading="lazy" decoding="async"></picture>`;
}

const CITY_NAMES: Array<[string, string]> = [
  ['tehran', 'تهران'], ['isfahan', 'اصفهان'], ['shiraz', 'شیراز'], ['tabriz', 'تبریز'],
  ['yazd', 'یزد'], ['rasht', 'رشت'], ['mashhad', 'مشهد'], ['bushehr', 'بوشهر'],
];

/** نوار شهرها: روی گوشی ورق‌خوردنی، روی صفحهٔ پهن شبکه‌ای چهارتایی. */
export function cities(): string {
  const sizes = '(min-width: 1100px) 300px, (min-width: 700px) 45vw, 78vw';
  return `<ul class="cities">${CITY_NAMES.map(([k, fa]) => `<li>${art(`city-${k}`, [480, 800, 1200], sizes, `شهر ${fa}`)}<span>${fa}</span></li>`).join('')}</ul>`;
}

/** دفتری که شب هم چراغش روشن است؛ پس‌زمینهٔ بخش «اینترنت قطع شد؟». */
export function nightArt(): string {
  return `<div class="night-art" aria-hidden="true">${art('night', [800, 1200, 1600], '100vw')}</div>`;
}
