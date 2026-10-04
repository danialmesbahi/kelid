# Graph Report - p23  (2026-10-04)

## Corpus Check
- 67 files · ~27,756 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .css 3, .example 1)

## Summary
- 662 nodes · 1481 edges · 30 communities (25 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a9dddc6d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- sqlStore.ts
- Kelid README
- photos.ts
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
- KelidStore (store contract)
- Rule: No Full Page Reloads (Link viewTransition)
- KelidStore
- Tech Stack Doc
- Pull Request Checklist
- Server: Node.js 22 + Fastify
- SqlStore (SQL + outbox + emit)
- نقشهٔ راه و تقسیم کار
- Desktop Storage: SQLCipher DB in %APPDATA%\Kelid
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 38 edges
2. `SqlStore` - 33 edges
3. `KelidStore` - 31 edges
4. `Icon()` - 28 edges
5. `toFaDigits()` - 27 edges
6. `useQuery()` - 24 edges
7. `TodayPage()` - 20 edges
8. `ClientsPage()` - 18 edges
9. `Listing` - 18 edges
10. `useStore()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts
- `Schema Migrations (migrations[], PRAGMA user_version)` --references--> `migrations`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/sql/schema.ts
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (30 total, 5 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.07
Nodes (68): Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useStorageInfo(), ACTIONS, CommandPalette() (+60 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.05
Nodes (51): normalizeForSearch (Persian text normalization), DesktopBridge, OpenedDriver, Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult, Client (+43 more)

### Community 2 - "Kelid README"
Cohesion: 0.20
Nodes (15): AGENTS.md Agent Rules, Graphify-First Exploration Workflow, Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts), npm Workspaces Monorepo (apps/web, apps/desktop, packages/core, packages/ui), Claude Code Specifics (Persian replies, graph-first, kelid-web launch config), Architecture Doc, Hash Router Routes (Today, Files, FileDetail, Clients, Settings, Add, Show), Show Page (full-screen customer presentation) (+7 more)

### Community 3 - "photos.ts"
Cohesion: 0.15
Nodes (22): useStore(), FullPhotoLayer(), hasFiles(), Lightbox(), PhotoGallery(), PhotoGrid(), PhotoManager(), thumbSrc() (+14 more)

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
Cohesion: 0.07
Nodes (30): Electron Sandbox + window.kelid Preload Bridge, App(), cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores (+22 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 17 - "Persian RTL UI (toFaDigits, toEnDigits, formatToman)"
Cohesion: 0.29
Nodes (7): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom), Jalali Calendar via Intl (calendar: persian)

### Community 18 - "KelidStore (store contract)"
Cohesion: 0.27
Nodes (7): useSlow(), Data Flow: Page -> KelidStore -> SqlDriver -> DB, KelidStore (store contract), MemoryStore (tests and fallback), Recipe: Add a Page, Recipe: Add a Store Method, useQuery / useStore hooks

### Community 20 - "KelidStore"
Cohesion: 0.05
Nodes (25): checkParams(), closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params (+17 more)

### Community 21 - "Tech Stack Doc"
Cohesion: 0.21
Nodes (8): Kelid Real-Estate Office SaaS, Electron Desktop (electron-builder NSIS, electron-updater), External Services (Zarinpal, Kavenegar, MapLibre), Owner Decisions (eNamad, code signing, providers, pricing), Phase Roadmap (0-5), PWA via vite-plugin-pwa (Capacitor later), Tech Stack Doc, Project Status (Phase 0 done, Phase 1 in progress)

### Community 22 - "Pull Request Checklist"
Cohesion: 0.47
Nodes (5): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Team Workflow (branch, typecheck/test, PR, CI green)

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.22
Nodes (8): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token, Vazirmatn Font Bundled In-App

### Community 26 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.23
Nodes (9): Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Outbox Sync Log (seq, entity, entity_id, op, payload, created_at), Recipe: Add a Field to Listing, Schema Migrations (migrations[], PRAGMA user_version), SqlStore (SQL + outbox + emit), Per-Field Last-Writer-Wins with Hybrid Logical Clock, Server-Assigned Plaque Numbers (temporary offline plaque) (+1 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

### Community 32 - "Desktop Storage: SQLCipher DB in %APPDATA%\Kelid"
Cohesion: 0.67
Nodes (4): Desktop DB Key Protected by Windows DPAPI (safeStorage), Local App Data Locations (kelid.db, kelid.key, browser storage), Argon2id password lock on the DB key (planned, phase 3), Desktop Storage: SQLCipher DB in %APPDATA%\Kelid

## Knowledge Gaps
- **206 isolated node(s):** `$schema`, `allow`, `deny`, `name`, `version` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 264 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `KelidStore` to `desktop/package.json`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `SqlStore (SQL + outbox + emit)`, `KelidStore`, `data.tsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `react-router` connect `Today.tsx` to `web/package.json`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06716182048040455 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05193319606497369 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._