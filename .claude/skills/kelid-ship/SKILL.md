---
name: kelid-ship
description: Finish a Kelid task — sync with main, verify, update docs, push the branch and open a pull request that closes the issue. Use when the user says "ship it", "open a PR", "I'm done", "push this", or similar.
---

# Ship a Kelid task

1. **Not on main.** If the current branch is `main`, stop: create a branch first (`/kelid-task`). Never push to `main`.
2. **Bring in main:** `git fetch origin` then `git merge origin/main` (conflict rules: `/kelid-sync`).
3. **Verify — all must pass:**
   - `npm run typecheck`
   - `npm test`
   - UI changes: run the app (`npm run dev`, preview config `kelid-web`) and check the changed screens in light + dark, at 375px if used on phones, keyboard only, no console errors.
   - Check the issue's **Acceptance** list item by item; report any item not met instead of hiding it.
4. **Docs.** If a rule, structure or recipe changed, update `AGENTS.md` / `docs/ARCHITECTURE.md`. If a roadmap item is finished, update the status line in `AGENTS.md`.
5. **Commit.** English, imperative, prefixed (`feat:`, `fix:`, `chore:`, `docs:`). Stage files by name — never `.env`, DB or key files. `graphify-out/` changes from the post-commit hook may be included.
6. **Push + PR.**
   - `git push -u origin HEAD`
   - `gh pr create --title "<same as commit summary>" --body-file -` with the body following `.github/pull_request_template.md`, the checklist ticked honestly, and `Closes #N`.
7. **Report** the PR URL. Ask the teammate to review. Merge only after CI is green and a person approves: `gh pr merge --squash --delete-branch`. After merging, everyone runs `git switch main && git pull`.
