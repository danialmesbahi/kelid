import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { brand, cities, faYear, faqHtml, halfGift, icon, iphone, jsonLd, mark, menuIcon, nightArt, plans, skyline, trialDays, yearGift, type SiteConfig } from './build/render';

// همان تصویر جایگزین عکس فایل در برنامه (Cover در packages/ui)
const COVER = '<i class="y t2"></i><i class="y t1"></i><i class="y gd"></i><i class="x fl"></i><i class="x w"></i><i class="x lt"></i><i class="x so"></i>';
const root = fileURLToPath(new URL('.', import.meta.url));

// سایت معرفی جدا از برنامه منتشر می‌شود (مثلاً kelid.ir). همه‌چیز موقع ساخت به HTML تبدیل می‌شود تا صفحه بی جاوااسکریپت و فوری برسد.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_SITE_');
  const cfg: SiteConfig = {
    site: (env.VITE_SITE_URL ?? 'https://kelid.ir').replace(/\/$/, ''),
    app: env.VITE_SITE_APP_URL ?? 'https://app.kelid.ir',
    windows: env.VITE_SITE_WINDOWS_URL ?? '/download/Kelid-Setup.exe',
    mac: env.VITE_SITE_MAC_URL ?? '/download/Kelid.dmg',
  };
  return {
    plugins: [site(cfg)],
    server: { port: 5175, strictPort: true },
    preview: { port: 4175, strictPort: true },
    build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  };
});

function site(cfg: SiteConfig): Plugin {
  const parts: Record<string, () => string> = { skyline, iphone, cities, night: nightArt, plans, faq: faqHtml, jsonld: () => jsonLd(cfg) };
  const vars: Record<string, string> = { cover: COVER, site: cfg.site, app: cfg.app, windows: cfg.windows, mac: cfg.mac, menu: menuIcon, trial: trialDays, gift: yearGift, gift6: halfGift, year: faYear() };
  return {
    name: 'kelid-site',
    enforce: 'pre',
    // پوستهٔ تیره همان توکن‌های .app.dark در kelid.css است، این‌جا با ترجیح سیستم؛ بی اسکریپتی که کلاس بگذارد.
    transform(code, id) {
      if (!id.endsWith('/src/site.css')) return;
      const kelid = readFileSync(fileURLToPath(new URL('../../packages/ui/src/kelid.css', import.meta.url)), 'utf8');
      const dark = /\.app\.dark\{([^}]*)\}/.exec(kelid)?.[1];
      if (!dark) throw new Error('dark tokens not found in kelid.css');
      return code.replace('/*@dark*/', `@media (prefers-color-scheme: dark){.app{${dark}}}`);
    },
    transformIndexHtml(html) {
      return html
        .replace(/<!--@(\w+)-->/g, (_, k: string) => {
          const fn = parts[k];
          if (!fn) throw new Error(`unknown part: ${k}`);
          return fn();
        })
        .replace(/\{\{icon:(\w+)(?: ([\w ]+))?\}\}/g, (_, n: string, c?: string) => icon(n, c))
        .replace(/\{\{brand:(\w+)\}\}/g, (_, n: string) => brand(n))
        .replace(/\{\{mark:(\w+)\}\}/g, (_, id: string) => mark(id))
        .replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
          const v = vars[k];
          if (v === undefined) throw new Error(`unknown var: ${k}`);
          return v;
        });
    },
    // سبک‌ها درون HTML می‌روند (یک درخواست کمتر پیش از اولین نقاشی) و فونت پیش‌بارگذاری می‌شود.
    writeBundle(opts) {
      const out = opts.dir ?? `${root}dist`;
      const htmlPath = `${out}/index.html`;
      let html = readFileSync(htmlPath, 'utf8');
      const assets = readdirSync(`${out}/assets`);
      for (const css of assets.filter((a) => a.endsWith('.css'))) {
        const text = readFileSync(`${out}/assets/${css}`, 'utf8').replace(/url\(\.\//g, 'url(/assets/');
        html = html.replace(new RegExp(`<link rel="stylesheet"[^>]*href="/assets/${css.replace(/[.[\]]/g, '\\$&')}"[^>]*>`), `<style>${text}</style>`);
        rmSync(`${out}/assets/${css}`);
      }
      const font = assets.find((a) => a.endsWith('.woff2'));
      if (font) html = html.replace('</title>', `</title>\n<link rel="preload" href="/assets/${font}" as="font" type="font/woff2" crossorigin>`);
      writeFileSync(htmlPath, html);
      writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${cfg.site}/sitemap.xml\n`);
      const today = new Date().toISOString().slice(0, 10);
      writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${cfg.site}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n</urlset>\n`);
    },
  };
}
