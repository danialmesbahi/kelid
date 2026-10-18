import { useEffect, useRef, useState } from 'react';
import { Icon, Skeleton } from '@kelid/ui';
import { dealLabel, formatToman, toFaDigits, type ClientDraft, type ListingDraft, type VoiceDraft, type VoiceForm } from '@kelid/core';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../auth/api';
import { useQuery } from '../data';
import './voice.css';

// دکمهٔ «با صدا بگویید»: مشاور مشخصات را یک‌نفس می‌گوید، سرور کلید با هوش مصنوعی گفته را به فیلدها
// تبدیل می‌کند و فرم پر می‌شود. فقط فیلدهایی که گفته شده عوض می‌شوند و یک دکمه همه را برمی‌گرداند.

const MAX_SECONDS = 120;
const MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

const KIND: Record<string, string> = { apartment: 'آپارتمان', villa: 'ویلایی', shop: 'مغازه', office: 'دفتر کار', land: 'زمین' };
const TEMP: Record<string, string> = { hot: 'جدی و فوری', warm: 'معمولی', cold: 'فعلاً دست نگه داشته' };
const fa = (n: number) => toFaDigits(n);
const toman = (n: number) => `${formatToman(n)} تومان`;

/** آنچه فهمیده شد، کوتاه و خوانا، تا کاربر یک نگاه بفهمد چه چیزی پر شد. */
export function draftChips(form: VoiceForm, d: ListingDraft | ClientDraft): string[] {
  const out: string[] = [];
  const push = (v: string | false | undefined) => v && out.push(v);
  if (form === 'listing') {
    const l = d as ListingDraft;
    push(l.deal && dealLabel[l.deal]);
    push(l.kind && KIND[l.kind]);
    push(l.neighborhood);
    push(l.street && `خیابان ${l.street}`);
    push(l.address && 'نشانی کامل');
    push(l.area !== undefined && `${fa(l.area)} متر`);
    push(l.bedrooms !== undefined && `${fa(l.bedrooms)} خواب`);
    push(l.floor !== undefined && (l.floor === 0 ? 'همکف' : `طبقهٔ ${fa(l.floor)}`));
    push(l.floorsTotal !== undefined && `${fa(l.floorsTotal)} طبقه`);
    push(l.yearBuilt !== undefined && `ساخت ${fa(l.yearBuilt)}`);
    l.features?.forEach((x) => push(x));
    push(l.total !== undefined && `قیمت ${toman(l.total)}`);
    push(l.deposit !== undefined && `ودیعه ${toman(l.deposit)}`);
    push(l.rent !== undefined && `اجاره ${toman(l.rent)}`);
    push(l.negotiable !== undefined && (l.negotiable ? 'قابل مذاکره' : 'قیمت مقطوع'));
    push(l.description && 'توضیحات');
    push(l.ownerName && `مالک: ${l.ownerName}`);
    push(l.ownerPhone && `شمارهٔ مالک`);
    push(l.ownerBestTime && `تماس ${l.ownerBestTime}`);
  } else {
    const c = d as ClientDraft;
    push(c.name);
    push(c.phone && 'شماره تماس');
    push(c.deal && (c.deal === 'sale' ? 'خرید' : dealLabel[c.deal]));
    c.kinds?.forEach((k) => push(KIND[k]));
    c.neighborhoods?.forEach((n) => push(n));
    push(c.areaMin !== undefined && c.areaMax !== undefined ? `${fa(c.areaMin)} تا ${fa(c.areaMax)} متر` : c.areaMin !== undefined ? `از ${fa(c.areaMin)} متر` : c.areaMax !== undefined && `تا ${fa(c.areaMax)} متر`);
    push(c.bedroomsMin !== undefined && `حداقل ${fa(c.bedroomsMin)} خواب`);
    push(c.budget !== undefined && `تا ${toman(c.budget)}`);
    push(c.rent !== undefined && `اجاره تا ${toman(c.rent)}`);
    push(c.temperature && TEMP[c.temperature]);
    push(c.waiting && 'منتظر خبر');
    push(c.notes && 'یادداشت');
  }
  return out;
}

type Phase =
  | { s: 'idle' }
  | { s: 'rec'; sec: number }
  | { s: 'work' }
  | { s: 'done'; transcript: string; chips: string[] }
  | { s: 'error'; text: string };

