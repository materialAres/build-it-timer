# PR #7 — Review report and fix plan

> PR: `feat(city): seeded 3D city with malus, signs and fixes` (`feat/ui-review` → `main`)
> Review: comment-only review by `materialAres`, submitted 2026-11-18 on commit `10501b5`.
> Written: 2026-11-21. Source of truth for the findings is the review comment; each finding below was re-checked against the code at `10501b5`.

> **Dead-code document: stashed (decision 2026-11-21).** `docs/refactor/dead-code-candidates.md` (entries DC1 and DC2) is not part of this PR and is not in the working tree: it was put aside with `git stash`. It will be restored later, in a dedicated branch, after this PR is closed and the remaining project tasks are concluded. Every mention of DC1/DC2 below refers to that stashed document. Until then, the two items live only in this review doc (see "D5 verification" and D8).

## 1. Review summary

**Verdict:** comment only, no blockers. `bun run compile`, `bun run lint` and `bun run test` (1471 tests, 121 files) pass at `10501b5`.

Not covered by the review: `bun run e2e`, `bun run build` and a visual check of the 3D view in a browser.

Two things must be fixed before merge: the PR scope/title, and the stale changelog lines. The rest are small code and doc corrections plus two questions.

### Findings and verification

| # | Severity | Finding | Re-checked in code |
|---|---|---|---|
| F1 | Major | PR scope and title: 52 commits across four streams; about 21.4k of the 41.9k added lines are tooling (`.claude/skills/impeccable/**`, 4 agent files, `.impeccable/design.json`, `.serena/memories`). The title names only the city. | Confirmed. The tooling paths add 21,447 lines in 67 files. |
| F2 | Minor | `PRESET_SAVE` accepts any non-empty id, not only `user:…` ids (`lib/messaging/blocklist-payload.ts:49`; `saveUserPreset` in `lib/blocking/saved-presets.ts:55` also only checks `id.length === 0`). | Confirmed. Nothing enforces `USER_PRESET_PREFIX` on the save path. |
| F3 | Minor | `docs/changelog.md:26` says "Now 1463 passing tests"; the real count is 1471. | Confirmed (line 26, and line 24 area repeats 1463). |
| F4 | Minor | `docs/changelog.md:163`: the CR6.T12 row says "partial (first-frame budget missed, reported)". PERF22 resolved it (budget met at 250 ms). The CR6 summary line 25 also still says "the first-frame budget is missed, see its entry". | Confirmed. |
| F5 | Minor | `docs/changelog.md:111`: the I016 row has hash `—`; the commit now exists as `10501b5`. | Confirmed. |
| F6 | Minor | `lib/score/calculate-built-characters.ts:35`: the comment says "a long stay costs more than its length". The escalation counts distraction ticks over the whole session, so several short visits escalate like one long stay (documented as intended in I013). | Confirmed, wording only. |
| F7 | Minor | `.claude/skills/impeccable/SKILL.md` is Apache 2.0 but the repo copy has no LICENSE/NOTICE. | Confirmed: no licence or notice file is tracked under `.claude/skills/impeccable`. |
| Q1 | Question | `store/city.selectors.ts:32`: `selectVisibleFloors` keeps the "falling" history (`advanceFall`, I015) in a module-level `visibleCache`, so its output depends on earlier calls. Should it live in the volatile UI slice? | Confirmed: `visibleCache` is a module-level `let`. |
| Q2 | Question | `entrypoints/background.ts:330-360`: `MALUS_APPLIED` reports the domain of the first "Open anyway" choice, even when the drop comes from another blocked tab. Nothing listens for it. Keep it? | Confirmed. The only `onMessage('MALUS_APPLIED', …)` calls are in tests. The message type is declared in `lib/messaging/messages.types.ts:53` and listed at `background.ts:47`. |

### Additional observation (not in the review)

- **A1 — `.claude/settings.local.json` is committed in this PR** (48 added lines, listed in the PR file list). CLAUDE.md §1.4 says not to commit this file because it is local and may hold machine-specific permissions. It should be removed from the branch and ignored. This needs your decision, see D6.

## 2. Open points

Status after the third round of answers (2026-11-21): **D1–D10 are all decided, including D9b**. D5 was changed on 2026-11-21 (see below). D9 is a new open point. The decision column records what was chosen; the original options are kept for the record.

