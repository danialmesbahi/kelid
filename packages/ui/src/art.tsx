// تصویرهای اختصاصی برنامه (صفحه‌های خالی): AVIF برای مرورگرهای تازه و WebP برای بقیه، هر کدام در دو پهنا.
// فقط نشانی فایل‌ها در باندل است؛ خود تصویر تنبل و تنها وقتی دیده شود بار می‌شود.
const files = import.meta.glob<string>('./art/*.{avif,webp}', { eager: true, query: '?url', import: 'default' });

export type ArtName = 'empty-files' | 'empty-clients';

const WIDTHS = [320, 640];

function set(name: ArtName, ext: 'avif' | 'webp', widths: number[]) {
  return widths.map((w) => `${files[`./art/${name}-${w}.${ext}`]} ${w}w`).join(', ');
}

/** sizes پهنای نمایش را به مرورگر می‌گوید تا کوچک‌ترین فایل کافی را بردارد. */
export function Art({ name, sizes, alt = '', className = '', eager = false }: { name: ArtName; sizes: string; alt?: string; className?: string; eager?: boolean }) {
  return (
    <picture className={`art ${className}`}>
      <source type="image/avif" srcSet={set(name, 'avif', WIDTHS)} sizes={sizes} />
      <img
        src={files[`./art/${name}-${WIDTHS[0]}.webp`]}
        srcSet={set(name, 'webp', WIDTHS)}
        sizes={sizes}
        width={640}
        height={640}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
