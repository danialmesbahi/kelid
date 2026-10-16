# Architecture

Load this on demand (it is not auto-loaded like AGENTS.md). For "who calls what", ask the graph: `graphify query "…"`.

## Data flow

```
 React page (apps/web/src/pages/*)
   │  useQuery('key', s => s.listListings())   ← cached per key, refetched on store change
   │  useStore().addListing(...)               ← writes
   ▼
 KelidStore  (packages/core/src/store.ts — the only contract pages know)
   ├─ CachedStore (packages/core/src/cachedStore.ts)  wraps the real store in the app: memoizes reads per table
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
- `apps/web/src/data.tsx#openStore()` (called from `main.tsx` before the first render) opens driver → `new CachedStore(await SqlStore.open(driver, seed))` (runs migrations, seeds sample data once); `StoreProvider` shows `<Splash/>` until ready.
- Every write: `transaction([row change, INSERT INTO outbox …])` then `emit()` → `CachedStore` drops only the reads of the tables that write touched, then mounted `useQuery` hooks (and prefetched ones) refetch; a result whose parts are all unchanged does not re-render.
- Main pages' queries live in `apps/web/src/queries.ts`; `Shell` prefetches them on idle so the first visit to a page renders with data. Long lists render progressively (`layout/useProgressive.ts`) with memoized rows.
- `outbox(seq, entity, entity_id, op, payload, created_at)` is the sync log for phase 2 (server push, per-field LWW with HLC).

## Server (phase 2, `apps/server`)

```
 Fastify app (src/app.ts)  security headers on every reply, generic 5xx body, GET /health
   ▼
 withOffice(pool, officeId, fn)  (src/db.ts)  BEGIN → set_config('kelid.office_id', id, true) → fn → COMMIT
   ▼
 PostgreSQL 16  one schema for all offices; each table: ENABLE + FORCE RLS, policy `office_id = kelid_office()`
```

