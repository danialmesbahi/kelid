# Graph Report - p25  (2026-10-04)

## Corpus Check
- 65 files · ~26,134 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 3, .example 1)

## Summary
- 633 nodes · 1407 edges · 36 communities (32 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3a2447c4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Files.tsx
- sqlStore.ts
- Kelid README
- App.tsx
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
- Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)
- SqlStore (SQL + outbox + emit)
- Rule: No Full Page Reloads (Link viewTransition)
- clients.test.ts
- Tech Stack Doc
- ClientForm.tsx
- CommandPalette.tsx
- Server: Node.js 22 + Fastify
- Clients.tsx
- Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)
- Add.tsx
- Today.tsx
- نقشهٔ راه و تقسیم کار
- useQuery
- Pull Request Checklist
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- Recipe: Add a Page

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 31 edges
2. `SqlStore` - 29 edges
3. `toFaDigits()` - 26 edges
4. `KelidStore` - 26 edges
5. `Icon()` - 25 edges
6. `useQuery()` - 23 edges
7. `ClientsPage()` - 18 edges
8. `TodayPage()` - 18 edges
9. `Listing` - 17 edges
10. `ClientForm()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (36 total, 4 thin omitted)

### Community 0 - "Files.tsx"
Cohesion: 0.24
Nodes (13): FileDetailPage(), DealFilter, FilesPage(), statusLabel, View, ShowPage(), dealLabel, floorLabel() (+5 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.06
Nodes (41): normalizeForSearch (Persian text normalization), Start a Kelid task, Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult, Client, ClientNeed (+33 more)

### Community 2 - "Kelid README"
Cohesion: 0.25
Nodes (11): AGENTS.md Agent Rules, Graphify-First Exploration Workflow, Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, graphify Post-Commit Hook, Onboarding Guide (+3 more)

### Community 3 - "App.tsx"
Cohesion: 0.18
Nodes (14): App(), Prefs, PrefsContext, router, ToastProvider(), SoonPage(), read(), systemDark() (+6 more)

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers, @types/better-sqlite3 (+22 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (45): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+37 more)

### Community 7 - "seed.ts"
Cohesion: 0.13
Nodes (9): at(), daysAgo(), L, listing(), seedClients, seedListings, seedTodos, seedVisits (+1 more)

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
Nodes (30): Electron Sandbox + window.kelid Preload Bridge, cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, DesktopBridge (+22 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)"
Cohesion: 0.40
Nodes (5): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom)

### Community 18 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.29
Nodes (9): Data Flow: Page -> KelidStore -> SqlDriver -> DB, Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), KelidStore (store contract), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), MemoryStore (tests and fallback), Recipe: Add a Field to Listing, Recipe: Add a Store Method, SqlDriver Interface (all, transaction, execScript) (+1 more)

### Community 20 - "clients.test.ts"
Cohesion: 0.08
Nodes (19): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, Node Test Driver (nodeDriver.ts, SQLCipher in Node) (+11 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "ClientForm.tsx"
Cohesion: 0.14
Nodes (23): Persian RTL UI (toFaDigits, toEnDigits, formatToman), AmountField(), amountText(), ClientForm(), FormState, grid(), KINDS, NewClientPage() (+15 more)

### Community 23 - "CommandPalette.tsx"
Cohesion: 0.18
Nodes (12): ACTIONS, CommandPalette(), Item, activeIndex(), NAV, Shell(), storageLabel, dealClass (+4 more)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 25 - "Clients.tsx"
Cohesion: 0.19
Nodes (9): useSlow(), PageSkeleton(), budgetText(), ClientsPage(), initial(), Kind, bestMatches(), describeMatch() (+1 more)

### Community 26 - "Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)"
Cohesion: 0.38
Nodes (4): Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque), Custom Sync Protocol (UUIDv7, outbox, cursor pull, soft delete)

### Community 27 - "Add.tsx"
Cohesion: 0.20
Nodes (8): Notify, Toast, ToastContext, AddPage(), AmountField(), FEATURES, parseAmount(), formatPlaque()

### Community 28 - "Today.tsx"
Cohesion: 0.21
Nodes (8): ACTION_ICON, AgendaRow(), greeting(), Stat(), TodayPage(), formatLongDate(), formatTime(), CheckBox()

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.33
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 30 - "useQuery"
Cohesion: 0.30
Nodes (10): usePrefsContext(), useQuery(), useStorageInfo(), useStore(), useToast(), EditClientPage(), SettingsPage(), whereText (+2 more)

### Community 31 - "Pull Request Checklist"
Cohesion: 0.32
Nodes (7): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Schema Migrations (migrations[], PRAGMA user_version), Team Workflow (branch, typecheck/test, PR, CI green), migrations

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

### Community 35 - "Recipe: Add a Page"
Cohesion: 0.40
Nodes (4): Recipe: Add a Page, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation), Keyboard Shortcuts (Ctrl+K, Ctrl+N, Show mode arrows/Esc)

## Knowledge Gaps
- **204 isolated node(s):** `$schema`, `allow`, `deny`, `name`, `version` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 258 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `clients.test.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `react-router` connect `App.tsx` to `Files.tsx`, `web/package.json`, `ClientForm.tsx`, `CommandPalette.tsx`, `Clients.tsx`, `Add.tsx`, `Today.tsx`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `SqlStore (SQL + outbox + emit)`, `clients.test.ts`, `data.tsx`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05747126436781609 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._