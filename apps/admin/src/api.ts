import { PLANS, type PlanId } from '@kelid/core/plans';

// همهٔ تماس‌های پنل با سرور (apps/server/src/admin/routes.ts). VITE_ADMIN_API_URL=demo = دادهٔ نمایشی برای پیش‌نمایش.

export type OfficeStatus = 'trial' | 'active' | 'ending' | 'expired' | 'suspended';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'canceled';

export interface Admin {
  id: string;
  name: string;
  phone: string;
}

export interface Office {
  id: string;
  name: string;
  plan: string;
  trial: boolean;
  status: OfficeStatus;
  expiresAt: string;
  seats: number;
  members: number;
  createdAt: string;
  lastSeenAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  /** تومان */
  paidTotal: number;
  manager: { name: string; phone: string } | null;
}

export interface Payment {
  id: string;
  plan: string;
  period: 'month' | 'year';
  /** تومان */
  amount: number;
  gateway: string;
  status: PaymentStatus;
  refId: string | null;
  card: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Note {
  id: string;
  kind: 'note' | 'extend' | 'suspend' | 'resume';
  body: string;
  createdAt: string;
  admin: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  role: 'manager' | 'agent';
  createdAt: string;
  lastSeenAt: string | null;
}

export interface OfficeDetail {
  office: Office;
  members: Member[];
  invites: Array<{ name: string; phone: string; role: string; createdAt: string }>;
  payments: Payment[];
  notes: Note[];
}

export interface Stats {
  offices: number;
  trial: number;
  active: number;
  ending: number;
  expired: number;
  suspended: number;
  fresh: number;
  /** تومان، ۳۰ روز اخیر */
  revenue30: number;
  payments30: number;
  revenueTotal: number;
}

export type ErrorCode = 'offline' | 'unauthorized' | 'bad_login' | 'locked' | 'too_many' | 'too_small' | 'not_found' | 'already' | 'server';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly retryAfter = 0,
  ) {
    super(code);
  }
}

export interface AdminApi {
  login(phone: string, password: string, code: string): Promise<{ token: string; expiresIn: number; admin: Admin }>;
  me(token: string): Promise<Admin>;
  stats(token: string): Promise<Stats>;
  offices(token: string, q: string, status: OfficeStatus | null): Promise<Office[]>;
  office(token: string, id: string): Promise<OfficeDetail>;
  extend(token: string, id: string, b: { days: number; plan: PlanId; trial: boolean; note: string }): Promise<OfficeDetail>;
  suspend(token: string, id: string, reason: string): Promise<OfficeDetail>;
  resume(token: string, id: string, note: string): Promise<OfficeDetail>;
  addNote(token: string, id: string, body: string): Promise<OfficeDetail>;
  payments(token: string, status: PaymentStatus | null): Promise<Array<Payment & { office: { id: string; name: string } }>>;
  /**
   * اتصال زنده: changed با شناسهٔ دفترهایی که عوض شدند (فهرست خالی = همه‌چیز را تازه کن). تا بسته شدن اتصال
   * باز می‌ماند؛ قطع شدنش با ApiError می‌آید تا دوباره وصل شود.
   */
  listen(token: string, on: { open(): void; changed(offices: string[]): void }, signal: AbortSignal): Promise<void>;
}

// سرور هر ۲۵ ثانیه یک خط خالی می‌فرستد؛ سکوت طولانی‌تر یعنی اتصال بی‌صدا مرده (وای‌فای عوض شد، پراکسی بست).
const LIVE_SILENCE_MS = 70_000;

const URL_ = (import.meta.env.VITE_ADMIN_API_URL as string | undefined) || (import.meta.env.DEV ? 'http://localhost:3000' : '');
export const DEMO = URL_ === 'demo';