- Two roles (`apps/server/db/init.sql`): `kelid_owner` owns tables and runs `migrations.ts` (append-only, advisory-locked, applied on start); `kelid_app` (DATABASE_URL) has only row DML, so it cannot turn RLS off. `assertSafeRole()` refuses superuser/BYPASSRLS at startup.
- Login (`src/auth/`): `POST /auth/otp` (6-digit code, 2 min, resend after 60 s, 5 per phone per hour, 10 per IP per 10 min) → `POST /auth/verify` (5 wrong guesses burn the code) → existing phone gets a session, a new one gets a 15-min `signupToken` for `POST /auth/signup` (creates office + user, with a password). Password login: `POST /auth/login {phone, password}` (scrypt hashes in `auth/password.ts`; unknown phone and wrong password give the same `wrong` and take the same time; 5 wrong passwords lock the phone for 15 min; 20 tries per IP per 10 min). `POST /auth/password` changes it with the current password, or without one for 10 min after an SMS login on that device (`devices.otp_at`, one use) — that is the forgot-password path. Session = 15-min HS256 access JWT `{sub, off, dev}` + per-device refresh token, rotated on every `POST /auth/refresh`; replaying an old one after a 60 s grace revokes the device. `GET/DELETE /auth/devices`, `POST /auth/logout`; `requireAuth` also rejects revoked devices immediately.
- Web side (`apps/web/src/auth/`): `AuthProvider` + `Login` only when `VITE_KELID_API_URL` is set. Two paths: **login** (phone + password → app; no tour, sample data cleared; «ورود با کد پیامکی» and «فراموش کردید؟» are the secondary SMS path, the latter ending in a new password) and **signup** (name + office + phone + password → code → short tour). Settings → account changes the password. Whether a phone has an account is revealed only after a correct code (no enumeration); an unknown phone on login can create an office without a second code; signup with an existing phone just logs in. A saved session opens the app instantly, even offline; only a 401 from the server sends the user back to login. Refresh token: Windows → DPAPI-encrypted `session.bin` via `window.kelid.session` (`apps/desktop/src/session.ts`); web → localStorage. Access token stays in memory.
- Sync (`packages/core/src/sync`, `apps/server/src/sync`, `apps/web/src/sync`): every outbox row carries an HLC (`hlc.ts`, lexically sortable). Merge is per-field last-writer-wins on the HLC (`merge.ts`); a delete is just the field `deleted`. Server table `entities` keeps `{fields, clocks}` per record plus a `version` from one sequence; pushes of an office are serialized by an advisory lock, so `GET /sync/pull?cursor=N` never skips anything. `POST /sync/push` is idempotent (a lost ack → resend, no duplicate); the server assigns unique plaques per office and clamps HLCs from clocks in the future. Fields arrive through `sanitizeFields` on both sides. Sample data is never sent. Photo bytes travel separately: `POST /sync/photos/:id` (base64 JSON, ≤2 MB photo + ≤256 KB thumb, magic bytes checked, write-once) and raw-bytes `GET /sync/photos/:id/thumb` and `/full`. `PhotoBlobs` (`apps/server/src/storage/photos.ts`) keeps the bytes in S3-compatible object storage when `S3_*` is set (ArvanCloud, Liara, MinIO; SigV4 client in `storage/s3.ts`, no SDK), otherwise in Postgres. The RLS table `photo_blobs` always holds the row, so a read goes through the office's own row before any object is fetched. The bucket stays private and the server proxies every read. Each upload gets a unique object key `office/photo/<random>` and runs outside the DB transaction, so slow storage never holds a DB connection and a repeated upload never overwrites a stored photo. Locally `photos.blob_state` is 0 = not uploaded, 1 = on server, 2 = metadata arrived and bytes pending (hidden and not counted), 3 = thumbnail here and full photo pending (listed and counted; `getPhoto` returns nothing yet). Live updates: `GET /sync/events` is a Server-Sent Events stream (opened with `fetch` so the token stays in the header). After each push or new photo commits, the server sends `pg_notify('kelid_live', {office, device})`; `LiveHub` (`apps/server/src/sync/live.ts`, one LISTEN connection, opened lazily) forwards a bare `data: change` to the office's other devices, which then run their normal pull. No data travels on the stream. A stream lives no longer than its access token, a revoked or logged-out device is kicked at once (`kickDevice`), and there are caps per device (3), office and process. The client (`SyncEngine.listen`) reconnects with backoff, pulls once after each reconnect, and keeps the 60 s poll as a safety net.
- Client engine (`apps/web/src/sync/engine.ts`): runs only when signed in on a persistent DB (`getSyncTarget()` in `data.tsx`; never the in-memory/locked tab). Push queue → ack (rows deleted only after the server confirms) → pull pages into `SqlStore.applyRemote` (fields still pending locally are kept; quiet, the UI refreshes every few pages). Triggers: start, local write (1.5 s debounce), `online`, tab visible, every 60 s while visible; backoff on errors. After push/pull it uploads pending photo bytes. It then downloads every missing thumbnail first, so lists fill fast, then up to 12 full photos per round, with another round shortly after while more remain. A 404 means not uploaded yet and is retried next round. Opening a photo whose full image hasn't arrived calls `fetchFullPhoto(id)` (`sync/state.ts`), which downloads it at once (deduplicated with the background download) while the lightbox shows the blurred thumbnail. The DB is bound to its office (`meta.sync_office`): `Gate` checks it before rendering anything and a different office's login gets `OfficeSwitch` (sign out, or `resetLocalData()` and continue) so one office's data is never shown or sent in another's account; logout can also wipe the device (shared computers). Status: `useSyncStatus()` (sidebar card + Settings account card).
- Team (`apps/server/src/auth/team.ts`, web `auth/TeamSection.tsx` in Settings): a manager invites a colleague by phone with a role (`manager` / `agent`) and, for agents, whether they see owner phones. Invites live in the global `invites` table (looked up by phone before login); members + open invites ≤ `offices.seats` (set by the plan). The invitee logs in with an SMS code; `/auth/verify` then returns `{signupToken, invite}` and the login screen shows «به دفتر بپیوندید» (`POST /auth/join`, name + password). Someone who already has their own office sees the invite in Settings (`session.invite`) and can move with `POST /auth/invite/accept` only if alone in their office; the device then wipes the old office's local data (no prompt when nothing is queued). Removing a member sets `users.removed_at`, revokes and kicks all their devices; the phone can later sign up or be invited again. Only managers manage the team or rename the office; at least one manager always stays. `authGuard` reads role and permission from the DB on every request (`req.member`) and rejects tokens of a user who left the office. Owner phones: for an agent without permission `/sync/pull` blanks `owner.phone` (`hideOwnerPhone`) and `/sync/push` keeps the stored phone (`keepOwnerPhone`; an empty one may be filled). Each pull carries `ownerPhones`; `SqlStore.setOwnerPhoneAccess` blanks local phones when it is taken away and resets the cursor for a full re-pull when it is given. The engine refuses to send anything with a token of another office (`tokenOffice`).
- Subscription (`packages/core/src/plans.ts`, `apps/server/src/billing/`, web `billing/`): plans, prices (toman/month; a year = 10 months) and trial length live **only** in `PLANS` / `TRIAL_*` in `plans.ts`. `offices` carries `plan`, `trial`, `expires_at`, `seats`; a new office gets a 14-day trial of `office`. `GET /billing` returns the subscription, plans, paid receipts and a fresh **license**: an Ed25519-signed token (`license.ts`, key `LICENSE_PRIVATE_KEY`; public half in `VITE_KELID_LICENSE_KEY`, `npm run license-keys -w @kelid/server` makes a pair) also sent with every session. The client verifies it with WebCrypto and keeps it in `localStorage` (`billing/license.ts`) so the app knows its state offline: after `exp`, or 14 days without reaching the server (`chk`), or with the clock turned back, the app is **read-only** (data visible, every store write throws `ReadOnlyError` through the `guardWrites` proxy in `data.tsx` → toast with «تمدید»; full-screen forms show `WriteGate`; `LicenseBar` explains it). The server enforces the same with `requireActive` (402 `subscription`) on `/sync/push`, photo upload and invites; the sync engine then turns `held` and keeps the queue until renewal. Payment: `POST /billing/checkout` (manager; amount from `PLANS` on the server, plan must fit current members) → gateway (`gateway.ts`: `ZarinpalGateway`, or `DevGateway` with a local fake bank page at `/billing/dev-pay` outside production) → bank calls `GET /billing/callback?o=&p=` (verify outside the transaction, then one locked transaction applies it idempotently via `nextExpiry`: same plan adds days, a plan change converts the remaining days by price) → the `/plans` page polls `GET /billing/payments/:id` and adopts the new license. Payments sit behind RLS like any office table.
- Vendor panel (`apps/server/src/admin/`, app `apps/admin`, port 5174): our own staff see every office's subscription, team and payments, never its listings, clients or photos. Access is a second set of permissive RLS policies gated by `kelid_vendor()` (GUC `kelid.vendor`, set per transaction only by `withVendor` in `db.ts`): `vendor_access` on `offices`, `vendor_read` (select) on `payments`, `vendor_only` on `vendor_admins` and `vendor_notes`, which offices never see (migration 9). Accounts are made only from the server shell: `npm run admin -w @kelid/server -- add --phone 09xxxxxxxxx --name "…"` prints a generated password and a TOTP secret/URI once (`reset`, `disable`, `list` too). `POST /admin/login` = phone + scrypt password + 6-digit TOTP (`admin/totp.ts`, RFC 6238, ±30 s, a used step can't be replayed), 5 failures lock the account 15 min, 10 tries per IP per 10 min; the JWT (`typ: vendor`, 8 h, own derived key) is re-checked against `disabled_at` on every request. Routes: `GET /admin/stats`, `GET /admin/offices?q&status`, `GET /admin/offices/:id`, `POST …/extend` (days + plan + trial flag + required reason; plan must fit members), `…/suspend` (reason), `…/resume`, `…/notes`, `GET /admin/payments?status`; every action writes a `vendor_notes` row. Suspension (`offices.suspended_at`) puts `sus` in the license → the app goes read-only with the reason, `requireActive` answers 402 and checkout 403 `suspended`. Live: triggers from migration 10 `pg_notify('kelid_vendor', office_id)` on every write to `offices`, `users`, `invites`, `payments`, `vendor_notes` (device `last_seen_at` deliberately not), and `kelid_live` `{o, k: 'billing'}` when an office's plan, expiry, seats or suspension changes. One `LiveHub` per server instance (`sync/live.ts`, created in `app.ts`) LISTENs both: `GET /admin/events` (SSE, vendor token in the header, batched ids every 50 ms, disabled admins kicked via `kickVendor`) makes the panel silently reload only what is on screen (`useLoad(key, fn, watch)`, changed rows flash), and `/sync/events` sends `event: billing` so office devices fetch `/billing` and adopt the new license at once (`useLiveLicense`). The app keeps its session in `sessionStorage`; `VITE_ADMIN_API_URL=demo` runs it on sample data (phone 09120000000, password 12345678, any code).
- Beta tools (`apps/server/src/beta/`, web `beta/`, panel `pages/Beta.tsx`; test version on its own branch until the beta starts): self-hosted, no third-party service. `installErrorCapture()` (`main.tsx`) puts uncaught errors and rejections into a local queue (`kelid.beta.errors`, max 20 distinct, repeats counted). Network failures, `ApiError`, `ReadOnlyError` and browser-extension noise are skipped. Ids are stripped from the page path. In-app feedback (sidebar «نظر بدهید», phone «بیشتر» sheet, Settings → «نظر شما») is queued too, each item with its own uuid. `BetaRunner` sends both queues while signed in: at once, a few seconds after something new, on `online` and every 5 min. Sending uses `POST /beta/feedback` (idempotent by id, 10 per user per hour) and `POST /beta/errors` (≤10 per request, 30 per device per 10 min). Feedback and errors are accepted even after the subscription ends. Server tables `feedback` and `client_errors` (migration 11) sit behind office RLS plus `vendor_access`. Errors are grouped by `errorFingerprint` (message without digits + top stack frame without line numbers or build hashes), so one bug is one row per office. A resolved error reopens when it happens again. The panel's «نظرها و خطاها» page lists both live, with open counts on the nav, and has «رسیدگی شد» / «حل شد» with undo. `offices.pilot` is a panel-only label: «افزودن به بتا» on the office page, filter «بتا» in the list, and a note in the office history.
- Accounts hold only real data: with `VITE_KELID_API_URL` set the DB is opened without the sample seed and any old sample rows are cleared on sign-in. Name and office name go to the server (`POST /auth/profile`, queued in `auth/profile.ts` while offline) and come back to other devices on the next token refresh; theme and text size stay per device. A new office gets the welcome with the path ahead (`Welcome signedUp`), then lands on «ثبت اولین فایل» or Today.
- Tests: `config.test.ts`, `app.test.ts`, `auth/auth.test.ts` run everywhere; `db.test.ts` needs `KELID_TEST_*` URLs (CI job `server` on Linux with a Postgres service).

