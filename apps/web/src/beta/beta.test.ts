import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type AuthApi } from '../auth/api';
import { captureError, currentPage, flushBeta, pendingFeedback, queueFeedback } from './beta';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});
vi.stubGlobal('location', { hash: '#/files/AbCdEf123456/edit' });
beforeEach(() => mem.clear());

const errors = () => JSON.parse(mem.get('kelid.beta.errors') ?? '[]') as Array<{ message: string; count: number; page: string }>;
const withToken = <T>(fn: (t: string) => Promise<T>) => fn('t');

describe('beta reports', () => {
  it('keeps ids out of the page path', () => {
    expect(currentPage()).toBe('/files/:id/edit');
    expect(currentPage('#/calendar?day=1405-07-17')).toBe('/calendar');
    expect(currentPage('')).toBe('/');
  });

  it('counts a repeated error once and skips network and extension noise', () => {
    const boom = () => new TypeError('x is undefined');
    const e = boom();
    captureError(e);
    captureError(e);
    captureError(new ApiError('offline'));
    captureError(new TypeError('Failed to fetch'));
    const ext = new Error('bad');
    ext.stack = 'Error: bad\n    at chrome-extension://abc/x.js:1:1';
    captureError(ext);
    expect(errors()).toEqual([expect.objectContaining({ message: 'TypeError: x is undefined', count: 2, page: '/files/:id/edit' })]);
  });

  it('sends feedback and errors, keeps them while offline and drops only what the server took', async () => {
    let online = false;
    const sent: unknown[] = [];
    const api = {
      sendFeedback: async (_t: string, f: unknown) => {
        if (!online) throw new ApiError('offline');
        sent.push(f);
      },
      reportErrors: async (_t: string, list: unknown[]) => {
        if (!online) throw new ApiError('offline');
        sent.push(...list);
        // خطای تازه وسط ارسال: باید در صف بماند
        captureError(new RangeError('late'));
      },
    } as unknown as AuthApi;
    queueFeedback('idea', '  جستجو با صدا  ');
    captureError(new TypeError('boom'));
    await flushBeta(api, withToken);
    expect(pendingFeedback()).toHaveLength(1);
    expect(errors()).toHaveLength(1);

    online = true;
    await flushBeta(api, withToken);
    expect(sent[0]).toMatchObject({ kind: 'idea', body: 'جستجو با صدا', page: '/files/:id/edit' });
    expect(sent[1]).toMatchObject({ message: 'TypeError: boom', count: 1 });
    expect(pendingFeedback()).toEqual([]);
    expect(errors().map((e) => e.message)).toEqual(['RangeError: late']);
  });

  it('gives up on feedback the server keeps rejecting, so the queue never jams', async () => {
    const api = { sendFeedback: async () => Promise.reject(new ApiError('server')), reportErrors: async () => {} } as unknown as AuthApi;
    queueFeedback('problem', 'x');
    for (let i = 0; i < 4; i++) await flushBeta(api, withToken);
    expect(pendingFeedback()).toHaveLength(1);
    await flushBeta(api, withToken);
    expect(pendingFeedback()).toEqual([]);
  });
});
