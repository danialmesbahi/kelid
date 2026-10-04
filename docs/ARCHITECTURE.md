# Architecture

Load this on demand (it is not auto-loaded like AGENTS.md). For "who calls what", ask the graph: `graphify query "…"`.

## Data flow

```
 React page (apps/web/src/pages/*)
   │  useQuery('key', s => s.listListings())   ← cached per key, refetched on store change
   │  useStore().addListing(...)               ← writes
   ▼
 KelidStore  (packages/core/src/store.ts — the only contract pages know)
   ├─ SqlStore    (packages/core/src/sql/sqlStore.ts)  real app: SQL + outbox + emit()
   └─ MemoryStore (store.ts)                           tests and last-resort fallback
   ▼
 SqlDriver { all, transaction, execScript }  (packages/core/src/sql/driver.ts)
   ├─ Desktop: window.kelid.db ──IPC──► apps/desktop/src/database.ts ► better-sqlite3-multiple-ciphers
   │            (SQLCipher v4, AES-256; key = 32 random bytes sealed by Windows DPAPI in %APPDATA%\Kelid\kelid.key)
   ├─ Web/PWA:  Worker RPC ► apps/web/src/db/sqlite.worker.ts ► @sqlite.org/sqlite-wasm on OPFS (SAH pool)
   └─ Tests:    packages/core/src/sql/nodeDriver.ts (same SQLCipher module in Node)
```

- `apps/web/src/db/drivers.ts#openDriver()` picks the driver once (singleton): `window.kelid` present → desktop, else worker.
- `apps/web/src/data.tsx#StoreProvider` opens driver → `SqlStore.open(driver, seed)` (runs migrations, seeds sample data once) and shows `<Splash/>` until ready.
- Every write: `transaction([row change, INSERT INTO outbox …])` then `emit()` → all `useQuery` hooks refetch.
- `outbox(seq, entity, entity_id, op, payload, created_at)` is the sync log for phase 2 (server push, per-field LWW with HLC).

## Module map

| Area | Files | Notes |
|---|---|---|
| Domain model | `packages/core/src/model.ts` | `Listing`, `Client` (+`ClientNeed`), `Visit`, `Todo`, `DealType = 'sale'\|'rent'\|'full'` |
| Persian text | `persian.ts` | `toFaDigits`, `toEnDigits`, `normalizeForSearch`, `formatPlaque` |
| Formatting | `format.ts` | `formatToman`, `headlinePrice`, `listingTitle`, `formatLongDate`, `formatTime` |
| Matching | `match.ts` | `matchListing` 0–100 (deal must match; budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), `bestMatches` |
| Sample data | `seed.ts` | rows flagged `sample = 1`; removable from Settings |
| Schema | `sql/schema.ts` | append-only `migrations[]`, version in `PRAGMA user_version` |
| Design tokens | `packages/ui/src/kelid.css` | tokens on `.app` / `.app.dark`; components: `.btn`, `.card`, `.plq`, `.seg`, `.fld`… |
| Motion | `packages/ui/src/motion.css` | view-transition names `kl-side`/`kl-top`/`kl-page`, `.enter`, `.stagger`, `.skel`, toasts |
| UI atoms | `packages/ui/src/components.tsx` | `Icon`, `Plaque`, `Cover`, `Segmented`, `Switch`, `Kbd`, `Skeleton`, `CheckBox` |
| App chrome | `apps/web/src/layout/*` | `Shell` (sidebar + top bar + shortcuts), `CommandPalette`, `Toasts`, `Splash`, `PageSkeleton` |
| Photos | `apps/web/src/photos/*` | resize in a Worker (`resize.worker.ts`: 1600px WebP + 400px thumb), `photoUrl` blob-URL cache keyed by photo id, `useCoverThumbs`, `PhotoGallery` + lightbox on `FileDetail`; bytes live in the `photos` table (migration 2) |
| Prefs | `apps/web/src/prefs.ts` | theme light/dark/auto, text size → `--zoom`; applied pre-paint in `index.html` |
| Branding | `scripts/icons.cjs` → `apps/desktop/build/` (icon.ico, NSIS BMPs), `apps/web/public/` (favicon, PWA PNGs) | generated with the project's Electron from the plaque design; run `npm run icons` after changing it and commit the output |
| PWA | `apps/web/vite.config.ts` (`vite-plugin-pwa`), `main.tsx` | manifest (fa, rtl, emerald, 192/512/maskable), Workbox precache of shell + wasm + fonts; SW registered only in production web builds, never when `window.kelid` exists |
| Phone layout | `app.css` (`@media (max-width: 767px)`), `layout/usePhone.ts`, `Shell` `.mtab` | sidebar hidden, bottom tab bar with new-file FAB; `usePhone` for behavior (Files: tap opens the file; Clients: list *or* profile). Keep the CSS breakpoint and `usePhone` in sync |
| Desktop shell | `apps/desktop/src/main.ts` | window, single-instance lock, external links → browser, opens DB before window |