## Module map

| Area | Files | Notes |
|---|---|---|
| Domain model | `packages/core/src/model.ts` | `Listing`, `Client` (+`ClientNeed`), `Visit`, `Todo`, `Deal`, `DealType = 'sale'\|'rent'\|'full'` |
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
| Jalali calendar | `packages/core/src/jalali.ts` | day keys (`yyyy-mm-dd`, Tehran), `jalaliOf`, `jalaliMonthDays`, `tehranIso` / `tehranTimeOf` — `Intl` + `formatToParts` only, no library |
| Calendar | `apps/web/src/calendar/*`, `packages/core/src/agenda.ts` | `TimeGrid` (day/week), `MonthGrid`, `calendar.css`; `layoutDay` puts overlapping visits side by side, `weekStart` = Saturday |
| Deals | `apps/web/src/deals/*`, `packages/core/src/deals.ts` | `Deal` (migration 4, `deals` table), `DEAL_STAGES`, `checklistFor` (sale vs lease), `suggestedCommission` (editable suggestion), `applyDealPatch` sets `closedAt` |
| Map | `apps/web/src/map/*` | Neshan behind `provider.ts` (style, reverse geocoding, search; keys `VITE_NESHAN_MAP_KEY` / `VITE_NESHAN_API_KEY`, `demo` = blank map); `MapView` lazy-loads the SDK and follows the theme; `LocationPicker` (fixed centre pin, search, offline guess from the nearest office listing via `nearestPlace`), `LocationField` in `ListingForm`, `HoodMapButton` in `ClientForm`, `FilesMap` (plaque markers) on Files; `tileCache.ts` wraps `fetch` for `*.neshan.org` and keeps tiles/styles in IndexedDB (works on `file://` too). `Listing.location` = columns `lat`/`lng` (migration 7), synced as one field |
| Visits | `apps/web/src/visits/*` | `VisitDialog` (add/edit; Today, FileDetail, client panel) and keyboard `JalaliPicker` |
| Prefs | `apps/web/src/prefs.ts` | theme light/dark/auto, text size → `--zoom`; applied pre-paint in `index.html`; user/office name and `welcomed` flag (localStorage until phase 2 login) |
| Welcome | `apps/web/src/welcome/` | first-run 4-step intro over the app (name, text size/theme live, keep or clear sample data); re-open from Settings. e2e skips it via `storageState` in `playwright.config.ts` |
| Branding | `scripts/icons.cjs` → `apps/desktop/build/` (icon.ico, NSIS BMPs), `apps/web/public/` (favicon, PWA PNGs) | generated with the project's Electron from the plaque design; run `npm run icons` after changing it and commit the output |
| PWA | `apps/web/vite.config.ts` (`vite-plugin-pwa`), `main.tsx` | manifest (fa, rtl, emerald, 192/512/maskable), Workbox precache of shell + wasm + fonts; SW registered only in production web builds, never when `window.kelid` exists |
| Phone layout | `app.css` (`@media (max-width: 767px)`), `layout/usePhone.ts`, `Shell` `.mtab` | sidebar hidden, bottom tab bar with new-file FAB; `usePhone` for behavior (Files: tap opens the file; Clients: list *or* profile). Keep the CSS breakpoint and `usePhone` in sync |
| Desktop shell | `apps/desktop/src/main.ts` | window, single-instance lock, external links → browser, opens DB before window |
| Auto-update | `apps/desktop/src/updater.ts`, `updateSignature.ts`, `scripts/release.mjs`, `apps/web/src/updates.tsx` | electron-updater (generic provider) against `build/update.json` (server URL + Ed25519 public key, packaged as `resources/update.json`; empty = off). Checks 20 s after launch, then every 4 h, and downloads in the background. A download is installed only if `latest.yml` carries our `kelidSignature` over `version + sha512`; electron-updater has already checked the file against that sha512. It is then installed silently when the app closes (`autoInstallOnAppQuit` turns on only after the check), so work is never interrupted. Settings shows a «نسخهٔ برنامه» card with progress, Persian release notes and an optional «همین حالا نصب». The first run after an update shows a toast once. Staged rollout uses `stagingPercentage`. |