| ID | Status | Question | Options | Recommendation |
|---|---|---|---|---|
| D1 | ✅ Decided | **How to handle the PR scope (F1)?** | (a) Retitle only, e.g. `feat: presets, mid-session adds and seeded 3D city`. (b) Move the tooling commit `1895c37` (skill, agents, `.impeccable`, `.serena`) into its own PR, then retitle. | (b) if you want the product diff reviewable. The tooling is about half the added lines. It needs a history rewrite or a rebase, and your rules forbid those unless you ask explicitly. (a) is the cheap, safe minimum. |
| D2 | ✅ Decided | **Skill licence (F7).** | (a) Add the upstream Apache 2.0 `LICENSE` (and `NOTICE` if upstream has one) next to `SKILL.md`. (b) Stop committing the skill and add it to `.gitignore`. | Depends on D1. If the tooling moves to its own PR, decide there. If it stays, (a) is the smaller change. I can't fetch upstream's exact LICENSE text from memory, so I'd need the source or a network fetch. |
| D3 | ✅ Decided | **`PRESET_SAVE` id check (F2): where to enforce the prefix?** | (a) Only in the payload validation (`blocklist-payload.ts`), as the review suggests. (b) Also in `saveUserPreset`, so the pure logic holds the invariant for any caller. | (b). The comment on `USER_PRESET_PREFIX` states an invariant, and the pure function is the place that keeps it. The payload check then stays a cheap early rejection. Both can share one `isUserPresetId` helper. |
| D4 | ✅ Decided | **`visibleCache` (Q1).** Keep the module-level cache or move the fall history to the volatile UI slice? | (a) Keep it, and export a `resetVisibleCache()` for tests. (b) Move the fall state into the volatile UI slice. | (a) is a small change but keeps the hidden state. (b) matches CLAUDE.md §1.3 (transient state in the volatile store) but changes a selector that must stay pure and memoised, and needs something to write the fall value on every `builtCharacters` change. I lean to (b), but it is a real refactor: say if you want it in this PR or as a follow-up. |
| D5 | ✅ Decided (changed: keep) | **`MALUS_APPLIED` (Q2).** Keep, fix the domain, or remove? | (a) Remove the message, the wiring in `background.ts` and its tests. (b) Keep it and report the domain correctly (for example, the domain of the blocked tab that was open when the drop happened). (c) Keep it as is and document the limit. | (a) fits YAGNI, since nothing consumes it. It touches 6 files including `messages.types.ts`. It was added by earlier work, so check `docs/roadmap-en.md` for a card that plans a consumer before removing it. |
| D6 | ✅ Decided | **`.claude/settings.local.json` (A1).** Remove it from the PR and add it to `.gitignore`? | Yes / No | Yes. Removing it from the branch means a new commit that deletes it, which is fine with the `commit` skill. Rewriting the history to drop it from the older commit is a separate choice. |
| D7 | ✅ Decided | **Missing checks.** Run `bun run build` and `bun run e2e` and do a visual check of the 3D view before merge? | Yes / No | Yes for build and e2e, I can run them. The visual check needs you or a browser session. |

### Decisions taken

- **D1 + D2 — tooling out of the repo (updated 2026-11-21: uninstall instead of ignore).** First decided: add `impeccable` to `.gitignore`. Then, since the tool has already been used and is no longer needed, it is **uninstalled** (decision D10 below). This also settles the Apache 2.0 licence point (F7): the skill is no longer redistributed, so no LICENSE/NOTICE is needed. Then retitle the PR and rewrite its description so that it covers all the streams (presets, mid-session adds, UI review, 3D city).
  - Uninstalling means deleting the files from the branch (`git rm`), in one new commit. They stay in the git history of the older commit `1895c37`; dropping them from history would be a rewrite and was not requested.
  - Scope: `.claude/skills/impeccable/` and the four `.claude/agents/impeccable-*.md` files. `.impeccable/design.json` moves to `docs/ui/design.json` (D9b = c); the two `.gitignore` lines for `.impeccable/critique/` and `.impeccable/live/` are removed, as the folder no longer has tracked files.
