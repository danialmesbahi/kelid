// تکه‌های HTML که موقع ساخت تولید می‌شوند تا صفحه بی هیچ جاوااسکریپتی کامل به مرورگر و گوگل برسد.
import { iconPaths, type IconName } from '../../../packages/ui/src/icons';
import { PLANS, TRIAL_DAYS, YEAR_MONTHS, priceOf } from '../../../packages/core/src/plans';
import { formatGrouped } from '../../../packages/core/src/format';
import { toFaDigits } from '../../../packages/core/src/persian';

export interface SiteConfig {
  /** نشانی خود سایت؛ canonical و نقشهٔ سایت با آن ساخته می‌شوند. */
  site: string;
  /** برنامهٔ وب (همان نسخهٔ گوشی). */
  app: string;
  /** نصب‌کنندهٔ ویندوز. */
  windows: string;
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

const fa = (n: number) => toFaDigits(formatGrouped(n));

/** کارت‌های قیمت از همان پلن‌های برنامه؛ قیمت فقط یک جا (packages/core) عوض می‌شود. */
export function plans(): string {
  return PLANS.map((p) => {
    const hot = p.id === 'office';
    const yearly = priceOf(p, 'year');
    return `<article class="plan${hot ? ' hot' : ''}">
${hot ? '<span class="plan-badge">انتخاب بیشتر دفترها</span>' : ''}
<h3 class="plan-name">${p.name}</h3>
<p class="plan-blurb">${p.blurb}</p>
<p class="plan-price"><span class="pm"><b class="num">${fa(p.monthly)}</b> تومان <small>ماهانه</small></span><span class="py"><b class="num">${fa(Math.round(yearly / 12 / 1000) * 1000)}</b> تومان <small>ماهانه، با پرداخت سالانه</small></span></p>
<p class="plan-year py">سالانه <span class="num">${fa(yearly)}</span> تومان</p>
<ul class="plan-list">
<li>${icon('users', 's')}${p.seats === 1 ? 'یک نفر' : `تا ${toFaDigits(p.seats)} همکار`}</li>
<li>${icon('check', 's')}همهٔ امکانات، بدون محدودیت فایل</li>
<li>${icon('check', 's')}ویندوز، وب و گوشی با هم</li>
<li>${icon('check', 's')}${toFaDigits(TRIAL_DAYS)} روز رایگان، بدون کارت بانکی</li>
</ul>
<a class="btn btn-lg btn-w ${hot ? 'btn-p' : 'btn-s'}" href="#download">شروع رایگان</a>
</article>`;
  }).join('\n');
}

export const trialDays = toFaDigits(TRIAL_DAYS);
export const yearGift = toFaDigits(12 - YEAR_MONTHS);

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
    q: 'روی گوشی هم می‌شود از کلید استفاده کرد؟',
    a: 'بله. کلید روی ویندوز، در مرورگر و روی گوشی‌های اندروید و آیفون کار می‌کند. روی گوشی کافی است نسخهٔ وب را باز کنید و آن را به صفحهٔ اصلی گوشی اضافه کنید تا مثل یک برنامه باز شود.',
  },
  {
    q: 'اطلاعات دفتر و شمارهٔ مالک‌ها امن است؟',
    a: 'اطلاعات روی دستگاه رمزگذاری‌شده نگه داشته می‌شود و فقط دفتر خودتان به آن دسترسی دارد. مدیر دفتر تعیین می‌کند کدام همکار شمارهٔ مالک‌ها را ببیند.',
  },
  {
    q: 'چند نفر از همکاران می‌توانند با هم کار کنند؟',
    a: 'بسته به پلن، از یک نفر تا پانزده همکار. مدیر دفتر همکاران را با شمارهٔ موبایل دعوت می‌کند و هر کس روی دستگاه خودش کار می‌کند.',
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
  return faqs.map((x, i) => `<details class="qa"${i === 0 ? ' open' : ''}><summary><h3>${x.q}</h3>${icon('down', 'qa-i')}</summary><p>${x.a}</p></details>`).join('\n');
}

/** داده‌های ساخت‌یافته برای گوگل: سازمان، سایت، نرم‌افزار با قیمت‌ها، و پرسش‌ها. */
export function jsonLd(c: SiteConfig): string {
  const prices = PLANS.map((p) => p.monthly * 10); // درگاه و schema.org ریال می‌خواهند
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${c.site}/#org`, name: 'کلید', alternateName: 'Kelid', url: `${c.site}/`, logo: `${c.site}/icons/icon-192.png` },
      { '@type': 'WebSite', '@id': `${c.site}/#site`, url: `${c.site}/`, name: 'کلید', alternateName: ['Kelid', 'نرم‌افزار املاک کلید'], inLanguage: 'fa-IR', publisher: { '@id': `${c.site}/#org` } },
      {
        '@type': 'SoftwareApplication',
        name: 'کلید',
        alternateName: 'نرم‌افزار املاک کلید',
        description: 'نرم‌افزار مدیریت املاک برای مشاوران و دفترهای املاک: فایل‌ها، مشتری‌ها، بازدیدها و قراردادها؛ روی ویندوز، وب و گوشی، حتی بدون اینترنت.',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'نرم‌افزار املاک',
        operatingSystem: 'Windows 10, Windows 11, Android, iOS, Web',
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

/** گوشی نمونه با فهرست فایل‌ها؛ هم در سرصفحه (گوشی) و هم در بخش دانلود. */
export function phone(): string {
  const rows: [string, string, string, string][] = [
    ['', '۰۵۲', 'آپارتمان ۱۰۵ متری', 'ونک · ۲۴ میلیارد'],
    ['r', '۰۵۰', 'آپارتمان ۸۰ متری', 'پونک · ۹۰۰ میلیون'],
    ['f', '۰۴۷', 'آپارتمان ۹۵ متری', 'یوسف‌آباد · ۳٫۵ میلیارد'],
    ['', '۰۴۴', 'مغازهٔ ۴۰ متری', 'سعادت‌آباد · ۱۲ میلیارد'],
    ['r', '۰۴۱', 'آپارتمان ۶۵ متری', 'شهرک غرب · ۶۰۰ میلیون'],
  ];
  return `<div class="ph-scr">
<div class="ph-st"><b>۹:۴۱</b><span></span></div>
<div class="ph-hd"><small>عصر بخیر</small><b>فایل‌ها</b></div>
<span class="m-search">${icon('search', 's')}جستجو…</span>
<div class="ph-list">${rows.map(([c, n, t, s]) => `<div class="ph-row"><span class="plq s${c ? ` ${c}` : ''}">${n}</span><span><b>${t}</b><small>${s}</small></span></div>`).join('')}</div>
<div class="ph-tab"><span class="on">${icon('today', 's')}</span><span>${icon('files', 's')}</span><span class="fab">${icon('plus', 's')}</span><span>${icon('users', 's')}</span><span>${icon('cal', 's')}</span></div>
</div>`;
}
