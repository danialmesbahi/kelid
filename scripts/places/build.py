"""Builds the per-city neighborhood/street suggestion files from Overture Maps (OpenStreetMap data, ODbL).

Usage (Python 3.11+, `pip install pyarrow shapely`):
    python scripts/places/build.py fetch  <work-dir>      # downloads the Iran slice of Overture (~300 MB)
    python scripts/places/build.py build  <work-dir>      # writes apps/web/src/places/data/*.json

Zones (زون) that the map doesn't have come from scripts/places/zones.json: each zone lists seed neighborhoods,
every other neighborhood of the city joins the nearest seed.
"""
import collections, glob, json, math, os, re, sys

RELEASE = '2026-09-23.1'
BUCKET = 'overturemaps-us-west-2/release/' + RELEASE
BOX = (44, 63.4, 25, 39.8)  # lon/lat bbox of Iran
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'apps/web/src/places/data')
SKIP_CLASSES = {'footway', 'path', 'steps', 'cycleway', 'bridleway', 'track', 'unknown'}


def s3():
    import pyarrow.fs as fs
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    return fs.S3FileSystem(anonymous=True, region='us-west-2', **({'proxy_options': proxy} if proxy else {}))


def fetch(work):
    import pyarrow.dataset as ds, pyarrow.parquet as pq, pyarrow.compute as pc, pyarrow.fs as fs
    os.makedirs(work, exist_ok=True)
    fsys = s3()
    for kind, cols in (('division', ['id', 'geometry', 'subtype', 'class', 'names', 'hierarchies', 'parent_division_id', 'population']),
                       ('division_area', ['division_id', 'subtype', 'geometry'])):
        d = ds.dataset(f'{BUCKET}/theme=divisions/type={kind}/', filesystem=fsys, format='parquet')
        pq.write_table(d.to_table(columns=cols, filter=ds.field('country') == 'IR'), os.path.join(work, f'{kind}.parquet'))
    x0, x1, y0, y1 = BOX
    base = f'{BUCKET}/theme=transportation/type=segment/'
    files = [i for i in fsys.get_file_info(fs.FileSelector(base)) if i.path.endswith('.parquet')]
    for i, fi in enumerate(files):
        f = pq.ParquetFile(fi.path, filesystem=fsys)
        md = f.metadata
        names = [md.schema.column(j).path for j in range(md.num_columns)]
        ix = {n: names.index(n) for n in ('bbox.xmin', 'bbox.xmax', 'bbox.ymin', 'bbox.ymax')}
        groups = []
        for g in range(md.num_row_groups):
            st = {k: md.row_group(g).column(v).statistics for k, v in ix.items()}
            if not (st['bbox.xmin'].min > x1 or st['bbox.xmax'].max < x0 or st['bbox.ymin'].min > y1 or st['bbox.ymax'].max < y0):
                groups.append(g)
        if not groups:
            continue
        t = f.read_row_groups(groups, columns=['subtype', 'class', 'names', 'geometry', 'bbox'])
        b = t.column('bbox')
        inside = pc.and_(pc.and_(pc.greater_equal(pc.struct_field(b, 'xmin'), x0), pc.less_equal(pc.struct_field(b, 'xmax'), x1)),
                         pc.and_(pc.greater_equal(pc.struct_field(b, 'ymin'), y0), pc.less_equal(pc.struct_field(b, 'ymax'), y1)))
        t = t.filter(inside)
        t = t.filter(pc.equal(t.column('subtype'), 'road'))
        t = t.filter(pc.is_valid(pc.struct_field(t.column('names'), 'primary')))
        if t.num_rows:
            pq.write_table(t.drop_columns(['bbox']), os.path.join(work, f'segment_{i:03d}.parquet'))


# ---------- text ----------
FA_DIGITS = str.maketrans('0123456789٠١٢٣٤٥٦٧٨٩', '۰۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶۷۸۹')
ARABIC_ONLY = re.compile('[ةأإؤءًٌٍَُِّ]|^(شارع|طريق|سكة|فريج|مدخل|دوار) ')
PERSIAN = re.compile('[؀-ۿ]')
LATIN = re.compile('[A-Za-z]')


def clean(s):
    if not s:
        return ''
    s = s.replace('ي', 'ی').replace('ك', 'ک').replace('ى', 'ی').translate(FA_DIGITS)
    s = s.split(';')[0]
    s = re.sub(r'\u200c(?=\s)|(?<=\s)\u200c', '', s)
    s = re.sub(r'\s+', ' ', s).strip(' -،,\u200c')
    # «حافظ۲۲» → «حافظ ۲۲»
    s = re.sub(r'([ء-ی])([۰-۹])', r'\1 \2', s)
    return s