- **D3 — option (b).** Enforce the `user:` prefix both in the payload check and in `saveUserPreset`, through one shared `isUserPresetId` helper.
- **D4 — option (a).** Keep the module-level `visibleCache` in `store/city.selectors.ts` and export a reset function for tests. The fall history is a view-side concern with one process-wide answer; moving it into the volatile slice would need an owner that updates it on every change of `builtCharacters`, and that is more machinery than the problem needs. A slice-based version can be proposed as a separate PR if it becomes necessary.
- **D5 — changed: keep `MALUS_APPLIED` as is, for now.** First decided as removal (option a), after a usage check that found it unused (see "D5 verification" below). Then changed: the unused code stays in this PR and is tracked in `docs/refactor/dead-code-candidates.md` (entry DC1) instead, to be cleaned up later together with the other dead code found. The document is stashed for now and comes back in a dedicated branch after this PR is closed (see the note at the top).
- **D8 — keep `SITE_BLOCKED_ATTEMPT` as is, for now.** Tracked as DC2 in the same (stashed) document.
- **D10 — uninstall `impeccable`: agreed.** The tooling adds 67 files and about 21.4k lines to the PR (skill, 4 agents, `.impeccable/`), adds an `impeccable` skill and four agents to every session's lists, and the work it was installed for (the UI review, `DESIGN.md`, `PRODUCT.md`) is done. Removing it reduces noise and the size of the PR. It can be reinstalled any time. Leftovers: D9, D9b.
- **D6 — yes.** Remove `.claude/settings.local.json` from the PR and ignore it.
- **D7 — yes.** Run `bun run build` and `bun run e2e` before merge. The visual check of the 3D view is still done by you or in a browser session.

**D9 — decided (2026-11-21), with one correction (D9b).** After the uninstall:

- `DESIGN.md` and `PRODUCT.md` stay as plain project docs. (`PRODUCT.md` line 3 holds a tool comment, `<!-- impeccable:product-schema 1 -->`, which can be deleted or left.)
- The mentions in `docs/changelog.md` and `docs/roadmap-en.md` are history and stay as written.
- The mentions that present the tool as a current workflow are reworded, not deleted:
  - `.serena/memories/core.md` line 12 ("from the Impeccable critique") and line 13 (`DESIGN.md` / `.impeccable/design.json` as the design authority, critique snapshots in `.impeccable/critique/`).
  - `docs/ui/ui-review-tasks.md`: lines 3–4 (source command and local report), and the `**Command**: /impeccable …` field of the cards (lines 64, 90, 107, 128, 144, 166, 181, 192, 220, 229, 250, 266, 280). The cards are history of how the work was planned, so the safest rewording is a note at the top that the tool is no longer installed and those commands can't be re-run, rather than editing every card. Lines 130–231 ("Implemented directly, without running the impeccable command") stay as they are.

**D9b (correction, decided: option C):** `.impeccable/design.json` is not only read by the tool. In the previous round I recommended deleting it as a "data file only the tool reads". That was wrong. It holds the `Duration Drum` snippet and the `drum-*` motion tokens, and two docs name it as part of the spec: `docs/ui/ui-review-tasks.md:196` (UI.T9, "Spec (normative)") and `DESIGN.md:312` (the static target image is the render of that snippet). It is also the only tracked file in `.impeccable/`: `critique/` and `live/` are gitignored. Deleting it would break those references.

Options:
- **(a) Keep `.impeccable/design.json` where it is** and reword the docs to call it a design-tokens file. Simplest; the folder name stays.
- **(b) Move its drum snippet and motion tokens into `DESIGN.md`**, then delete the file. Cleaner, but it is a bigger edit to a design document.
- **(c) Move the file to a neutral place** (e.g. `docs/ui/design.json`) and update the two references.

**Decision (2026-11-21): option (c).** Move the file to `docs/ui/design.json` with `git mv`, so its history follows it, and update every reference to the old path:
- `DESIGN.md:312`
- `docs/ui/ui-review-tasks.md:196`
- `.serena/memories/core.md:13` (already being reworded in T6)

`docs/changelog.md:1584` also names the file; it is history and stays as written. After the move `.impeccable/` has no tracked files, so the two `.gitignore` lines for `critique/` and `live/` are removed with the tool. The file's content is not changed, and since it was generated by the tool, a check that nothing inside it refers to its own old path is part of T6.

### D5 verification: is `MALUS_APPLIED` used?

Searched the whole repo outside `node_modules`, build output and docs (`MALUS_APPLIED`, `MalusApplied`, `charactersRemoved`), then the listeners.

