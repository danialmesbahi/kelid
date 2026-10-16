import type { CSSProperties, ReactNode } from 'react';
import type { DealType } from '@kelid/core';
import { formatPlaque } from '@kelid/core';
import { iconPaths, type IconName } from './icons';
import logoUrl from './logo.svg';

export function Icon({ name, size = 'm', thick = false, className = '' }: { name: IconName; size?: 's' | 'm' | 'l'; thick?: boolean; className?: string }) {
  const cls = ['ic', size === 's' ? 's' : size === 'l' ? 'l' : '', thick ? 'th' : '', className].filter(Boolean).join(' ');
  // مسیرها ثابت‌های خود برنامه‌اند، نه ورودی کاربر.
  return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconPaths[name] }} />;
}

/** نشان «کلید» (کلید شمسه). با word نام «کلید» کنارش می‌آید و تصویر فقط تزئینی می‌شود. */
export function Logo({ size = 32, word = false, className = '' }: { size?: number; word?: boolean; className?: string }) {
  return (
    <span className={['logo', className].filter(Boolean).join(' ')} style={word ? { fontSize: Math.round(size * 0.6) } : undefined}>
      <img src={logoUrl} width={size} height={size} alt={word ? '' : 'کلید'} draggable={false} />
      {word && <b>کلید</b>}
    </span>
  );
}

const dealClass: Record<DealType, string> = { sale: '', rent: 'r', full: 'f' };

/** پلاک فایل — تنها رمز رنگی برنامه: سبز فروش، خردلی اجاره، آبی رهن کامل. */
export function Plaque({ value, deal, size = 'm', className = '' }: { value: number | null; deal: DealType; size?: 's' | 'm' | 'l' | 'xl'; className?: string }) {
  const sz = size === 'm' ? '' : size;
  return <span className={['plq', dealClass[deal], sz, className].filter(Boolean).join(' ')}>{formatPlaque(value)}</span>;
}

/** عکس ملک؛ تا وقتی عکس واقعی (`src`) نیامده، تصویرسازی معماری جای آن نمایش داده می‌شود. */
export function Cover({ variant, src, alt = '', className = '', style, children }: { variant: 'f' | 'g' | 'i' | 'j'; src?: string; alt?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={`ph ph-${variant} ${className}`} style={style}>
      {src ? (
        <img className="photo" src={src} alt={alt} draggable={false} decoding="async" />
      ) : (
        <>
          <i className="y t2" />
          <i className="y t1" />
          <i className="y gd" />
          <i className="x fl" />
          <i className="x w" />
          <i className="x lt" />
          <i className="x so" />
        </>
      )}
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="sw" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

/** بلوک اسکلت لودینگ؛ فقط اگر بارگذاری بیش از ~۱۲۰ میلی‌ثانیه طول بکشد دیده می‌شود. */
export function Skeleton({ w = '100%', h = 16, r = 10, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skel" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** تیک گرد و انیمیشن‌دار؛ همه‌جای برنامه یکسان. */
export function CheckBox({ checked, onChange, label, size = 24 }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: number }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="checkbox"
      onClick={() => onChange(!checked)}
      style={{
        width: size, height: size, borderRadius: size / 3.4, flex: 'none', padding: 0,
        border: `1.5px solid ${checked ? 'var(--pri)' : 'var(--line2)'}`,
        background: checked ? 'var(--pri)' : 'transparent', color: 'var(--pri-ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {checked && <Icon name="check" size="s" thick />}
    </button>
  );
}
