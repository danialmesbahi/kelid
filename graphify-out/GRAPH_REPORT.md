# Graph Report - p24  (2026-10-04)

## Corpus Check
- 71 files · ~34,984 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 1)

## Summary
- 671 nodes · 1395 edges · 46 communities (39 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `81457002`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- listingEdit.test.ts
- Kelid README
- sqlStore.ts
- web/package.json
- package.json
- desktop/package.json
- core.test.ts
- MemoryStore
- compilerOptions
- permissions
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- drivers.ts
- core/package.json
- core/tsconfig.json
- ListingForm.tsx
- SqlStore (SQL + outbox + emit)
- Rule: No Full Page Reloads (Link viewTransition)
- database.ts
- Tech Stack Doc
- build
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- Server: Node.js 22 + Fastify
- devDependencies
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- data.tsx
- scripts
- نقشهٔ راه و تقسیم کار
- icons.cjs
- Pull Request Checklist
- Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- useSlow
- .prettierrc.json
- nsis
- @playwright/test
- setup.mjs
- seed.ts
- devDependencies
- scripts
- allowScripts
- win
- engines

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 28 edges
2. `SqlStore` - 26 edges
3. `toFaDigits()` - 25 edges
4. `KelidStore` - 23 edges
5. `Icon()` - 23 edges
6. `useQuery()` - 22 edges
7. `TodayPage()` - 18 edges
8. `FileDetailPage()` - 17 edges
9. `Listing` - 17 edges
10. `ClientsPage()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `useToast()` --references--> `Undo via Toast instead of Confirm Dialogs`  [EXTRACTED]
  apps/web/src/layout/Toasts.tsx → AGENTS.md
- `matchListing()` --references--> `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)`  [EXTRACTED]
  packages/core/src/match.ts → docs/ARCHITECTURE.md
- `migrations` --references--> `Schema Migrations (migrations[], PRAGMA user_version)`  [EXTRACTED]
  packages/core/src/sql/schema.ts → docs/ARCHITECTURE.md
- `Plaque()` --references--> `Plaque Color Code (green sale, mustard rent, blue full mortgage)`  [EXTRACTED]
  packages/ui/src/components.tsx → AGENTS.md

## Import Cycles
- None detected.

## Communities (46 total, 7 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.07
Nodes (64): Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useStorageInfo(), useStore(), ACTIONS (+56 more)

### Community 1 - "listingEdit.test.ts"
Cohesion: 0.19
Nodes (8): StoreProvider (opens driver, SqlStore.open, Splash), seed, dirs, nodeSqliteDriver(), dirs, sample, Sample Data (first-run seed, removable in Settings), vitest

### Community 2 - "Kelid README"
Cohesion: 0.33
Nodes (9): AGENTS.md Agent Rules, Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook, Onboarding Guide, Prerequisites (Node 22, Git, gh, uv + graphify) (+1 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.06
Nodes (42): normalizeForSearch (Persian text normalization), Start a Kelid task, Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult, Client, ClientNeed (+34 more)

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.14
Nodes (16): description, better-sqlite3-multiple-ciphers, name, private, version, workspaces, eslint, eslint-config-prettier (+8 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, better-sqlite3-multiple-ciphers, description, better-sqlite3-multiple-ciphers, main, name, private (+6 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+7 more)

### Community 10 - "permissions"
Cohesion: 0.40
Nodes (4): permissions, allow, deny, $schema

### Community 11 - "ui/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @kelid/core, exports, ./kelid.css, ./motion.css, @kelid/core, react, main (+7 more)

### Community 12 - "web/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, types, exclude, extends, include, ../../tsconfig.base.json

### Community 13 - "desktop/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, types, extends, include, ../../tsconfig.base.json

### Community 14 - "drivers.ts"
Cohesion: 0.11
Nodes (15): DesktopBridge, desktopDriver(), execScript(), openDriver(), OpenedDriver, transaction(), Window, workerDriver() (+7 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "ListingForm.tsx"
Cohesion: 0.10
Nodes (26): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), AmountField(), amountText(), editedFields(), FEATURES (+18 more)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.27
Nodes (9): Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Node Test Driver (nodeDriver.ts, SQLCipher in Node), Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript), SqlStore (SQL + outbox + emit), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection) (+1 more)

### Community 20 - "database.ts"
Cohesion: 0.20
Nodes (9): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, openEncrypted() (+1 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "build"
Cohesion: 0.18
Nodes (11): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+3 more)

### Community 23 - "Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)"
Cohesion: 0.50
Nodes (4): Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), Web Worker Driver (sqlite.worker.ts on OPFS SAH pool), Common Problems and Fixes, Web/Phone Storage: SQLite WASM on OPFS in Worker

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 25 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, better-sqlite3-multiple-ciphers, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, globals, @playwright/test (+6 more)

### Community 26 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (4): Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "data.tsx"
Cohesion: 0.12
Nodes (15): App(), cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, Splash() (+7 more)

### Community 28 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:desktop, dist:win, e2e, format, format:check (+5 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "icons.cjs"
Cohesion: 0.21
Nodes (10): { app, BrowserWindow }, bmp24(), font, fs, header(), path, plaque(), root (+2 more)

### Community 31 - "Pull Request Checklist"
Cohesion: 0.24
Nodes (9): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version) (+1 more)

### Community 32 - "Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)"
Cohesion: 0.32
Nodes (8): Desktop DB Key Protected by Windows DPAPI (safeStorage), Electron Sandbox + window.kelid Preload Bridge, Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers), openDriver() singleton driver selection, Recipe: Add an IPC Capability (desktop only), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 35 - "useSlow"
Cohesion: 0.33
Nodes (5): useSlow(), Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

### Community 37 - "nsis"
Cohesion: 0.18
Nodes (11): nsis, allowToChangeInstallationDirectory, createDesktopShortcut, installerHeader, installerIcon, installerSidebar, language, oneClick (+3 more)

### Community 39 - "setup.mjs"
Cohesion: 0.20
Nodes (3): hooks, major, root

### Community 40 - "seed.ts"
Cohesion: 0.32
Nodes (7): at(), daysAgo(), L, listing(), seedTodos, seedVisits, tehranToday()

### Community 41 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, concurrently, cross-env, electron, electron-builder, esbuild, wait-on

### Community 42 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, build:main, dev, dist

### Community 43 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2

### Community 44 - "win"
Cohesion: 0.67
Nodes (3): win, icon, target

## Knowledge Gaps
- **237 isolated node(s):** `$schema`, `allow`, `deny`, `printWidth`, `tabWidth` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 296 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `listingEdit.test.ts` to `package.json`, `core.test.ts`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `electron` connect `database.ts` to `desktop/package.json`, `icons.cjs`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `react-router` connect `Today.tsx` to `ListingForm.tsx`, `web/package.json`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07033639143730887 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05651176133103844 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._