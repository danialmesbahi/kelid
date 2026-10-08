import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon, Skeleton } from '@kelid/ui';
import { formatGrouped, toFaDigits } from '@kelid/core';
import type { OfficeStatus, Stats } from '../api';
import { useFlash } from '../live';
import { ago, dateText, errorText, leftText, Phone, planName, statusTag, useLoad, useSlow } from '../ui';

const FILTERS: Array<{ value: OfficeStatus | ''; label: string }> = [
  { value: '', label: 'همه' },
  { value: 'active', label: 'فعال' },
  { value: 'trial', label: 'آزمایشی' },
  { value: 'ending', label: 'رو به پایان' },
  { value: 'expired', label: 'تمام شده' },
  { value: 'suspended', label: 'معلق' },
];

/** فهرست همهٔ دفترها با آمار بالای صفحه؛ جستجو و فیلتر در نشانی صفحه می‌ماند تا برگشتن از جزئیات همان‌جا بیاید. */
export function Offices() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('s') ?? '') as OfficeStatus | '';
  const [text, setText] = useState(q);
  const search = useRef<HTMLInputElement>(null);

  // تایپ کردن جستجو را با کمی مکث می‌فرستد، نه با هر حرف.
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => setParams((p) => (text.trim() ? p.set('q', text) : p.delete('q'), p), { replace: true }), 250);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  // «/» یا Ctrl+K: رفتن به جستجو.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea');
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const stats = useLoad('stats', (a, t) => a.stats(t));
  const list = useLoad(`offices:${status}:${q.trim()}`, (a, t) => a.offices(t, q, status || null));
  const slow = useSlow(!list.data && list.pending);
  const flash = useFlash();
  const setStatus = (s: OfficeStatus | '') => setParams((p) => (s ? p.set('s', s) : p.delete('s'), p), { replace: true });

  return (
    <>
      <header className="hd">
        <div className="col" style={{ gap: 4 }}>
          <span className="eb">پنل فروشنده</span>
          <h1 className="t1">دفترها</h1>
          <span className="mute sm">همهٔ دفترهایی که با کلید کار می‌کنند؛ برای تمدید، تعلیق یا یادداشت روی هر دفتر بزنید.</span>
        </div>
      </header>
      <div className="bd">
        <StatsRow stats={stats.data} status={status} onPick={setStatus} />

        <section className="col" style={{ gap: 14 }} aria-label="فهرست دفترها">
          <div className="ad-tools">
            <label className="ad-search">
              <Icon name="search" size="s" />
              <input
                ref={search}
                className="fld"
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="نام دفتر یا شمارهٔ موبایل"
                aria-label="جستجوی دفتر"
              />
              <kbd className="kbd">/</kbd>
            </label>
            <div className="seg" role="tablist" aria-label="وضعیت دفتر">
              {FILTERS.map((f) => (
                <button key={f.value} type="button" role="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {list.error && !list.data ? (
            <div className="card ad-empty">
              <Icon name="warn" size="l" />
              <span>{errorText(list.error)}</span>
              <button type="button" className="btn btn-s" onClick={list.reload}>
                دوباره امتحان کنید
              </button>
            </div>
          ) : !list.data ? (
            slow && (
              <div className="card ad-table" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="ad-row skel-row">
                    <Skeleton w="60%" h={18} />
                    <Skeleton w={70} h={26} r={99} />
                    <Skeleton w="70%" h={16} />
                    <Skeleton w="70%" h={16} />
                    <Skeleton w="50%" h={16} />
                    <Skeleton w="60%" h={16} />
                  </div>
                ))}
              </div>
            )
          ) : list.data.length === 0 ? (
            <div className="card ad-empty">
              <Icon name="search" size="l" />
              <span>{q || status ? 'دفتری با این جستجو یا وضعیت پیدا نشد.' : 'هنوز هیچ دفتری ثبت‌نام نکرده است.'}</span>
            </div>
          ) : (
            <div className="card ad-table" aria-busy={list.pending}>
              <div className="ad-row ad-head" aria-hidden="true">
                <span>دفتر</span>
                <span>وضعیت</span>
                <span>پلن و همکاران</span>
                <span>اعتبار</span>
                <span>آخرین فعالیت</span>
                <span>پرداخت‌ها</span>
              </div>
              <div className="stagger">
                {list.data.map((o) => {
                  const tag = statusTag[o.status];
                  return (
                    <Link key={o.id} to={`/offices/${o.id}`} viewTransition className={`ad-row hov${flash.has(o.id) ? ' ad-flash' : ''}`}>
                      <span className="col ad-cell-main">
                        <span className="b ad-ell">{o.name}</span>
                        <span className="xs mute ad-ell">
                          {o.manager ? (
                            <>
                              {o.manager.name}، <Phone value={o.manager.phone} />
                            </>
                          ) : (
                            'بی مدیر'
                          )}
                        </span>
                      </span>
                      <span>
                        <span className={`tag ${tag.tone}`}>{tag.label}</span>
                      </span>
                      <span className="col">
                        <span className="sm sb">{o.trial ? `آزمایشی (${planName(o.plan)})` : planName(o.plan)}</span>
                        <span className="xs mute">
                          {toFaDigits(o.members)} از {toFaDigits(o.seats)} نفر
                        </span>
                      </span>
                      <span className="col">
                        <span className="sm">{dateText(o.expiresAt)}</span>
                        <span className={`xs ${o.status === 'expired' ? 'ad-bad' : o.status === 'ending' ? 'ad-warn' : 'mute'}`}>{leftText(o.expiresAt)}</span>
                      </span>
                      <span className="sm mute">
                        {ago(o.lastSeenAt)}
                      </span>
                      <span className="sm num">
                        {o.paidTotal ? (
                          <>
                            {formatGrouped(o.paidTotal)} <span className="xs mute">تومان</span>
                          </>
                        ) : (
                          <span className="mute">بی پرداخت</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {list.data && list.data.length > 0 && (
            <span className="xs mute">
              {toFaDigits(list.data.length)} دفتر{list.data.length >= 300 ? '؛ برای دیدن بقیه جستجو کنید' : ''}
            </span>
          )}
        </section>
      </div>
    </>
  );
}

function StatsRow({ stats, status, onPick }: { stats: Stats | undefined; status: OfficeStatus | ''; onPick: (s: OfficeStatus | '') => void }) {
  const items: Array<{ key: OfficeStatus | ''; label: string; value: number | undefined; sub?: string; tone?: string }> = [
    { key: '', label: 'همهٔ دفترها', value: stats?.offices, sub: stats ? `${toFaDigits(stats.fresh)} تازه در ۳۰ روز` : undefined },
    { key: 'active', label: 'اشتراک فعال', value: stats?.active, tone: 'ok' },
    { key: 'trial', label: 'آزمایشی', value: stats?.trial },
    { key: 'ending', label: 'رو به پایان', value: stats?.ending, sub: 'کمتر از ۷ روز', tone: 'warn' },
    { key: 'expired', label: 'تمام شده', value: stats?.expired, sub: stats?.suspended ? `و ${toFaDigits(stats.suspended)} دفتر معلق` : undefined, tone: 'bad' },
  ];
  return (
    <div className="ad-stats">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`card ad-stat${status === it.key ? ' on' : ''}`}
          aria-pressed={status === it.key}
          onClick={() => onPick(it.key)}
        >
          <span className="sm mute">{it.label}</span>
          {it.value === undefined ? <Skeleton w={48} h={30} /> : <span className={`ad-stat-n ${it.tone ? `ad-${it.tone}` : ''}`}>{toFaDigits(it.value)}</span>}
          <span className="xs mute">{it.sub ?? ' '}</span>
        </button>
      ))}
      <div className="deep ad-stat ad-money">
        <span className="sm">درآمد ۳۰ روز اخیر</span>
        {stats ? (
          <span className="ad-stat-n">
            {formatGrouped(stats.revenue30)} <span className="sm">تومان</span>
          </span>
        ) : (
          <Skeleton w={120} h={30} />
        )}
        <span className="xs">{stats ? `${toFaDigits(stats.payments30)} پرداخت موفق` : ' '}</span>
      </div>
    </div>
  );
}