def fa_name(names):
    if not names:
        return ''
    common = dict(names.get('common') or [])
    return clean(common.get('fa') or names.get('primary'))


def persian(s):
    return bool(s) and bool(PERSIAN.search(s)) and not LATIN.search(s) and not ARABIC_ONLY.search(s)


# «دوم» یا «۱۲» تنها، بی نام خیابان اصلی، به کار نشانی نمی‌آید.
BARE = re.compile(r'^((کوچه|کوی|خیابان|بن ?بست|بن‌بست) )?(یکم|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم|[۰-۹]+)?( (غربی|شرقی|شمالی|جنوبی))?$')


def norm_key(s):
    return re.sub(r'[\s\u200c]', '', s)


CITY_FIX = {'شهر بابک': 'شهربابک', 'شهر کرد': 'شهرکرد', 'شهر ری': 'ری'}


def city_name(s):
    s = re.sub(r'^شهرستان ', '', s)
    if s in CITY_FIX:
        return CITY_FIX[s]
    return re.sub(r'^(شهر|بندر) (?=\S)', lambda m: '' if m.group(1) == 'شهر' else m.group(0), s)


def province_name(s):
    return re.sub(r'^استان ', '', s or '')


def zone_label(s):
    m = re.match(r'^(منطقه|ناحیه) ([۰-۹]+)', s)
    return f'{m.group(1)} {m.group(2)}' if m else s


def slug(en, fa):
    base = re.sub(r'[^a-z0-9]+', '-', (en or '').lower()).strip('-')
    return base or 'c' + str(abs(hash(fa)) % 10**8)


