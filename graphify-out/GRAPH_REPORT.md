# Graph Report - kelid  (2026-10-04)

## Corpus Check
- 63 files · ~22,992 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 585 nodes · 1075 edges · 29 communities (21 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd0769eb`
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
- MemoryStore
- compilerOptions
- allow
- ui/package.json
- web/tsconfig.json
- desktop/tsconfig.json
- prefs.ts
- core/package.json
- core/tsconfig.json
- Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)
- sqlite.worker.ts
- Rule: No Full Page Reloads (Link viewTransition)
- preload.ts
- better-sqlite3-mc.d.ts
- Server: Node.js 22 + Fastify
- setup.mjs
- نقشهٔ راه و تقسیم کار
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
- `Local App Data Locations (kelid.db, kelid.key, browser storage)` --semantically_similar_to--> `Desktop Storage: SQLCipher DB in %APPDATA%\Kelid`  [INFERRED] [semantically similar]
  docs/ONBOARDING.md → README.md
- `Undo via Toast instead of Confirm Dialogs` --references--> `useToast()`  [EXTRACTED]
  AGENTS.md → apps/web/src/layout/Toasts.tsx
- `Plaque Color Code (green sale, mustard rent, blue full mortgage)` --references--> `Plaque()`  [EXTRACTED]
  AGENTS.md → packages/ui/src/components.tsx
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

## Communities (29 total, 8 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.07
Nodes (71): Persian RTL UI (toFaDigits, toEnDigits, formatToman), Prefs, PrefsContext, router, usePrefsContext(), cache, StorageInfo, StoreContext (+63 more)

### Community 1 - "sqlStore.ts"
Cohesion: 0.06
Nodes (37): normalizeForSearch (Persian text normalization), ACTIONS, CommandPalette(), Item, Persian-normalized search column (LIKE now, FTS5 later), Client, ClientNeed, ClientTemperature (+29 more)

### Community 2 - "AGENTS.md Agent Rules"
Cohesion: 0.07
Nodes (34): Pull Request Checklist, CI check Job (windows-latest: npm ci, typecheck, test, web build), AGENTS.md Agent Rules, Definition of Done (typecheck, test, visual check light/dark/375px), Git Workflow (feat/fix/docs branches, green CI before merge), Graphify-First Exploration Workflow, Kelid Real-Estate Office SaaS, Known Gotchas (OPFS single tab, single-instance lock, npmRebuild false, Vite/Vitest major, Intl formatToParts) (+26 more)

### Community 3 - "drivers.ts"
Cohesion: 0.06
Nodes (47): Desktop DB Key Protected by Windows DPAPI (safeStorage), Electron Sandbox + window.kelid Preload Bridge, closeDatabase(), loadKey(), openDatabase(), Params, createWindow(), webEntry() (+39 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @kelid/core, @kelid/ui, react, react-dom, react-router, @sqlite.org/sqlite-wasm, vazirmatn (+24 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (30): allowScripts, electron@44.5.1, electron-winstaller@5.4.0, esbuild@0.28.2, description, devDependencies, better-sqlite3-multiple-ciphers, @types/better-sqlite3 (+22 more)

### Community 6 - "desktop/package.json"
Cohesion: 0.04
Nodes (46): author, build, appId, asarUnpack, directories, electronVersion, extraResources, files (+38 more)

### Community 7 - "seed.ts"
Cohesion: 0.14
Nodes (15): Domain Model (Listing, Client, ClientNeed, Visit, Todo, DealType), matchListing Scoring (budget 35, neighborhood 30, area 20, bedrooms 10, kind 5), Recipe: Add a Field to Listing, budgetOf(), matchListing(), MatchResult, at(), daysAgo() (+7 more)

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

### Community 17 - "Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize)"
Cohesion: 0.40
Nodes (5): Plaque Color Code (green sale, mustard rent, blue full mortgage), Web index.html (rtl, fa, #root, main.tsx entry), Pre-Paint Theme/Zoom Script (kelid.theme, kelid.textSize), Design Tokens (kelid.css), Prefs (theme, text size -> --zoom)

### Community 18 - "sqlite.worker.ts"
Cohesion: 0.40
Nodes (3): Params, ready, Req

### Community 24 - "Server: Node.js 22 + Fastify"
Cohesion: 0.29
Nodes (7): Seller Admin Panel (apps/admin), Drizzle ORM (candidate for the server, phase 2), Ed25519 Signed Subscription License with Offline Grace, Server: Node.js 22 + Fastify, Iranian Cloud Hosting (Liara, ArvanCloud, ParsPack), PostgreSQL 16 with Row-Level Security per Office, Phone + SMS Code Login with JWT and Per-Device Refresh Token

### Community 25 - "setup.mjs"
Cohesion: 0.22
Nodes (3): hooks, major, root

### Community 29 - "نقشهٔ راه و تقسیم کار"
Cohesion: 0.29
Nodes (6): تقسیم کار پیشنهادی برای دو نفر هم‌زمان, روند هر کار, طراحی, فاز ۱ — کارهای باز, فازها, نقشهٔ راه و تقسیم کار

## Knowledge Gaps
- **225 isolated node(s):** `name`, `version`, `private`, `description`, `author` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 261 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SqlStore` connect `sqlStore.ts` to `App.tsx`, `drivers.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `MemoryStore` connect `MemoryStore` to `App.tsx`, `sqlStore.ts`, `drivers.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `Kelid README` connect `AGENTS.md Agent Rules` to `drivers.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0681766186227408 - nodes in this community are weakly interconnected._
- **Should `sqlStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061754385964912284 - nodes in this community are weakly interconnected._
- **Should `AGENTS.md Agent Rules` be split into smaller, more focused modules?**
  _Cohesion score 0.06938020351526364 - nodes in this community are weakly interconnected._