## Routes (`apps/web/src/App.tsx`, hash router)

| Path | Page | Notes |
|---|---|---|
| `/` | `Today` | greeting, agenda with “now” line, todos, recent files |
| `/files` | `Files` | list/cards, deal filter, preview pane; double-click → detail |
| `/files/:id` | `FileDetail` | hero cover/plaque shared-element transition, archive + undo |
| `/clients` | `Clients` | `?c=id` selection, best matches, start a showing, edit / archive with undo |
| `/calendar` | `CalendarPage` | `?v=day\|week\|month&d=yyyy-mm-dd`; week time grid (drag to move, drag bottom edge to resize, Alt+arrows), month grid (drag to another day), phone = day view + week strip; color = listing's plaque color |
| `/deals` | `DealsPage` | 4-stage board (drag a card to another stage; phone = stage tabs), `?d=id` opens the deal panel, `?new=listingId` the new-deal dialog (FileDetail «شروع معامله»). Stage drives listing status: done → closed, lost → active, others → negotiating |
| `/settings` | `Settings` | theme, text size, storage info, clear sample data, subscription card and receipts |
| `/plans` | `PlansPage` | choose plan + month/year, pay (opens the bank in a new tab, page waits and polls), success / failed states |
| `/add` | `Add` | full-screen form outside the shell (`ListingForm`) |
| `/files/:id/edit` | `EditListing` | same `ListingForm` prefilled; status, unsaved-changes prompt (`useBlocker`) |
| `/clients/new`, `/clients/:id/edit` | `ClientForm` | full-screen client form; duplicate-phone warning (`normalizePhone`), neighborhood chips, rent cap (`need.rentMax`) |
| `/show?f=id,id` | `Show` | full-screen presentation to a customer, ←/→/Esc |

