# Graph Report - RealState  (2026-10-04)

## Corpus Check
- 63 files · ~22,975 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 590 nodes · 1080 edges · 36 communities (30 shown, 6 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1fae52d5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- sqlStore.ts
- AGENTS.md Agent Rules
- drivers.ts
- dependencies
- package.json
- desktop/package.json
- seed.ts
- build
- compilerOptions
- allow
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- prefs.ts
- core/package.json
- core/tsconfig.json
- Persian RTL UI (toFaDigits, toEnDigits, formatToman)
- sqlite.worker.ts
- Rule: No Full Page Reloads (Link viewTransition)
- preload.ts
- better-sqlite3-mc.d.ts
- Tech Stack Doc
- Server: Node.js 22 + Fastify
- setup.mjs
- Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)
- SqlStore (SQL + outbox + emit)
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- نقشهٔ راه و تقسیم کار
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- Recipe: Add a Page
- StoreProvider
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- kelid-task/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 26 edges
2. `SqlStore` - 24 edges
3. `KelidStore` - 21 edges
4. `toFaDigits()` - 21 edges
5. `allow` - 20 edges
6. `useQuery()` - 19 edges
7. `Listing` - 17 edges
8. `listingTitle()` - 16 edges
9. `normalizeForSearch()` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `SqlStore (SQL + outbox + emit)` --references--> `SqlStore`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/sql/sqlStore.ts
- `KelidStore (store contract)` --references--> `KelidStore`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/store.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (36 total, 6 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.07
Nodes (74): Rule: UI Never Runs SQL (useQuery/useStore only), Prefs, PrefsContext, router, usePrefsContext(), cache, StorageInfo, StoreContext (+66 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.05
Nodes (33): normalizeForSearch (Persian text normalization), Persian-normalized search column (LIKE now, FTS5 later), Client, ClientTemperature, Listing, ListingStatus, Price, PropertyKind (+25 more)

### Community 2 - "AGENTS.md Agent Rules"
Cohesion: 0.24
Nodes (15): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Rule: Append-Only Schema Migrations, Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui) (+7 more)

### Community 3 - "drivers.ts"
Cohesion: 0.08
Nodes (27): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), DesktopBridge, desktopDriver() (+19 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+24 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (33): better-sqlite3-multiple-ciphers, allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies (+25 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.07
Nodes (27): author, dependencies, better-sqlite3-multiple-ciphers, description, devDependencies, concurrently, cross-env, electron (+19 more)

### Community 7 - "seed.ts"
Cohesion: 0.13
Nodes (16): Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, budgetOf(), matchListing(), MatchResult, ClientNeed, at() (+8 more)

### Community 8 - "build"
Cohesion: 0.10
Nodes (21): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+13 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, compilerOptions, isolatedModules, jsx, lib, module, moduleResolution (+10 more)

### Community 10 - "allow"
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

### Community 14 - "prefs.ts"
Cohesion: 0.27
Nodes (8): App(), read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src, ../../tsconfig.base.json

### Community 17 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.29
Nodes (7): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom), Jalali Calendar via Intl (calendar: persian)

### Community 18 - "sqlite.worker.ts"
Cohesion: 0.40
Nodes (3): Params, ready, Req

### Community 23 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (12): Kelid Real-Estate Office SaaS, Principle: Every External Dependency Behind an Adapter, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Principle: Local-First, Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later) (+4 more)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (10): Rule: No External CDNs or Google Fonts, Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Principle: Independence from Sanctions and Internet Cutoffs (+2 more)

### Community 25 - "setup.mjs"
Cohesion: 0.22
Nodes (3): hooks, major, root

### Community 26 - "Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)"
Cohesion: 0.32
Nodes (8): Desktop DB Key Protected by Windows DPAPI (safeStorage), Electron Sandbox + window.kelid Preload Bridge, Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers), openDriver() singleton driver selection, Recipe: Add an IPC Capability (desktop only), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 27 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.48
Nodes (7): Rule: New Store Method in Both SqlStore and MemoryStore, Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript), SqlStore (SQL + outbox + emit)

### Community 28 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (7): Rule: Every Mutation = Transaction + Outbox Insert + emit(), Soft Deletes (deleted = 1), Undo via Toast instead of Confirm Dialogs, Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)"
Cohesion: 0.50
Nodes (5): Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), Prebuilt Native Modules / npm allowScripts, Web Worker Driver (sqlite.worker.ts on OPFS SAH pool), Common Problems and Fixes, Web/Phone Storage: SQLite WASM on OPFS in Worker

### Community 31 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (5): Rule: No Spinners (useSlow + Skeleton after 120ms), Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 32 - "StoreProvider"
Cohesion: 0.40
Nodes (5): storeFor(), StoreProvider(), StoreProvider (opens driver, SqlStore.open, Splash), seed, Sample Data (first-run seed, removable in Settings)

## Knowledge Gaps
- **215 isolated node(s):** `$schema`, `Bash(npm run *)`, `Bash(npm test)`, `Bash(npm ci)`, `Bash(npm install)` (+210 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `sqlStore.ts` to `App.tsx`, `drivers.ts`, `SqlStore (SQL + outbox + emit)`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `MemoryStore` connect `sqlStore.ts` to `App.tsx`, `SqlStore (SQL + outbox + emit)`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `Kelid README` connect `AGENTS.md Agent Rules` to `StoreProvider`, `Tech Stack Doc`, `Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)`, `Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)`, `Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)`, `Recipe: Add a Page`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `Bash(npm run *)`, `Bash(npm test)` to the rest of the system?**
  _215 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06786941580756013 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05198537095088819 - nodes in this community are weakly interconnected._
- **Should `drivers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08097165991902834 - nodes in this community are weakly interconnected._