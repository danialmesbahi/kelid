// تکه‌های HTML که موقع ساخت تولید می‌شوند تا صفحه بی هیچ جاوااسکریپتی کامل به مرورگر و گوگل برسد.
import { bestTerm, perMonthOf, TRIAL_DAYS, type Catalog } from '../../../packages/core/src/plans';
import { toFaDigits } from '../../../packages/core/src/persian';
import { icon } from './icon';
import { catalogStamp, pricingHtml } from './pricing';

export { icon };

export interface SiteConfig {
  /** نشانی خود سایت؛ canonical و نقشهٔ سایت با آن ساخته می‌شوند. */
  site: string;
  /** برنامهٔ وب (همان نسخهٔ گوشی). */
  app: string;
  /** نصب‌کنندهٔ ویندوز. */
  windows: string;
  /** نصب‌کنندهٔ مک (dmg). */
  mac: string;
  /** سرور کلید؛ فهرست پلن‌ها و قیمت‌ها از GET /plans آن می‌آید. خالی = فقط فهرست زمان ساخت. */
  api: string;
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

/** بخش قیمت؛ مرورگر اگر فهرست سرور فرق داشت با src/live.ts از نو می‌سازدش. */
export function pricing(c: Catalog, api: string): string {
  return `<div id="pricing-live" class="pricing-live" data-v="${catalogStamp(c, TRIAL_DAYS)}"${api ? ` data-api="${api}"` : ''}>
${pricingHtml(c, TRIAL_DAYS)}
</div>`;
}

export const trialDays = toFaDigits(TRIAL_DAYS);

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
    q: 'کلید هوش مصنوعی دارد؟ پر کردن فرم با صدا چطور کار می‌کند؟',
    a: 'بله. کلید اولین نرم‌افزار املاک ایران است که فرم‌ها را با هوش مصنوعی پر می‌کند. در فرم فایل یا مشتری دکمهٔ میکروفون را بزنید و مشخصات را به فارسی محاوره‌ای بگویید؛ هوش مصنوعی کلید معامله، نوع ملک، محله، خیابان، متراژ، خواب، طبقه، قیمت و شمارهٔ مالک را می‌فهمد و هر کدام را در جای خودش می‌نویسد. فقط چیزهایی که گفته‌اید عوض می‌شود و با یک دکمه برمی‌گردد. این بخش اینترنت لازم دارد.',
  },
  {
    q: 'محله‌ها و خیابان‌های کدام شهرها در کلید هست؟',
    a: 'محله‌ها و خیابان‌های ۱٬۰۱۰ شهر ایران، از تهران و مشهد و اصفهان تا شهرهای کوچک، همراه با منطقه‌بندی شهر در کلید هست. هنگام ثبت فایل، دو حرف از نام محله کافی است تا پیشنهاد شود و خیابان‌های همان محله جلو بیاید؛ این پیشنهادها بدون اینترنت هم کار می‌کنند.',
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

/** مدت فیلم هوش مصنوعی (public/ai) به شکل ISO 8601؛ با هر رندر تازه به‌روز شود. */
const AI_FILM_DURATION = 'PT22S';

/** داده‌های ساخت‌یافته برای گوگل: سازمان، سایت، نرم‌افزار با قیمت‌ها، و پرسش‌ها. */
export function jsonLd(c: SiteConfig, cat: Catalog): string {
  const best = bestTerm(cat.terms);
  const prices = cat.plans.flatMap((p) => [(best ? perMonthOf(p, best) : p.monthly) * 10, p.monthly * 10]); // درگاه و schema.org ریال می‌خواهند
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${c.site}/#org`, name: 'کلید', alternateName: 'Kelid', url: `${c.site}/`, logo: `${c.site}/icons/icon-192.png` },
      { '@type': 'WebSite', '@id': `${c.site}/#site`, url: `${c.site}/`, name: 'کلید', alternateName: ['Kelid', 'نرم‌افزار املاک کلید'], inLanguage: 'fa-IR', publisher: { '@id': `${c.site}/#org` } },
      {
        '@type': 'SoftwareApplication',
        name: 'کلید',
        alternateName: 'نرم‌افزار املاک کلید',
        description: 'اولین نرم‌افزار املاک با هوش مصنوعی در ایران، برای مشاوران و دفترهای املاک: پر کردن فرم فایل و مشتری با صدا، پیشنهاد هوشمند محله و خیابان، پیدا کردن مشتری جور، بازدیدها و قراردادها؛ روی ویندوز، مک، وب و گوشی، حتی بدون اینترنت.',
        featureList: [
          'پر کردن فرم فایل و مشتری با صدا و هوش مصنوعی',
          'پیشنهاد هوشمند محله و خیابان در ۱٬۰۱۰ شهر ایران',
          'پیدا کردن خودکار مشتری جور برای هر فایل',
          'تقویم شمسی بازدید و یادآوری',
          'ثبت قرارداد و کمیسیون',
          'کار کامل بدون اینترنت با همگام‌سازی خودکار',
        ],
        keywords: 'نرم افزار املاک, نرم افزار املاک هوش مصنوعی, هوش مصنوعی املاک, هوش مصنوعی مشاور املاک, نرم افزار مشاور املاک, پر کردن فرم با صدا, نرم افزار فایلینگ املاک',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'نرم‌افزار املاک',
        operatingSystem: 'Windows 10, Windows 11, macOS, Android, iOS, Web',
        inLanguage: 'fa-IR',
        url: `${c.site}/`,
        downloadUrl: new URL(c.windows, `${c.site}/`).href,
        image: `${c.site}/og.png`,
        publisher: { '@id': `${c.site}/#org` },
        offers: { '@type': 'AggregateOffer', priceCurrency: 'IRR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: cat.plans.length },
      },
      {
        '@type': 'VideoObject',
        name: 'هوش مصنوعی کلید: پر کردن فرم فایل با صدا و پیشنهاد هوشمند محله و خیابان',
        description: 'مشاور املاک مشخصات فایل را می‌گوید و هوش مصنوعی کلید فرم را پر می‌کند؛ بعد محله و خیابان از نقشهٔ شهر پیشنهاد می‌شود. اولین نرم‌افزار املاک با هوش مصنوعی در ایران.',
        thumbnailUrl: `${c.site}/ai/poster.jpg`,
        contentUrl: `${c.site}/ai/kelid-ai.mp4`,
        uploadDate: '2026-10-31',
        duration: AI_FILM_DURATION,
        inLanguage: 'fa-IR',
        publisher: { '@id': `${c.site}/#org` },
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

/** دو خط نامساوی به‌جای همبرگر سه‌خطی معمول؛ آرام‌تر و خاص‌تر. */
export const menuIcon = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M9 15h10"></path></svg>';

/** آیفون ۱۷/۱۸ پرومکس با iOS 27: نوار وضعیت دو طرف Dynamic Island، نوار زبانه‌ی شیشه‌ای شناور، فهرست گروه‌بندی‌شده. رنگ بدنه سخت‌افزار است و با پوسته عوض نمی‌شود. */
export function iphone(): string {
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
<picture class="ios-shot"><img src="/art/app-phone-780.webp" width="780" height="1594" alt="" loading="lazy" decoding="async"></picture>
<span class="ios-home"></span>
</div></div>
</div>`;
}

/** تصویر واکنش‌گرا: AVIF و WebP در سه پهنا، تنبل، با اندازهٔ ثابت تا صفحه موقع بار شدن نپرد. */
function art(name: string, widths: number[], sizes: string, alt = '', size: [number, number] = [1200, 800], extra = 'loading="lazy"'): string {
  const set = (ext: string) => widths.map((w) => `/art/${name}-${w}.${ext} ${w}w`).join(', ');
  return `<picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><img src="/art/${name}-${widths[0]}.webp" srcset="${set('webp')}" sizes="${sizes}" width="${size[0]}" height="${size[1]}" alt="${alt}" ${extra} decoding="async"></picture>`;
}

const HERO_WIDTHS = [768, 1152, 1536];

/** میزی تنها روی تپه‌ای بالای تهرانِ مه‌گرفته در سپیده‌دم: «دفترتان هر جا باشید همراهتان است». نیمهٔ بالایش آسمان خالی است تا نوشته‌ها خوانا بمانند. */
export function heroArt(): string {
  return `<div class="hero-art" aria-hidden="true">${art('hero', HERO_WIDTHS, '100vw', '', [1536, 1024], 'fetchpriority="high"')}</div>`;
}

/** پیش‌بارگذاری تصویر سرصفحه در head تا مرورگر پیش از خواندن CSS سراغش برود. */
export function heroPreload(): string {
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${HERO_WIDTHS.map((w) => `/art/hero-${w}.avif ${w}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">`;
}

/** عکس واقعی برنامه (npm run shots) در قاب پنجرهٔ دسکتاپ؛ پیش‌نمایش همیشه همان طراحی امروز برنامه است. */
export function appDesktop(): string {
  return `<picture class="win-shot"><img src="/art/app-desktop-1280.webp" srcset="/art/app-desktop-1280.webp 1280w, /art/app-desktop-2560.webp 2560w" sizes="(min-width: 1280px) 1200px, 94vw" width="1280" height="800" alt="" decoding="async"></picture>`;
}

/** عکس واقعی یک صفحهٔ برنامه در اندازهٔ گوشی، برای کارت‌های «چهار قدم». */
export function appShot(name: string): string {
  return `<img class="step-shot" src="/art/${name}-860.webp" width="860" height="1120" alt="" loading="lazy" decoding="async">`;
}

const CITY_NAMES: Array<[string, string]> = [
  ['tehran', 'تهران'], ['isfahan', 'اصفهان'], ['shiraz', 'شیراز'], ['tabriz', 'تبریز'],
  ['yazd', 'یزد'], ['rasht', 'رشت'], ['mashhad', 'مشهد'], ['bushehr', 'بوشهر'],
];

/** شهرها به شکل موزاییک: تهران بزرگ، بوشهر پهن، بقیه کوچک؛ روی گوشی موزاییک فشردهٔ ۴×۲. */
export function cities(): string {
  const big = '(min-width: 1100px) 600px, (min-width: 701px) 92vw, 25vw';
  const small = '(min-width: 1100px) 300px, (min-width: 701px) 46vw, 25vw';
  return `<ul class="cities">${CITY_NAMES.map(([k, fa], i) => `<li class="c-${k}">${art(`city-${k}`, [480, 800, 1200], i === 0 || k === 'bushehr' ? big : small, `شهر ${fa}`)}<span>${fa}</span></li>`).join('')}</ul>`;
}

/** خیابان بارانی رشت با پنجره‌های روشن، در قاب کنار متن بخش «اینترنت قطع شد؟»؛ متن روی تصویر نمی‌رود تا خوانا بماند. */
export function offlineArt(): string {
  return `<figure class="off-art" aria-hidden="true">${art('city-rasht', [480, 800, 1200], '(min-width: 920px) 560px, 92vw')}<span class="off-badge">${icon('cloud')}<span><b>اینترنت قطع است</b><small>همه‌چیز روی همین دستگاه ذخیره شد</small></span></span></figure>`;
}

/** دفتری که شب چراغش روشن است، زیر جملهٔ «امشب که چراغ دفتر را خاموش می‌کنید». */
export function finalArt(): string {
  return `<div class="final-art" aria-hidden="true">${art('night', [800, 1200, 1600], '100vw')}</div>`;
}

/** در باز و استکان چای کنار پرسش‌ها: یعنی بپرسید، دفتر باز است. */
export function faqArt(): string {
  return `<div class="faq-art">${art('welcome', [400, 800], '(min-width: 920px) 380px, 90vw', '', [800, 800])}</div>`;
}

/** کد QR برای نشانی صفحه، هنگام ساخت؛ بی وابستگی. حالت بایت، تصحیح خطای M، نسخهٔ ۱ تا ۶ (تا ۱۰۶ بایت). */
export function qr(text: string): string {
  const data = [...new TextEncoder().encode(text)];
  // [کل کدواژه‌ها، کدواژهٔ تصحیح در هر بلوک، تعداد بلوک] برای سطح M
  const spec: [number, number, number][] = [[26, 10, 1], [44, 16, 1], [70, 26, 1], [100, 18, 2], [134, 24, 2], [172, 16, 4]];
  const ver = spec.findIndex(([t, e, b]) => t - e * b >= data.length + 2) + 1;
  const s = spec[ver - 1];
  if (!s) throw new Error(`qr: text too long (${data.length} bytes)`);
  const [total, ecLen, blocks] = s;
  const cap = total - ecLen * blocks;

  // رشتهٔ بیت‌ها: حالت بایت، طول، داده، پایان‌دهنده و پرکننده
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(data.length, 8); data.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; words.length < cap; p++) words.push(p % 2 ? 0x11 : 0xec);

  // Reed–Solomon روی GF(256)
  const mul = (x: number, y: number) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
  const div: number[] = Array<number>(ecLen - 1).fill(0).concat(1);
  for (let i = 0, root = 1; i < ecLen; i++, root = mul(root, 2)) {
    for (let j = 0; j < div.length; j++) div[j] = mul(div[j]!, root) ^ (div[j + 1] ?? 0);
  }
  const per = cap / blocks;
  const dataBlocks = Array.from({ length: blocks }, (_, b) => words.slice(b * per, (b + 1) * per));
  const ecBlocks = dataBlocks.map((blk) => {
    const r = Array<number>(ecLen).fill(0);
    for (const b of blk) { const f = b ^ r.shift()!; r.push(0); div.forEach((c, i) => { r[i]! ^= mul(c, f); }); }
    return r;
  });
  const codewords: number[] = [];
  for (let i = 0; i < per; i++) dataBlocks.forEach((blk) => codewords.push(blk[i]!));
  for (let i = 0; i < ecLen; i++) ecBlocks.forEach((blk) => codewords.push(blk[i]!));

  // ماتریس: الگوهای ثابت، سپس داده به‌صورت زیگزاگ
  const size = ver * 4 + 17;
  const dark = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (x: number, y: number, on: boolean) => { dark[y]![x] = on; fixed[y]![x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  if (ver > 1) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(size - 7 + dx, size - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const format = (mask: number) => {
    const d = mask; // بیت‌های سطح M صفر است
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412, bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  for (let right = size - 1, i = 0; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
      if (!fixed[y]![x] && i < codewords.length * 8) { dark[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }

  // ماسکی که کم‌ترین جریمه را دارد (قاعده‌های ۱، ۲ و ۴ استاندارد)
  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0, (_: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0, (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0, (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const apply = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y]![x] && masks[m]!(x, y)) dark[y]![x] = !dark[y]![x]; };
  const at = (x: number, y: number) => dark[y]![x]!;
  const penalty = () => {
    let p = 0, n = 0;
    for (let a = 0; a < size; a++) for (const get of [(b: number) => at(b, a), (b: number) => at(a, b)]) {
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && get(b) === get(b - 1)) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) p += 3;
    }
    for (const row of dark) for (const c of row) if (c) n++;
    return p + Math.floor(Math.abs((n * 20) / (size * size) - 10)) * 10;
  };
  let best = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) { apply(m); format(m); const sc = penalty(); if (sc < bestScore) { best = m; bestScore = sc; } apply(m); }
  apply(best); format(best);

  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (dark[y]![x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="qr" viewBox="-4 -4 ${size + 8} ${size + 8}" role="img" aria-label="کد QR صفحهٔ دانلود کلید" shape-rendering="crispEdges"><rect x="-4" y="-4" width="${size + 8}" height="${size + 8}" fill="#fff"/><path fill="#14171C" d="${d}"/></svg>`;
}

/** پنجرهٔ برنامهٔ رایانه برای سرصفحه و کارت دانلود، با عکس واقعی صفحهٔ فایل‌ها (npm run shots). */
export function desktop(): string {
  return `<div class="win"><div class="win-bar"><i></i><i></i><i></i><span>کلید · فایل‌ها</span></div>${appDesktop()}</div>`;
}
