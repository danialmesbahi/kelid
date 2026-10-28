import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

/**
 * صفحه‌های کوچک HTML که مرورگر کاربر بعد از درگاه می‌بیند؛ همان رنگ‌ها و فونت برنامه. بدون اسکریپت: CSP صفحه فقط استایل درون‌خطی
 * و فونت همین سرور را اجازه می‌دهد (headers.ts). برگشت خودکار با meta refresh است، نه اسکریپت.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface PageAction {
  label: string;
  href: string;
  primary?: boolean;
}

/** نشانی فونت؛ همین سرور آن را از بستهٔ vazirmatn می‌دهد (fontFile). */
export const FONT_PATH = '/billing/font.woff2';

let font: Promise<Buffer | null> | null = null;
/** فونت وزیرمتن یک بار از node_modules خوانده می‌شود؛ نبودنش صفحه را خراب نمی‌کند، فقط فونت سیستم می‌آید. */
export function fontFile(): Promise<Buffer | null> {
  font ??= readFile(createRequire(import.meta.url).resolve('vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2')).catch(() => null);
  return font;
}

// آیکون‌های خطی همان سیستم طراحی (packages/ui/src/icons.ts).
const ICON = {
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
const icon = (name: keyof typeof ICON, cls = '') => `<svg class="ic${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// نشان کلید (packages/ui/src/logo.svg).
const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#17654F"/><stop offset=".55" stop-color="#0E4D3F"/><stop offset="1" stop-color="#0A3A30"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#kg)"/><path fill="#fff" fill-rule="evenodd" d="M32 8.42L35.98 12.4L41.6 12.4L41.6 18.02L45.58 22L41.6 25.98L41.6 31.6L35.98 31.6L32 35.58L28.02 31.6L22.4 31.6L22.4 25.98L18.42 22L22.4 18.02L22.4 12.4L28.02 12.4ZM26.4 22a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0-11.2 0Z"/><circle cx="32" cy="22" r="2.9" fill="#C9A86F"/><path fill="#fff" d="M29 31.5H35V43.4H41.6V47.6H35V49.2H39.8V53.4H31.6A2.6 2.6 0 0 1 29 50.8Z"/></svg>`;

export function page(p: {
  tone: 'ok' | 'bad' | 'info' | 'wait';
  title: string;
  lines: string[];
  /** ردیف‌های رسید: [عنوان، مقدار] */
  rows?: [string, string][];
  actions?: PageAction[];
  note?: string;
  /** بعد از چند ثانیه خودکار به این نشانی (یا بی نشانی: همین صفحه) می‌رود. */
  refresh?: { seconds: number; url?: string; text: string };
  /** درگاه آزمایشی زرین‌پال نیست. */
  dev?: boolean;
}): string {
  const mark = p.tone === 'ok' ? icon('check', ' thick') : p.tone === 'bad' ? icon('x', ' thick') : icon('card');
  const actions = (p.actions ?? []).map((a) => `<a class="btn${a.primary ? ' p' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
  const rows = (p.rows ?? []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const r = p.refresh;
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
${r ? `<meta http-equiv="refresh" content="${r.seconds}${r.url ? `;url=${esc(r.url)}` : ''}">` : ''}
<title>${esc(p.title)} — کلید</title>
<style>
@font-face{font-family:'Vazirmatn';src:url('${FONT_PATH}') format('woff2');font-weight:100 900;font-display:swap}
:root{--bg:#EFEEEA;--paper:#fff;--sunk:#F2F1ED;--line:#E6E5E0;--line2:#D3D1CA;--ink:#121412;--ink2:#383D3A;--mute:#5C625E;--faint:#737874;--pri:#0E4D3F;--pri-ink:#fff;--pri-tint:#E5EFEA;--pri-text:#0E4D3F;--brass:#A7834A;--bad:#B42318;--bad-tint:#FBEAE8;--sh:0 1px 2px rgba(18,20,18,.05),0 24px 48px -28px rgba(18,20,18,.28);color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0B0C0B;--paper:#141614;--sunk:#1D201D;--line:#262926;--line2:#383C38;--ink:#ECEDE9;--ink2:#C9CDC8;--mute:#9DA39E;--faint:#858B86;--pri:#3A9A7F;--pri-ink:#04110D;--pri-tint:#15302A;--pri-text:#7DD0B5;--brass:#C9A86F;--bad:#F2867B;--bad-tint:#2E1715;--sh:0 1px 2px rgba(0,0,0,.4),0 24px 48px -28px rgba(0,0,0,.8);color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px 16px;background:var(--bg) radial-gradient(120% 60% at 50% -10%,var(--pri-tint),transparent 60%) no-repeat;color:var(--ink);font:15px/1.6 Vazirmatn,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;color:var(--ink)}
.logo{width:34px;height:34px;flex:none}
main{width:100%;max-width:460px;background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:var(--sh);padding:36px 28px 28px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;animation:enter .45s cubic-bezier(.2,.8,.2,1) both}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ic.thick{stroke-width:2.4}
.mk{width:76px;height:76px;margin-bottom:10px;border-radius:24px;display:grid;place-items:center;background:var(--pri-tint);color:var(--pri-text)}
.mk .ic{width:36px;height:36px}
.mk.ok{animation:stamp .7s .15s cubic-bezier(.2,1.4,.4,1) both}
.mk.bad{background:var(--bad-tint);color:var(--bad)}
.mk.wait{animation:breathe 2.4s ease-in-out infinite}
h1{margin:0;font-size:24px;font-weight:800;line-height:1.5}
p{margin:0;color:var(--mute);line-height:1.9}
p.lead{color:var(--ink2);font-weight:600;font-size:16px}
dl{width:100%;margin:14px 0 0;padding:4px 16px;border-radius:14px;background:var(--sunk);text-align:start}
dl div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px dashed var(--line2)}
dl div:first-child{border-top:0}
dt{color:var(--mute);font-size:14px}
dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums;unicode-bidi:plaintext}
.acts{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:20px}
.btn{display:flex;align-items:center;justify-content:center;height:54px;border-radius:14px;border:1px solid var(--line2);background:var(--paper);color:var(--ink);text-decoration:none;font-weight:700;font-size:16px;transition:filter .15s}
.btn.p{background:var(--pri);border-color:var(--pri);color:var(--pri-ink)}
.btn:hover{filter:brightness(.96)}
.btn:focus-visible{outline:2px solid var(--pri-text);outline-offset:2px}
.auto{width:100%;margin-top:14px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--mute)}
.bar{height:4px;border-radius:4px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--pri);transform-origin:right;animation:bar var(--t) linear both}
.dots{display:inline-flex;gap:6px;margin-top:8px}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--pri);opacity:.25;animation:dot 1.2s infinite}
.dots i:nth-child(2){animation-delay:.2s}
.dots i:nth-child(3){animation-delay:.4s}
.note{margin-top:16px;font-size:13px;color:var(--faint)}
.safe{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--faint)}
.safe .ic{width:16px;height:16px;color:var(--brass)}
@keyframes enter{from{opacity:0;transform:translateY(10px)}}
@keyframes stamp{0%{opacity:0;transform:scale(1.8) rotate(-6deg)}60%{opacity:1;transform:scale(.96) rotate(1deg)}100%{transform:none}}
@keyframes breathe{50%{transform:scale(.94);opacity:.8}}
@keyframes dot{40%{opacity:1}}
@keyframes bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (max-width:420px){main{padding:30px 20px 22px}h1{font-size:22px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="brand">${LOGO}<span>کلید</span></div>
<main>
<div class="mk ${p.tone}" aria-hidden="true">${mark}</div>
<h1>${esc(p.title)}</h1>
${p.lines.map((l, i) => `<p${i === 0 ? ' class="lead"' : ''}>${esc(l)}</p>`).join('\n')}
${p.tone === 'wait' ? '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
${rows ? `<dl>${rows}</dl>` : ''}
${actions ? `<div class="acts">${actions}</div>` : ''}
${r ? `<div class="auto" role="status"><span>${esc(r.text)}</span><div class="bar" style="--t:${r.seconds}s"><i></i></div></div>` : ''}
${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
</main>
${p.dev ? '' : `<div class="safe">${icon('shield')}<span>پرداخت امن با درگاه بانکی زرین‌پال</span></div>`}
</body>
</html>`;
}
