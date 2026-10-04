# Graph Report - kelid  (2026-10-04)

## Corpus Check
- 65 files · ~33,004 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 621 nodes · 1205 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `269b58a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Today.tsx
- KelidStore
- Kelid README
- sqlStore.ts
- web/package.json
- package.json
- desktop/package.json
- seed.ts
- MemoryStore
- compilerOptions
- allow
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- data.tsx
- core/package.json
- core/tsconfig.json
- Client
- model.ts
- Rule: No Full Page Reloads (Link viewTransition)
- build
- Add.tsx
- SqlStore (SQL + outbox + emit)
- sqlStore.test.ts
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 27 edges
2. `SqlStore` - 25 edges
3. `KelidStore` - 22 edges
4. `useQuery()` - 20 edges
5. `TodayPage()` - 18 edges
6. `react` - 16 edges
7. `Listing` - 16 edges
8. `FileDetailPage()` - 15 edges
9. `Icon()` - 15 edges
10. `normalizeForSearch()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts
- `Start a Kelid task` --references--> `useQuery()`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → apps/web/src/data.tsx
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (26 total, 5 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.06
Nodes (49): App(), Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useSlow(), useStorageInfo() (+41 more)

### Community 1 - "KelidStore"
Cohesion: 0.16
Nodes (3): Start a Kelid task, Listing, KelidStore

### Community 2 - "Kelid README"
Cohesion: 0.06
Nodes (43): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Desktop DB Key Protected by Windows DPAPI (safeStorage), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, Kelid Real-Estate Office SaaS (+35 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.09
Nodes (23): DesktopBridge, Visit, better-sqlite3-multiple-ciphers, SqlDriver, SqlParams, SqlStatement, SqlValue, migrate() (+15 more)

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (35): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+27 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (31): allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers (+23 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.07
Nodes (26): author, dependencies, better-sqlite3-multiple-ciphers, description, devDependencies, concurrently, cross-env, electron (+18 more)

### Community 7 - "seed.ts"
Cohesion: 0.24
Nodes (9): at(), daysAgo(), L, listing(), seedClients, seedListings, seedTodos, seedVisits (+1 more)

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
Cohesion: 0.09
Nodes (22): Electron Sandbox + window.kelid Preload Bridge, cache, StorageInfo, StoreContext, storeFor(), StoreProvider(), stores, desktopDriver() (+14 more)

### Community 15 - "core/package.json"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "core/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.base.json

### Community 18 - "model.ts"
Cohesion: 0.19
Nodes (10): bestMatches(), budgetOf(), matchListing(), MatchResult, ClientNeed, ClientTemperature, ListingStatus, Price (+2 more)

### Community 20 - "build"
Cohesion: 0.08
Nodes (25): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+17 more)

### Community 22 - "Add.tsx"
Cohesion: 0.07
Nodes (47): normalizeForSearch (Persian text normalization), Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), ACTIONS, CommandPalette(), Item (+39 more)

### Community 24 - "SqlStore (SQL + outbox + emit)"
Cohesion: 0.13
Nodes (18): Data Flow: Page -> KelidStore -> SqlDriver -> DB, Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), KelidStore (store contract), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), MemoryStore (tests and fallback), Recipe: Add a Field to Listing, Recipe: Add a Store Method, Schema Migrations (migrations[], PRAGMA user_version) (+10 more)

### Community 25 - "sqlStore.test.ts"
Cohesion: 0.06
Nodes (28): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, Node Test Driver (nodeDriver.ts, SQLCipher in Node) (+20 more)

## Knowledge Gaps
- **215 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+210 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 271 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `electron` connect `sqlStore.test.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `KelidStore`, `data.tsx`, `Add.tsx`, `SqlStore (SQL + outbox + emit)`, `sqlStore.test.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `vitest` connect `sqlStore.test.ts` to `package.json`, `Add.tsx`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _215 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.057738572574178026 - nodes in this community are weakly interconnected._
- **Should `Kelid README` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09254901960784313 - nodes in this community are weakly interconnected._