# ---------- build ----------
def build(work):
    import pyarrow.parquet as pq
    from shapely import wkb, STRtree
    from shapely.geometry import Point

    divs = pq.read_table(os.path.join(work, 'division.parquet')).to_pylist()
    areas = collections.defaultdict(list)
    for a in pq.read_table(os.path.join(work, 'division_area.parquet')).to_pylist():
        areas[a['division_id']].append(wkb.loads(a['geometry']))
    by_id = {d['id']: d for d in divs}
    for d in divs:
        d['pt'] = wkb.loads(d['geometry'])
        d['fa'] = fa_name(d['names'])
        d['en'] = dict((d['names'] or {}).get('common') or []).get('en') or ''
        shapes = areas.get(d['id'])
        d['area'] = max(shapes, key=lambda g: g.area) if shapes else None

    def province(d):
        for level in d['hierarchies'] or []:
            for h in level:
                if h['subtype'] == 'region':
                    return province_name(clean(h['name']))
        return ''

    # شهرها: city/town؛ آن‌ها که بی‌مرز هستند دایره‌ای به اندازهٔ جمعیت می‌گیرند.
    # «دهستان …» بخش روستایی است، نه شهر.
    cities = [d for d in divs if d['subtype'] == 'locality' and d['class'] in ('city', 'town') and persian(d['fa']) and not d['fa'].startswith('دهستان ')]
    for c in cities:
        if c['area'] is None:
            km = 1.5 + min(6, math.sqrt((c['population'] or 20000) / 20000))
            c['area'] = c['pt'].buffer(km / 100)
        c['size'] = c['area'].area
    cities.sort(key=lambda c: -c['size'])
    # شهرکی که داخل مرز شهر بزرگ‌تر است (تجریش در تهران) یکی از محله‌های همان شهر می‌شود.
    tree = STRtree([c['area'] for c in cities])
    host = {}
    for i, c in enumerate(cities):
        for j in tree.query(c['pt'], predicate='within'):
            if j < i and cities[j]['area'].contains(c['pt']) and cities[j]['size'] > c['size'] * 3 and j not in host:
                host[i] = j
                break
    main = [i for i in range(len(cities)) if i not in host]

    hoods = collections.defaultdict(dict)  # city -> name -> point
    def add_hood(ci, name, pt):
        if persian(name) and len(name) <= 40 and norm_key(name) not in {norm_key(n) for n in hoods[ci]}:
            hoods[ci][name] = pt
    for i, j in host.items():
        add_hood(j, city_name(cities[i]['fa']), cities[i]['pt'])
    tree = STRtree([cities[i]['area'] for i in main])
    macro = collections.defaultdict(list)
    for d in divs:
        if d['subtype'] not in ('neighborhood', 'microhood', 'macrohood'):
            continue
        hit = [main[k] for k in tree.query(d['pt'], predicate='within')]
        if not hit:
            continue
        ci = min(hit, key=lambda k: cities[k]['size'])
        if d['subtype'] == 'macrohood':
            if d['area'] is not None and persian(d['fa']):
                macro[ci].append((zone_label(d['fa']), d['area']))
        else:
            add_hood(ci, d['fa'], d['pt'])

    overrides = json.load(open(os.path.join(os.path.dirname(__file__), 'zones.json'), encoding='utf-8'))

    def zones_for(ci):
        names = list(hoods[ci])
        c = cities[ci]
        o = overrides.get(city_name(c['fa']))
        out = collections.OrderedDict()
        if o:
            seeds = [(z, hoods[ci][s]) for z, ss in o.items() for s in ss if s in hoods[ci]]
            for n in names:
                z = min(seeds, key=lambda s: s[1].distance(hoods[ci][n]))[0]
                out.setdefault(z, []).append(names.index(n))
            return [[z, out.get(z, [])] for z in o]
        # مناطق شهرداری: بزرگ‌ترین منطقه‌ای که محله در آن است.
        ms = sorted(macro.get(ci, []), key=lambda m: -m[1].area)
        for n in names:
            for label, g in ms:
                if g.contains(hoods[ci][n]):
                    out.setdefault(label, []).append(names.index(n))
                    break
        zs = [[z, ix] for z, ix in out.items() if len(ix) >= 2]
        num = lambda z: int(re.sub('[^۰-۹]', '', z).translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')) or 999)
        zs.sort(key=lambda z: (num(z[0]), z[0]))
        return zs if len(zs) >= 2 else []

    # خیابان‌ها: هر تکه به شهری که وسطش در آن است و تا سه محلهٔ نزدیک (کمتر از ۱٫۵ کیلومتر).
    streets = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, collections.Counter(), collections.Counter()]))
    hood_names = {ci: list(h) for ci, h in hoods.items()}
    hood_pts = {ci: list(h.values()) for ci, h in hoods.items() if h}
    hood_tree = {ci: STRtree(p) for ci, p in hood_pts.items()}
    for f in sorted(glob.glob(os.path.join(work, 'segment_*.parquet'))):
        t = pq.read_table(f).to_pylist()
        for r in t:
            if r['class'] in SKIP_CLASSES:
                continue
            name = fa_name(r['names'])
            if not persian(name) or len(name) > 50 or BARE.match(name):
                continue
            g = wkb.loads(r['geometry'])
            mid = g.interpolate(0.5, normalized=True)
            hit = [main[k] for k in tree.query(mid, predicate='within')]
            if not hit:
                continue
            ci = min(hit, key=lambda k: cities[k]['size'])
            # «لیان غربی»، «خیابان لیان غربی» و «کوچه لیان ۲» با «لیان ۲» یکی‌اند؛ پرکاربردترین نوشته می‌ماند
            s = streets[ci][norm_key(re.sub(r'^(خیابان|کوچه) ', '', name))]
            s[2][name] += g.length
            s[0] += g.length
            if ci in hood_tree:
                for p in (g.interpolate(0, normalized=True), mid, g.interpolate(1, normalized=True)):
                    k = int(hood_tree[ci].nearest(p))
                    hp = hood_pts[ci][k]
                    if hp.distance(p) < 0.015:
                        s[1][k] += 1

    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, '*.json')):
        os.remove(old)
    index, used = [], set()
    for ci in main:
        c = cities[ci]
        hs = hood_names.get(ci, [])
        st = sorted(streets[ci].items(), key=lambda kv: -kv[1][0])
        if not hs and len(st) < 15:
            continue
        name = city_name(c['fa'])
        key = slug(c['en'], name)
        n = 2
        while key in used:
            key, n = f'{slug(c["en"], name)}-{n}', n + 1
        used.add(key)
        data = {'n': name, 'p': province(c), 'z': zones_for(ci), 'h': hs,
                's': [[v[2].most_common(1)[0][0], *[k for k, _ in v[1].most_common(3)]] for _, v in st]}
        with open(os.path.join(OUT, key + '.json'), 'w', encoding='utf-8') as fp:
            json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
        index.append({'k': key, 'n': name, 'p': province(c), 'pop': c['population'] or 0, 'h': len(hs), 's': len(st)})
    index.sort(key=lambda c: (-c['pop'], -c['s']))
    # نام تکراری در دو استان: نام استان کنارش می‌آید تا در فهرست جدا باشند.
    dup = collections.Counter(c['n'] for c in index)
    cities_out = [[c['k'], c['n'], c['p'], 1 if dup[c['n']] > 1 else 0] for c in index]
    with open(os.path.join(os.path.dirname(OUT), 'cities.json'), 'w', encoding='utf-8') as fp:
        json.dump(cities_out, fp, ensure_ascii=False, separators=(',', ':'))
    print(len(index), 'cities')


if __name__ == '__main__':
    {'fetch': fetch, 'build': build}[sys.argv[1]](sys.argv[2])