function httpApi(base: string): AdminApi {
  async function call<T>(method: 'GET' | 'POST', path: string, token: string | null, body?: object): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        method,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      throw new ApiError('offline');
    }
    if (res.ok) return (await res.json()) as T;
    const e = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
    const known: ErrorCode[] = ['unauthorized', 'bad_login', 'locked', 'too_many', 'too_small', 'not_found', 'already'];
    throw new ApiError(known.includes(e.error as ErrorCode) ? (e.error as ErrorCode) : 'server', e.retryAfter ?? 0);
  }
  const qs = (o: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  return {
    login: (phone, password, code) => call('POST', '/admin/login', null, { phone, password, code }),
    me: async (t) => (await call<{ admin: Admin }>('GET', '/admin/me', t)).admin,
    stats: (t) => call('GET', '/admin/stats', t),
    offices: async (t, q, status) => (await call<{ offices: Office[] }>('GET', `/admin/offices${qs({ q: q.trim() || null, status })}`, t)).offices,
    office: (t, id) => call('GET', `/admin/offices/${id}`, t),
    extend: (t, id, b) => call('POST', `/admin/offices/${id}/extend`, t, b),
    suspend: (t, id, reason) => call('POST', `/admin/offices/${id}/suspend`, t, { reason }),
    resume: (t, id, note) => call('POST', `/admin/offices/${id}/resume`, t, note ? { note } : {}),
    addNote: (t, id, body) => call('POST', `/admin/offices/${id}/notes`, t, { body }),
    payments: async (t, status) =>
      (await call<{ payments: Array<Payment & { office: { id: string; name: string } }> }>('GET', `/admin/payments${qs({ status })}`, t)).payments,
    listen: async (token, on, signal) => {
      // fetch به‌جای EventSource: توکن در هدر می‌رود، نه در آدرس (که در لاگ‌ها می‌ماند).
      const ctl = new AbortController();
      const abort = () => ctl.abort();
      signal.addEventListener('abort', abort);
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const alive = () => {
        clearTimeout(quiet);
        quiet = setTimeout(abort, LIVE_SILENCE_MS);
      };
      try {
        alive();
        let res: Response;
        try {
          res = await fetch(`${base}/admin/events`, {
            headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
            signal: ctl.signal,
            credentials: 'omit',
            cache: 'no-store',
          });
        } catch {
          if (signal.aborted) return;
          throw new ApiError('offline');
        }
        if (res.status === 401) throw new ApiError('unauthorized');
        if (!res.ok || !res.body) throw new ApiError('server');
        on.open();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = '';
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            alive();
            buf += value;
            for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
              const line = /^data: (.*)$/m.exec(buf.slice(0, i))?.[1];
              buf = buf.slice(i + 2);
              if (!line) continue;
              try {
                const o = (JSON.parse(line) as { o?: unknown }).o;
                if (Array.isArray(o)) on.changed(o.filter((x): x is string => typeof x === 'string'));
              } catch {
                on.changed([]);
              }
            }
            if (buf.length > 65_536) buf = '';
          }
        } catch {
          if (!signal.aborted) throw new ApiError('offline');
        }
        if (!signal.aborted) throw new ApiError('offline');
      } finally {
        clearTimeout(quiet);
        signal.removeEventListener('abort', abort);
      }
    },
  };
}

export const api: AdminApi | null = DEMO ? demoApi() : URL_ ? httpApi(URL_.replace(/\/+$/, '')) : null;

/* ---------- دادهٔ نمایشی: همان رفتار سرور، در حافظه ---------- */

