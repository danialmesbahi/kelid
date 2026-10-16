// ساخت آیکون‌ها و تصویرهای نصب‌کننده از روی نشان «کلید شمسه» (packages/ui/src/logo.svg).
// اجرا: npm run icons   (با Electron خود پروژه؛ کتابخانهٔ تصویر لازم نیست)
// خروجی‌ها در مخزن ثبت می‌شوند؛ فقط وقتی طرح عوض شد دوباره اجرا کنید.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const font = fs.readFileSync(path.join(root, 'node_modules/vazirmatn/fonts/webfonts/Vazirmatn-Black.woff2')).toString('base64');
const EMERALD = '#0E4D3F';
const logo = fs.readFileSync(path.join(root, 'packages/ui/src/logo.svg'), 'utf8');

/** نشان «کلید شمسه» از روی packages/ui/src/logo.svg. full: زمینه تا لبه (maskable/apple)، safe: اندازهٔ نشان داخل زمینه. */
function plaque(s, { full = false, safe = 1 } = {}) {
  const off = 32 - 32 * safe;
  const svg = logo
    .replace('rx="15"', `rx="${full ? 0 : 15}"`)
    .replace(/(<rect[^>]*\/>)([\s\S]*)<\/svg>/, `$1<g transform="translate(${off} ${off}) scale(${safe})">$2</g></svg>`);
  return `<img width="${s}" height="${s}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
}

/** نوار کنار پنجرهٔ نصب (۱۶۴×۳۱۴) */
function sidebar() {
  return `
  <div style="width:164px;height:314px;background:linear-gradient(170deg,#17654F,${EMERALD} 60%,#0A3A30);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;direction:rtl">
    ${plaque(112)}
    <span style="font:900 13px/1.7 Vazirmatn;color:rgba(255,255,255,.88);text-align:center">سامانهٔ فایل املاک</span>
  </div>`;
}

/** سربرگ پنجرهٔ نصب (۱۵۰×۵۷) */
function header() {
  return `
  <div style="width:150px;height:57px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;direction:rtl">
    ${plaque(42)}
    <span style="font:900 11px/1.5 Vazirmatn;color:${EMERALD}">سامانهٔ<br>فایل املاک</span>
  </div>`;
}

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Vazirmatn;font-weight:900;src:url(data:font/woff2;base64,${font}) format('woff2')}
html,body{margin:0;background:transparent;overflow:hidden}
</style></head><body><div id="c"></div></body></html>`;

/** فایل ICO: اندازه‌های کوچک به‌صورت BMP (برای NSIS و ویندوزهای قدیمی) و ۲۵۶ به‌صورت PNG. */
function ico(frames) {
  const blobs = frames.map(({ size, img }) => {
    if (size >= 256) return img.toPNG();
    const bgra = img.toBitmap();
    const rowMask = Math.ceil(size / 32) * 4;
    const out = Buffer.alloc(40 + size * size * 4 + rowMask * size);
    out.writeUInt32LE(40, 0);
    out.writeInt32LE(size, 4);
    out.writeInt32LE(size * 2, 8);
    out.writeUInt16LE(1, 12);
    out.writeUInt16LE(32, 14);
    out.writeUInt32LE(size * size * 4 + rowMask * size, 20);
    // BMP از پایین به بالا ذخیره می‌شود؛ ماسک AND صفر می‌ماند چون آلفا کافی است.
    for (let y = 0; y < size; y++) bgra.copy(out, 40 + (size - 1 - y) * size * 4, y * size * 4, (y + 1) * size * 4);
    return out;
  });
  const head = Buffer.alloc(6 + 16 * frames.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = head.length;
  frames.forEach(({ size }, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(blobs[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += blobs[i].length;
  });
  return Buffer.concat([head, ...blobs]);
}

/** BMP بیست‌وچهاربیتی؛ NSIS فقط همین را برای تصویرهای نصب می‌پذیرد. */
function bmp24(img) {
  const { width, height } = img.getSize();
  const bgra = img.toBitmap();
  const row = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * height);
  out.write('BM', 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * height, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = 54 + (height - 1 - y) * row + x * 3;
      out[dst] = bgra[src];
      out[dst + 1] = bgra[src + 1];
      out[dst + 2] = bgra[src + 2];
    }
  }
  return out;
}

const write = (rel, buf) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`  ✓ ${rel} (${Math.round(buf.length / 1024)} KB)`);
};

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, transparent: true, frame: false, backgroundColor: '#00000000', useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  const render = async (html, w, h = w) => {
    win.setContentSize(w, h);
    await win.webContents.executeJavaScript(`document.getElementById('c').innerHTML = ${JSON.stringify(html)}; document.fonts.ready.then(() => new Promise(r => setTimeout(r, 120)))`);
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
    return img.getSize().width === w ? img : img.resize({ width: w, height: h, quality: 'best' });
  };

  const frames = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) frames.push({ size, img: await render(plaque(size), size) });
  write('apps/desktop/build/icon.ico', ico(frames));
  write('apps/web/public/favicon.ico', ico(frames.filter((f) => f.size <= 48)));
  write('apps/admin/public/favicon.ico', ico(frames.filter((f) => f.size <= 48)));
  write('apps/desktop/build/installerSidebar.bmp', bmp24(await render(sidebar(), 164, 314)));
  write('apps/desktop/build/installerHeader.bmp', bmp24(await render(header(), 150, 57)));

  write('apps/web/public/icons/favicon-32.png', frames.find((f) => f.size === 32).img.toPNG());
  write('apps/web/public/icons/icon-192.png', (await render(plaque(192), 192)).toPNG());
  write('apps/web/public/icons/icon-512.png', (await render(plaque(512), 512)).toPNG());
  // maskable: پس‌زمینه تا لبه، نشان داخل دایرهٔ امن ۸۰٪
  write('apps/web/public/icons/maskable-512.png', (await render(plaque(512, { full: true, safe: 0.72 }), 512)).toPNG());
  write('apps/web/public/icons/apple-touch-icon.png', (await render(plaque(180, { full: true, safe: 0.86 }), 180)).toPNG());
  app.exit(0);
});
