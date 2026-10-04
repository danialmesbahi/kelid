# Graph Report - kelid  (2026-10-04)

## Corpus Check
- 67 files · ~27,138 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 690 nodes · 1283 edges · 29 communities (22 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da864049`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- data.tsx
- SqlStore
- AGENTS.md Agent Rules
- photos.test.ts
- dependencies
- package.json
- build
- sqlStore.ts
- MemoryStore
- compilerOptions
- allow
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- prefs.ts
- core/package.json
- core/tsconfig.json
- components.tsx
- sqlite.worker.ts
- Rule: No Full Page Reloads (Link viewTransition)
- better-sqlite3-mc.d.ts
- setup.mjs
- drivers.ts
- نقشهٔ راه و تقسیم کار
- kelid-ship/SKILL.md
- kelid-sync/SKILL.md
- kelid-task/SKILL.md

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 37 edges
2. `SqlStore` - 33 edges
3. `KelidStore` - 29 edges
4. `useQuery()` - 23 edges
5. `allow` - 20 edges
6. `useStore()` - 17 edges
7. `Listing` - 15 edges
8. `normalizeForSearch()` - 15 edges
9. `compilerOptions` - 15 edges
10. `useToast()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `SqlStore (SQL + outbox + emit)` --references--> `SqlStore`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/sql/sqlStore.ts
- `KelidStore (store contract)` --references--> `KelidStore`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/store.ts
- `MemoryStore (tests and fallback)` --references--> `MemoryStore`  [EXTRACTED]
  docs/ARCHITECTURE.md → packages/core/src/store.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **KelidStore over pluggable SqlDriver implementations** — docs_architecture_kelidstore, docs_architecture_sqlstore, docs_architecture_memorystore, docs_architecture_sqldriver, docs_architecture_desktop_ipc_driver, docs_architecture_web_worker_driver, docs_architecture_node_test_driver [EXTRACTED 1.00]
- **Merge quality gates (DoD, CI, PR checklist, team workflow)** — agents_definition_of_done, _github_workflows_ci_check_job, _github_pull_request_template_pr_checklist, docs_onboarding_team_workflow, agents_git_workflow [INFERRED 0.85]
- **Offline-first write path feeding future sync** — agents_outbox_mutation_rule, docs_architecture_outbox, agents_soft_delete, docs_tech_stack_sync_protocol, docs_tech_stack_hlc_lww, docs_tech_stack_local_first [INFERRED 0.85]

## Communities (29 total, 7 thin omitted)

### Community 0 - "data.tsx"
Cohesion: 0.05
Nodes (59): Prefs, PrefsContext, router, usePrefsContext(), cache, StorageInfo, StoreContext, stores (+51 more)

### Community 1 - "SqlStore"
Cohesion: 0.14
Nodes (11): Todo, blob(), listingValues(), nowIso(), outbox(), photoCount(), rowToClient(), rowToPhoto() (+3 more)

### Community 2 - "AGENTS.md Agent Rules"
Cohesion: 0.05
Nodes (51): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Desktop DB Key Protected by Windows DPAPI (safeStorage), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, Kelid Real-Estate Office SaaS (+43 more)

### Community 3 - "photos.test.ts"
Cohesion: 0.07
Nodes (24): closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry(), Params, at() (+16 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+24 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (33): better-sqlite3-multiple-ciphers, allowScripts, electron@38.8.6, electron-winstaller@5.4.0, esbuild@0.25.12, esbuild@0.28.2, description, devDependencies (+25 more)

### Community 6 - "build"
Cohesion: 0.04
Nodes (48): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+40 more)

### Community 7 - "sqlStore.ts"
Cohesion: 0.06
Nodes (55): normalizeForSearch (Persian text normalization), Persian RTL UI (toFaDigits, toEnDigits, formatToman), ACTIONS, CommandPalette(), Item, AddPage(), AmountField(), FEATURES (+47 more)

### Community 8 - "MemoryStore"
Cohesion: 0.06
Nodes (6): Client, Listing, Visit, photoScenario(), KelidStore, MemoryStore

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

### Community 17 - "components.tsx"
Cohesion: 0.10
Nodes (20): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), useStorageInfo(), activeIndex(), NAV, Shell(), storageLabel (+12 more)

### Community 18 - "sqlite.worker.ts"
Cohesion: 0.33
Nodes (3): Params, ready, Req

### Community 25 - "setup.mjs"
Cohesion: 0.22
Nodes (3): hooks, major, root

### Community 26 - "drivers.ts"
Cohesion: 0.11
Nodes (21): Electron Sandbox + window.kelid Preload Bridge, storeFor(), StoreProvider(), DesktopBridge, desktopDriver(), execScript(), openDriver(), OpenedDriver (+13 more)

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

## Knowledge Gaps
- **220 isolated node(s):** `Kind`, `DealFilter`, `View`, `statusLabel`, `ACTION_ICON` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 279 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `SqlStore` to `data.tsx`, `AGENTS.md Agent Rules`, `photos.test.ts`, `sqlStore.ts`, `MemoryStore`, `drivers.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `MemoryStore` connect `MemoryStore` to `data.tsx`, `SqlStore`, `AGENTS.md Agent Rules`, `photos.test.ts`, `sqlStore.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `KelidStore` connect `MemoryStore` to `data.tsx`, `SqlStore`, `AGENTS.md Agent Rules`, `photos.test.ts`, `sqlStore.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `Kind`, `DealFilter`, `View` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054705003734129946 - nodes in this community are weakly interconnected._
- **Should `SqlStore` be split into smaller, more focused modules?**
  _Cohesion score 0.13663663663663664 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md Agent Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.050595238095238096 - nodes in this community are weakly interconnected._