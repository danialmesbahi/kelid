---
name: kelid-sync
description: Bring the latest main into the current Kelid branch and resolve merge conflicts safely (migrations, package-lock, graphify outputs). Use when the user says "update from main", "sync", "pull the teammate's changes", or when a PR shows conflicts.
---

# Sync a Kelid branch with main

1. Commit or stash local work first. `git fetch origin`.
2. On `main`: `git pull --ff-only`. On a feature branch: `git merge origin/main` (don't rebase a branch someone else has pulled).
3. **Conflict rules**
   - `graphify-out/*` → take main's version (`git checkout --theirs graphify-out/`), finish the merge, then `graphify update .` and commit the refreshed graph. Never hand-merge `graph.json`.
   - `package-lock.json` → take main's version, then `npm install` to re-add this branch's packages, and commit the result.
   - `packages/core/src/sql/schema.ts` → both sides appended migrations: keep **main's migrations first, unchanged and in order**, then this branch's after them. Never edit or renumber a migration that is already on main. Run `npm test`.
   - `AGENTS.md` / docs → keep both sides' rules; remove duplicates.
   - Code → resolve by intent (read both sides' commits: `git log --oneline origin/main -10`), never by deleting the other side's work.
4. After merging: if `package-lock.json` changed run `npm install`; then `npm run typecheck` and `npm test` must pass before pushing.
5. Summarise for the user what came in from main (`git log --oneline HEAD@{1}..HEAD`) and how each conflict was resolved.
