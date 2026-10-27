import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { VoiceForm } from './voice';
import { ruleDraft } from './voiceRules';

// جمله‌های عامیانه (۱۱۴ + ۱۲۰ + ۱۵۰ + ۵۹ + ۵۷ + ۱۰۸) و صداهای واقعی مهدی (voiceReal) با فهرست محله‌های واقعی بوشهر و تهران. «expected» زیرمجموعه است؛ null یعنی آن فیلد نباید پر شود.
type Case = { form: VoiceForm; transcript: string; hints: 'bushehr' | 'tehran'; expected: Record<string, unknown> };
type City = { h: string[]; z: [string, string[]][] };

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const placesOf = (name: string) => {
  const c = JSON.parse(read(`../../../apps/web/src/places/data/${name}.json`)) as City;
  return [...c.h, ...c.z.map((z) => z[0])];
};
const places = { bushehr: placesOf('bushehr'), tehran: placesOf('tehran') };
const cases = ['./voiceCorpus.jsonl', './voiceCorpus2.jsonl', './voiceCorpus3.jsonl', './voiceCorpus4.jsonl', './voiceCorpus5.jsonl', './voiceCorpus6.jsonl', './voiceReal.jsonl'].flatMap((f) =>
  read(f)
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Case),
);

const sorted = (v: unknown) => (Array.isArray(v) ? [...(v as string[])].sort() : v);

describe('colloquial corpus', () => {
  it.each(cases.map((c) => [c.transcript, c] as const))('%s', (_, c) => {
    const got = ruleDraft(c.form, c.transcript, places[c.hints], 1405) as Record<string, unknown>;
    const picked = Object.fromEntries(Object.keys(c.expected).map((k) => [k, sorted(got[k]) ?? null]));
    const want = Object.fromEntries(Object.entries(c.expected).map(([k, v]) => [k, sorted(v)]));
    expect(picked).toEqual(want);
  });
});
