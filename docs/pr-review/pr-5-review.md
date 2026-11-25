# PR #5 — Review report and fix plan

> PR: `feat(CR2): lock the blocklist while a timer session is active` (`feat/blocklist-cr` → `main`), merged on 2026-11-03 as `8bdbb57`.
> Review: post-merge review, written on 2026-11-20 on `feat/pr-review-CR` (commit `fb5d334`, where it was filed as issue "I010" with roadmap §2.7).
> Moved here on 2026-11-24 while merging that branch into `main` after PR #7. The ID `I010` and roadmap §2.7 were already taken on `main`, so the review now follows the format of `pr-7-review.md`. Every finding was re-checked against `main` at `6824c30` (CR4, CR5 and CR6 landed in between).

## Progress (2026-11-24)

| Task | Result | Commit |
|---|---|---|
| PR5.T1 | Done. The red test is green; the gate is `lib/messaging/startup-gate.ts` | `9c07f5d` |
| PR5.T2 | Done. `BLOCKLIST_MUTATION_TYPES`, `isBlocklistMutation`, an exhaustive handler | — (to be committed) |
| PR5.T3 | Open | — |
| PR5.T4 | Open | — |

## 1. Review summary

CR2 makes the blocklist editable only while `timer.status === 'idle'`. The rule is enforced in three places: the store actions, the background mutation handler and the UI. CR5 later opened the **add** direction while `running`/`paused` (`isBlocklistAddAllowed`, `store/blocklist-lock.ts`). The design is sound and the suites cover every mutation in every status. The review found one correctness gap in critical logic (§3.4), plus maintainability and test-precision points.

### Findings and verification

| # | Severity | Finding | Status on `main` (`6824c30`) | Task |
|---|---|---|---|---|
| F1 | Major | The background applies mutations before the store has been hydrated at startup | **Still present, and wider**: the CR5 `addsSites` pre-step reads the same default state, and a mid-session add from the popup is enough to trigger it. Reproduced by a red test | PR5.T1 |
| F2 | Minor | The lock lives in the `default:` branch of the mutation switch | Still present (`lib/messaging/apply-mutation.ts:131`). The branch now also covers the `PRESET_*` types | PR5.T2 |
| F3 | Minor | `createMutationHandler` is longer than 40 lines and has no explicit return type | Still present: lines 100–164, about 65 lines, and no return type | PR5.T2 |
| F4 | Minor | The component lock tests do not assert that no mutation is sent | Still present. `TagEditor` was removed by CR4. None of `SiteList`, `PresetPicker` or `SavedPresets` tests spies on the message bus | PR5.T3 |
| F5 | Minor (copy) | The Italian lock notice says "bloccati… bloccata" | **Resolved on `main`**: `locales/it.yml:99` now reads "La lista è bloccata. Reimposta il timer per modificarla." | none |
| F6 | Process note | Commit hygiene of the PR | Unchanged (history is not rewritten) | none |

## F1 — The background runs mutations before the startup hydration

### Root cause

In `startBackground` (`entrypoints/background.ts`):

1. The store is created and zustand starts an automatic hydration (no `skipHydration`). The background also attaches `attachStoreSync(store)` (`:420`).
2. The mutation listeners are registered **synchronously** (`:551–580`). Each delivery first runs the CR5 pre-step: `addsSites` (`:568`) reads `store.getState().timer.status` to decide whether to call `growthTick.account()` and refresh the distraction tracker. Then it calls `handleMutation`.
3. The authoritative hydration only runs inside `ready` (`:606–607`, `await store.persist.rehydrate()`). That call supersedes the automatic one.

In MV3 the event that wakes a sleeping worker is dispatched right after the top-level script runs, while `storage.local.get` is still in flight. Until the read resolves, the timer is the slice default (`idle`) and the blocklist is empty. Then:

- The handler judges the message against `idle`. zustand v5's `persist` wraps `setState` and calls `setItem` **even before hydration**, so an applied message persists the **defaults**: an `idle` timer and a blocklist built from an empty list.
- When the read that was already in flight resolves, the hydration merge replaces the in-memory state with the persisted snapshot. Its `set(…, true)` is the raw setter and does not write, so nothing repairs storage. The background ignores its own write (the M1.T8 self-write filter), so it never re-reads it either.

