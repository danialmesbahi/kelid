# Graph Report - RealState  (2026-10-04)

## Corpus Check
- 83 files · ~47,147 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 898 nodes · 2016 edges · 65 communities (54 shown, 11 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4c934c85`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Clients.tsx
- allowScripts
- Kelid README
- sqlStore.ts
- web/package.json
- package.json
- desktop/package.json
- visits.test.ts
- MemoryStore
- compilerOptions
- permissions
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- SqlDriver
- core/package.json
- core/tsconfig.json
- ClientForm.tsx
- SqlStore (SQL + outbox + emit)
- Rule: No Full Page Reloads (Link viewTransition)
- clients.test.ts
- Tech Stack Doc
- build
- photos.ts
- Server: Node.js 22 + Fastify
- devDependencies
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- prefs.ts
- scripts
- نقشهٔ راه و تقسیم کار
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- KelidStore
- drivers.ts
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- useSlow
- .prettierrc.json
- preload.ts
- kelid-task/SKILL.md
- sqlite.worker.ts
- nsis
- @types/node
- devDependencies
- scripts
- win
- typescript
- typescript-eslint
- vitest
- Today.tsx
- App.tsx
- Files.tsx
- data.tsx
- database.ts
- icons.cjs
- VisitDialog.tsx
- setup.mjs
- seed.ts
- Persian RTL UI (toFaDigits, toEnDigits, formatToman)
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- eslint-plugin-react-hooks

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 49 edges
2. `SqlStore` - 44 edges
3. `KelidStore` - 42 edges
4. `toFaDigits()` - 40 edges
5. `useQuery()` - 30 edges
6. `useStore()` - 25 edges
7. `useToast()` - 25 edges
8. `nowIso()` - 21 edges
9. `allow` - 20 edges
10. `outbox()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `useToast()` --references--> `Undo via Toast instead of Confirm Dialogs`  [EXTRACTED]
  apps/web/src/layout/Toasts.tsx → AGENTS.md
- `matchListing()` --references--> `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)`  [EXTRACTED]
  packages/core/src/match.ts → docs/ARCHITECTURE.md
- `Plaque()` --references--> `Plaque Color Code (green sale, mustard rent, blue full mortgage)`  [EXTRACTED]
  packages/ui/src/components.tsx → AGENTS.md
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `loadKey()` --references--> `Desktop DB Key Protected by Windows DPAPI (safeStorage)`  [EXTRACTED]
  apps/desktop/src/database.ts → AGENTS.md

## Import Cycles
- None detected.

## Communities (65 total, 11 thin omitted)

### Community 0 - "Clients.tsx"
Cohesion: 0.33
Nodes (8): subscribe(), usePhone(), budgetText(), ClientsPage(), initial(), Kind, needSummary(), packages_core_src_index_describematch

### Community 1 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2

### Community 2 - "Kelid README"
Cohesion: 0.23
Nodes (15): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Rule: Append-Only Schema Migrations, Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui) (+7 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.09
Nodes (33): DealType, b(), blob(), Cell, LISTING_KEEP, LISTING_PH, LISTING_SET, listingUpdateValues() (+25 more)

### Community 4 - "web/package.json"
Cohesion: 0.06
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.20
Nodes (9): description, engines, node, name, private, version, workspaces, apps/* (+1 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.20
Nodes (9): author, dependencies, better-sqlite3-multiple-ciphers, description, better-sqlite3-multiple-ciphers, main, name, private (+1 more)

### Community 7 - "visits.test.ts"
Cohesion: 0.21
Nodes (21): JalaliPicker(), autoTitle(), defaultStart(), VisitDialog(), addDays(), addJalaliMonths(), formatJalaliDay(), JALALI_MONTHS (+13 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, compilerOptions, isolatedModules, jsx, lib, module, moduleResolution (+10 more)

### Community 10 - "permissions"
Cohesion: 0.07
Nodes (29): permissions, allow, deny, $schema, Bash(gh issue list *), Bash(gh issue view *), Bash(gh pr checks *), Bash(gh pr list *) (+21 more)

### Community 11 - "ui/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @kelid/core, exports, ./kelid.css, ./motion.css, @kelid/core, react, main (+7 more)

### Community 12 - "web/tsconfig.json"
Cohesion: 0.15
Nodes (12): compilerOptions, types, exclude, extends, include, src, ../../tsconfig.base.json, ../../packages/core/src/sql/nodeDriver.ts (+4 more)

### Community 13 - "desktop/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, types, extends, include, ES2023, node, src (+2 more)

### Community 14 - "SqlDriver"
Cohesion: 0.17
Nodes (9): DesktopBridge, OpenedDriver, better-sqlite3-multiple-ciphers, SqlDriver, SqlParams, SqlStatement, SqlValue, migrate() (+1 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src, ../../tsconfig.base.json

### Community 17 - "ClientForm.tsx"
Cohesion: 0.06
Nodes (52): normalizeForSearch (Persian text normalization), AmountField(), amountText(), ClientForm(), FormState, grid(), KINDS, numText() (+44 more)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.21
Nodes (14): Rule: New Store Method in Both SqlStore and MemoryStore, Rule: UI Never Runs SQL (useQuery/useStore only), Data Flow: Page -> KelidStore -> SqlDriver -> DB, Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), KelidStore (store contract), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), MemoryStore (tests and fallback), Recipe: Add a Field to Listing (+6 more)

### Community 20 - "clients.test.ts"
Cohesion: 0.13
Nodes (15): Node Test Driver (nodeDriver.ts, SQLCipher in Node), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection), seed, dirs, tenant, dirs, nodeSqliteDriver(), openEncrypted() (+7 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (12): Kelid Real-Estate Office SaaS, Principle: Every External Dependency Behind an Adapter, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Principle: Local-First, Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later) (+4 more)

### Community 22 - "build"
Cohesion: 0.15
Nodes (13): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+5 more)

### Community 23 - "photos.ts"
Cohesion: 0.14
Nodes (24): FullPhotoLayer(), hasFiles(), Lightbox(), PhotoGallery(), PhotoGrid(), PhotoManager(), thumbSrc(), failAll() (+16 more)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (10): Rule: No External CDNs or Google Fonts, Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Principle: Independence from Sanctions and Internet Cutoffs (+2 more)

### Community 25 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-prettier, @eslint/js, globals, devDependencies, better-sqlite3-multiple-ciphers, eslint, eslint-config-prettier (+9 more)

### Community 26 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (7): Rule: Every Mutation = Transaction + Outbox Insert + emit(), Soft Deletes (deleted = 1), Undo via Toast instead of Confirm Dialogs, Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "prefs.ts"
Cohesion: 0.18
Nodes (12): App(), read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM (+4 more)

### Community 28 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:desktop, dist:win, e2e, format, format:check (+5 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)"
Cohesion: 1.00
Nodes (3): Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), Prebuilt Native Modules / npm allowScripts, Common Problems and Fixes

### Community 31 - "KelidStore"
Cohesion: 0.07
Nodes (18): Client, ClientNeed, ClientTemperature, Listing, ListingStatus, Photo, Price, PropertyKind (+10 more)

### Community 32 - "drivers.ts"
Cohesion: 0.14
Nodes (18): Electron Sandbox + window.kelid Preload Bridge, storeFor(), StoreProvider(), desktopDriver(), execScript(), openDriver(), transaction(), Window (+10 more)

### Community 35 - "useSlow"
Cohesion: 0.40
Nodes (5): Rule: No Spinners (useSlow + Skeleton after 120ms), Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

### Community 40 - "sqlite.worker.ts"
Cohesion: 0.40
Nodes (3): Params, ready, Req

### Community 41 - "nsis"
Cohesion: 0.18
Nodes (11): nsis, allowToChangeInstallationDirectory, createDesktopShortcut, installerHeader, installerIcon, installerSidebar, language, oneClick (+3 more)

### Community 43 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, concurrently, cross-env, electron, electron-builder, esbuild, wait-on, concurrently (+5 more)

### Community 44 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, build:main, dev, dist

### Community 45 - "win"
Cohesion: 0.67
Nodes (3): win, icon, target

### Community 50 - "Today.tsx"
Cohesion: 0.09
Nodes (29): ACTIONS, Item, activeIndex(), NAV, Shell(), storageLabel, TABS, ACTION_ICON (+21 more)

### Community 53 - "App.tsx"
Cohesion: 0.12
Nodes (26): Prefs, PrefsContext, router, usePrefsContext(), useStorageInfo(), useStore(), Notify, Toast (+18 more)

### Community 54 - "Files.tsx"
Cohesion: 0.19
Nodes (29): Persian RTL UI (toFaDigits, toEnDigits, formatToman), useQuery(), CommandPalette(), FileDetailPage(), DealFilter, FilesPage(), statusLabel, View (+21 more)

### Community 55 - "data.tsx"
Cohesion: 0.15
Nodes (13): cache, StorageInfo, StoreContext, stores, useSlow(), PageSkeleton(), Splash(), packages_core_src_index_kelidstore (+5 more)

### Community 56 - "database.ts"
Cohesion: 0.26
Nodes (10): checkParams(), closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), ref_better_sqlite3_multiple_ciphers (+2 more)

### Community 57 - "icons.cjs"
Cohesion: 0.21
Nodes (10): { app, BrowserWindow }, bmp24(), font, fs, header(), path, plaque(), root (+2 more)

### Community 58 - "VisitDialog.tsx"
Cohesion: 0.11
Nodes (20): DURATIONS, HOURS, KINDS, MINUTES, VisitPreset, packages_core_src_index_adddays, packages_core_src_index_addjalalimonths, packages_core_src_index_client (+12 more)

### Community 59 - "setup.mjs"
Cohesion: 0.20
Nodes (4): ref_node_child_process, hooks, major, root

### Community 60 - "seed.ts"
Cohesion: 0.28
Nodes (8): at(), daysAgo(), L, listing(), seedClients, seedTodos, seedVisits, tehranToday()

### Community 61 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.40
Nodes (5): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom)

### Community 62 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

## Knowledge Gaps
- **268 isolated node(s):** `$schema`, `Bash(npm run *)`, `Bash(npm test)`, `Bash(npm ci)`, `Bash(npm install)` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `sqlStore.ts` to `visits.test.ts`, `SqlDriver`, `SqlStore (SQL + outbox + emit)`, `clients.test.ts`, `data.tsx`, `KelidStore`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `MemoryStore` connect `MemoryStore` to `sqlStore.ts`, `visits.test.ts`, `SqlStore (SQL + outbox + emit)`, `clients.test.ts`, `data.tsx`, `KelidStore`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `KelidStore` connect `KelidStore` to `sqlStore.ts`, `visits.test.ts`, `MemoryStore`, `SqlStore (SQL + outbox + emit)`, `clients.test.ts`, `data.tsx`, `photos.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `$schema`, `Bash(npm run *)`, `Bash(npm test)` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08611670020120725 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `MemoryStore` be split into smaller, more focused modules?**
  _Cohesion score 0.0960960960960961 - nodes in this community are weakly interconnected._