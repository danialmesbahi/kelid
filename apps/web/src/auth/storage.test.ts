import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedSession } from './storage';

const mem = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

const s = { refreshToken: 'r1', deviceId: 'd1', user: { id: 'u1' }, office: { id: 'o1' }, invite: null } as unknown as SavedSession;

describe('saved session and pending logouts', () => {
  beforeEach(() => {
    mem.clear();
    vi.resetModules();
  });

  it('keeps a logout the server did not hear across sign-out, restart and the next sign-in', async () => {
    let st = await import('./storage');
    await st.loadSession();
    await st.saveSession(s);
    await st.setPendingLogouts(['r1']);
    await st.clearSession();
    expect(mem.get('kelid.session')).not.toContain('d1');

    vi.resetModules();
    st = await import('./storage');
    expect(await st.loadSession()).toBeNull();
    expect(st.pendingLogouts()).toEqual(['r1']);
    await st.saveSession({ ...s, refreshToken: 'r2', deviceId: 'd2' });

    vi.resetModules();
    st = await import('./storage');
    expect((await st.loadSession())?.deviceId).toBe('d2');
    expect(st.pendingLogouts()).toEqual(['r1']);
    await st.setPendingLogouts([]);
    await st.clearSession();
    expect(mem.has('kelid.session')).toBe(false);
  });
});