### Why `main` needs a two-message trigger

Since CR4/CR5, every idle-only mutation (remove, preset off, save, rename, delete) is a **no-op on the empty default state**, so a single locked message changes nothing. The window shows through CR5's add direction:

1. An early `BLOCKLIST_ADD_SITE` (legal while running) is applied to the defaults and persists them. The `addsSites` pre-step also sees `idle`, so it skips `growthTick.account()`.
2. An early `BLOCKLIST_REMOVE_SITE` for the same site is judged against `idle` and **bypasses the CR2 lock**.

### Consequences (observed in the red test)

The test persists a `running` session whose blocklist holds `facebook.com`, starts a fresh background, holds the storage read open (FIFO, like the real backend), sends `ADD x.com` then `REMOVE x.com`, and then lets startup finish.

| Check | Expected | Observed on `main` |
|---|---|---|
| CR2 lock rejects the early `REMOVE` (`debug` record, `{ type }` only) | rejected | **accepted**, no record |
| Timers written to storage | never `idle` | **two writes with `idle`** |
| In-memory timer after `ready` | `running` | `running` |
| In-memory blocklist after `ready` | `facebook.com`, `x.com` | **`facebook.com`** (the early add is lost) |
| Persisted timer after `ready` | `running` | **`idle`** |
| Persisted blocklist after `ready` | `facebook.com`, `x.com` | **empty** |

- **The lock is bypassed** for the early removal.
- **Memory and storage disagree after startup**, until the next background write.
- **The running session and its blocklist can be lost.** If the worker is suspended before its next write, the next restore (M2.T2) reads an `idle` timer and an empty blocklist. Meanwhile a popup syncing from storage (M1.T8) sees an unlocked, empty list.
- **Timer commands share the window (not reproduced yet).** An early timer command is judged against the default `idle` timer, not the persisted session. Reading the code, the likely effect is that an early `TIMER_PAUSED` or `TIMER_RESET` is lost: `growthTick.account()` is a no-op on an idle timer, and the slice action has nothing to pause or reset. The root cause and the fix are the same. The PR5.T1 test for an early `TIMER_PAUSED` will establish the actual behavior.
- **Trigger: reachable from normal use.** Since CR5 the popup keeps the add form and the preset toggles that are off enabled while a session runs. A site added just as the browser wakes the background is enough: the add is lost, and storage is left with an `idle` timer and an empty blocklist, so the session can be lost on the next restart. Only the lock bypass on removal still needs a stale tab or a forged runtime message, because the popup disables those controls (sender provenance is M5.T1).

### Why the existing test does not catch it

Decision F of `docs/features-analysis/blocklist-lock.md` ("startup window — persisted status") points to *"rejects a mutation received while a restored running session is reconciled"* in `tests/integration/background/blocklist-lock.test.ts`. That test awaits `handle.ready` (line 85) **before** `sendMessage` (line 89). It therefore checks the handler *after* the restart, not during it.

### Fix direction

- Apply mutations only after the startup hydration has resolved. Chain each delivery, **including the `addsSites` pre-step**, on one hydration promise that `ready` also awaits. Promise callbacks run in FIFO order, so messages keep their arrival order.
- Do **not** gate on `store.persist.hasHydrated()`. `attachStoreSync` rehydrates on every storage change and sets it back to `false`, so a plain check would drop legitimate `idle` edits that arrive during an ordinary sync.
- A failed hydration must not leave the listeners waiting forever. `rehydrate()` resolves even when the read fails. The store then keeps its defaults, and `onRehydrateStorage` has already logged the error (M4.T3c).

## F2 — The lock sits in the `default:` branch

`createMutationHandler` switches on the four timer commands and applies the lock (now with the CR5 add/edit split) in `default:` (`apply-mutation.ts:131–139`). The rule really covers "everything that is not a timer command". If a future non-blocklist type is added to `MUTATION_TYPES`, it is locked silently, and the switch has no exhaustiveness check that would flag it. Principle O (§1.1) says the blocklist mutation set should be declared as data (`BLOCKLIST_MUTATION_TYPES` with an `isBlocklistMutation` guard), and the switch should end with a `never` check.

## F3 — `createMutationHandler` size and return type