function demoApi(): AdminApi {
  const DAY = 86_400_000;
  const now = Date.now();
  const iso = (d: number) => new Date(now + d * DAY).toISOString();
  const me: Admin = { id: 'a1', name: 'مهدی سعادت', phone: '09120000000' };
  const people = [
    'علی رضایی',
    'مریم احمدی',
    'رضا کاظمی',
    'سارا نوری',
    'حسین مرادی',
    'زهرا کریمی',
    'امیر جعفری',
    'نرگس حیدری',
    'محمد یوسفی',
    'لیلا صادقی',
    'بهرام فتحی',
    'فاطمه رحیمی',
  ];
  const names = [
    'املاک پارسا',
    'املاک آفتاب',
    'مشاور املاک نگین',
    'املاک الماس شرق',
    'املاک سپید',
    'مسکن طلایی',
    'املاک کوه‌نور',
    'املاک ونک',
    'املاک آرامش',
    'مشاور املاک ایرانیان',
    'املاک دیبا',
    'املاک ستاره',
  ];
  // [روزهای مانده، آزمایشی، پلن، اعضا، تعلیق، روز ساخت]
  const shapes: Array<[number, boolean, PlanId, number, boolean, number]> = [
    [200, false, 'office', 4, false, -160],
    [-3, false, 'office', 3, false, -120],
    [9, true, 'office', 1, false, -5],
    [4, false, 'pro', 11, false, -300],
    [26, false, 'solo', 1, false, -65],
    [2, true, 'office', 2, false, -12],
    [140, false, 'pro', 8, true, -210],
    [12, true, 'office', 1, false, -2],
    [330, false, 'office', 5, false, -35],
    [-20, true, 'office', 1, false, -34],
    [60, false, 'solo', 1, false, -95],
    [13, true, 'office', 3, false, -1],
  ];
  const plan = (id: string) => PLANS.find((p) => p.id === id)!;
  const offices: OfficeDetail[] = shapes.map(([left, trial, planId, members, suspended, made], i) => {
    const id = `o${i + 1}`;
    const p = plan(planId);
    const phone = `0912${String(1000000 + i * 7919).slice(-7)}`;
    const pays: Payment[] = trial
      ? []
      : [0, 1].slice(0, i % 3 === 0 ? 2 : 1).map((k) => ({
          id: `${id}p${k}`,
          plan: planId,
          period: k === 0 && left > 60 ? 'year' : 'month',
          amount: k === 0 && left > 60 ? p.monthly * 10 : p.monthly,
          gateway: 'zarinpal',
          status: 'paid',
          refId: String(80000000 + i * 1234 + k),
          card: '6037-99**-****-1234',
          createdAt: iso(made + 14 + k * 30),
          paidAt: iso(made + 14 + k * 30),
        }));
    if (i === 1)
      pays.unshift({
        id: `${id}px`,
        plan: 'office',
        period: 'month',
        amount: p.monthly,
        gateway: 'zarinpal',
        status: 'canceled',
        refId: null,
        card: null,
        createdAt: iso(-2),
        paidAt: null,
      });
    const team: Member[] = Array.from({ length: members }, (_, k) => ({
      id: `${id}u${k}`,
      name: people[(i + k) % people.length]!,
      phone: k === 0 ? phone : `0935${String(2000000 + i * 131 + k * 17).slice(-7)}`,
      role: k === 0 ? 'manager' : 'agent',
      createdAt: iso(made + k * 3),
      lastSeenAt: i === 9 ? iso(-19) : iso(-((i * 37 + k * 11) % 50) / 24),
    }));
    const notes: Note[] = [];
    if (suspended) notes.push({ id: `${id}n1`, kind: 'suspend', body: 'پرداخت با کارت دزدی؛ تا بررسی بانک معلق', createdAt: iso(-1), admin: me.name });
    if (i === 0)
      notes.push({ id: `${id}n2`, kind: 'note', body: 'برای وارد کردن فایل‌های اکسل قدیمی تماس گرفتند؛ راهنمایی شد.', createdAt: iso(-8), admin: me.name });
    const office: Office = {
      id,
      name: names[i]!,
      plan: planId,
      trial,
      status: 'active',
      expiresAt: iso(left),
      seats: p.seats,
      members,
      createdAt: iso(made),
      lastSeenAt: team[0]?.lastSeenAt ?? null,
      suspendedAt: suspended ? iso(-1) : null,
      suspendReason: suspended ? 'پرداخت با کارت دزدی؛ تا بررسی بانک معلق' : null,
      paidTotal: pays.filter((x) => x.status === 'paid').reduce((s, x) => s + x.amount, 0),
      manager: { name: team[0]!.name, phone },
    };
    return {
      office,
      members: team,
      invites: i === 0 ? [{ name: 'سارا نوری', phone: '09130000000', role: 'agent', createdAt: iso(-1) }] : [],
      payments: pays,
      notes,
    };
  });

  const status = (o: Office): OfficeStatus => {
    const left = Date.parse(o.expiresAt) - Date.now();
    if (o.suspendedAt) return 'suspended';
    if (left <= 0) return 'expired';
    if (left <= 7 * DAY) return 'ending';
    return o.trial ? 'trial' : 'active';
  };
  const fresh = (d: OfficeDetail): OfficeDetail => {
    d.office.status = status(d.office);
    d.office.paidTotal = d.payments.filter((x) => x.status === 'paid').reduce((s, x) => s + x.amount, 0);
    return structuredClone(d);
  };
  const find = (id: string) => {
    const d = offices.find((x) => x.office.id === id);
    if (!d) throw new ApiError('not_found');
    return d;
  };
  const wait = <T>(v: () => T, ms = 220) =>
    new Promise<T>((ok, bad) =>
      setTimeout(() => {
        try {
          ok(v());
        } catch (e) {
          bad(e);
        }
      }, ms),
    );
  const note = (d: OfficeDetail, kind: Note['kind'], body: string) =>
    d.notes.unshift({ id: `n${Date.now()}`, kind, body, createdAt: new Date().toISOString(), admin: me.name });
  const fa = (n: number) => String(n).replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[Number(x)]!);

  return {
    login: (phone, password, code) =>
      wait(() => {
        if (phone.replace(/\D/g, '').slice(-10) !== '9120000000' || password !== '12345678' || code.length !== 6) throw new ApiError('bad_login');
        return { token: 'demo', expiresIn: 8 * 3600, admin: me };
      }, 500),
    me: () => wait(() => me, 60),
    // پیش‌نمایش سروری ندارد؛ اتصال «زنده» همیشه باز است و کار خود همین صفحه بی‌واسطه دیده می‌شود.
    listen: (_t, on, signal) =>
      new Promise((done) => {
        on.open();
        signal.addEventListener('abort', () => done());
      }),
    stats: () =>
      wait(() => {
        const all = offices.map((d) => status(d.office));
        const count = (s: OfficeStatus) => all.filter((x) => x === s).length;
        const paid = offices.flatMap((d) => d.payments).filter((p) => p.status === 'paid');
        const recent = paid.filter((p) => Date.parse(p.paidAt!) > Date.now() - 30 * DAY);
        return {
          offices: offices.length,
          trial: count('trial'),
          active: count('active'),
          ending: count('ending'),
          expired: count('expired'),
          suspended: count('suspended'),
          fresh: offices.filter((d) => Date.parse(d.office.createdAt) > Date.now() - 30 * DAY).length,
          revenue30: recent.reduce((s, p) => s + p.amount, 0),
          payments30: recent.length,
          revenueTotal: paid.reduce((s, p) => s + p.amount, 0),
        };
      }),
    offices: (_t, q, st) =>
      wait(() => {
        const text = q.trim().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
        const digits = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\D/g, '');
        return offices
          .map(fresh)
          .filter((d) => !st || d.office.status === st)
          .filter((d) => !text || d.office.name.includes(text) || (digits.length >= 3 && d.members.some((m) => m.phone.includes(digits))))
          .sort((a, b) => Date.parse(b.office.createdAt) - Date.parse(a.office.createdAt))
          .map((d) => d.office);
      }),
    office: (_t, id) => wait(() => fresh(find(id))),
    extend: (_t, id, b) =>
      wait(() => {
        const d = find(id);
        const p = plan(b.plan);
        if (p.seats < d.members.length + d.invites.length) throw new ApiError('too_small');
        Object.assign(d.office, {
          plan: p.id,
          seats: p.seats,
          trial: b.trial,
          expiresAt: new Date(Math.max(Date.parse(d.office.expiresAt), Date.now()) + b.days * DAY).toISOString(),
        });
        note(d, 'extend', `تمدید ${fa(b.days)} روزه، پلن ${p.name}${b.trial ? ' (آزمایشی)' : ''}: ${b.note}`);
        return fresh(d);
      }, 400),
    suspend: (_t, id, reason) =>
      wait(() => {
        const d = find(id);
        if (d.office.suspendedAt) throw new ApiError('already');
        Object.assign(d.office, { suspendedAt: new Date().toISOString(), suspendReason: reason });
        note(d, 'suspend', reason);
        return fresh(d);
      }, 400),
    resume: (_t, id, n) =>
      wait(() => {
        const d = find(id);
        if (!d.office.suspendedAt) throw new ApiError('already');
        Object.assign(d.office, { suspendedAt: null, suspendReason: null });
        note(d, 'resume', n || 'تعلیق برداشته شد');
        return fresh(d);
      }, 400),
    addNote: (_t, id, body) =>
      wait(() => {
        const d = find(id);
        note(d, 'note', body);
        return fresh(d);
      }),
    payments: (_t, st) =>
      wait(() =>
        offices
          .flatMap((d) => d.payments.map((p) => ({ ...p, office: { id: d.office.id, name: d.office.name } })))
          .filter((p) => !st || p.status === st)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      ),
  };
}