## Routes (`apps/web/src/App.tsx`, hash router)

| Path | Page | Notes |
|---|---|---|
| `/` | `Today` | greeting, agenda with “now” line, todos, recent files |
| `/files` | `Files` | list/cards, deal filter, preview pane; double-click → detail |
| `/files/:id` | `FileDetail` | hero cover/plaque shared-element transition, archive + undo |
| `/clients` | `Clients` | `?c=id` selection, best matches, start a showing, edit / archive with undo |
| `/calendar`, `/deals` | `Soon` | placeholders (phase 4) |
| `/settings` | `Settings` | theme, text size, storage info, clear sample data |
| `/add` | `Add` | full-screen form outside the shell |
| `/clients/new`, `/clients/:id/edit` | `ClientForm` | full-screen client form; duplicate-phone warning (`normalizePhone`), neighborhood chips, rent cap (`need.rentMax`) |
| `/show?f=id,id` | `Show` | full-screen presentation to a customer, ←/→/Esc |

## Recipes

### Add a field to `Listing`
1. `model.ts`: add the field (optional if old rows lack it).
2. `schema.ts`: **append** a migration, e.g. `ALTER TABLE listings ADD COLUMN parking INTEGER;`.
3. `sqlStore.ts`: add to `LISTING_COLS`, `listingValues()`, `rowToListing()`.
4. `MemoryStore` needs nothing for plain fields; update `seed.ts` if samples should show it.
5. UI: form in `Add.tsx`, display in `FileDetail.tsx`. 6. Test in `sqlStore.test.ts` (write → reopen → read).

### Add a store method
1. Declare it on `KelidStore` (`store.ts`) with a Persian doc comment.
2. Implement in `MemoryStore` and `SqlStore` (mutations: transaction + outbox + `emit()`).
3. Test both paths in `packages/core/src/**/*.test.ts`. 4. Use from pages via `useQuery` / `useStore()`.

### Add a page
1. `apps/web/src/pages/Foo.tsx` exporting `FooPage`; root element `className="bd enter"`.
2. Register in `App.tsx` under the Shell children (or top-level for full-screen pages).
3. Add to `NAV` in `layout/Shell.tsx` only if it belongs in the 5-item sidebar (keep it at 5).
4. Data via `useQuery('foo:…', …)`; first load uses `useSlow` + `PageSkeleton`.
5. Links to it: `<Link to="/foo" viewTransition>`.

### Add an IPC capability (desktop only)
1. `apps/desktop/src/database.ts` (or a new module): `ipcMain.handle('area:action', …)` — validate inputs.
2. `preload.ts`: expose a narrow function on `window.kelid`. 3. Type it on `Window.kelid` in `apps/web/src/db/drivers.ts`.
4. The web build must keep working without it (feature-detect `window.kelid`).

## Testing
- `npm test` runs Vitest over every `*.test.ts` (today: `packages/core/src`). SQL tests open a real SQLCipher file in a temp dir (also checks wrong-key rejection).
- UI is verified by running it: `npm run dev` (browser) or `npm run dev:desktop`. Check light/dark, keyboard, reduced motion, 375px width.
