# Graph Report - p23  (2026-10-04)

## Corpus Check
- 71 files · ~28,396 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 6, .css 3, .example 1)

## Summary
- 692 nodes · 1514 edges · 33 communities (26 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee2a0b22`
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
- permissions
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- data.tsx
- core/package.json
- core/tsconfig.json
- Persian RTL UI (toFaDigits, toEnDigits, formatToman)
- photos.test.ts
- Rule: No Full Page Reloads (Link viewTransition)
- database.ts
- photoScenario
- setup.mjs
- devDependencies
- scripts
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- drivers.ts
- .prettierrc.json
- allowScripts
- @playwright/test
- engines

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
- `Start a Kelid task` --references--> `SqlStore`  [INFERRED]
  .claude/skills/kelid-task/SKILL.md → packages/core/src/sql/sqlStore.ts
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

## Communities (33 total, 7 thin omitted)

### Community 0 - "Today.tsx"
Cohesion: 0.06
Nodes (88): Prefs, PrefsContext, router, usePrefsContext(), useQuery(), useStorageInfo(), useStore(), ACTIONS (+80 more)

### Community 1 - "KelidStore"
Cohesion: 0.16
Nodes (3): Start a Kelid task, Listing, KelidStore

### Community 2 - "Kelid README"
Cohesion: 0.06
Nodes (42): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Desktop DB Key Protected by Windows DPAPI (safeStorage), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, Kelid Real-Estate Office SaaS (+34 more)

### Community 3 - "sqlStore.ts"
Cohesion: 0.07
Nodes (39): normalizeForSearch (Persian text normalization), Persian-normalized search column (LIKE now, FTS5 later), Client, ClientNeed, ClientTemperature, DealType, ListingStatus, Photo (+31 more)

### Community 4 - "web/package.json"
Cohesion: 0.05
Nodes (34): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+26 more)

### Community 5 - "package.json"
Cohesion: 0.14
Nodes (16): description, better-sqlite3-multiple-ciphers, name, private, version, workspaces, eslint, eslint-config-prettier (+8 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (45): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+37 more)

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

### Community 18 - "photos.test.ts"
Cohesion: 0.23
Nodes (5): nodeSqliteDriver(), dirs, dirs, sample, vitest

### Community 20 - "database.ts"
Cohesion: 0.18
Nodes (12): checkParams(), closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params (+4 more)

### Community 21 - "photoScenario"
Cohesion: 0.33
Nodes (3): deleteReorderUndo(), photo(), photoScenario()

### Community 22 - "setup.mjs"
Cohesion: 0.20
Nodes (3): hooks, major, root

### Community 25 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, better-sqlite3-multiple-ciphers, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react-hooks, globals, @playwright/test (+6 more)

### Community 28 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, dev:desktop, dist:win, e2e, format, format:check (+4 more)

### Community 35 - "drivers.ts"
Cohesion: 0.05
Nodes (38): Electron Sandbox + window.kelid Preload Bridge, useSlow(), DesktopBridge, desktopDriver(), execScript(), openDriver(), OpenedDriver, transaction() (+30 more)

### Community 36 - ".prettierrc.json"
Cohesion: 0.29
Nodes (6): endOfLine, printWidth, singleQuote, tabWidth, trailingComma, useTabs

### Community 37 - "allowScripts"
Cohesion: 0.50
Nodes (4): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2

## Knowledge Gaps
- **226 isolated node(s):** `$schema`, `allow`, `deny`, `printWidth`, `tabWidth` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 286 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `photos.test.ts` to `package.json`, `seed.ts`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `electron` connect `database.ts` to `desktop/package.json`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `SqlStore` connect `sqlStore.ts` to `KelidStore`, `photos.test.ts`, `drivers.ts`, `data.tsx`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **What connects `$schema`, `allow`, `deny` to the rest of the system?**
  _226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0561726436052047 - nodes in this community are weakly interconnected._
- **Should `Kelid README` be split into smaller, more focused modules?**
  _Cohesion score 0.057912457912457915 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07071455016660497 - nodes in this community are weakly interconnected._