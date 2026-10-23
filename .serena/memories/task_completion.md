# Task completion

Definition of done for any roadmap task (repo root):

1. `bun run test` — full Vitest suite green (record `N passing across M files`).
2. `bun run compile` — `tsc --noEmit` clean.
3. `bun run lint` — ESLint clean.
4. `bun run build` **and** `bun run build:firefox` — both MV3 targets must build (background form differs).
5. `bun run e2e` when the change touches popup/background/blocking behavior covered by the Playwright suite.
6. Update `docs/changelog.md` before declaring done: `### <ID> — <title>` entry in the right milestone section, summary-table row, "Updated to" marker and real test counts. Include files touched, dependencies, tests, decisions, acceptance status; leave the commit column as `—` (the agent never commits).
7. Update the changelog's "Open issues" list when the task resolves or introduces one.
8. Leave all changes uncommitted; never run git write commands.

Also: verify the acceptance criteria in the task card of `docs/roadmap-en.md`; for critical logic (timer/alarms, URL parsing, DNR, score/malus, palette determinism) re-run the dependent suites as a regression check.