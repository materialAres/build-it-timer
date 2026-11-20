# I010 — CR2 review findings (blocklist lock, PR #5)

- **Status**: **open**
- **Severity**: high for F1 (reproduced: the blocklist lock is bypassed in the background's startup window, and storage is left holding an `idle` timer, so a running session can be lost on the next restart); the other findings are maintainability, test precision and copy
- **Type**: review follow-up — one correctness gap in critical logic (§3.4), plus maintainability, test-coverage and copy findings
- **Found**: post-merge review of PR #5 `feat(CR2): lock the blocklist while a timer session is active` (merged as `8bdbb57`)
- **Fixed in**: — (planned as I010.T1–I010.T5 in `docs/roadmap-en.md` §2.7)
- **Related tasks**: CR2.T1, CR2.T2, CR2.T3a, CR2.T3b, CR2.T3c, M1.T7, M1.T8, M1.T10, M2.T2

---

## Summary

CR2 makes the blocklist editable only while `timer.status === 'idle'`. The
predicate `isBlocklistEditable` is enforced in three places: the store actions,
the background mutation handler and the UI. The design is sound and the suite
covers every mutation in every locked status. The review found:

| # | Finding | Severity | Task |
|---|---|---|---|
| F1 | The background guard reads a store that has not been hydrated yet | major | I010.T1 |
| F2 | The lock lives in the `default:` branch of the mutation switch | minor | I010.T2 |
| F3 | `createMutationHandler` exceeds 40 lines and has no explicit return type | minor | I010.T2 |
| F4 | Component lock tests do not assert that no mutation is sent | minor | I010.T3 |
| F5 | Italian lock notice repeats the same root word | minor (copy) | I010.T4 |
| F6 | Commit hygiene of the PR | process note | none |

F1 was first found by reading the code (zustand `5.0.15` and the background
wiring). It is now **reproduced** by a red integration test
(`tests/integration/background/blocklist-lock.test.ts`, describe
*"blocklist lock before the startup hydration (I010.T1)"*), which fails until
I010.T1 is implemented.

---

## F1 — The background guard runs before the store is hydrated

### Symptom (reproduced)

A blocklist mutation that reaches the background **before** the persisted state
has loaded is checked against the default `idle` timer instead of the persisted
`running` (or `paused` / `completed`) session. The CR2.T2 guard lets it through.

### Root cause

In `startBackground` (`entrypoints/background.ts`):

1. The store is created at line 474. zustand starts an automatic hydration at
   creation (no `skipHydration`).
2. The mutation listeners are registered **synchronously** at lines 621–642.
3. The authoritative hydration only runs inside `ready` (lines 666–667,
   `await store.persist.rehydrate()`). That call supersedes the automatic one
   (zustand bumps its internal hydration version).

In MV3 the event that wakes a sleeping worker is dispatched right after the
top-level script runs, while `storage.local.get` is still in flight. Until it
resolves, `store.getState().timer.status` is the slice default, `idle`. At that
point:

- `createMutationHandler` (`lib/messaging/apply-mutation.ts:150`) sees `idle`,
  accepts the mutation and calls `store.setState({ blocklist: next })`.
- zustand v5's `persist` wraps `setState` and calls `setItem` **unconditionally**,
  even before hydration. The write persists the partialized state: the edited
  blocklist **and the default `idle` timer**.
- When the read that was already in flight resolves, `merge` replaces the
  in-memory state with the persisted snapshot. `set(…, true)` inside `hydrate`
  is the raw setter, so this does not write.

### Consequences (observed in the red test)

The test persists a `running` session, starts a fresh background, holds the
storage read open (served in FIFO order, like the real backend), sends
`BLOCKLIST_ADD_SITE` and then lets startup finish. Result:

| Check | Expected | Observed |
|---|---|---|
| CR2 lock rejects the early mutation (`debug` record) | rejected | **accepted**, no record |
| Timers written to storage | never `idle` | **one write with `idle`** |
| In-memory timer after `ready` | `running` | `running` |
| In-memory blocklist after `ready` | `[]` | `[]` |
| Persisted timer after `ready` | `running` | **`idle`** |
| Persisted blocklist after `ready` | `[]` | **`[facebook.com]`** |

- **The lock is bypassed.** The early mutation is applied and persisted,
  without the CR2.T2 record.
- **Memory and storage disagree after startup.** The hydration merge restores
  the running session in memory, and its `set(…, true)` does not write, so
  nothing repairs storage. The background ignores its own write (M1.T8
  self-write filter), so it never re-reads it either. Storage keeps the default
  `idle` timer and the edited blocklist **until the next background write**.
- **The running session can be lost.** If the worker is suspended before its
  next write, the next restore (M2.T2) reads the `idle` snapshot and the
  session is gone. Meanwhile a popup syncing from storage (M1.T8) sees an
  `idle` timer, an unlocked list and the edit. When the next background write
  lands, both revert, so the edit appears and then disappears.
- **Ordering matters.** With a read that is served *after* the write (a
  non-FIFO variant of the same test), the outcome is worse: the background
  itself ends `idle` in memory and keeps the edit.
- Timer commands share the same window (for example `TIMER_STARTED` applied on
  the default state). That part predates CR2 and is not covered by the red
  test, but it has the same root cause and the same fix.
- **Trigger.** The popup UI disables the editors while it sees a locked
  status, so the realistic triggers are a stale or forged runtime message
  delivered as the worker wakes (sender provenance is M5.T1).

### Why the existing test does not catch it

Decision F of `docs/features-analysis/blocklist-lock.md` ("startup window
covered by the integration test") points to
`tests/integration/background/blocklist-lock.test.ts`:
*"rejects a mutation received while a restored running session is reconciled"*.
The test calls `await handle.ready` (line 76) **before** `sendMessage` (line 80).
It therefore checks the handler *after* the restart has finished, not during
it.

### Fix direction

Blocklist and timer mutations must not run before the startup hydration has
finished:

- Run the mutation listeners only after the startup hydration has resolved. For
  example, chain each delivery on one hydration promise that `ready` also awaits.
  Promise callbacks run in FIFO order, so the arrival order of messages is
  preserved.
- Do **not** use `store.persist.hasHydrated()` alone as the gate. The background
  also runs `attachStoreSync(store)` (line 495), and every sync rehydration sets
  `hasHydrated` back to `false`. A plain check would silently drop legitimate
  `idle` edits that arrive during an ordinary sync.
- A failed hydration must not leave the listeners waiting forever. zustand's
  `rehydrate()` resolves even when the read fails. The store then keeps its
  defaults and `onRehydrateStorage` has already logged the error (M4.T3c), so
  the listeners run on that state, the only one the background can know.

---

## F2 — The lock sits in the `default:` branch

`createMutationHandler` switches on the four timer commands and applies the lock
in `default:` (`lib/messaging/apply-mutation.ts:146–150`). The rule really
covers "everything that is not a timer command". If a future non-blocklist type
is added to `MUTATION_TYPES`, it is locked silently, and the switch has no
exhaustiveness check that would flag it. Principle O (§1.1): the set of
blocklist mutations should be declared as data (for example a
`BLOCKLIST_MUTATION_TYPES` list and an `isBlocklistMutation` type guard), and
the switch should end with an exhaustive `never` check.

## F3 — `createMutationHandler` size and return type

With the CR2.T2 guard, the function spans lines 115–166, about 52 lines (the
§1.2 limit is 40). Its exported signature was changed by the PR but still has
no explicit return type (§1.2: every exported function declares one).
Extracting the blocklist branch into a helper fixes F2 and F3 together.

## F4 — Component lock tests stop at the store

The CR2.T3a/T3b acceptance criteria say that interacting with a locked control
causes "no store change, **no mutation sent**". The tests in
`tests/unit/components/blocklist/{SiteList,PresetPicker,TagEditor}.test.tsx`
assert only the store. Because the controls are `disabled`, React never calls
their handlers, so the tests mostly check the DOM attribute. The store-level
tests (`tests/unit/store/blocklist-lock.test.ts`) do assert `sendMutation`, so
the risk is low, but the component criteria are not covered as written.

## F5 — Italian copy

`locales/it.yml:65`: *"La lista dei bloccati è bloccata durante una sessione.
Reimposta il timer per modificarla."* The sentence says "bloccati… bloccata".
Suggested wording: *"La lista dei siti bloccati non è modificabile durante una
sessione. Reimposta il timer per modificarla."* It still names Reset, as
decision A requires.

## F6 — Commit hygiene (process note, no task)

- `8289fc1` bundles CR2.T2 and CR2.T3a under the scope `CR2`.
- Several commit headlines are longer than 72 characters.
- `801fab9` adds `CLAUDE.md`, which is unrelated to CR2 (the PR body lists it).

History is not rewritten (§4.2). For future change requests: one task per
commit, with the task ID as the scope, and unrelated changes in a separate PR.

---

## Acceptance criteria (for the whole issue)

- A blocklist mutation delivered before the startup hydration has finished is
  evaluated against the **persisted** timer status. With a persisted `running`
  session it is rejected, nothing is written, and storage never holds a default
  `idle` timer. (I010.T1)
- Legitimate `idle` edits that arrive during an ordinary sync rehydration are
  still applied. (I010.T1)
- The blocklist mutation set is explicit and the switch is exhaustive;
  `createMutationHandler` is ≤ 40 lines with an explicit return type. (I010.T2)
- The component lock tests assert that no mutation message is sent. (I010.T3)
- The Italian notice no longer repeats "bloccati… bloccata". (I010.T4)
- Changelog entry, this document marked fixed, full gate green. (I010.T5)

## Evidence

- `entrypoints/background.ts:474` (store creation), `:495` (`attachStoreSync`),
  `:621–642` (listeners registered synchronously), `:666–667` (`ready` →
  `rehydrate`).
- `lib/messaging/apply-mutation.ts:115–166` (`createMutationHandler`), `:146`
  (`default:` branch), `:150` (lock check).
- `node_modules/zustand/esm/middleware.mjs` (5.0.15): the persist-wrapped
  `setState` calls `setItem()` with no hydration check; `hydrate()` resets
  `hasHydrated = false` on every call.
- `tests/integration/background/blocklist-lock.test.ts:76–80`: `handle.ready`
  is awaited before the message is sent.
- `tests/integration/background/blocklist-lock.test.ts`, describe
  *"blocklist lock before the startup hydration (I010.T1)"*: red test that
  reproduces F1 (4 soft assertions fail: no lock record, an `idle` write,
  persisted timer `idle`, persisted blocklist edited).
- `locales/it.yml:65`.
