import { describe, expect, it } from 'vitest';
import { AvanegarVoice, GeminiVoice, OpenAiVoice, avanegarTranscribe, geminiSchema, voicePrompt } from './voice';

const cfg = { provider: 'openai' as const, apiKey: 'sk-test', baseUrl: 'https://ai.example/v1', transcribeModel: 'stt', extractModel: 'llm' };

function fakeFetch(content: string, transcript = 'آپارتمان فروشی سعادت‌آباد صد و بیست متر') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = url.endsWith('/audio/transcriptions') ? { text: transcript } : { choices: [{ message: { content } }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe('voice form filling', () => {
  it('transcribes, extracts with a strict schema and cleans the result', async () => {
    const { calls, impl } = fakeFetch(JSON.stringify({ deal: 'sale', kind: 'apartment', neighborhood: 'سعادت‌آباد', area: 120, total: 'lots', street: null }));
    const r = await new OpenAiVoice(cfg, impl).fill('listing', Buffer.alloc(2000), 'audio/webm', ['سعادت‌آباد']);
    expect(r).toEqual({ transcript: 'آپارتمان فروشی سعادت‌آباد صد و بیست متر', fields: { deal: 'sale', kind: 'apartment', neighborhood: 'سعادت‌آباد', area: 120 } });

    expect(calls.map((c) => c.url)).toEqual(['https://ai.example/v1/audio/transcriptions', 'https://ai.example/v1/chat/completions']);
    const stt = calls[0]!.init.body as FormData;
    expect(stt.get('model')).toBe('stt');
    expect(stt.get('language')).toBe('fa');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    const llm = JSON.parse(String(calls[1]!.init.body)) as { model: string; response_format: { json_schema: { strict: boolean } } };
    expect(llm.model).toBe('llm');
    expect(llm.response_format.json_schema.strict).toBe(true);
  });

  it('returns nothing for silence and survives a broken model answer', async () => {
    const silent = fakeFetch('{}', '  ');
    expect(await new OpenAiVoice(cfg, silent.impl).fill('client', Buffer.alloc(2000), 'audio/ogg', [])).toEqual({ transcript: '', fields: {} });
    expect(silent.calls).toHaveLength(1);
    const broken = fakeFetch('not json');
    // جواب خراب مدل: قاعده‌های خود برنامه هنوز از متن پر می‌کنند.
    expect((await new OpenAiVoice(cfg, broken.impl).fill('client', Buffer.alloc(2000), 'audio/ogg', [])).fields).toEqual({ deal: 'sale', kinds: ['apartment'], areaMin: 120 });
  });

  it('throws on a service error so the route can answer ai_failed', async () => {
    const impl = (async () => new Response('quota', { status: 429 })) as unknown as typeof fetch;
    await expect(new OpenAiVoice(cfg, impl).fill('listing', Buffer.alloc(2000), 'audio/webm', [])).rejects.toThrow('429');
  });

  it('tells the model the year and the office neighbourhoods', () => {
    const p = voicePrompt('listing', ['ونک', 'پونک'], 1405);
    expect(p).toContain('1405');
    expect(p).toContain('ونک، پونک');
  });

  it('sends the audio to Gemini once and reads transcript and fields from one answer', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const text = JSON.stringify({ transcript: 'خانم احمدی دنبال رهن کامل در ونک', name: 'خانم احمدی', deal: 'full', neighborhoods: ['ونک'], kinds: null });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const g = new GeminiVoice({ provider: 'gemini', apiKey: 'g-key', baseUrl: 'https://gemini.example/v1beta', model: 'gemini-2.5-flash' }, impl);
    const r = await g.fill('client', Buffer.from('abc'.repeat(400)), 'audio/webm', []);
    expect(r).toEqual({ transcript: 'خانم احمدی دنبال رهن کامل در ونک', fields: { name: 'خانم احمدی', deal: 'full', neighborhoods: ['ونک'] } });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://gemini.example/v1beta/models/gemini-2.5-flash:generateContent');
    expect((calls[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    const body = JSON.parse(String(calls[0]!.init.body)) as { contents: Array<{ parts: Array<{ inlineData: { mimeType: string } }> }>; generationConfig: { responseSchema: { required: string[] } } };
    expect(body.contents[0]!.parts[0]!.inlineData.mimeType).toBe('audio/webm');
    expect(body.generationConfig.responseSchema.required[0]).toBe('transcript');
  });

  it('turns the JSON Schema into Gemini\'s nullable schema', () => {
    expect(geminiSchema({ type: ['array', 'null'], items: { type: 'string', enum: ['a', 'b'] } })).toEqual({ type: 'array', nullable: true, items: { type: 'string', enum: ['a', 'b'] } });
    expect(geminiSchema({ type: ['string', 'null'], enum: ['x', null] })).toEqual({ type: 'string', nullable: true, enum: ['x'] });
  });

  it('transcribes with Avanegar and extracts with the OpenAI-compatible model', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.includes('avanegar')
        ? { status: 'success', data: { data: { aiResponse: { status: 2000, message: 'success', result: { text: 'آپارتمان ۱۲۰ متری در ونک' } } } } }
        : { choices: [{ message: { content: JSON.stringify({ kind: 'apartment', area: 120, neighborhood: 'ونک' }) } }] };
      return new Response(JSON.stringify(body), { status: url.includes('avanegar') ? 201 : 200 });
    }) as unknown as typeof fetch;
    const v = new OpenAiVoice({ ...cfg, stt: { provider: 'avanegar', token: 'tok', url: 'https://stt.example/avanegar' } }, impl);
    const r = await v.fill('listing', Buffer.alloc(2000), 'audio/wav', ['ونک', 'پونک']);
    expect(r).toEqual({ transcript: 'آپارتمان ۱۲۰ متری در ونک', fields: { kind: 'apartment', area: 120, neighborhood: 'ونک' } });
    expect(calls.map((c) => c.url)).toEqual(['https://stt.example/avanegar', 'https://ai.example/v1/chat/completions']);
    expect((calls[0]!.init.headers as Record<string, string>)['gateway-token']).toBe('tok');
    const fd = calls[0]!.init.body as FormData;
    expect(fd.get('language')).toBe('fa');
    expect(fd.getAll('hotwords[]')).toEqual(['ونک', 'پونک']);
    await expect(v.fill('listing', Buffer.alloc(2000), 'audio/webm', [])).rejects.toThrow('unsupported');
  });

  it('treats Avanegar\'s empty-audio error as nothing heard', async () => {
    const impl = (async () =>
      new Response(JSON.stringify({ meta: { code: 'AIError' }, data: { additionalInfo: { statusCode: 400, additionalInfo: { aiStatusCode: '2400', aiMessage: 'Empty Audio file.' } } } }), { status: 400 })) as unknown as typeof fetch;
    expect(await avanegarTranscribe({ provider: 'avanegar', token: 't', url: 'https://stt.example' }, Buffer.alloc(2000), 'audio/wav', [], impl)).toBe('');
    const down = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    await expect(avanegarTranscribe({ provider: 'avanegar', token: 't', url: 'https://stt.example' }, Buffer.alloc(2000), 'audio/wav', [], down)).rejects.toThrow('503');
  });

  it('fills the form with Avanegar alone, using the app rules', async () => {
    const calls: string[] = [];
    const impl = (async (url: string) => {
      calls.push(url);
      const text = 'مشتری آقای سامان مغازه می خواهد، تو خیابون سنگی یکصد و بیست متر قیمت: سی و دو میلیارد';
      return new Response(JSON.stringify({ data: { data: { aiResponse: { result: { text } } } } }), { status: 201 });
    }) as unknown as typeof fetch;
    const v = new AvanegarVoice({ provider: 'avanegar', stt: { provider: 'avanegar', token: 't', url: 'https://stt.example/avanegar' } }, impl);
    const r = await v.fill('client', Buffer.alloc(2000), 'audio/wav', []);
    expect(calls).toEqual(['https://stt.example/avanegar']);
    expect(r.fields).toEqual({ name: 'آقای سامان', deal: 'sale', kinds: ['shop'], neighborhoods: ['خیابان سنگی'], areaMin: 120, budget: 32_000_000_000 });
  });
});
