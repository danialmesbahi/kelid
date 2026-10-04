# Graph Report - p28  (2026-10-04)

## Corpus Check
- 70 files · ~33,780 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 6, .css 3, .example 1)

## Summary
- 656 nodes · 1320 edges · 37 communities (30 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `596ca544`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
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
- Persian RTL UI (toFaDigits, toEnDigits, formatToman)
- SqlStore (SQL + outbox + emit)
- Rule: No Full Page Reloads (Link viewTransition)
- sqlStore.test.ts
- Tech Stack Doc
- build
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- Server: Node.js 22 + Fastify
- devDependencies
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- App.tsx
- scripts
- نقشهٔ راه و تقسیم کار
- engines
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- Recipe: Add a Page
- .prettierrc.json
- @playwright/test

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 27 edges
2. `SqlStore` - 25 edges
3. `Icon()` - 24 edges
4. `KelidStore` - 22 edges
5. `toFaDigits()` - 21 edges
6. `useQuery()` - 20 edges
7. `TodayPage()` - 18 edges
8. `ClientsPage()` - 17 edges
9. `Listing` - 17 edges
10. `listingTitle()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `useToast()` --references--> `Undo via Toast instead of Confirm Dialogs`  [EXTRACTED]
  apps/web/src/layout/Toasts.tsx → AGENTS.md
- `Plaque()` --references--> `Plaque Color Code (green sale, mustard rent, blue full mortgage)`  [EXTRACTED]
  packages/ui/src/components.tsx → AGENTS.md
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `loadKey()` --references--> `Desktop DB Key Protected by Windows DPAPI (safeStorage)`  [EXTRACTED]
  apps/desktop/src/database.ts → AGENTS.md

## Import Cycles
- None detected.

## Communities (37 total, 7 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.07
Nodes (58): Persian RTL UI (toFaDigits, toEnDigits, formatToman), useQuery(), useSlow(), useStore(), ACTIONS, CommandPalette(), Item, PageSkeleton() (+50 more)

### Community 1 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2

### Community 2 - "Kelid README"
Cohesion: 0.24
Nodes (14): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config) (+6 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.06
Nodes (35): normalizeForSearch (Persian text normalization), Start a Kelid task, Persian-normalized search column (LIKE now, FTS5 later), Client, ClientNeed, ClientTemperature, DealType, Listing (+27 more)

### Community 4 - "web/package.json"
Cohesion: 0.06
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.14
Nodes (16): description, better-sqlite3-multiple-ciphers, name, private, version, workspaces, eslint, eslint-config-prettier (+8 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3-multiple-ciphers, description, devDependencies, concurrently, cross-env, electron (+18 more)

### Community 7 - "seed.ts"
Cohesion: 0.09
Nodes (17): Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, bestMatches(), budgetOf(), describeMatch(), matchListing(), MatchResult (+9 more)

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
Cohesion: 0.06
Nodes (32): Electron Sandbox + window.kelid Preload Bridge, cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, DesktopBridge (+24 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.40
Nodes (5): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.36
Nodes (7): Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript), SqlStore (SQL + outbox + emit), useQuery / useStore hooks

### Community 20 - "sqlStore.test.ts"
Cohesion: 0.06
Nodes (28): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, Node Test Driver (nodeDriver.ts, SQLCipher in Node) (+20 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "build"
Cohesion: 0.08
Nodes (25): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+17 more)

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
Nodes (27): App(), Prefs, PrefsContext, router, usePrefsContext(), useStorageInfo(), Notify, Toast (+19 more)

### Community 28 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:desktop, dist:win, e2e, format, format:check (+5 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 35 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (4): Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

## Knowledge Gaps
- **236 isolated node(s):** `$schema`, `allow`, `deny`, `printWidth`, `tabWidth` (+231 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 294 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `sqlStore.test.ts` to `package.json`, `seed.ts`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `electron` connect `sqlStore.test.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `react-router` connect `Today.tsx` to `App.tsx`, `web/package.json`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _236 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07148514851485148 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06368011847463902 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05547652916073969 - nodes in this community are weakly interconnected._