function errorText(e: unknown): string {
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر اجازه دهید و دوباره بزنید.';
  if (e instanceof DOMException && e.name === 'NotFoundError') return 'میکروفونی به این دستگاه وصل نیست.';
  if (e instanceof ApiError) {
    if (e.code === 'offline') return 'اینترنت وصل نیست؛ برای پر کردن با صدا اینترنت لازم است.';
    if (e.code === 'no_ai') return 'پر کردن با صدا هنوز روی سرور کلید روشن نشده است.';
    if (e.code === 'too_many') return 'کمی صبر کنید و دوباره امتحان کنید.';
    if (e.code === 'bad_audio') return 'صدا درست ضبط نشد؛ دوباره بگویید.';
  }
  return 'صحبت پردازش نشد؛ دوباره امتحان کنید.';
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(blob);
  });

interface Live {
  rec: MediaRecorder;
  stream: MediaStream;
  ctx?: AudioContext;
  raf: number;
  timer: number;
  cancelled: boolean;
}

const supported = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const mmss = (sec: number) => `${toFaDigits(Math.floor(sec / 60))}:${toFaDigits(String(sec % 60).padStart(2, '0'))}`;

/**
 * onDraft پیش‌نویس را روی فرم می‌نشاند و تابع برگرداندن می‌دهد.
 * فقط وقتی دیده می‌شود که برنامه به سرور کلید وصل است (حالت تک‌دستگاهی سرور ندارد).
 */
