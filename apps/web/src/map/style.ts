import { DARK, LIGHT, layers, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/** نام منبع نقشه در سبک؛ جستجو و پیدا کردن محله هم از همین منبع می‌خوانند. */
export const SOURCE = 'kelid';

// رنگ‌ها هم‌خانوادهٔ توکن‌های kelid.css: کاغذی و آرام، تا پلاک‌های رنگی روی نقشه دیده شوند.
const light: Flavor = {
  ...LIGHT,
  background: '#EFEEEA',
  earth: '#F3F2EE',
  water: '#BCD6E2',
  park_a: '#DCE8D6',
  park_b: '#C9DFC1',
  wood_a: '#DCE8D6',
  wood_b: '#C9DFC1',
  buildings: '#E3E0D8',
  pedestrian: '#ECEAE3',
  hospital: '#F1E6E3',
  school: '#EFE9DE',
  industrial: '#E6E7E3',
  minor_a: '#FFFFFF',
  minor_b: '#FFFFFF',
  major: '#FFFFFF',
  highway: '#FFF4DE',
  link: '#FFFFFF',
  minor_casing: '#DCD9D1',
  major_casing_early: '#D3D0C8',
  major_casing_late: '#D3D0C8',
  highway_casing_early: '#E2CFA6',
  highway_casing_late: '#E2CFA6',
  roads_label_minor: '#737874',
  roads_label_major: '#5C625E',
  city_label: '#383D3A',
  subplace_label: '#5C625E',
  regular: 'Vazirmatn',
  bold: 'Vazirmatn Bold',
  italic: 'Vazirmatn',
};
const dark: Flavor = {
  ...DARK,
  background: '#0B0C0B',
  earth: '#141614',
  water: '#1A2A31',
  park_a: '#17231D',
  park_b: '#1B2A22',
  wood_a: '#17231D',
  wood_b: '#1B2A22',
  buildings: '#1F2320',
  minor_a: '#262926',
  minor_b: '#2C302D',
  major: '#33372F',
  highway: '#3D3A2E',
  link: '#2C302D',
  roads_label_minor: '#858B86',
  roads_label_major: '#9DA39E',
  city_label: '#ECEDE9',
  subplace_label: '#9DA39E',
  regular: 'Vazirmatn',
  bold: 'Vazirmatn Bold',
  italic: 'Vazirmatn',
};

/** هر جا سبک فونت دیگری خواسته (بر اساس خط زبان)، همان وزیرمتن؛ فونت از خود برنامه کشیده می‌شود نه از سرور. */
function vazir(v: unknown, bold: boolean): unknown {
  if (Array.isArray(v)) return v.map((x) => vazir(x, bold));
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === 'text-font' ? ['literal', [bold ? 'Vazirmatn Bold' : 'Vazirmatn']] : vazir(x, bold);
    return o;
  }
  return v;
}

function tidy(l: LayerSpecification): LayerSpecification {
  if (l.type !== 'symbol' || !l.layout) return l;
  const layout = { ...l.layout } as Record<string, unknown>;
  // نشانه‌های تصویری مکان‌ها (sprite) را نداریم و لازم هم نیست؛ نام مکان کافی است.
  delete layout['icon-image'];
  const bold = JSON.stringify(layout['text-font'] ?? '').includes('Bold') || JSON.stringify(layout['text-font'] ?? '').includes('Medium');
  if (layout['text-font']) layout['text-font'] = [bold ? 'Vazirmatn Bold' : 'Vazirmatn'];
  if (layout['text-field']) layout['text-field'] = vazir(layout['text-field'], bold);
  return { ...l, layout } as LayerSpecification;
}

export function mapStyle(dark_: boolean, tiles: string): StyleSpecification {
  return {
    version: 8,
    // بدون glyphs: نوشته‌ها با فونت خود برنامه روی دستگاه کشیده می‌شوند، نه از سرور فونت
    sources: {
      [SOURCE]: { type: 'vector', url: `pmtiles://${tiles}`, attribution: '© OpenStreetMap' },
    },
    // پیکان یک‌طرفه و تابلوی شماره‌دار جاده بدون تصویر نشانه معنایی ندارند
    layers: layers(SOURCE, dark_ ? dark : light, { lang: 'fa' })
      .filter((l) => l.id !== 'roads_oneway' && l.id !== 'roads_shields')
      .map(tidy),
  };
}
