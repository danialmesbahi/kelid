---
name: kelid-task
description: Start work on a Kelid GitHub issue — pick or claim the issue, branch from fresh main, load only the context it needs. Use when the user says "start a task", "next task", "work on #N", "what should I do next", or similar.
---

# Start a Kelid task

Repo: `danialmesbahi/kelid`. Issues + milestones are the single source of truth for who does what.

1. **Clean start.** `git status` must be clean (otherwise ask). Then `git switch main` and `git pull --ff-only`. If `package-lock.json` changed, run `npm install`.
2. **Pick the issue.**
   - Number given → `gh issue view N`.
   - Otherwise list unclaimed work in the earliest open phase:
     `gh issue list --milestone "Phase 1 — Offline single device" --search "no:assignee" --json number,title,labels`
     (move to the next phase only when Phase 1 has nothing unclaimed). Show the top 3, `priority: high` first, and let the user choose.
   - Never start an issue assigned to someone else; never start `needs-owner` issues unless the user is the owner.
3. **Claim it** so the teammate sees it: `gh issue edit N --add-assignee @me` and comment `Started on branch <branch>`.
4. **Branch.** `git switch -c <type>/<N>-<short-slug>` where type is `feat`, `fix` or `chore` (e.g. `feat/2-edit-listing`).
5. **Load context cheaply.**
   - `graphify query "<the issue goal in one sentence>" --budget 1500` (fall back to `graphify-out/GRAPH_REPORT.md`).
   - Read only the files under the issue's **Pointers** plus what the query returned. Follow the matching recipe in `docs/ARCHITECTURE.md`.
   - Before editing a hub (`KelidStore`, `SqlStore`, `useQuery`, `schema.ts`): `graphify affected "<name>"`.
6. **Plan.** Turn the issue's **Acceptance** list into a short checklist and share it. Ask only if scope is genuinely unclear.
7. Work in small commits. When done, use `/kelid-ship`. If `main` moved meanwhile, use `/kelid-sync`.
