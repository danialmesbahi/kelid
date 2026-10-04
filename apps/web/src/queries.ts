import { tehranToday, type KelidStore } from '@kelid/core';

/**
 * کوئری صفحه‌های اصلی در یک جا، تا Shell بتواند آن‌ها را از قبل گرم کند (prefetchQuery)
 * و باز شدن هر صفحه با داده‌ی آماده و بدون مکث باشد.
 */
type Q<T> = { key: string; fn: (s: KelidStore) => Promise<T> };
const q = <T,>(key: string, fn: (s: KelidStore) => Promise<T>): Q<T> => ({ key, fn });

export const filesQuery = q('files', async (s) => {
  const [all, clients] = await Promise.all([s.listListings(), s.listClients()]);
  return { all, clients };
});

export const clientsQuery = q('clients', async (s) => {
  const [clients, listings] = await Promise.all([s.listClients(), s.listListings()]);
  return { clients, listings };
});

export const coverThumbsQuery = q('cover-thumbs', (s) => s.coverThumbs());

export const navCountsQuery = q('nav-counts', async (s) => {
  const [l, c] = await Promise.all([s.listListings(), s.listClients()]);
  return { files: l.length, clients: c.length };
});

export const paletteQuery = q('palette', async (s) => {
  const [listings, clients] = await Promise.all([s.listListings(), s.listClients()]);
  return { listings, clients };
});

/** برنامهٔ امروز؛ کلید با روز عوض می‌شود تا بعد از نیمه‌شب برنامهٔ تازه بیاید. */
export function todayQuery() {
  const dayStart = new Date(`${tehranToday()}T00:00:00+03:30`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();
  return q(`today:${dayStart}`, async (s) => {
    const [visits, todos, listings, clients] = await Promise.all([s.listVisits(dayStart, dayEnd), s.listTodos(), s.listListings(), s.listClients()]);
    return { visits, todos, listings, clients };
  });
}
