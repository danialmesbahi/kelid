import { cleanVoiceDraft, voiceSchema, type VoiceDraft, type VoiceForm } from '@kelid/core/voice';
import { jalaliOf, tehranDayKey } from '@kelid/core/jalali';

/**
 * پر کردن فرم با صدا در دو گام: گفتار فارسی → متن (gpt-4o-transcribe) و متن → فیلدهای فرم
 * (مدل زبانی با خروجی ساخت‌یافتهٔ JSON Schema). هر سرویس سازگار با API اوپن‌ای‌آی کار می‌کند؛
 * سرور ایران به اوپن‌ای‌آی نمی‌رسد، پس آنجا AI_BASE_URL درگاهی داخلی مثل AvalAI است.
 */
export interface AiConfig {
  apiKey: string;
  /** مثلاً https://api.openai.com/v1 یا https://api.avalai.ir/v1 */
  baseUrl: string;
  transcribeModel: string;
  extractModel: string;
}

export interface VoiceResult<F extends VoiceForm = VoiceForm> {
  transcript: string;
  fields: VoiceDraft<F>;
}

export interface VoiceAi {
  fill<F extends VoiceForm>(form: F, audio: Buffer, mime: string, hints: string[]): Promise<VoiceResult<F>>;
}

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a' };
export const VOICE_MIMES = Object.keys(EXT);

const WHAT: Record<VoiceForm, string> = {
  listing: 'a NEW PROPERTY FILE (a property the office is selling or renting out for its owner)',
  client: 'a NEW CUSTOMER (someone looking to buy or rent; their needs and budget)',
};

/** دستور مدل؛ قاعده‌های پول و عدد فارسی اینجاست چون بیشترین خطا همان‌جاست. */
export function voicePrompt(form: VoiceForm, hints: string[], year = jalaliOf(tehranDayKey()).y): string {
  return [
    `You fill the form for ${WHAT[form]} in an Iranian real-estate office app, from what an agent said in Persian (transcribed speech).`,
    `The current Solar Hijri year is ${year}.`,
    'Rules:',
    '- Fill only what was actually said or is unmistakably implied. Everything else is null. Never invent or guess values.',
    '- Money is an integer in TOMAN. میلیون = 1,000,000; میلیارد = 1,000,000,000; هزار = 1,000; «تومن» = تومان. ریال ÷ 10. «هشت و نیم میلیارد» = 8500000000; «دو میلیارد و سیصد» = 2300000000; «یک و دویست» in a sale context = 1200000000.',
    '- If the unit is left out, use it only when context makes it certain (sale prices are billions, monthly rents are millions); otherwise null.',
    '- Spoken numbers become digits. Phone numbers: write every digit in order (صفر نهصد و دوازده ... → 0912...). Keep the leading 0.',
    '- «رهن» alone with no rent means full mortgage (full); «رهن و اجاره» / «ودیعه و اجاره» means rent; «فروش» / «فروشی» / «خرید» means sale.',
    '- «همکف» is floor 0. «n طبقه» about the building means floorsTotal. «n خوابه» means bedrooms.',
    '- Text values are Persian script, short and clean; fix obvious speech-recognition misspellings. Do not repeat in notes/description what already has its own field.',
    hints.length ? `- Neighbourhoods this office already uses (prefer this exact spelling when the spoken name sounds the same): ${hints.join('، ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** واژه‌های این کار به مدل گفتار کمک می‌کند نام محله و اصطلاح‌ها را درست بنویسد. */
function transcribeHint(hints: string[]): string {
  return `مشاور املاک مشخصات ملک یا مشتری را می‌گوید: متراژ، خواب، طبقه، رهن، اجاره، ودیعه، میلیون، میلیارد تومان، پارکینگ، آسانسور، انباری. ${hints.join('، ')}`.slice(0, 900);
}

function parseJson(content: unknown): unknown {
  try {
    return typeof content === 'string' ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

export class OpenAiVoice implements VoiceAi {
  constructor(
    private readonly cfg: AiConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: RequestInit): Promise<unknown> {
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${this.cfg.apiKey}` },
      signal: AbortSignal.timeout(45_000),
    });
    // متن خطای سرویس فقط به لاگ سرور می‌رود، نه به کاربر.
    if (!res.ok) throw new Error(`ai ${path} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    return res.json();
  }

  async fill<F extends VoiceForm>(form: F, audio: Buffer, mime: string, hints: string[]): Promise<VoiceResult<F>> {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `voice.${EXT[mime] ?? 'webm'}`);
    fd.append('model', this.cfg.transcribeModel);
    fd.append('language', 'fa');
    fd.append('prompt', transcribeHint(hints));
    fd.append('response_format', 'json');
    const heard = (await this.call('/audio/transcriptions', { method: 'POST', body: fd })) as { text?: unknown };
    const transcript = typeof heard.text === 'string' ? heard.text.trim().slice(0, 4000) : '';
    if (!transcript) return { transcript: '', fields: {} as VoiceDraft<F> };

    const out = (await this.call('/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.cfg.extractModel,
        temperature: 0,
        messages: [
          { role: 'system', content: voicePrompt(form, hints) },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_schema', json_schema: { name: `kelid_${form}`, strict: true, schema: voiceSchema(form) } },
      }),
    })) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = out.choices?.[0]?.message?.content;
    return { transcript, fields: cleanVoiceDraft(form, parseJson(content)) };
  }
}