The function spans lines 100–164, about 65 lines (the §1.2 limit is 40). The exported signature has no explicit return type (§1.2). Extracting the blocklist branch into a helper fixes F2 and F3 together.

## F4 — Component lock tests stop at the store

The CR2.T3a/T3b criteria say that interacting with a locked control causes "no store change, **no mutation sent**". The component tests (`tests/unit/components/blocklist/{SiteList,PresetPicker,SavedPresets}.test.tsx`) assert only the store or the DOM. Because the controls are `disabled`, React never calls their handlers, so the tests mostly check the attribute. The store-level tests (`tests/unit/store/blocklist-lock.test.ts`) do assert `sendMutation`, so the risk is low, but the component criteria are not covered as written.

## F5 — Italian copy (resolved on `main`)

The original text was "La lista dei bloccati è bloccata durante una sessione…". The CR5/UI copy rework replaced it with "La lista è bloccata. Reimposta il timer per modificarla." (`locales/it.yml:99`). The new text no longer repeats the root and still names Reset (CR2 decision A). No task is needed.

## F6 — Commit hygiene (process note, no task)

- `8289fc1` bundles CR2.T2 and CR2.T3a under the scope `CR2`.
- Several commit headlines are longer than 72 characters.
- `801fab9` adds `CLAUDE.md`, which is unrelated to CR2 (the PR body lists it).

History is not rewritten. For future change requests: one task per commit, with the task ID as the scope, and unrelated changes in a separate PR.

## 2. Decisions

- **D1 — where the review lives (2026-11-24).** Here, with local IDs `PR5.Tn`, following `pr-7-review.md`. The original issue file `docs/issue/I010-cr2-review-findings.md` and roadmap §2.7 from `fb5d334` were dropped in the merge, because `I010` (checkpoint fix `4ac0794`) and §2.7 (CR4) were already taken on `main`.
- **D2 — red test adapted to CR5.** The original test sent one early `BLOCKLIST_ADD_SITE`, which CR5 now allows while running. The test now sends `ADD x.com` then `REMOVE x.com` (see F1, "Why `main` needs a two-message trigger"). It is merged red, on purpose, as the red step of PR5.T1 (§3.1).
- **D3 — F5 dropped.** It was resolved on `main` by the copy rework.

## 3. Tasks

Task IDs are local to this document (`PR5.Tn`). Do them one at a time, in order. Code tasks follow the red/green/refactor rule of CLAUDE.md §3.1, and each task records its entry with the `changelog` skill (`Commit: —` until committed).

### PR5.T1 — Gate background mutations on the startup hydration (F1)

- **Status:** done (uncommitted). The red test is green as written; see the changelog entry.
- **Files:** `entrypoints/background.ts`, `tests/integration/background/blocklist-lock.test.ts`.
- **Work:**
  - Every mutation delivery waits for the startup hydration promise (the same one `ready` awaits), then runs in arrival order.
  - The CR5 `addsSites` pre-step and the `TIMER_PAUSED`/`TIMER_RESET` `growthTick.account()` call run after the wait, on the hydrated state.
  - Put the gate in a small extracted helper, so `startBackground` does not grow (§1.2).
- **Acceptance criteria:**
  - **Red test already in place**: describe *"blocklist lock before the startup hydration (PR5.T1)"* (`blocklist-lock.test.ts:390`). It fails today on five soft assertions (see F1). Do not weaken it: it must turn green as written.
  - After the fix, all of these hold:
    - the early `REMOVE` is rejected with the CR2.T2 `debug` record (`{ type }` only, no domain);
    - no `storage.local.set` call holds an `idle` timer;
    - after `handle.ready`, both memory and storage hold the `running` session with `facebook.com` and `x.com`.
  - The early `ADD` while `running` credits `growthTick.account()` on the hydrated state and refreshes the distraction tracker (CR5.T2 behavior, now also in the window).
  - A test with a persisted `idle` state: an early `ADD a.com` then `REMOVE a.com` leaves the list empty, and the final state is persisted.
  - An early `TIMER_PAUSED` credits the stretch on the hydrated running session, not on the defaults.
  - The gate is the startup hydration promise, **not** `store.persist.hasHydrated()`. A test shows that an `idle` edit arriving while the background's own sync rehydration is in flight is still applied.
  - A failed startup hydration releases the waiting messages (they run on the defaults kept by M4.T3c). No promise is left pending and there is no unhandled rejection.
  - The test *"rejects a mutation received while a restored running session is reconciled"* is renamed to what it checks (after the restart has completed).
  - The M2.T2, M1.T8, M1.T10, M3.T3b, CR2, CR4.T4, CR5.T2 and mutation-bus suites stay green unchanged (§3.4).