export function VoiceFill<F extends VoiceForm>({ form, onDraft }: { form: F; onDraft: (d: VoiceDraft<F>) => () => void }) {
  const { status, api, withToken } = useAuth();
  const hoods = useQuery('voice-hoods', async (s) => [...new Set((await s.listListings()).map((l) => l.neighborhood).filter(Boolean))].slice(0, 40));
  const [phase, setPhase] = useState<Phase>({ s: 'idle' });
  const undo = useRef<(() => void) | null>(null);
  const live = useRef<Live | null>(null);
  const bars = useRef<HTMLSpanElement>(null);
  const mounted = useRef(true);

  const release = () => {
    const l = live.current;
    if (!l) return;
    live.current = null;
    cancelAnimationFrame(l.raf);
    clearInterval(l.timer);
    l.stream.getTracks().forEach((t) => t.stop());
    void l.ctx?.close().catch(() => {});
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (live.current) live.current.cancelled = true;
      if (live.current?.rec.state === 'recording') live.current.rec.stop();
      release();
    };
  }, []);

  const send = async (blob: Blob, mime: string) => {
    if (blob.size < 1000) {
      setPhase({ s: 'error', text: 'صدایی ضبط نشد؛ کمی طولانی‌تر بگویید.' });
      return;
    }
    setPhase({ s: 'work' });
    try {
      const audio = await toBase64(blob);
      const r = await withToken((t) => api!.voiceFill(t, { form, audio, mime: mime.split(';')[0]!, hints: hoods ?? [] }));
      if (!mounted.current) return;
      const chips = draftChips(form, r.fields);
      undo.current = chips.length ? onDraft(r.fields) : null;
      setPhase({ s: 'done', transcript: r.transcript, chips });
    } catch (e) {
      if (mounted.current) setPhase({ s: 'error', text: errorText(e) });
    }
  };

  const start = async () => {
    if (live.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      if (!mounted.current) return stream.getTracks().forEach((t) => t.stop());
      const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const cancelled = live.current?.cancelled ?? true;
        release();
        const type = rec.mimeType || mime || 'audio/webm';
        if (!cancelled && mounted.current) void send(new Blob(chunks, { type }), type);
      };
      const begun = Date.now();
      const l: Live = { rec, stream, raf: 0, timer: 0, cancelled: false };
      live.current = l;
      // میله‌های صدا مستقیم با CSS variable جابه‌جا می‌شوند، بی رندر دوبارهٔ React در هر فریم.
      try {
        const ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          bars.current?.style.setProperty('--lvl', String(Math.min(1, peak / 64)));
          l.raf = requestAnimationFrame(tick);
        };
        l.ctx = ctx;
        tick();
      } catch {
        // بی نمایش سطح صدا هم ضبط کار می‌کند.
      }
      l.timer = window.setInterval(() => {
        const sec = Math.floor((Date.now() - begun) / 1000);
        if (sec >= MAX_SECONDS && rec.state === 'recording') rec.stop();
        else setPhase((p) => (p.s === 'rec' && p.sec !== sec ? { s: 'rec', sec } : p));
      }, 250);
      rec.start(1000);
      setPhase({ s: 'rec', sec: 0 });
    } catch (e) {
      release();
      setPhase({ s: 'error', text: errorText(e) });
    }
  };

  const stop = (cancel = false) => {
    const l = live.current;
    if (!l) return;
    l.cancelled = cancel;
    if (l.rec.state === 'recording') l.rec.stop();
    else release();
    if (cancel) setPhase({ s: 'idle' });
  };

  // Esc ضبط را بی‌فرستادن لغو می‌کند.
  useEffect(() => {
    if (phase.s !== 'rec') return;
    const onKey = (e: KeyboardEvent) => {
      const l = live.current;
      if (e.key !== 'Escape' || !l) return;
      e.preventDefault();
      l.cancelled = true;
      l.rec.stop();
      setPhase({ s: 'idle' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase.s]);

  if (status !== 'signedIn' || !api || !supported()) return null;

  const restore = () => {
    undo.current?.();
    undo.current = null;
    setPhase({ s: 'idle' });
  };

  return (
    <section className={`vf ${phase.s === 'rec' ? 'on' : ''}`} aria-live="polite">
      {phase.s === 'rec' ? (
        <>
          <span className="vf-mic live" aria-hidden="true"><Icon name="mic" /></span>
          <div className="col vf-txt">
            <span className="b">در حال گوش دادن… <span className="num mute">{mmss(phase.sec)}</span></span>
            <span className="xs mute">هر وقت گفتنِ مشخصات تمام شد، «تمام شد» را بزنید.</span>
          </div>
          <span ref={bars} className="vf-bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <div className="rw vf-act">
            <button type="button" className="btn btn-g" onClick={() => stop(true)}>لغو</button>
            <button type="button" className="btn btn-p" onClick={() => stop()}><Icon name="check" size="s" thick />تمام شد</button>
          </div>
        </>
      ) : phase.s === 'work' ? (
        <>
          <span className="vf-mic" aria-hidden="true"><Icon name="mic" /></span>
          <div className="col vf-txt">
            <span className="b">در حال فهمیدن صحبت شما…</span>
            <Skeleton w="70%" h={12} />
            <Skeleton w="45%" h={12} />
          </div>
        </>
      ) : phase.s === 'done' ? (
        <>
          <span className={`vf-mic ${phase.chips.length ? 'ok pop-in' : ''}`} aria-hidden="true"><Icon name={phase.chips.length ? 'check' : 'mic'} thick={!!phase.chips.length} /></span>
          <div className="col vf-txt">
            <span className="b">{phase.chips.length ? `${toFaDigits(phase.chips.length)} مورد پر شد؛ یک نگاه بیندازید` : 'از این صحبت چیزی برای فرم پیدا نشد'}</span>
            {phase.chips.length > 0 && (
              <span className="vf-chips stagger">
                {phase.chips.map((c, i) => <span key={i} className="tag ok">{c}</span>)}
              </span>
            )}
            {phase.transcript && <q className="xs mute vf-heard">{phase.transcript}</q>}
          </div>
          <div className="rw vf-act">
            {undo.current && <button type="button" className="btn btn-g" onClick={restore}>برگرداندن</button>}
            <button type="button" className="btn btn-s" onClick={() => void start()}><Icon name="mic" size="s" />{phase.chips.length ? 'گفتن بیشتر' : 'دوباره بگویید'}</button>
          </div>
        </>
      ) : (
        <>
          <span className="vf-mic" aria-hidden="true"><Icon name="mic" /></span>
          <div className="col vf-txt">
            <span className="b">{phase.s === 'error' ? phase.text : 'به جای نوشتن، بگویید'}</span>
            <span className="xs mute">
              {form === 'listing'
                ? 'مثلاً: «آپارتمان فروشی در سعادت‌آباد، ۱۲۰ متر، دو خواب، طبقهٔ سوم، هشت و نیم میلیارد، مالک آقای رضایی…»'
                : 'مثلاً: «خانم احمدی، دنبال رهن و اجاره در ونک، ۸۰ تا ۱۰۰ متر، تا ۵۰۰ میلیون ودیعه…»'}
            </span>
          </div>
          <button type="button" className="btn btn-p vf-go" onClick={() => void start()}><Icon name="mic" size="s" />{phase.s === 'error' ? 'دوباره' : 'شروع صحبت'}</button>
        </>
      )}
    </section>
  );
}