- **Producer:** only `createMalusWiring` (`entrypoints/background.ts:360`).
- **Production consumers: none.** `components/`, `entrypoints/blocked-overlay.content.tsx` and the popup never listen for it. The only registration is the background's own passive one (`MESSAGE_TYPES`, `background.ts:44-48`, registered at `:543`); its handler (`handlePassiveMessage`, `:534`) only acts on `TIMER_TICK` and `SITE_BLOCKED_ATTEMPT`, so for `MALUS_APPLIED` it does nothing. The bus also does not deliver a message to its own sender.
- **Other consumers: tests only** (`malus.test.ts`, `background.test.ts`, `bus.test.ts`, `blocked-overlay.test.ts`, `malus-wiring.test.ts`), plus the type in `lib/messaging/messages.types.ts:52-54,115`.
- **Docs only:** the roadmap CR6.T5b criterion "`MALUS_APPLIED` still reaches the overlay" was never implemented (the changelog already notes "no production listener").
- **Larger removal than first described:** `createMalusWiring` does nothing except send this message. Its `handleAttempt` (called from `background.ts:538` on `SITE_BLOCKED_ATTEMPT`) only arms the report. So removing the message removes the whole wiring, the `malus` constant at `background.ts:456` and its `dispose()` at `:458`.

Result: removal would be safe for behavior, but it is not done in this PR. The score, the city and the population lose characters through `builtCharacters` and don't use this message.

**D8 — decided:** keep `SITE_BLOCKED_ATTEMPT` as it is. The overlay still sends it and the background still handles it. Tracked as DC2 in `docs/refactor/dead-code-candidates.md`, which is stashed for now (see the note at the top).

## 3. Tasks

Task IDs are local to this document (`PR7.Tn`). The order is the suggested one. Code tasks follow the red/green/refactor rule of CLAUDE.md §3.1.

### PR7.T1 — Fix the stale changelog lines (F3, F4, F5)

- **Depends on:** nothing. It does not depend on any decision.
- **Files:** `docs/changelog.md`.
- **Work:**
  - Line 26: change 1463 to 1471 (both mentions in the bullet), keeping the per-step breakdown consistent with the PERF22 (1468) and I016 (1471) entries.
  - Line 163: set the CR6.T12 status to done and reference PERF22 and the 250 ms budget.
  - Line 25 (CR6 summary): remove "the first-frame budget is missed, see its entry" or mark it resolved by PERF22.
  - Line 111: replace `—` with `10501b5` for I016.
- **Process:** use the `changelog` skill and read only the sections it edits.
- **Acceptance:** no remaining "1463", no "budget is missed" without the PERF22 resolution, and I016 names its hash.

### PR7.T2 — Fix the malus comment wording (F6)

- **Depends on:** nothing.
- **Files:** `lib/score/calculate-built-characters.ts` (comment at line ~35).
- **Work:** replace "so a long stay costs more than its length" with wording that says the escalation counts distraction ticks across the whole session, so several short visits escalate like one long stay (I013).
- **Acceptance:** comment only, no behavior change, tests still green.

### PR7.T3 — Enforce the `user:` prefix on saved presets (F2)

- **Status:** ready (D3 = b).
- **Files:** `lib/messaging/blocklist-payload.ts`, `lib/blocking/saved-presets.ts`, a shared helper such as `isUserPresetId`, and their tests (grep the existing `PRESET_SAVE` and `saveUserPreset` tests under `tests/`).
- **Work (red first):**
  1. Add a failing test: `PRESET_SAVE` with id `work` is rejected at the boundary.
  2. Add a failing test: `saveUserPreset` with a non-prefixed id returns the same state reference.
  3. Implement the check with `id.startsWith(USER_PRESET_PREFIX)`.
  4. Confirm valid `user:…` ids, including ids produced by `migrate-presets.ts`, still pass.
- **Acceptance:** forged non-prefixed ids are rejected, the existing tests pass, and the `USER_PRESET_PREFIX` comment is true.

### PR7.T4 — Decide and apply the `visibleCache` change (Q1)

- **Status:** ready (D4 = a).
- **Files:** `store/city.selectors.ts`, `tests/unit/store/city-selectors.test.ts` (and any other test that reads `selectVisibleFloors` with a shared history, such as `tests/integration/background/malus.test.ts`).
- **Work:** export a reset function for `visibleCache` (name to be chosen when implementing, e.g. `resetVisibleCache`), and call it in the tests that depend on a clean history. Add a failing test first that shows the leak, then the reset.
- **Acceptance:** the I015 fall behavior is unchanged (existing tests green), and a test can reset the fall history without relying on the order of earlier tests.

