# Graph Report - RealState  (2026-10-04)

## Corpus Check
- Corpus is ~20,644 words - fits in a single context window. You may not need a graph.

## Summary
- 537 nodes · 1033 edges · 23 communities (19 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.88)
- Token cost: 121,654 input · 0 output

## Community Hubs (Navigation)
- Web Pages & Data Hooks
- Domain Model, Search & Matching
- Team Rules & Workflow
- Storage Drivers & Store Wiring
- Web App Dependencies
- Root Workspace Config
- Desktop Dependencies
- Desktop DB, Main Process & Seed
- Installer Build Config
- Shared TS Compiler Settings
- MemoryStore Implementation
- UI Package Manifest
- Web TS Config
- Desktop TS Config
- Theme & Text-Size Prefs
- Core Package Manifest
- Core TS Config
- Persian RTL Design Language
- Web SQLite Worker
- Motion & No-Reload Navigation
- Electron Preload Bridge
- SQLCipher Type Shim

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 26 edges
2. `SqlStore` - 24 edges
3. `toFaDigits()` - 21 edges
4. `KelidStore` - 21 edges
5. `useQuery()` - 19 edges
6. `Listing` - 17 edges
7. `listingTitle()` - 16 edges
8. `normalizeForSearch()` - 15 edges
9. `compilerOptions` - 15 edges
10. `build` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5)` --references--> `matchListing()`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/match.ts
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `Desktop DB Key Protected by Windows DPAPI (safeStorage)` --references--> `loadKey()`  [EXTRACTED]
  AGENTS.md → apps/desktop/src/database.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]

## Communities (23 total, 4 thin omitted)

### Community 0 - "Web Pages & Data Hooks"
Cohesion: 0.07
Nodes (71): Prefs, PrefsContext, router, usePrefsContext(), cache, StorageInfo, StoreContext, stores (+63 more)

### Community 1 - "Domain Model, Search & Matching"
Cohesion: 0.06
Nodes (37): normalizeForSearch (Persian text normalization), Persian-normalized search column (LIKE now, FTS5 later), budgetOf(), matchListing(), MatchResult, Client, ClientNeed, ClientTemperature (+29 more)

### Community 2 - "Team Rules & Workflow"
Cohesion: 0.06
Nodes (54): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Rule: Append-Only Schema Migrations, Definition of Done (typecheck, test, visual check light/dark/375px), Desktop DB Key Protected by Windows DPAPI (safeStorage), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow (+46 more)

### Community 3 - "Storage Drivers & Store Wiring"
Cohesion: 0.07
Nodes (40): Rule: New Store Method in Both SqlStore and MemoryStore, Electron Sandbox + window.kelid Preload Bridge, Rule: No Spinners (useSlow + Skeleton after 120ms), Rule: UI Never Runs SQL (useQuery/useStore only), storeFor(), StoreProvider(), DesktopBridge, desktopDriver() (+32 more)

### Community 4 - "Web App Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+24 more)

### Community 5 - "Root Workspace Config"
Cohesion: 0.06
Nodes (32): allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers (+24 more)

### Community 6 - "Desktop Dependencies"
Cohesion: 0.07
Nodes (27): author, dependencies, better-sqlite3-multiple-ciphers, description, devDependencies, concurrently, cross-env, electron (+19 more)

### Community 7 - "Desktop DB, Main Process & Seed"
Cohesion: 0.10
Nodes (21): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), at(), daysAgo() (+13 more)

### Community 8 - "Installer Build Config"
Cohesion: 0.10
Nodes (21): build, appId, asarUnpack, directories, electronVersion, extraResources, files, nodeGypRebuild (+13 more)

### Community 9 - "Shared TS Compiler Settings"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, compilerOptions, isolatedModules, jsx, lib, module, moduleResolution (+10 more)

### Community 11 - "UI Package Manifest"
Cohesion: 0.12
Nodes (15): dependencies, @kelid/core, exports, ./kelid.css, ./motion.css, @kelid/core, react, main (+7 more)

### Community 12 - "Web TS Config"
Cohesion: 0.17
Nodes (11): compilerOptions, types, exclude, extends, include, src, ../../tsconfig.base.json, ../../packages/core/src/sql/nodeDriver.ts (+3 more)

### Community 13 - "Desktop TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, types, extends, include, ES2023, node, src (+2 more)

### Community 14 - "Theme & Text-Size Prefs"
Cohesion: 0.27
Nodes (8): App(), read(), systemDark(), TextSize, ThemePref, usePrefs(), write(), ZOOM

### Community 15 - "Core Package Manifest"
Cohesion: 0.22
Nodes (8): exports, ./node, main, name, private, type, types, version

### Community 16 - "Core TS Config"
Cohesion: 0.25
Nodes (7): compilerOptions, types, extends, include, node, src, ../../tsconfig.base.json

### Community 17 - "Persian RTL Design Language"
Cohesion: 0.29
Nodes (7): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom), Jalali Calendar via Intl (calendar: persian)

### Community 18 - "Web SQLite Worker"
Cohesion: 0.40
Nodes (3): Params, ready, Req

## Knowledge Gaps
- **177 isolated node(s):** `name`, `version`, `private`, `description`, `author` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `Domain Model, Search & Matching` to `Web Pages & Data Hooks`, `Storage Drivers & Store Wiring`, `Desktop DB, Main Process & Seed`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `MemoryStore` connect `MemoryStore Implementation` to `Web Pages & Data Hooks`, `Domain Model, Search & Matching`, `Storage Drivers & Store Wiring`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `Kelid README` connect `Team Rules & Workflow` to `Storage Drivers & Store Wiring`, `Desktop DB, Main Process & Seed`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web Pages & Data Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.07106124357176251 - nodes in this community are weakly interconnected._
- **Should `Domain Model, Search & Matching` be split into smaller, more focused modules?**
  _Cohesion score 0.06220095693779904 - nodes in this community are weakly interconnected._
- **Should `Team Rules & Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.05723905723905724 - nodes in this community are weakly interconnected._