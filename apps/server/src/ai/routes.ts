import type { FastifyInstance } from 'fastify';
import type { Pool } from '../db';
import { authGuard } from '../auth/routes';
import { RateLimiter } from '../auth/rateLimit';
import { requireActive } from '../billing/subscription';
import { VOICE_MIMES, type VoiceAi } from './voice';

// صدای حدود دو دقیقه با opus زیر یک مگابایت است؛ سقف برای ضبط‌های mp4 آیفون جا دارد.
const AUDIO_MAX = 4 * 1024 * 1024;

const voiceSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['form', 'audio', 'mime'],
    properties: {
      form: { type: 'string', enum: ['listing', 'client'] },
      audio: { type: 'string', minLength: 100, maxLength: Math.ceil((AUDIO_MAX * 4) / 3) + 4 },
      mime: { type: 'string', enum: VOICE_MIMES },
      hints: { type: 'array', maxItems: 60, items: { type: 'string', maxLength: 60 } },
      // محله‌ها و زون‌های شهر دفتر (بزرگ‌ترین شهر چند صد نام دارد)؛ فقط قاعده‌ها از آن استفاده می‌کنند.
      places: { type: 'array', maxItems: 1500, items: { type: 'string', maxLength: 60 } },
    },
  },
} as const;

/** پر کردن فرم با صدا. صدا و متن آن هیچ‌جا ذخیره یا لاگ نمی‌شود. */
export async function aiRoutes(app: FastifyInstance, { pool, jwtSecret, voice }: { pool: Pool; jwtSecret: string; voice: VoiceAi | null }) {
  const writable = [authGuard(pool, jwtSecret), requireActive(pool)];
  // هر صحبت هزینه دارد؛ ۶۰ بار در ساعت برای یک مشاور پرکار هم کافی است.
  const byUser = new RateLimiter(60, 60 * 60_000);

  app.post('/ai/voice', { preHandler: writable, bodyLimit: 6 * 1024 * 1024, schema: voiceSchema }, async (req, reply) => {
    if (!voice) return reply.status(503).send({ error: 'no_ai' });
    const wait = byUser.take(req.auth!.sub);
    if (wait) return reply.status(429).header('retry-after', String(wait)).send({ error: 'too_many', retryAfter: wait });
    const b = req.body as { form: 'listing' | 'client'; audio: string; mime: string; hints?: string[]; places?: string[] };
    const bytes = Buffer.from(b.audio, 'base64');
    if (bytes.length < 1000 || bytes.length > AUDIO_MAX) return reply.status(400).send({ error: 'bad_audio' });
    const hints = [...new Set((b.hints ?? []).map((h) => h.trim()).filter(Boolean))].slice(0, 40);
    const places = [...new Set((b.places ?? []).map((h) => h.trim()).filter(Boolean))];
    try {
      return await voice.fill(b.form, bytes, b.mime, hints, places);
    } catch (e) {
      req.log.error({ err: e }, 'voice fill failed');
      return reply.status(502).send({ error: 'ai_failed' });
    }
  });
}
