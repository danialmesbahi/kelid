import { cleanVoiceDraft, voiceSchema, type VoiceDraft, type VoiceForm } from '@kelid/core/voice';
import { jalaliOf, tehranDayKey } from '@kelid/core/jalali';

/**
 * پر کردن فرم با صدا، با یکی از دو سرویس:
 * - openai: دو گام؛ گفتار فارسی → متن (gpt-4o-transcribe) و متن → فیلدها (خروجی ساخت‌یافتهٔ JSON Schema).
 *   هر سرویس سازگار با API اوپن‌ای‌آی کار می‌کند؛ سرور ایران به اوپن‌ای‌آی نمی‌رسد، پس آنجا درگاهی داخلی مثل AvalAI.
 * - gemini: یک گام؛ خود صدا به Gemini می‌رود و متن و فیلدها با هم برمی‌گردند.
 */
export type AiConfig =
  | {
      provider: 'openai';
      apiKey: string;
      /** مثلاً https://api.openai.com/v1 یا https://api.avalai.ir/v1 */
      baseUrl: string;
      transcribeModel: string;
      extractModel: string;
    }
  | {
      provider: 'gemini';
      apiKey: string;
      /** https://generativelanguage.googleapis.com/v1beta */
      baseUrl: string;
      model: string;
    };

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

/** درخواست به سرویس؛ متن خطای سرویس فقط به لاگ سرور می‌رود، نه به کاربر. */
async function post(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<unknown> {
  const res = await fetchImpl(url, { ...init, method: 'POST', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`ai ${new URL(url).pathname} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return res.json();
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
    private readonly cfg: Extract<AiConfig, { provider: 'openai' }>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private call(path: string, init: RequestInit): Promise<unknown> {
    return post(this.fetchImpl, `${this.cfg.baseUrl}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${this.cfg.apiKey}` } });
  }

  async fill<F extends VoiceForm>(form: F, audio: Buffer, mime: string, hints: string[]): Promise<VoiceResult<F>> {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `voice.${EXT[mime] ?? 'webm'}`);
    fd.append('model', this.cfg.transcribeModel);
    fd.append('language', 'fa');
    fd.append('prompt', transcribeHint(hints));
    fd.append('response_format', 'json');
    const heard = (await this.call('/audio/transcriptions', { body: fd })) as { text?: unknown };
    const transcript = typeof heard.text === 'string' ? heard.text.trim().slice(0, 4000) : '';
    if (!transcript) return { transcript: '', fields: {} as VoiceDraft<F> };

    const out = (await this.call('/chat/completions', {
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

type Json = { type?: string | string[]; enum?: unknown[]; properties?: Record<string, Json>; items?: Json; required?: string[]; description?: string };

/** JSON Schema → زیرمجموعهٔ OpenAPI که responseSchema جمینای می‌فهمد (null با nullable، بی additionalProperties). */
export function geminiSchema(s: Json): object {
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  return {
    ...(types.length ? { type: types.find((t) => t !== 'null') ?? 'string' } : {}),
    ...(types.includes('null') ? { nullable: true } : {}),
    ...(s.enum ? { enum: s.enum.filter((x) => x !== null) } : {}),
    ...(s.description ? { description: s.description } : {}),
    ...(s.items ? { items: geminiSchema(s.items) } : {}),
    ...(s.properties ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, geminiSchema(v)])) } : {}),
    ...(s.required ? { required: s.required } : {}),
  };
}

export class GeminiVoice implements VoiceAi {
  constructor(
    private readonly cfg: Extract<AiConfig, { provider: 'gemini' }>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fill<F extends VoiceForm>(form: F, audio: Buffer, mime: string, hints: string[]): Promise<VoiceResult<F>> {
    const base = voiceSchema(form) as Json;
    // متن شنیده‌شده هم در همان پاسخ می‌آید تا کاربر ببیند چه فهمیده شد.
    const schema: Json = {
      ...base,
      properties: { transcript: { type: 'string', description: 'exact Persian transcript of the recording; empty if nothing was said' }, ...base.properties },
      required: ['transcript', ...(base.required ?? [])],
    };
    const out = (await post(this.fetchImpl, `${this.cfg.baseUrl}/models/${encodeURIComponent(this.cfg.model)}:generateContent`, {
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${voicePrompt(form, hints)}\nThe input is the agent's voice recording. First write its exact Persian transcript in "transcript", then fill the fields from it.` }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: audio.toString('base64') } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: geminiSchema(schema) },
      }),
    })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
    const text = (out.candidates?.[0]?.content?.parts ?? []).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
    const raw = parseJson(text) as { transcript?: unknown } | null;
    const transcript = typeof raw?.transcript === 'string' ? raw.transcript.trim().slice(0, 4000) : '';
    if (!transcript) return { transcript: '', fields: {} as VoiceDraft<F> };
    return { transcript, fields: cleanVoiceDraft(form, raw) };
  }
}

export function voiceAi(cfg: AiConfig): VoiceAi {
  return cfg.provider === 'gemini' ? new GeminiVoice(cfg) : new OpenAiVoice(cfg);
}
