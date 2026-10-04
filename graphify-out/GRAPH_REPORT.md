# Graph Report - kelid  (2026-10-04)

## Corpus Check
- 66 files · ~24,669 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 619 nodes · 1261 edges · 35 communities (31 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `21f8b153`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- sqlStore.ts
- Kelid README
- drivers.ts
- web/package.json
- package.json
- desktop/package.json
- seed.ts
- data.tsx
- compilerOptions
- permissions
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- prefs.ts
- core/package.json
- core/tsconfig.json
- Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)
- ListingForm.tsx
- Rule: No Full Page Reloads (Link viewTransition)
- SqlDriver
- listingEdit.test.ts
- setup.mjs
- Tech Stack Doc
- Server: Node.js 22 + Fastify
- database.ts
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- KelidStore (store contract)
- SqlStore (SQL + outbox + emit)
- نقشهٔ راه و تقسیم کار
- Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts)
- Recipe: Add a Page
- Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 28 edges
2. `SqlStore` - 26 edges
3. `KelidStore` - 23 edges
4. `useQuery()` - 22 edges
5. `TodayPage()` - 18 edges
6. `toFaDigits()` - 17 edges
7. `Icon()` - 17 edges
8. `ClientsPage()` - 16 edges
9. `Listing` - 15 edges
10. `normalizeForSearch()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (35 total, 4 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.06
Nodes (69): Persian RTL UI (toFaDigits, toEnDigits, formatToman), App(), Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useSlow() (+61 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.05
Nodes (44): normalizeForSearch (Persian text normalization), Start a Kelid task, Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult (+36 more)

### Community 2 - "Kelid README"
Cohesion: 0.24
Nodes (14): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config) (+6 more)

### Community 3 - "drivers.ts"
Cohesion: 0.25
Nodes (6): desktopDriver(), execScript(), openDriver(), transaction(), Window, workerDriver()

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers (+22 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (45): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+37 more)

### Community 7 - "seed.ts"
Cohesion: 0.14
Nodes (9): at(), daysAgo(), L, listing(), seedClients, seedListings, seedTodos, seedVisits (+1 more)

### Community 8 - "data.tsx"
Cohesion: 0.09
Nodes (11): cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, Splash(), StoreProvider (opens driver, SqlStore.open, Splash) (+3 more)

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

### Community 14 - "prefs.ts"
Cohesion: 0.36
Nodes (7): read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)"
Cohesion: 0.40
Nodes (5): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom)

### Community 18 - "ListingForm.tsx"
Cohesion: 0.16
Nodes (15): AmountField(), amountText(), FEATURES, FormState, grid(), KINDS, ListingFields, ListingForm() (+7 more)

### Community 20 - "SqlDriver"
Cohesion: 0.18
Nodes (7): DesktopBridge, OpenedDriver, better-sqlite3-multiple-ciphers, SqlDriver, SqlParams, SqlStatement, SqlValue

### Community 21 - "listingEdit.test.ts"
Cohesion: 0.23
Nodes (5): dirs, nodeSqliteDriver(), dirs, sample, vitest

### Community 22 - "setup.mjs"
Cohesion: 0.20
Nodes (3): hooks, major, root

### Community 23 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 25 - "database.ts"
Cohesion: 0.22
Nodes (9): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, openEncrypted() (+1 more)

### Community 26 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 27 - "KelidStore (store contract)"
Cohesion: 0.43
Nodes (5): Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Recipe: Add a Store Method, useQuery / useStore hooks

### Community 28 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.25
Nodes (8): Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version), SqlStore (SQL + outbox + emit), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete), migrations

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 31 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (4): Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 32 - "Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers)"
Cohesion: 0.28
Nodes (9): Electron Sandbox + window.kelid Preload Bridge, Desktop Driver (window.kelid.db IPC -> better-sqlite3-multiple-ciphers), Node Test Driver (nodeDriver.ts, SQLCipher in Node), openDriver() singleton driver selection, Recipe: Add an IPC Capability (desktop only), SqlDriver Interface (all, transaction, execScript), Testing Strategy (Vitest, real SQLCipher, wrong-key rejection), Web Worker Driver (sqlite.worker.ts on OPFS SAH pool) (+1 more)

## Knowledge Gaps
- **206 isolated node(s):** `Prefs`, `PrefsContext`, `router`, `DealFilter`, `View` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 262 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `database.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `react-router` connect `Today.tsx` to `ListingForm.tsx`, `web/package.json`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `vitest` connect `listingEdit.test.ts` to `package.json`, `seed.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `Prefs`, `PrefsContext`, `router` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.058428680396643784 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05389876880984952 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._