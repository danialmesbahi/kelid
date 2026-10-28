import { PLANS, priceOf, type Period, type PlanId } from '@kelid/core/plans';
import { toEnDigits } from '@kelid/core/persian';

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
  /** دفتر آزمایشی بتا */
  pilot: boolean;
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
  period: Period;
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
  pilot: number;
  openFeedback: number;
  openErrors: number;
  /** تیکت‌هایی که منتظر پاسخ ما هستند. */
  openTickets: number;
}

export type FeedbackKind = 'problem' | 'idea' | 'praise';

export interface Feedback {
  id: string;
  kind: FeedbackKind;
  body: string;
  page: string;
  appVersion: string;
  platform: string;
  createdAt: string;
  doneAt: string | null;
  office: { id: string; name: string; pilot: boolean };
  user: { name: string; phone: string; role: string };
}

export type TicketTopic = 'problem' | 'question' | 'billing' | 'idea';
export type TicketStatus = 'open' | 'answered' | 'closed';

/** تیکت پشتیبانی؛ «باز» = منتظر پاسخ ما. */
export interface Ticket {
  id: string;
  topic: TicketTopic;
  subject: string;
  status: TicketStatus;
  page: string;
  appVersion: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
  messages: number;
  last: { body: string; from: 'user' | 'support' };
  office: { id: string; name: string; pilot: boolean };
  user: { name: string; phone: string; role: string };
}

/** پیوست پیام؛ بایت‌ها فقط وقتی کسی بازش کرد می‌آیند. */
export interface TicketFile {
  id: string;
  name: string;
  mime: string;
  size: number;
}

/** پیوستی که می‌فرستیم؛ data = بایت‌ها به base64. نوعش را سرور از خود بایت‌ها می‌فهمد. */
export interface NewTicketFile {
  name: string;
  data: string;
}

export interface TicketDetail {
  ticket: Ticket;
  messages: Array<{ id: string; body: string; from: 'user' | 'support'; author: string; createdAt: string; files: TicketFile[] }>;
}

/** یک باگ در همهٔ دفترها (با اثرانگشت یکی شده). */
export interface ClientError {
  fingerprint: string;
  count: number;
  offices: number;
  firstSeen: string;
  lastSeen: string;
  message: string;
  stack: string;
  page: string;
  appVersion: string;
  platform: string;
  recent: Array<{ id: string; name: string }>;
}

export type OfficeFilter = OfficeStatus | 'pilot';