All routes sit under a pathless `layout/ScrollMemory` route: moving to another page starts it at the top, going back (browser/phone back, or detail → its list) restores the list's scroll, a search-only change (`?c=`) leaves scroll alone, and re-tapping the open tab scrolls to the top. Register new pages inside it.

## Recipes

### Add a field to `Listing`
1. `model.ts`: add the field (optional if old rows lack it).
2. `schema.ts`: **append** a migration, e.g. `ALTER TABLE listings ADD COLUMN parking INTEGER;`.
3. `sqlStore.ts`: add to `LISTING_COLS`, `listingValues()`, `rowToListing()`.
4. `MemoryStore` needs nothing for plain fields; update `seed.ts` if samples should show it.
5. UI: form in `ListingForm.tsx` (`toState` / `toFields`, shared by add and edit), display in `FileDetail.tsx`. 6. Test in `sqlStore.test.ts` (write → reopen → read).

### Add a store method
1. Declare it on `KelidStore` (`store.ts`) with a Persian doc comment.
2. Implement in `MemoryStore` and `SqlStore` (mutations: transaction + outbox + `emit()`).
3. Test both paths in `packages/core/src/**/*.test.ts`. 4. Use from pages via `useQuery` / `useStore()`.

### Add a page
1. `apps/web/src/pages/Foo.tsx` exporting `FooPage`; root element `className="bd enter"`.
2. Register in `App.tsx` under the Shell children (or top-level for full-screen pages).
3. Add to `NAV` in `layout/Shell.tsx` only if it belongs in the 5-item sidebar (keep it at 5).
4. Data via `useQuery('foo:…', …)`; first load uses `useSlow` + `PageSkeleton`. A main sidebar page: put its query in `queries.ts` and add it to the prefetch list in `Shell.tsx`.
5. Links to it: `<Link to="/foo" viewTransition>` (sidebar/tab-bar entries switch instantly without a view transition).

