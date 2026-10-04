# Graph Report - kelid  (2026-10-04)

## Corpus Check
- 67 files · ~26,349 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 659 nodes · 1356 edges · 36 communities (32 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea0c1129`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CommandPalette.tsx
- sqlStore.ts
- Kelid README
- drivers.ts
- dependencies
- package.json
- desktop/package.json
- KelidStore
- MemoryStore
- compilerOptions
- allow
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- data.tsx
- core/package.json
- core/tsconfig.json
- Add.tsx
- VisitDialog.tsx
- Rule: No Full Page Reloads (Link viewTransition)
- Files.tsx
- Clients.tsx
- Tech Stack Doc
- useQuery
- Today.tsx
- visits.test.ts
- SqlStore (SQL + outbox + emit)
- Server: Node.js 22 + Fastify
- Pull Request Checklist
- prefs.ts
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- نقشهٔ راه و تقسیم کار
- Recipe: Add a Page
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 34 edges
2. `SqlStore` - 32 edges
3. `KelidStore` - 29 edges
4. `useQuery()` - 22 edges
5. `Listing` - 16 edges
6. `Icon()` - 16 edges
7. `normalizeForSearch()` - 15 edges
8. `compilerOptions` - 15 edges
9. `FilesPage()` - 14 edges
10. `toFaDigits()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (36 total, 4 thin omitted)

### Community 0 - "CommandPalette.tsx"
Cohesion: 0.17
Nodes (14): ACTIONS, CommandPalette(), Item, activeIndex(), NAV, Shell(), storageLabel, CheckBox() (+6 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.09
Nodes (28): normalizeForSearch (Persian text normalization), OpenedDriver, Persian-normalized search column (LIKE now, FTS5 later), DealType, normalizeForSearch(), SqlDriver, migrate(), b() (+20 more)

### Community 2 - "Kelid README"
Cohesion: 0.25
Nodes (11): AGENTS.md Agent Rules, Graphify-First Exploration Workflow, Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook, Onboarding Guide (+3 more)

### Community 3 - "drivers.ts"
Cohesion: 0.11
Nodes (17): Electron Sandbox + window.kelid Preload Bridge, DesktopBridge, desktopDriver(), execScript(), openDriver(), transaction(), Window, workerDriver() (+9 more)

### Community 4 - "dependencies"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (31): allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers (+23 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (45): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+37 more)

### Community 7 - "KelidStore"
Cohesion: 0.06
Nodes (26): Start a Kelid task, bestMatches(), budgetOf(), matchListing(), MatchResult, Client, ClientNeed, ClientTemperature (+18 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+7 more)

### Community 10 - "allow"
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
Cohesion: 0.11
Nodes (16): App(), Prefs, PrefsContext, router, cache, StorageInfo, StoreContext, storeFor() (+8 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Add.tsx"
Cohesion: 0.11
Nodes (23): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), AddPage(), AmountField(), FEATURES, parseAmount() (+15 more)

### Community 18 - "VisitDialog.tsx"
Cohesion: 0.11
Nodes (9): JalaliPicker(), autoTitle(), DURATIONS, HOURS, KINDS, MINUTES, nextHour(), VisitDialog() (+1 more)

### Community 20 - "Files.tsx"
Cohesion: 0.24
Nodes (5): DealFilter, statusLabel, View, dealLabel, react-router

### Community 21 - "Clients.tsx"
Cohesion: 0.19
Nodes (7): useSlow(), PageSkeleton(), ClientsPage(), initial(), Kind, needSummary(), Skeleton()

### Community 22 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 23 - "useQuery"
Cohesion: 0.32
Nodes (10): usePrefsContext(), useQuery(), useStorageInfo(), useStore(), useToast(), FileDetailPage(), SettingsPage(), whereText (+2 more)

### Community 24 - "Today.tsx"
Cohesion: 0.24
Nodes (5): ACTION_ICON, AgendaRow(), greeting(), Stat(), TodayPage()

### Community 25 - "visits.test.ts"
Cohesion: 0.06
Nodes (36): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, Node Test Driver (nodeDriver.ts, SQLCipher in Node) (+28 more)

### Community 26 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.29
Nodes (9): Data Flow: Page -> KelidStore -> SqlDriver -> DB, Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), KelidStore (store contract), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), MemoryStore (tests and fallback), Recipe: Add a Field to Listing, Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript) (+1 more)

### Community 27 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 28 - "Pull Request Checklist"
Cohesion: 0.32
Nodes (7): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Schema Migrations (migrations[], PRAGMA user_version), Team Workflow (branch, typecheck/test, PR, CI green), migrations

### Community 29 - "prefs.ts"
Cohesion: 0.36
Nodes (7): read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM

### Community 30 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (4): Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 31 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 32 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (4): Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

### Community 35 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

## Knowledge Gaps
- **212 isolated node(s):** `Kind`, `ACTION_ICON`, `KINDS`, `DURATIONS`, `HOURS` (+207 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 276 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `visits.test.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `visits.test.ts`, `SqlStore (SQL + outbox + emit)`, `data.tsx`, `KelidStore`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `react-router` connect `Files.tsx` to `CommandPalette.tsx`, `dependencies`, `data.tsx`, `Add.tsx`, `Clients.tsx`, `Today.tsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `Kind`, `ACTION_ICON`, `KINDS` to the rest of the system?**
  _212 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0929281122150789 - nodes in this community are weakly interconnected._
- **Should `drivers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._