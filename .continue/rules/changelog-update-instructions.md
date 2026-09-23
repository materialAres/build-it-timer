# Instructions — Updating the changelog

> Process document for AI agents. Describes **when** and **how** to update `.continue/rules/changelog.md` every time a task from `docs/roadmap-en.md` is completed.

## General rule (mandatory)

Every time you complete a roadmap task (Milestone 0–4), **before declaring the task done** you must update `.continue/rules/changelog.md`. The changelog is an integral part of a task's Definition of Done: a task without an entry in the changelog is to be considered not done.

This also applies to partial tasks: if you only complete part of a task, update the entry with the actual status (e.g. `partial`) and note what remains.

## Version control — the agent NEVER commits or pushes

- The agent **never runs** `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, `git reset`, or any other command that writes to the repository history, whether directly or via indirect tools/aliases/scripts.
- The agent may use git **read-only** (`git status`, `git log`, `git diff`, `git show`, `git rev-parse`) to gather information (e.g. the hash of an already-existing commit).
- All changes (code, tests, changelog) are left **uncommitted**: it is always the human developer who reviews and commits.
- As a result, the changelog's `Commit` column **cannot** be filled in by the agent at task time: the developer fills it in after committing. Until the commit exists, the agent writes `—` (or `to be committed`) and **never makes up a hash**.

## When to update

Update the changelog **immediately after** verifying the task's acceptance criteria, in the same context/work session in which you prepare the implementation (the changes remain **uncommitted**, see the "Version control" section):

- after the task's tests pass (`bun run test`);
- after the type-check is clean (`bun run compile`);
- after confirming the acceptance criteria listed in the task card.

Don't put off the update for "later": write the entry while you still remember exactly what you did, which files you touched, and which criteria you covered.

## How to update (step-by-step procedure)

1. **Read the current state** of `.continue/rules/changelog.md` and the task card in `docs/roadmap-en.md` (§2).
2. **Fill in/correct the "Commit" column**: if the developer has already committed the task, you may read the existing hash in read-only mode (`git log --oneline -1`, `git rev-parse --short HEAD`) and insert it. If the task hasn't been committed yet (the normal case, since the agent never commits: see "Version control"), write `—` / `to be committed` and do not make up any hash.
3. **Update the "Current status" section**:
   - move the "Updated to: **<task ID>**" marker;
   - update the milestone status (completed / in progress, with the list of tasks done and those remaining);
   - update the **test counts** (`bun run test` → N passing tests across M files) and the type-check status;
   - if you touched the number of test files or the total test count, the numbers must reflect reality: don't copy them from the past.
4. **Add a row to the "Completed tasks summary" table** with: `ID`, `Title` (from the roadmap), `Status`, `Commit`.
5. **Add the task's detail entry** in the correct milestone section, following the standard format (below).
6. **Update the "Dependencies added" table** if the task introduced new runtime or dev dependencies (with the exact version from `package.json`/`bun.lock`).
7. **Update "Open issues and points to clarify"**: add newly discovered issues; remove ones resolved by this task. If the task resolves an existing issue, move it out of the list and mention its resolution in the task's entry.
8. **Don't touch** sections unrelated to the task (avoid noise in the diff).

## Detail entry format (mandatory)

For each completed task, add a sub-section (`###`) in the milestone's group, using this schema:

```markdown
### <ID> — <Title from the roadmap>
- <What was implemented, in terms of concrete API/behavior, not mere intentions.>
- Files created/modified: `<path>` (with a brief description if not obvious from the name).
- Dependencies added: `<package>` `<version>` (reason) — or "none".
- Tests: `<test path>` (N tests, <unit|integration|component>) — cases covered, briefly.
- Relevant notes/decisions: (e.g. deferred open point, design choice, behavior for an edge case).
- Acceptance criteria: <verified / partial — explain what's missing>.
```

## Content rules

- **Write what was actually done**, verifiable from the code and the tests. Don't make up files, functions, tests, or commits that don't exist: if in doubt, check with `git show`/`git diff` and the real files.
- **No redundant detail**: don't paste entire files; describe the public API and the relevant behavior.
- **Precise references**: use the real file paths and the real commit hashes.
- **Truthful numbers**: test counts, dependency versions, and lint/type-check status must be the actual ones at the time of the update.
- **Respect the document's language**: the changelog is in **English**.
- **Style**: concise, bullet lists, tables where already present. Stay consistent with the existing formatting (don't reformat untouched sections).
- **One task = one entry**: don't merge multiple tasks into a single entry, and don't split one task across multiple entries.

## Distinction between "completed" and "nice-to-have"

- If the task is marked *(Nice to have)* in the roadmap, indicate this in the entry (e.g. `status: completed (nice-to-have)`).
- If the task was **skipped** or **deferred**, don't add it to the completed-tasks table: note the deferral (and the reason) in "Open issues and points to clarify" or in a status note.

## Final verification of the update

> Remember: the agent **never commits** (see "Version control"). This checklist should be run before concluding the task and leaving the changes ready for human review.

Before concluding the task, check that:

- [ ] exactly one detail entry exists for the task just completed;
- [ ] the summary table contains the task's row; the `Commit` column shows a real hash only if the commit already exists, otherwise `—` / `to be committed`;
- [ ] "Current status" and the counts (test / type-check) reflect reality;
- [ ] new dependencies are listed with the exact version;
- [ ] resolved issues have been removed and new ones added;
- [ ] no unrelated section has been altered.

If any of these points is not satisfied, the changelog update is incomplete.

## Minimal update example

For the completion of a hypothetical `M1.T4`:

1. table row: `| M1.T4 | Zustand store — skeleton + slice combination | completed | — (to be committed) |` (the real hash is added by the developer after the commit)
2. detail entry:

```markdown
### M1.T4 — Zustand store — skeleton + slice combination
- `store/index.ts` combines the slices (stubs) with the `persist` middleware, using `browserStorage` (M1.T3); `partialize` excludes volatile fields (fine-grained timer, UI state, temporary flags).
- Files created/modified: `store/index.ts`, `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`.
- Dependencies added: none.
- Tests: `tests/unit/store/store.test.ts` (N tests, unit+integration) — persisted field survives "restart"; volatile field resets to default.
- Notes: exports a single `useAppStore` hook + granular per-slice selectors.
- Acceptance criteria: verified.
```

3. update to "Current status" (test count, "Updated to: M1.T4" marker).