export type ErrorCode = 'offline' | 'unauthorized' | 'bad_login' | 'locked' | 'too_many' | 'too_small' | 'not_found' | 'already' | 'bad_file' | 'too_big' | 'server';

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
  offices(token: string, q: string, status: OfficeFilter | null): Promise<Office[]>;
  office(token: string, id: string): Promise<OfficeDetail>;
  extend(token: string, id: string, b: { days: number; plan: PlanId; trial: boolean; note: string }): Promise<OfficeDetail>;
  suspend(token: string, id: string, reason: string): Promise<OfficeDetail>;
  resume(token: string, id: string, note: string): Promise<OfficeDetail>;
  addNote(token: string, id: string, body: string): Promise<OfficeDetail>;
  payments(token: string, status: PaymentStatus | null): Promise<Array<Payment & { office: { id: string; name: string } }>>;
  setPilot(token: string, id: string, pilot: boolean): Promise<OfficeDetail>;
  feedback(token: string, status: 'open' | 'done'): Promise<Feedback[]>;
  markFeedback(token: string, office: string, id: string, done: boolean): Promise<void>;
  errors(token: string, status: 'open' | 'resolved'): Promise<ClientError[]>;
  resolveError(token: string, fingerprint: string, resolved: boolean): Promise<void>;
  tickets(token: string, status: TicketStatus): Promise<Ticket[]>;
  ticket(token: string, office: string, id: string): Promise<TicketDetail>;
  /** پاسخ ما؛ تیکت «پاسخ داده شد» می‌شود و کاربر در برنامه نشان می‌بیند. */
  replyTicket(token: string, office: string, id: string, body: string, files?: NewTicketFile[]): Promise<TicketDetail>;
  ticketFile(token: string, office: string, id: string, file: string): Promise<Blob>;
  setTicketStatus(token: string, office: string, id: string, status: TicketStatus): Promise<TicketDetail>;
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
    if (res.status === 204) return undefined as T;
    if (res.ok) return (await res.json()) as T;
    const e = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
    const known: ErrorCode[] = ['unauthorized', 'bad_login', 'locked', 'too_many', 'too_small', 'not_found', 'already', 'bad_file', 'too_big'];
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
    offices: async (t, q, status) =>
      (await call<{ offices: Office[] }>('GET', `/admin/offices${qs({ q: q.trim() || null, status: status === 'pilot' ? null : status, pilot: status === 'pilot' ? 'true' : null })}`, t))
        .offices,
    office: (t, id) => call('GET', `/admin/offices/${id}`, t),
    extend: (t, id, b) => call('POST', `/admin/offices/${id}/extend`, t, b),
    suspend: (t, id, reason) => call('POST', `/admin/offices/${id}/suspend`, t, { reason }),
    resume: (t, id, note) => call('POST', `/admin/offices/${id}/resume`, t, note ? { note } : {}),
    addNote: (t, id, body) => call('POST', `/admin/offices/${id}/notes`, t, { body }),
    payments: async (t, status) =>
      (await call<{ payments: Array<Payment & { office: { id: string; name: string } }> }>('GET', `/admin/payments${qs({ status })}`, t)).payments,
    setPilot: (t, id, pilot) => call('POST', `/admin/offices/${id}/pilot`, t, { pilot }),
    feedback: async (t, status) => (await call<{ feedback: Feedback[] }>('GET', `/admin/feedback${qs({ status })}`, t)).feedback,
    markFeedback: (t, office, id, done) => call('POST', `/admin/feedback/${office}/${id}`, t, { done }),
    errors: async (t, status) => (await call<{ errors: ClientError[] }>('GET', `/admin/errors${qs({ status })}`, t)).errors,
    resolveError: (t, fp, resolved) => call('POST', `/admin/errors/${fp}`, t, { resolved }),
    tickets: async (t, status) => (await call<{ tickets: Ticket[] }>('GET', `/admin/tickets${qs({ status })}`, t)).tickets,
    ticket: (t, office, id) => call('GET', `/admin/tickets/${office}/${id}`, t),
    replyTicket: (t, office, id, body, files) => call('POST', `/admin/tickets/${office}/${id}/messages`, t, { body, ...(files?.length ? { files } : {}) }),
    ticketFile: async (t, office, id, file) => {
      let res: Response;
      try {
        res = await fetch(`${base}/admin/tickets/${office}/${id}/files/${file}`, { headers: { authorization: `Bearer ${t}` }, credentials: 'omit', cache: 'no-store' });
      } catch {
        throw new ApiError('offline');
      }
      if (!res.ok) throw new ApiError(res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not_found' : 'server');
      return res.blob();
    },
    setTicketStatus: (t, office, id, status) => call('POST', `/admin/tickets/${office}/${id}/status`, t, { status }),
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
          amount: priceOf(p, k === 0 && left > 60 ? 'year' : 'month'),
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
      pilot: i === 0 || i === 3 || i === 8,
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

  const fb = (i: number, kind: FeedbackKind, body: string, page: string, hours: number, done = false): Feedback => {
    const d = offices[i]!;
    const m = d.members[d.members.length > 1 ? 1 : 0]!;
    return {
      id: `f${i}${hours}`,
      kind,
      body,
      page,
      appVersion: '0.1.0',
      platform: i % 2 ? 'pwa' : 'desktop',
      createdAt: new Date(now - hours * 3_600_000).toISOString(),
      doneAt: done ? new Date(now - (hours - 1) * 3_600_000).toISOString() : null,
      office: { id: d.office.id, name: d.office.name, pilot: d.office.pilot },
      user: { name: m.name, phone: m.phone, role: m.role },
    };
  };
  const feedback: Feedback[] = [
    fb(0, 'problem', 'وقتی عکس فایل را از گوشی می‌گیرم، عکس برعکس ذخیره می‌شود.', '/files/:id/edit', 2),
    fb(3, 'idea', 'کاش می‌شد فایل‌ها را برای مشتری در واتساپ هم فرستاد، نه فقط پیامک.', '/show', 5),
    fb(8, 'praise', 'تقویم خیلی خوب شده، همکارها هم راحت کار می‌کنند. ممنون.', '/calendar', 26),
    fb(3, 'problem', 'جستجوی «ونك» با ک عربی چیزی پیدا نمی‌کرد.', '/files', 72, true),
  ];
  const tk = (i: number, topic: TicketTopic, subject: string, msgs: Array<[from: 'user' | 'support', body: string, hours: number]>): TicketDetail => {
    const d = offices[i]!;
    const m = d.members[0]!;
    const last = msgs.at(-1)!;
    const messages = msgs.map(([from, body, hours], n) => ({
      id: `t${i}-${n}`,
      body,
      from,
      author: from === 'user' ? m.name : 'سارا نوری',
      createdAt: new Date(now - hours * 3_600_000).toISOString(),
      files: [] as TicketFile[],
    }));
    return {
      ticket: {
        id: `t${i}`,
        topic,
        subject,
        status: last[0] === 'user' ? 'open' : 'answered',
        page: '/files',
        appVersion: '0.1.0',
        platform: i % 2 ? 'pwa' : 'desktop',
        createdAt: messages[0]!.createdAt,
        updatedAt: messages.at(-1)!.createdAt,
        messages: messages.length,
        last: { body: last[1], from: last[0] },
        office: { id: d.office.id, name: d.office.name, pilot: d.office.pilot },
        user: { name: m.name, phone: m.phone, role: m.role },
      },
      messages,
    };
  };
  const tickets: TicketDetail[] = [
    tk(1, 'billing', 'تمدید اشتراک سالانه', [['user', 'سلام، اشتراکمان تمام شده. می‌خواهم یک ساله تمدید کنم؛ تخفیف هم دارد؟', 20]]),
    tk(3, 'problem', 'عکس‌ها روی گوشی دیر باز می‌شوند', [
      ['user', 'عکس فایل‌ها روی گوشی همکارم خیلی دیر باز می‌شود. اینترنتش هم خوب است.', 30],
      ['support', 'سلام، ممنون که خبر دادید. لطفاً بگویید گوشی اندروید است یا آیفون؟', 28],
      ['user', 'اندروید، سامسونگ A54.', 4],
    ]),
    tk(5, 'question', 'چاپ برگهٔ فایل برای مشتری', [
      ['user', 'چطور برگهٔ یک فایل را برای مشتری چاپ کنم؟', 26],
      ['support', 'سلام، در صفحهٔ هر فایل دکمهٔ «چاپ» بالای صفحه است.', 3],
    ]),
  ];
  const clientErrors: ClientError[] = [
    {
      fingerprint: '3fa1c0de9b2e4471',
      count: 14,
      offices: 2,
      firstSeen: iso(-3),
      lastSeen: new Date(now - 40 * 60_000).toISOString(),
      message: "TypeError: Cannot read properties of undefined (reading 'plaque')",
      stack: "TypeError: Cannot read properties of undefined (reading 'plaque')\n    at ListingCard (assets/index-Bx3k.js:2:41120)\n    at renderWithHooks (assets/react-Dq9.js:1:22011)",
      page: '/files/:id',
      appVersion: '0.1.0',
      platform: 'desktop',
      recent: [offices[3]!.office, offices[0]!.office].map((o) => ({ id: o.id, name: o.name })),
    },
    {
      fingerprint: '91c2aa07e3d5b810',
      count: 3,
      offices: 1,
      firstSeen: iso(-1),
      lastSeen: iso(-0.4),
      message: 'QuotaExceededError: The quota has been exceeded.',
      stack: 'QuotaExceededError: The quota has been exceeded.\n    at savePhoto (assets/index-Bx3k.js:2:88310)',
      page: '/add',
      appVersion: '0.1.0',
      platform: 'pwa',
      recent: [{ id: offices[8]!.office.id, name: offices[8]!.office.name }],
    },
  ];
  const resolved = new Set<string>();

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
  // بایت پیوست‌های پیش‌نمایش فقط تا بستن صفحه.
  const fileData = new Map<string, string>();
  const findTicket = (id: string) => {
    const x = tickets.find((t) => t.ticket.id === id);
    if (!x) throw new ApiError('not_found');
    return x;
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
        // صفحه‌کلید فارسی هم باید کار کند: ۰۹۱۲… و ۱۲۳۴۵۶ همان ارقام انگلیسی‌اند.
        const en = (s: string) => toEnDigits(s).replace(/\D/g, '');
        if (en(phone).slice(-10) !== '9120000000' || toEnDigits(password) !== '12345678' || en(code).length !== 6) throw new ApiError('bad_login');
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
          pilot: offices.filter((d) => d.office.pilot).length,
          openFeedback: feedback.filter((f) => !f.doneAt).length,
          openErrors: clientErrors.filter((e) => !resolved.has(e.fingerprint)).length,
          openTickets: tickets.filter((x) => x.ticket.status === 'open').length,
        };
      }),
    offices: (_t, q, st) =>
      wait(() => {
        const text = q.trim().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
        const digits = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\D/g, '');
        return offices
          .map(fresh)
          .filter((d) => !st || (st === 'pilot' ? d.office.pilot : d.office.status === st))
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
    setPilot: (_t, id, pilot) =>
      wait(() => {
        const d = find(id);
        if (d.office.pilot !== pilot) note(d, 'note', pilot ? 'به دفترهای آزمایشی (بتا) اضافه شد' : 'از دفترهای آزمایشی (بتا) بیرون آمد');
        d.office.pilot = pilot;
        for (const f of feedback) if (f.office.id === id) f.office.pilot = pilot;
        return fresh(d);
      }),
    feedback: (_t, st) => wait(() => structuredClone(feedback.filter((f) => !f.doneAt === (st === 'open')))),
    markFeedback: (_t, _o, id, done) =>
      wait(() => {
        const f = feedback.find((x) => x.id === id);
        if (!f) throw new ApiError('not_found');
        f.doneAt = done ? (f.doneAt ?? new Date().toISOString()) : null;
      }),
    errors: (_t, st) => wait(() => structuredClone(clientErrors.filter((e) => resolved.has(e.fingerprint) === (st === 'resolved')))),
    resolveError: (_t, fp, r) =>
      wait(() => {
        if (r) resolved.add(fp);
        else resolved.delete(fp);
      }),
    tickets: (_t, st) =>
      wait(() =>
        structuredClone(
          tickets
            .filter((x) => x.ticket.status === st)
            .map((x) => x.ticket)
            .sort((a, b) => (st === 'open' ? 1 : -1) * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt))),
        ),
      ),
    ticket: (_t, _o, id) => wait(() => structuredClone(findTicket(id))),
    replyTicket: (_t, _o, id, body, files) =>
      wait(() => {
        const x = findTicket(id);
        const at = new Date().toISOString();
        const attached = (files ?? []).map((f) => {
          const fid = crypto.randomUUID();
          fileData.set(fid, f.data);
          return { id: fid, name: f.name, mime: f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream', size: Math.floor((f.data.length * 3) / 4) };
        });
        x.messages.push({ id: `${id}-${x.messages.length}`, body: body.trim(), from: 'support', author: 'شما', createdAt: at, files: attached });
        x.ticket = { ...x.ticket, status: 'answered', updatedAt: at, messages: x.messages.length, last: { body: body.trim(), from: 'support' } };
        return structuredClone(x);
      }),
    ticketFile: (_t, _o, _id, file) =>
      wait(() => {
        const data = fileData.get(file);
        if (!data) throw new ApiError('not_found');
        return new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))]);
      }),
    setTicketStatus: (_t, _o, id, st) =>
      wait(() => {
        const x = findTicket(id);
        x.ticket = { ...x.ticket, status: st, updatedAt: new Date().toISOString() };
        return structuredClone(x);
      }),
  };
}