- **Amended criteria:**

  | Task | Amended part | New rule |
  |---|---|---|
  | M1.T10 | the mutation handler applies a message as soon as it is received | mutations wait for the background's startup hydration, then apply in arrival order |
  | CR2.T2 | startup window covered by a test that sends after `handle.ready` | covered by a test that sends **before** `handle.ready` resolves |
  | CR5.T2 | the add pre-step reads the status on delivery | the add pre-step reads the hydrated status |

### PR5.T2 — Explicit blocklist branch and exhaustive switch (F2, F3)

- **Status:** done (uncommitted). A refactor: no existing test changed.
- **Files:** `lib/messaging/messages.types.ts`, `lib/messaging/apply-mutation.ts`, `tests/integration/messaging/mutation-bus.test.ts`.
- **Work:**
  - `messages.types.ts` exports `BLOCKLIST_MUTATION_TYPES` (`as const`): every blocklist and `PRESET_*` type (recount on `main`). It also exports a type guard `isBlocklistMutation(message): message is BlocklistMutationMessage`. `MUTATION_TYPES` is composed from it plus the timer commands, so the lists cannot drift.
  - `createMutationHandler` declares its return type (`(message: MutationMessage) => void`) and is ≤ 40 lines. The blocklist branch (CR2/CR5 lock check, debug logs, malformed-payload drop, `applyBlocklistMutation`, identity check, `setState`) moves into a private helper.
  - The switch has no catch-all `default:` that applies the lock. It ends with a `never` exhaustiveness check, so adding a mutation type without handling it fails `bun run compile`.
- **Acceptance criteria:** `mutation-bus.test.ts` asserts that `MUTATION_TYPES` equals the union of `BLOCKLIST_MUTATION_TYPES` and the four timer commands, with no type missing or duplicated. All the existing mutation-bus, CR2, CR4.T4 and CR5.T2 tests pass unchanged. `apply-mutation.ts` stays ≤ 200 lines.
- **Notes:** this is a refactor. If a test needs a behavior change to pass, stop and report it instead of changing the test.

### PR5.T3 — Component lock tests assert that no mutation is sent (F4)

- **Status:** open. Independent of the other tasks.
- **Files:** `tests/unit/components/blocklist/SiteList.test.tsx`, `PresetPicker.test.tsx`, `SavedPresets.test.tsx`.
- **Work:** in each locked case, the test that interacts with a disabled control also asserts that no mutation message left the popup. The locked cases are:
  - `completed`: everything is locked;
  - `running`/`paused`: the × remove buttons, switching an applied preset off, and the save/rename/delete controls.

  For example, spy on `fakeBrowser.runtime.sendMessage` (the default `sendMutation` of the module-level store goes through the bus).
- **Acceptance criteria:** where a test fires an event on a disabled control, it also checks that the control is `disabled`. The idle-path tests and the CR5 add-while-running tests stay unchanged and green. No production file is touched.

### PR5.T4 — Close-out

- **Status:** open. Depends on PR5.T1–T3.
- **Files:**
  - `docs/changelog.md`
  - this document
  - `docs/features-analysis/blocklist-lock.md`
  - `.serena/memories/core.md`
- **Work:**
  - The changelog has one entry per PR5 task (via the `changelog` skill), with the **real** test counts.
  - This document's Progress table is filled in.
  - Decision F in `blocklist-lock.md` (§10) points to the during-the-window test of PR5.T1.
  - The `core.md` "Open follow-up: PR #5 review" note is replaced by the invariant: background mutations wait for the startup hydration and are never gated on `hasHydrated()`.
- **Acceptance criteria:** `bun run compile`, `bun run lint`, `bun run test`, `bun run build` and `bun run build:firefox` are green. Also run `bun run e2e` if the Playwright suite is available.
