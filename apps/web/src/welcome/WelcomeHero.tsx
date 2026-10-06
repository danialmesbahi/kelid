import { useEffect, useRef } from 'react';
import { Icon } from '@kelid/ui';

// صحنهٔ شب تهران: البرز، برج میلاد و پنجره‌هایی که یکی‌یکی روشن می‌شوند.
// فقط یک بار ساخته می‌شود؛ ثابت است تا هر بار رندر هزینه نداشته باشد.
const W = 600;
const H = 340;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; w: number; h: number };
type Lit = Rect & { d: number };

const SCENE = (() => {
  const r = rng(1405);
  const mid: Rect[] = [];
  for (let x = -6; x < W; ) {
    const w = 30 + r() * 34;
    const h = 120 + r() * 110;
    // جای برج میلاد خالی می‌ماند تا قامتش دیده شود
    if (x + w > 112 && x < 150) { x = 152; continue; }
    mid.push({ x, y: H - h, w, h });
    x += w + 4 + r() * 10;
  }
  const near: Rect[] = [];
  const lit: Lit[] = [];
  for (let x = -10; x < W; ) {
    const w = 40 + r() * 46;
    const h = 56 + r() * 96;
    const b = { x, y: H - h, w, h };
    near.push(b);
    const cols = Math.floor((w - 10) / 13);
    const rows = Math.floor((h - 18) / 17);
    const ox = x + (w - cols * 13 + 6) / 2;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() > 0.42) continue;
        const wx = ox + i * 13;
        // روشن شدن مثل موج از وسط صحنه به دو طرف
        lit.push({ x: wx, y: b.y + 12 + j * 17, w: 6, h: 9, d: Math.round(700 + Math.abs(wx - W / 2) * 3.2 + r() * 500) });
      }
    }
    x += w + 3 + r() * 6;
  }
  const stars = Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * 190, s: 0.5 + r() * 1.1, o: 0.25 + r() * 0.6 }));
  return { mid, near, lit, stars };
})();

const box = (b: Rect) => `M${b.x.toFixed(1)} ${H}V${b.y.toFixed(1)}H${(b.x + b.w).toFixed(1)}V${H}Z`;
const MID_PATH = SCENE.mid.map(box).join('');
const NEAR_PATH = SCENE.near.map(box).join('');

/** نیمهٔ تصویری آشنایی: شهر شب با پلاک کلید که با حرکت موس عمق می‌گیرد. */
export function WelcomeHero({ office }: { office: string }) {
  const ref = useRef<HTMLElement>(null);

  // عمق با موس: فقط دو متغیر CSS در هر فریم عوض می‌شود و بقیه کار با transform روی GPU است.
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / innerWidth) * 2 - 1;
      y = (e.clientY / innerHeight) * 2 - 1;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--mx', x.toFixed(3));
        el.style.setProperty('--my', y.toFixed(3));
      });
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // به‌جای انیمیشن بی‌پایان، هر ۵ ثانیه یک برق کوتاه روی کلید و گاهی یک شهاب؛ بین آن‌ها کارت گرافیک بیکار است.
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let beat = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      beat = (beat % 4) + 1;
      el.dataset.beat = String(beat);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside ref={ref} className="wl-hero" aria-hidden="true">
      <div className="wl-sky">
        <svg className="wl-stars" viewBox={`0 0 ${W} 190`} preserveAspectRatio="xMidYMin slice">
          {SCENE.stars.map((s, i) => <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.s.toFixed(2)} opacity={s.o.toFixed(2)} />)}
        </svg>
        <span className="wl-shoot" />
        <span className="wl-moon" />
      </div>

      <svg className="wl-city wl-far" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <path className="wl-mtn" d="M-10 340V214L40 190 78 200 124 160 150 172 196 128 226 146 262 118 300 150 336 136 372 168 420 132 452 150 494 112 530 140 566 128 610 160V340Z" />
        <path className="wl-snow" d="M186 136 196 128 226 146 214 146 204 140ZM252 126 262 118 282 136 270 134ZM484 120 494 112 514 128 502 126ZM114 168 124 160 138 167 128 168Z" />
      </svg>

      <svg className="wl-city wl-mid" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <path d={MID_PATH} />
        {/* برج میلاد */}
        <path className="wl-milad" d="M126 340 128 118H132L134 340ZM128.8 34H131.2V96H128.8ZM110 104C110 96 150 96 150 104L138 118H122ZM118 94C118 88 142 88 142 94Z" />
        <rect className="wl-ring" x="112" y="102" width="36" height="2.4" rx="1.2" />
        <circle className="wl-beacon" cx="130" cy="32" r="2.6" />
      </svg>

      <svg className="wl-city wl-near" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <path d={NEAR_PATH} />
        <g className="wl-lit">
          {SCENE.lit.map((l, i) => <rect key={i} x={l.x.toFixed(1)} y={l.y.toFixed(1)} width={l.w} height={l.h} rx="1" style={{ animationDelay: `${l.d}ms` }} />)}
        </g>
      </svg>

      <div className="wl-stage">
        <span className="wl-halo" />
        <span className="wl-tilt">
          <span className="plq wl-key">کلید</span>
        </span>
        <span className="wl-float f1"><span className="plq s">۰۲۷</span><b>آپارتمان ۱۲۰ متری</b><small>سعادت‌آباد · ۲۸ میلیارد</small></span>
        <span className="wl-float f2"><span className="av">ک</span><b>آقای کریمی</b><small className="ok">۹۲٪ جور</small></span>
        <span className="wl-float f3"><Icon name="cal" size="s" /><b>بازدید ساعت ۱۰:۳۰</b><small>فردا</small></span>
      </div>

      <div className="wl-hero-ft">
        <b>{office.trim() || 'دفتر املاک شما'}</b>
        <span>همهٔ فایل‌ها و مشتری‌ها، مرتب و دم دست</span>
      </div>
    </aside>
  );
}
