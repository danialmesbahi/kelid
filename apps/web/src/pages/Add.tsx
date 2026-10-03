import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Cover, Icon } from '@kelid/ui';
import { dealLabel, formatPlaque, formatToman, toEnDigits, type DealType, type Listing } from '@kelid/core';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';

const FEATURES = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی و نگهبان', 'استخر و سونا'];

/** «۲۸٬۰۰۰٬۰۰۰٬۰۰۰» یا «28000000000» → عدد */
function parseAmount(s: string): number | undefined {
  const n = Number(toEnDigits(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function AmountField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const n = parseAmount(value);
  return (
    <label className="lbl">
      {label}
      <input className="fld num" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder="به تومان" style={{ fontSize: 19 }} />
      <span className="hint">{n ? `${formatToman(n)} تومان` : ' '}</span>
    </label>
  );
}

export function AddPage() {
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [deal, setDeal] = useState<DealType>('sale');
  const [f, setF] = useState({ neighborhood: '', street: '', address: '', area: '', bedrooms: '', floor: '', floorsTotal: '', yearBuilt: '', total: '', deposit: '', rent: '', ownerName: '', ownerPhone: '' });
  const [features, setFeatures] = useState<string[]>(['پارکینگ', 'آسانسور']);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const num = (s: string) => (s ? Number(toEnDigits(s)) : undefined);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const area = num(f.area);
    if (!f.neighborhood.trim() || !area) {
      setError('محله و متراژ را بنویسید.');
      return;
    }
    const price: Listing['price'] = deal === 'sale' ? { total: parseAmount(f.total) } : deal === 'rent' ? { deposit: parseAmount(f.deposit), monthlyRent: parseAmount(f.rent) } : { deposit: parseAmount(f.deposit) };
    const listing = await store.addListing({
      deal, status: 'active', kind: 'apartment',
      neighborhood: f.neighborhood.trim(), street: f.street.trim(), address: f.address.trim() || undefined,
      area, bedrooms: num(f.bedrooms) ?? 0, floor: num(f.floor), floorsTotal: num(f.floorsTotal), yearBuilt: num(f.yearBuilt),
      features, price, negotiable: true,
      owner: { name: f.ownerName.trim() || '—', phone: toEnDigits(f.ownerPhone) },
      cover: (['f', 'g', 'i', 'j'] as const)[Math.floor(Math.random() * 4)]!, photoCount: 0,
    });
    navigate(`/files/${listing.id}`, { replace: true, viewTransition: true });
    toast(`فایل ${formatPlaque(listing.plaque)} ثبت شد`);
  };

  return (
    <div style={{ padding: 8, minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <form onSubmit={onSubmit} className="col" style={{ flex: 1, minWidth: 0, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 20 }}>
        <header className="top" style={{ position: 'sticky', top: 0, background: 'var(--paper)', borderRadius: '20px 20px 0 0', zIndex: 2 }}>
          <Link viewTransition className="btn btn-g" to="/files" style={{ padding: '0 12px' }}><Icon name="x" size="s" />بستن</Link>
          <span className="b" style={{ fontSize: 18 }}>فایل جدید</span>
          <span className="sp" />
          {error && <span role="alert" className="tag bad">{error}</span>}
          <button type="submit" className="btn btn-p">ثبت فایل</button>
        </header>

        <div className="col enter" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '28px 24px 80px', gap: 36 }}>
          <fieldset className="col" style={{ border: 0, margin: 0, padding: 0, gap: 14 }}>
            <legend className="t2" style={{ padding: '0 0 14px' }}>۱. این ملک برای چیست؟</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {(['sale', 'rent', 'full'] as const).map((d) => (
                <button key={d} type="button" aria-pressed={deal === d} onClick={() => setDeal(d)} className={`col ${deal === d ? 'sel' : ''}`}
                  style={{ minHeight: 88, borderRadius: 16, border: '1px solid var(--line2)', background: 'var(--paper)', padding: '14px 16px', alignItems: 'flex-start', gap: 8, textAlign: 'right' }}>
                  <span className={`plq ${d === 'rent' ? 'r' : d === 'full' ? 'f' : ''}`} style={{ minWidth: 40 }}>؟</span>
                  <span className="b">{dealLabel[d]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="col" style={{ border: 0, margin: 0, padding: 0, gap: 14 }}>
            <legend className="t2" style={{ padding: '0 0 14px' }}>۲. کجاست؟</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <label className="lbl">محله<input className="fld" value={f.neighborhood} onChange={(e) => set('neighborhood')(e.target.value)} placeholder="مثلاً سعادت‌آباد" required /></label>
              <label className="lbl">خیابان<input className="fld" value={f.street} onChange={(e) => set('street')(e.target.value)} /></label>
            </div>
            <label className="lbl">نشانی کامل <span className="hint">فقط برای دفتر؛ به مشتری نشان داده نمی‌شود</span><input className="fld" value={f.address} onChange={(e) => set('address')(e.target.value)} /></label>
          </fieldset>

          <fieldset className="col" style={{ border: 0, margin: 0, padding: 0, gap: 14 }}>
            <legend className="t2" style={{ padding: '0 0 14px' }}>۳. مشخصات</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
              <label className="lbl">متراژ<input className="fld num" inputMode="numeric" value={f.area} onChange={(e) => set('area')(e.target.value)} required /></label>
              <label className="lbl">خواب<input className="fld num" inputMode="numeric" value={f.bedrooms} onChange={(e) => set('bedrooms')(e.target.value)} /></label>
              <label className="lbl">طبقه<input className="fld num" inputMode="numeric" value={f.floor} onChange={(e) => set('floor')(e.target.value)} /></label>
              <label className="lbl">سال ساخت<input className="fld num" inputMode="numeric" value={f.yearBuilt} onChange={(e) => set('yearBuilt')(e.target.value)} placeholder="۱۴۰۳" /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {FEATURES.map((x) => (
                <label key={x} className="chk">
                  <input type="checkbox" checked={features.includes(x)} onChange={(e) => setFeatures((fs) => (e.target.checked ? [...fs, x] : fs.filter((y) => y !== x)))} />
                  {x}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="col" style={{ border: 0, margin: 0, padding: 0, gap: 14 }}>
            <legend className="t2" style={{ padding: '0 0 14px' }}>۴. قیمت</legend>
            {deal === 'sale' && <AmountField label="قیمت کل (تومان)" value={f.total} onChange={set('total')} />}
            {deal === 'rent' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                <AmountField label="ودیعه (تومان)" value={f.deposit} onChange={set('deposit')} />
                <AmountField label="اجارهٔ ماهانه (تومان)" value={f.rent} onChange={set('rent')} />
              </div>
            )}
            {deal === 'full' && <AmountField label="مبلغ رهن کامل (تومان)" value={f.deposit} onChange={set('deposit')} />}
          </fieldset>

          <fieldset className="col" style={{ margin: 0, padding: 18, gap: 14, borderRadius: 18, background: 'var(--paper2)', border: '1px solid var(--line)' }}>
            <legend className="t2" style={{ padding: '0 6px' }}>۵. مالک</legend>
            <span className="xs rw" style={{ gap: 6, color: 'var(--brass-text)' }}><Icon name="lock" size="s" />در حالت نمایش و برگهٔ چاپی دیده نمی‌شود</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <label className="lbl">نام مالک<input className="fld" value={f.ownerName} onChange={(e) => set('ownerName')(e.target.value)} /></label>
              <label className="lbl">شمارهٔ مالک<input className="fld num" inputMode="tel" value={f.ownerPhone} onChange={(e) => set('ownerPhone')(e.target.value)} style={{ direction: 'ltr', textAlign: 'right' }} /></label>
            </div>
          </fieldset>

          <div className="rw sm mute" style={{ gap: 10 }}>
            <Cover variant="f" style={{ width: 64, height: 48, borderRadius: 10 }} />
            بارگذاری عکس در قدم بعد (با گوشی یا از روی کامپیوتر) اضافه می‌شود.
          </div>
        </div>
      </form>
    </div>
  );
}
