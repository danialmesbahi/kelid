# Graph Report - p26  (2026-10-04)

## Corpus Check
- 67 files · ~26,563 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 3, .example 1)

## Summary
- 658 nodes · 1475 edges · 36 communities (30 shown, 6 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3fa945c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- sqlStore.ts
- Kelid README
- VisitDialog.tsx
- web/package.json
- package.json
- desktop/package.json
- KelidStore
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
- Schema Migrations (migrations[], PRAGMA user_version)
- Rule: No Full Page Reloads (Link viewTransition)
- database.ts
- Tech Stack Doc
- drivers.ts
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- Server: Node.js 22 + Fastify
- SqlDriver
- SqlStore (SQL + outbox + emit)
- sqlStore.test.ts
- Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)
- نقشهٔ راه و تقسیم کار
- setup.mjs
- useQuery / useStore hooks
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- better-sqlite3-mc.d.ts

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 34 edges
2. `SqlStore` - 32 edges
3. `KelidStore` - 29 edges
4. `Icon()` - 27 edges
5. `VisitDialog()` - 25 edges
6. `toFaDigits()` - 25 edges
7. `useQuery()` - 22 edges
8. `TodayPage()` - 19 edges
9. `listingTitle()` - 18 edges
10. `Listing` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (36 total, 6 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.07
Nodes (65): Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useStorageInfo(), useStore(), ACTIONS (+57 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.11
Nodes (25): normalizeForSearch (Persian text normalization), Persian-normalized search column (LIKE now, FTS5 later), DealType, normalizeForSearch(), b(), Cell, LISTING_PH, listingValues() (+17 more)

### Community 2 - "Kelid README"
Cohesion: 0.28
Nodes (11): Pull Request Checklist, AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook (+3 more)

### Community 3 - "VisitDialog.tsx"
Cohesion: 0.09
Nodes (28): JalaliPicker(), autoTitle(), defaultStart(), DURATIONS, HOURS, KINDS, MINUTES, VisitDialog() (+20 more)

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers, @types/better-sqlite3 (+22 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (45): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+37 more)

### Community 7 - "KelidStore"
Cohesion: 0.05
Nodes (25): Start a Kelid task, budgetOf(), matchListing(), MatchResult, Client, ClientNeed, ClientTemperature, Listing (+17 more)

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
Cohesion: 0.10
Nodes (18): App(), cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, Splash() (+10 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.29
Nodes (7): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom), Jalali Calendar via Intl (calendar: persian)

### Community 18 - "Schema Migrations (migrations[], PRAGMA user_version)"
Cohesion: 0.25
Nodes (8): CI check Job (windows-latest: npm ci, typecheck, test, web build), Git Workflow (feat/fix/docs branches, green CI before merge), Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version), Team Workflow (branch, typecheck/test, PR, CI green), migrations

### Community 20 - "database.ts"
Cohesion: 0.21
Nodes (8): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, electron

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "drivers.ts"
Cohesion: 0.25
Nodes (6): desktopDriver(), execScript(), openDriver(), transaction(), Window, workerDriver()

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 25 - "SqlDriver"
Cohesion: 0.22
Nodes (7): DesktopBridge, OpenedDriver, SqlDriver, SqlParams, SqlStatement, SqlValue, migrate()

### Community 26 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.26
Nodes (8): KelidStore (store contract), MemoryStore (tests and fallback), Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Recipe: Add a Store Method, SqlStore (SQL + outbox + emit), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "sqlStore.test.ts"
Cohesion: 0.20
Nodes (6): Node Test Driver (nodeDriver.ts, SQLCipher in Node), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection), nodeSqliteDriver(), openEncrypted(), dirs, sample

### Community 28 - "Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)"
Cohesion: 0.32
Nodes (8): Electron Sandbox + window.kelid Preload Bridge, Data Flow: Page -> KelidStore -> SqlDriver -> DB, Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers), openDriver() singleton driver selection, Recipe: Add an IPC Capability (desktop only), SqlDriver Interface (all, transaction, execScript), Web Worker Driver (sqlite.worker.ts on OPFS SAH pool), Web/Phone Storage: SQLite WASM on OPFS in Worker

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "setup.mjs"
Cohesion: 0.20
Nodes (3): hooks, major, root

### Community 31 - "useQuery / useStore hooks"
Cohesion: 0.25
Nodes (6): useSlow(), Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), useQuery / useStore hooks, Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

## Knowledge Gaps
- **208 isolated node(s):** `$schema`, `allow`, `deny`, `name`, `version` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 268 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `database.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `react-router` connect `Today.tsx` to `web/package.json`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `VisitDialog.tsx`, `KelidStore`, `data.tsx`, `SqlDriver`, `SqlStore (SQL + outbox + emit)`, `sqlStore.test.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07176864750484924 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11215686274509803 - nodes in this community are weakly interconnected._
- **Should `VisitDialog.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09268707482993198 - nodes in this community are weakly interconnected._