### PR7.T5 — `MALUS_APPLIED` (Q2): no code change, dead-code document deferred

- **Status:** changed on 2026-11-21 (D5 = keep). The removal described earlier is **not** done in this PR, and the dead-code document is **not** part of it either.
- **Files:** none in this PR. `docs/refactor/dead-code-candidates.md` (entries DC1 and DC2) exists only in a git stash.
- **Work:** the unused message and its wiring stay as they are. Q2 is answered in the PR by saying that the domain limit is known, that nothing reads the message (see "D5 verification") and that the cleanup is deferred. `SITE_BLOCKED_ATTEMPT` (D8) is deferred the same way. Later, in a dedicated branch opened after this PR is closed and the remaining project tasks are done, the stash is restored and the document is committed.
- **Acceptance:** no source changes, nothing about dead code in the PR diff, and the stash is left untouched.

### PR7.T6 — Uninstall `impeccable` (F7, D1, D2, D9, D10)

- **Status:** ready (D9b = c).
- **Files:** `.claude/skills/impeccable/**`, `.claude/agents/impeccable-*.md` (4 files), `.impeccable/design.json` → `docs/ui/design.json`, `DESIGN.md` (line 312), `.serena/memories/core.md` (lines 12–13), `docs/ui/ui-review-tasks.md` (lines 3–4, 196 and a note at the top), `PRODUCT.md` line 3 (optional), `.gitignore` (the two `.impeccable/` lines).
- **Work:**
  1. Check that no other skill, agent or script depends on the files before deleting.
  2. Delete the skill and the four agents (`git rm -r`).
  3. Reword the Serena memory so `DESIGN.md` and `PRODUCT.md` are the design authority and the tool is not mentioned as current. Memory edits go through Serena, per CLAUDE.md.
  4. In `docs/ui/ui-review-tasks.md`, update the source lines and add one note saying the tool is no longer installed and the `/impeccable …` commands are historical. Leave the cards as they are.
  5. `git mv .impeccable/design.json docs/ui/design.json`, update the three references above, and check that the file doesn't refer to its own old path.
  6. Commit through the `commit` skill, on your request.
- **Acceptance:** the PR diff no longer contains the skill or its agents; `DESIGN.md` and `PRODUCT.md` stay; no doc points to a tool that is gone as if it were current; no LICENSE is needed.

### PR7.T7 — Remove `.claude/settings.local.json` from the PR (A1)

- **Status:** ready (D6 = yes).
- **Files:** `.claude/settings.local.json`, `.gitignore`.
- **Work:** delete the file from the branch and add it to `.gitignore`. Make sure it's still present locally if you rely on it (`git rm --cached`).
- **Acceptance:** the file is no longer in the PR diff.

### PR7.T8 — Fix the PR scope and title (F1)

- **Status:** ready (D1 = retitle and rewrite the description, no split). Do it after T6 and T7 and after the branch is pushed, so the description matches the final diff and diff size.
- **Work:** `gh pr edit 7 --title "feat: presets, mid-session adds and seeded 3D city"` (wording to confirm) and rewrite the body so the Summary names all the streams (CR4 presets, CR5 mid-session adds, the UI review UI.T1–UI.T10, the CR6 3D city, the fixes). Update the diff numbers and the commit list, and drop the mention of the tooling that is no longer in the diff. The description must not mention the dead-code document or the dead-code candidates (DC1, DC2): they are not in this PR (see the note at the top). This edits the PR on GitHub, so I'll show you the text first.
- **Acceptance:** the title and the description cover every stream, match the final diff, and say nothing about the dead-code document.

### PR7.T9 — Final verification (D7)

- **Status:** ready (D7 = yes), runs last.
- **Work:** run `bun run compile`, `bun run lint`, `bun run test`, then `bun run build` and `bun run e2e`. Report any failures as they are. The visual check of the 3D City tab in a browser is still needed from you, or from a browser session.
- **Acceptance:** all commands pass at the new head, and the changelog test count matches the actual count.

## 4. Suggested order and grouping

1. **No decision needed:** T1, T2.
2. **Ready now (all decided):** T3 (tests first), T4, T5 (docs only), T6, T7, then T8. No point is open any more.
4. **Last:** T9.

Commits go only through the `commit` skill, on your request. Every behavior change gets a changelog entry, and T1 should be redone at the end if the test count changes (T3 and T4 add tests, so the count will change).
