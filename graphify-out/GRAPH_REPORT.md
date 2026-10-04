# Graph Report - RealState  (2026-10-04)

## Corpus Check
- 68 files · ~33,025 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 686 nodes · 1256 edges · 44 communities (37 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0fbd87ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- KelidStore
- Kelid README
- sqlStore.ts
- web/package.json
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
- prefs.ts
- scripts
- نقشهٔ راه و تقسیم کار
- model.ts
- Schema Migrations (migrations[], PRAGMA user_version)
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- useSlow
- .prettierrc.json
- sqlite.worker.ts
- Visit
- preload.ts
- kelid-task/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 26 edges
2. `SqlStore` - 24 edges
3. `toFaDigits()` - 21 edges
4. `KelidStore` - 21 edges
5. `allow` - 20 edges
6. `useQuery()` - 19 edges
7. `Listing` - 17 edges
8. `listingTitle()` - 16 edges
9. `normalizeForSearch()` - 15 edges
10. `compilerOptions` - 15 edges

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

## Communities (44 total, 7 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.06
Nodes (94): Rule: UI Never Runs SQL (useQuery/useStore only), Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useStorageInfo(), useStore() (+86 more)

### Community 1 - "KelidStore"
Cohesion: 0.15
Nodes (3): Client, Listing, KelidStore

### Community 2 - "Kelid README"
Cohesion: 0.28
Nodes (11): Pull Request Checklist, AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook (+3 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.09
Nodes (28): normalizeForSearch (Persian text normalization), OpenedDriver, Persian-normalized search column (LIKE now, FTS5 later), Todo, normalizeForSearch(), toEnDigits(), SqlDriver, SqlValue (+20 more)

### Community 4 - "web/package.json"
Cohesion: 0.06
Nodes (32): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+24 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.07
Nodes (27): author, dependencies, better-sqlite3-multiple-ciphers, description, devDependencies, concurrently, cross-env, electron (+19 more)

### Community 7 - "seed.ts"
Cohesion: 0.15
Nodes (14): packages_core_src_index_filterlistings, packages_core_src_index_matchlisting, packages_core_src_index_normalizeforsearch, packages_core_src_index_seedclients, packages_core_src_index_seedlistings, at(), daysAgo(), L (+6 more)

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
Cohesion: 0.17
Nodes (11): compilerOptions, types, exclude, extends, include, src, ../../tsconfig.base.json, ../../packages/core/src/sql/nodeDriver.ts (+3 more)

### Community 13 - "desktop/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, types, extends, include, ES2023, node, src (+2 more)

### Community 14 - "data.tsx"
Cohesion: 0.08
Nodes (32): Electron Sandbox + window.kelid Preload Bridge, cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, DesktopBridge (+24 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src, ../../tsconfig.base.json

### Community 17 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.29
Nodes (7): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom), Jalali Calendar via Intl (calendar: persian)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.48
Nodes (7): Rule: New Store Method in Both SqlStore and MemoryStore, Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript), SqlStore (SQL + outbox + emit)

### Community 20 - "sqlStore.test.ts"
Cohesion: 0.06
Nodes (33): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Node Test Driver (nodeDriver.ts, SQLCipher in Node), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection) (+25 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (12): Kelid Real-Estate Office SaaS, Principle: Every External Dependency Behind an Adapter, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Principle: Local-First, Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later) (+4 more)

### Community 22 - "build"
Cohesion: 0.07
Nodes (27): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+19 more)

### Community 23 - "Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)"
Cohesion: 1.00
Nodes (3): Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), Prebuilt Native Modules / npm allowScripts, Common Problems and Fixes

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (10): Rule: No External CDNs or Google Fonts, Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Principle: Independence from Sanctions and Internet Cutoffs (+2 more)

### Community 25 - "devDependencies"
Cohesion: 0.07
Nodes (27): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, globals, devDependencies, better-sqlite3-multiple-ciphers, eslint (+19 more)

### Community 26 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (7): Rule: Every Mutation = Transaction + Outbox Insert + emit(), Soft Deletes (deleted = 1), Undo via Toast instead of Confirm Dialogs, Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "prefs.ts"
Cohesion: 0.21
Nodes (10): App(), read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM (+2 more)

### Community 28 - "scripts"
Cohesion: 0.07
Nodes (26): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2, description, engines, node, name (+18 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "model.ts"
Cohesion: 0.22
Nodes (9): budgetOf(), matchListing(), MatchResult, ClientNeed, ClientTemperature, ListingStatus, Price, PropertyKind (+1 more)

### Community 31 - "Schema Migrations (migrations[], PRAGMA user_version)"
Cohesion: 0.25
Nodes (9): CI check Job (windows-latest: npm ci, typecheck, test, web build), Rule: Append-Only Schema Migrations, Git Workflow (feat/fix/docs branches, green CI before merge), Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version), Team Workflow (branch, typecheck/test, PR, CI green) (+1 more)

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 35 - "useSlow"
Cohesion: 0.33
Nodes (6): Rule: No Spinners (useSlow + Skeleton after 120ms), useSlow(), Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

### Community 37 - "sqlite.worker.ts"
Cohesion: 0.40
Nodes (3): Params, ready, Req

## Knowledge Gaps
- **244 isolated node(s):** `$schema`, `Bash(npm run *)`, `Bash(npm test)`, `Bash(npm ci)`, `Bash(npm install)` (+239 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `sqlStore.ts` to `KelidStore`, `SqlStore (SQL + outbox + emit)`, `sqlStore.test.ts`, `data.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Kelid README` connect `Kelid README` to `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`, `useSlow`, `data.tsx`, `Tech Stack Doc`, `Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)`, `Schema Migrations (migrations[], PRAGMA user_version)`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `seed` connect `data.tsx` to `sqlStore.test.ts`, `seed.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `Bash(npm run *)`, `Bash(npm test)` to the rest of the system?**
  _244 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05791026238161776 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._