### Add an IPC capability (desktop only)
1. `apps/desktop/src/database.ts` (or a new module): `ipcMain.handle('area:action', …)` — validate inputs.
2. `preload.ts`: expose a narrow function on `window.kelid`. 3. Type it on `Window.kelid` in `apps/web/src/db/drivers.ts`.
4. The web build must keep working without it (feature-detect `window.kelid`).

## Testing
- `npm test` runs Vitest over every `*.test.ts` (today: `packages/core/src`). SQL tests open a real SQLCipher file in a temp dir (also checks wrong-key rejection).
- UI is verified by running it: `npm run dev` (browser) or `npm run dev:desktop`. Check light/dark, keyboard, reduced motion, 375px width.

## Releasing the Windows app
1. Once per release machine: `npm run update-keys -w @kelid/desktop` writes the private key to `~/.kelid/update-private.pem` and the public key to `apps/desktop/build/update.json`. Back up the private key safely: without it, installed apps never update again. Then set `url` (https) in `update.json` and commit it.
2. Bump `version` in `apps/desktop/package.json` and write Persian notes in `apps/desktop/build/release-notes.md` (one change per line).
3. `npm run dist:win`, then `npm run release -w @kelid/desktop -- --staging 20`. This signs and writes `release/latest.yml`, and refuses to run if the key or `update.json` doesn't match the build.
4. Upload `Kelid-Setup-<v>.exe`, its `.blockmap`, and `latest.yml` last. Keep older installers and blockmaps for differential downloads. To widen the rollout, re-run step 3 with a bigger `--staging` (or none, for everyone) and re-upload `latest.yml`.
