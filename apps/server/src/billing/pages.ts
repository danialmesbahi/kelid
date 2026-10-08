/**
 * صفحه‌های کوچک HTML که مرورگر کاربر بعد از درگاه می‌بیند. بدون اسکریپت؛ CSP صفحه فقط استایل درون‌خطی را اجازه می‌دهد (app.ts).
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface PageAction {
  label: string;
  href: string;
  primary?: boolean;
}

export function page(p: { tone: 'ok' | 'bad' | 'info'; title: string; lines: string[]; actions?: PageAction[]; note?: string }): string {
  const mark = p.tone === 'ok' ? '✓' : p.tone === 'bad' ? '!' : 'ک';
  const actions = (p.actions ?? []).map((a) => `<a class="btn${a.primary ? ' p' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('');
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${esc(p.title)} — کلید</title>
<style>
:root{--bg:#EFEEEA;--paper:#fff;--ink:#121412;--mute:#5C625E;--line:#E6E5E0;--pri:#0E4D3F;--pri-tint:#E5EFEA;--bad:#B42318;--bad-tint:#FBEAE8;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0B0C0B;--paper:#141614;--ink:#ECEDE9;--mute:#9DA39E;--line:#262926;--pri:#3A9A7F;--pri-tint:#15302A;--bad:#F2867B;--bad-tint:#2E1715;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:15px/1.8 Vazirmatn,Tahoma,system-ui,sans-serif}
main{width:100%;max-width:440px;background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:32px 28px;text-align:center}
.mk{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:grid;place-items:center;font-size:30px;font-weight:700;background:var(--pri-tint);color:var(--pri)}
.mk.bad{background:var(--bad-tint);color:var(--bad)}
h1{margin:0 0 8px;font-size:22px}
p{margin:4px 0;color:var(--mute)}
p.b{color:var(--ink);font-weight:600}
.acts{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.btn{display:flex;align-items:center;justify-content:center;height:50px;border-radius:14px;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:600}
.btn.p{background:var(--pri);border-color:var(--pri);color:#fff}
.note{margin-top:18px;font-size:13px}
</style>
</head>
<body>
<main>
<div class="mk${p.tone === 'bad' ? ' bad' : ''}" aria-hidden="true">${mark}</div>
<h1>${esc(p.title)}</h1>
${p.lines.map((l, i) => `<p${i === 0 ? ' class="b"' : ''}>${esc(l)}</p>`).join('\n')}
${actions ? `<div class="acts">${actions}</div>` : ''}
${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
</main>
</body>
</html>`;
}
