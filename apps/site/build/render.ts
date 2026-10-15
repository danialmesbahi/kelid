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

const fa = (n: number) => toFaDigits(formatGrouped(n));

const kTooman = (n: number) => `${toFaDigits(Math.round(n / 1000))} هزار تومان`;

/** کارت‌های قیمت از همان پلن‌های برنامه؛ قیمت فقط یک جا (packages/core) عوض می‌شود. سالانه پیش‌فرض است. */
export function plans(): string {
  return PLANS.map((p) => {
    const hot = p.id === 'office';
    const yearly = priceOf(p, 'year');
    const perMonthYearly = Math.round(yearly / 12 / 1000) * 1000;
    const avatars = ['ر', 'م', 'س', 'ن', 'ک'].slice(0, Math.min(p.seats, 4));
    const more = p.seats > 4 ? `<span class="av plus">+${toFaDigits(p.seats - 4)}</span>` : '';
    return `<article class="plan${hot ? ' hot' : ''}">
${hot ? `<span class="plan-badge">${icon('gem', 's')}پیشنهاد ما برای بیشتر دفترها</span>` : ''}
<h3 class="plan-name">${p.name}</h3>
<p class="plan-blurb">${p.blurb}</p>
<div class="plan-seats"><span class="avs">${avatars.map((a) => `<span class="av">${a}</span>`).join('')}${more}</span><b>${p.seats === 1 ? 'یک نفر' : `تا ${toFaDigits(p.seats)} همکار`}</b></div>
<div class="plan-price">
<p class="py"><s class="num">${fa(p.monthly)}</s><span class="save">${toFaDigits(Math.round((1 - YEAR_MONTHS / 12) * 100))}٪ کمتر</span></p>
<p class="pp"><b class="num py">${fa(perMonthYearly)}</b><b class="num pm">${fa(p.monthly)}</b><span>تومان در ماه</span></p>
<p class="pnote py">سالانه <span class="num">${fa(yearly)}</span> تومان · روزی حدود ${kTooman(yearly / 365)}</p>
<p class="pnote pm">پرداخت ماهانه · روزی حدود ${kTooman(p.monthly / 30)}</p>
</div>
<a class="btn btn-lg btn-w ${hot ? 'btn-gold' : 'btn-d'}" href="#download">${trialDays} روز رایگان امتحان کنید</a>
<p class="plan-safe">${icon('check', 's')}بدون کارت بانکی، بدون تعهد</p>
</article>`;
  }).join('\n');
}

export const trialDays = toFaDigits(TRIAL_DAYS);
export const saveYear = (() => { const p = PLANS.find((x) => x.id === 'office') ?? PLANS[0]!; return kTooman(p.monthly * 12 - priceOf(p, 'year')); })();
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
    q: 'روی مک و گوشی هم کار می‌کند؟',
    a: 'بله. کلید روی ویندوز، مک، آیفون، اندروید و در مرورگر کار می‌کند. روی گوشی، نسخهٔ وب را در Safari یا Chrome باز کنید و «افزودن به صفحهٔ اصلی» را بزنید تا مثل یک برنامه نصب شود.',
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
  // name یکسان: با باز شدن یک پرسش بقیه خودشان بسته می‌شوند، بی جاوااسکریپت.
  return faqs.map((x, i) => `<details class="qa" name="faq"${i === 0 ? ' open' : ''}><summary><h3>${x.q}</h3>${icon('down', 'qa-i')}</summary><p>${x.a}</p></details>`).join('\n');
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

export const menuIcon = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"></path></svg>';

/** آیفون ۱۸ پرومکس با نوار وضعیت iOS و کلید نصب‌شده روی آن؛ رنگ بدنه سخت‌افزار است و با پوسته عوض نمی‌شود. */
export function iphone(): string {
  const rows: [string, string, string, string, string, string][] = [
    ['', '۰۵۲', 'آپارتمان ۱۰۵ متری', 'ونک، ملاصدرا', '۲۴ میلیارد', 'متری ۲۲۸ میلیون'],
    ['', '۰۵۱', 'آپارتمان ۹۵ متری', 'یوسف‌آباد', '۱۹ میلیارد', 'متری ۲۰۰ میلیون'],
    ['r', '۰۵۰', 'آپارتمان ۸۰ متری', 'پونک، حصارک', 'ودیعه ۹۰۰ م', 'اجاره ۲۰ میلیون'],
    ['', '۰۲۷', 'آپارتمان ۱۲۰ متری', 'سعادت‌آباد', '۲۸ میلیارد', 'متری ۲۳۳ میلیون'],
    ['f', '۰۴۲', 'آپارتمان ۷۰ متری', 'تهرانپارس', 'رهن ۲٫۲ میلیارد', 'بدون اجاره'],
    ['r', '۰۳۱', 'آپارتمان ۸۵ متری', 'پونک', 'ودیعه ۸۰۰ م', 'اجاره ۲۲ میلیون'],
  ];
  const signal = '<svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg>';
  const wifi = '<svg viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.3 10.3 0 0 0 8 .4 10.3 10.3 0 0 0 .8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.6 6.6 0 0 0 8 4a6.6 6.6 0 0 0-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3zM8 9.4 9.9 7.3a2.8 2.8 0 0 0-3.8 0z"/></svg>';
  const battery = '<svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.4" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="2"/><path d="M25 4v4c.8-.3 1.3-1.1 1.3-2S25.8 4.3 25 4z" opacity=".45"/></svg>';
  return `<div class="iph" aria-hidden="true">
<i class="iph-b act"></i><i class="iph-b vu"></i><i class="iph-b vd"></i><i class="iph-b pw"></i><i class="iph-b cc"></i>
<div class="iph-scr">
<div class="ios-bar"><b>۹:۴۱</b><span>${signal}${wifi}${battery}</span></div>
<span class="iph-island"></span>
<div class="ka">
<div class="ka-top"><span class="plq s">کلید</span><span class="ka-search">${icon('search', 's')}جستجو در فایل‌ها، مشتری‌ها…</span></div>
<div class="ka-hd"><b>فایل‌ها</b><small>۱۲۸ فایل</small></div>
<div class="ka-seg"><span class="on">همه ۱۲۸</span><span><i class="sw-s"></i>فروش ۵۴</span><span><i class="sw-r"></i>رهن و اجاره ۵۱</span></div>
<div class="ka-list">${rows.map(([c, n, t, pl, pr, sub], i) => `<div class="ka-row${i === 0 ? ' sel' : ''}"><span class="plq s${c ? ` ${c}` : ''}">${n}</span><span class="ka-t"><b>${t}</b><small>${pl}</small></span><span class="ka-p"><b>${pr}</b><small>${sub}</small></span></div>`).join('')}</div>
<div class="ka-tab"><span>${icon('today', 's')}امروز</span><span class="on">${icon('files', 's')}فایل‌ها</span><span class="fab">${icon('plus')}</span><span>${icon('users', 's')}مشتری‌ها</span><span>${icon('set', 's')}تنظیمات</span></div>
</div>
<span class="ios-home"></span>
</div>
</div>`;
}
