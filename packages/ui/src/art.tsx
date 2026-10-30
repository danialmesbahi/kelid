// تصویرهای اختصاصی کلید: AVIF برای مرورگرهای تازه و WebP برای بقیه، هر کدام در دو پهنا.
// فقط نشانی فایل‌ها در باندل است؛ خود تصویر تنبل و تنها وقتی دیده شود بار می‌شود.
const files = import.meta.glob<string>('./art/*.{avif,webp}', { eager: true, query: '?url', import: 'default' });

export const CITIES = ['tehran', 'isfahan', 'shiraz', 'tabriz', 'yazd', 'rasht', 'mashhad', 'bushehr'] as const;
export type City = (typeof CITIES)[number];
export const CITY_FA: Record<City, string> = { tehran: 'تهران', isfahan: 'اصفهان', shiraz: 'شیراز', tabriz: 'تبریز', yazd: 'یزد', rasht: 'رشت', mashhad: 'مشهد', bushehr: 'بوشهر' };
export type ArtName = 'empty-files' | 'empty-clients' | `city-${City}`;

/** هر روز یک شهر؛ همه روی یک دستگاه یک تصویر می‌بینند و کش به کار می‌آید. */
export function cityOfDay(): City {
  return CITIES[Math.floor(Date.now() / 864e5) % CITIES.length] ?? 'tehran';
}

const WIDTHS: Record<'empty' | 'city', [number, number]> = { empty: [320, 640], city: [640, 1024] };

function set(name: ArtName, ext: 'avif' | 'webp', widths: number[]) {
  return widths.map((w) => `${files[`./art/${name}-${w}.${ext}`]} ${w}w`).join(', ');
}

/** sizes پهنای نمایش را به مرورگر می‌گوید تا کوچک‌ترین فایل کافی را بردارد. */
export function Art({ name, sizes, alt = '', className = '', eager = false }: { name: ArtName; sizes: string; alt?: string; className?: string; eager?: boolean }) {
  const widths = WIDTHS[name.startsWith('city-') ? 'city' : 'empty'];
  const square = name.startsWith('empty-');
  return (
    <picture className={`art ${className}`}>
      <source type="image/avif" srcSet={set(name, 'avif', widths)} sizes={sizes} />
      <img
        src={files[`./art/${name}-${widths[0]}.webp`]}
        srcSet={set(name, 'webp', widths)}
        sizes={sizes}
        width={square ? 640 : 1024}
        height={square ? 640 : 683}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
