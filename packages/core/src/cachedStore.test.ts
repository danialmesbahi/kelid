import { describe, expect, it, vi } from 'vitest';
import { CachedStore, MemoryStore, seed } from './index';

function spied() {
  const inner = new MemoryStore(seed);
  const store = new CachedStore(inner);
  return { inner, store, listListings: vi.spyOn(inner, 'listListings'), listTodos: vi.spyOn(inner, 'listTodos') };
}

describe('CachedStore', () => {
  it('reuses a read until its table changes', async () => {
    const { store, listListings } = spied();
    const a = await store.listListings();
    const b = await store.listListings();
    expect(b).toBe(a);
    expect(listListings).toHaveBeenCalledTimes(1);
    // فیلتر متفاوت، خواندن جداست
    await store.listListings({ deal: 'rent' });
    expect(listListings).toHaveBeenCalledTimes(2);
  });

  it('drops only reads of the tables a write touched', async () => {
    const { store, listListings, listTodos } = spied();
    const listings = await store.listListings();
    const todos = await store.listTodos();
    const first = todos[0]!;

    await store.setTodoDone(first.id, !first.done);
    expect(await store.listListings()).toBe(listings);
    expect(listListings).toHaveBeenCalledTimes(1);
    const fresh = await store.listTodos();
    expect(fresh.find((t) => t.id === first.id)?.done).toBe(!first.done);
    expect(listTodos).toHaveBeenCalledTimes(2);

    await store.archiveListing(listings[0]!.id);
    expect((await store.listListings()).length).toBe(listings.length - 1);
  });

  it('notifies subscribers after the cache is cleared', async () => {
    const { store } = spied();
    const before = await store.listListings();
    const seen: number[] = [];
    store.subscribe(() => {
      void store.listListings().then((l) => seen.push(l.length));
    });
    await store.archiveListing(before[0]!.id);
    await Promise.resolve();
    expect(seen).toEqual([before.length - 1]);
  });

  it('clears everything for changes it did not make itself', async () => {
    const { inner, store, listListings } = spied();
    await store.listListings();
    // نوشتن مستقیم روی لایهٔ زیرین (مثل همگام‌سازی آینده)
    await inner.addTodo({ title: 'x' });
    await store.listListings();
    expect(listListings).toHaveBeenCalledTimes(2);
  });

  it('answers single reads from a cached full list', async () => {
    const { inner, store } = spied();
    const all = await store.listListings();
    const get = vi.spyOn(inner, 'getListing');
    expect(await store.getListing(all[1]!.id)).toBe(all[1]);
    expect(await store.getListing('nope')).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
    await store.archiveListing(all[1]!.id);
    expect(await store.getListing(all[1]!.id)).toBeUndefined();
  });

  it('does not keep failed reads', async () => {
    const { inner, store } = spied();
    const spy = vi.spyOn(inner, 'listClients').mockRejectedValueOnce(new Error('disk'));
    await expect(store.listClients()).rejects.toThrow('disk');
    await expect(store.listClients()).resolves.toHaveLength(seed.clients.length);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
