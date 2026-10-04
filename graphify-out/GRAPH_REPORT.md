# Graph Report - p23  (2026-10-04)

## Corpus Check
- 74 files · ~38,544 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 1)

## Summary
- 724 nodes · 1569 edges · 48 communities (40 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c38d8a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Files.tsx
- allowScripts
- Kelid README
- sqlStore.ts
- web/package.json
- package.json
- desktop/package.json
- seed.ts
- MemoryStore
- compilerOptions
- permissions
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- data.tsx
- core/package.json
- core/tsconfig.json
- Add.tsx
- SqlStore (SQL + outbox + emit)
- Rule: No Full Page Reloads (Link viewTransition)
- database.ts
- Tech Stack Doc
- build
- photos.ts
- Server: Node.js 22 + Fastify
- devDependencies
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- App.tsx
- scripts
- نقشهٔ راه و تقسیم کار
- engines
- KelidStore
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- Recipe: Add a Page
- .prettierrc.json
- icons.cjs
- @playwright/test
- photos.test.ts
- Pull Request Checklist
- nsis
- setup.mjs
- devDependencies
- scripts
- win
- better-sqlite3-mc.d.ts

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 38 edges
2. `SqlStore` - 33 edges
3. `KelidStore` - 31 edges
4. `Icon()` - 29 edges
5. `toFaDigits()` - 27 edges
6. `useQuery()` - 24 edges
7. `TodayPage()` - 20 edges
8. `ClientsPage()` - 19 edges
9. `FilesPage()` - 18 edges
10. `Listing` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `useToast()` --references--> `Undo via Toast instead of Confirm Dialogs`  [EXTRACTED]
  apps/web/src/layout/Toasts.tsx → AGENTS.md
- `matchListing()` --references--> `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)`  [EXTRACTED]
  packages/core/src/match.ts → docs/ARCHITECTURE.md
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts
- `Plaque()` --references--> `Plaque Color Code (green sale, mustard rent, blue full mortgage)`  [EXTRACTED]
  packages/ui/src/components.tsx → AGENTS.md

## Import Cycles
- None detected.

## Communities (48 total, 8 thin omitted)

### Community 0 - "Files.tsx"
Cohesion: 0.08
Nodes (55): useQuery(), useSlow(), useStorageInfo(), ACTIONS, CommandPalette(), Item, PageSkeleton(), activeIndex() (+47 more)

### Community 1 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2

### Community 2 - "Kelid README"
Cohesion: 0.25
Nodes (11): AGENTS.md Agent Rules, Graphify-First Exploration Workflow, Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook, Onboarding Guide (+3 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.06
Nodes (44): normalizeForSearch (Persian text normalization), OpenedDriver, Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult, Client, ClientNeed (+36 more)

### Community 4 - "web/package.json"
Cohesion: 0.06
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.14
Nodes (16): description, better-sqlite3-multiple-ciphers, name, private, version, workspaces, eslint, eslint-config-prettier (+8 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, better-sqlite3-multiple-ciphers, description, better-sqlite3-multiple-ciphers, main, name, private (+6 more)

### Community 7 - "seed.ts"
Cohesion: 0.22
Nodes (10): at(), daysAgo(), L, listing(), seed, seedClients, seedListings, seedTodos (+2 more)

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

### Community 14 - "data.tsx"
Cohesion: 0.08
Nodes (25): Electron Sandbox + window.kelid Preload Bridge, cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, DesktopBridge (+17 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Add.tsx"
Cohesion: 0.12
Nodes (13): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), AddPage(), AmountField(), FEATURES, parseAmount() (+5 more)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.33
Nodes (8): Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Node Test Driver (nodeDriver.ts, SQLCipher in Node), Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript), SqlStore (SQL + outbox + emit), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection)

### Community 20 - "database.ts"
Cohesion: 0.21
Nodes (10): checkParams(), closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params (+2 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "build"
Cohesion: 0.18
Nodes (11): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+3 more)

### Community 23 - "photos.ts"
Cohesion: 0.13
Nodes (25): useStore(), useToast(), FullPhotoLayer(), hasFiles(), Lightbox(), PhotoGallery(), PhotoGrid(), PhotoManager() (+17 more)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 25 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, better-sqlite3-multiple-ciphers, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, globals, @playwright/test (+6 more)

### Community 26 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (4): Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "App.tsx"
Cohesion: 0.09
Nodes (24): App(), Prefs, PrefsContext, router, usePrefsContext(), Notify, Toast, ToastContext (+16 more)

### Community 28 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:desktop, dist:win, e2e, format, format:check (+5 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 31 - "KelidStore"
Cohesion: 0.13
Nodes (6): Start a Kelid task, Listing, deleteReorderUndo(), photo(), photoScenario(), KelidStore

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 35 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (4): Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

### Community 37 - "icons.cjs"
Cohesion: 0.19
Nodes (10): { app, BrowserWindow }, bmp24(), font, fs, header(), path, plaque(), root (+2 more)

### Community 39 - "photos.test.ts"
Cohesion: 0.24
Nodes (5): nodeSqliteDriver(), dirs, dirs, sample, vitest

### Community 40 - "Pull Request Checklist"
Cohesion: 0.22
Nodes (10): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version) (+2 more)

### Community 41 - "nsis"
Cohesion: 0.18
Nodes (11): nsis, allowToChangeInstallationDirectory, createDesktopShortcut, installerHeader, installerIcon, installerSidebar, language, oneClick (+3 more)

### Community 42 - "setup.mjs"
Cohesion: 0.20
Nodes (3): hooks, major, root

### Community 43 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, concurrently, cross-env, electron, electron-builder, esbuild, wait-on

### Community 44 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, build:main, dev, dist

### Community 45 - "win"
Cohesion: 0.67
Nodes (3): win, icon, target

## Knowledge Gaps
- **241 isolated node(s):** `$schema`, `allow`, `deny`, `printWidth`, `tabWidth` (+236 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 304 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `photos.test.ts` to `Add.tsx`, `package.json`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `electron` connect `database.ts` to `icons.cjs`, `desktop/package.json`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `SqlStore (SQL + outbox + emit)`, `photos.test.ts`, `data.tsx`, `KelidStore`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _241 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Files.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07690509583917718 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06224899598393574 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05547652916073969 - nodes in this community are weakly interconnected._