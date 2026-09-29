# Zustand Store Analysis — Timer Focus (BuildIt)

> Scope: `store/` (`index.ts`, `timer.slice.ts`, `city.slice.ts`, `blocklist.slice.ts`,
> `score.slice.ts`, `storage-adapter.ts`, `store.types.ts`) plus every file that
> imports/reaches them (`entrypoints/background.ts`, `entrypoints/content.ts`,
> `entrypoints/popup/*`, `lib/messaging/messages.types.ts`, `tests/**`).
> Baseline verified at analysis time: `bun run compile` → clean (exit 0);
> `bun run test` → 29 passed / 6 files. Per `.continue/rules/changelog.md`, the
> store is at task **M1.T4** (skeleton): slices are stubs and have **no actions yet**.

---

## Summary

The store is a clean, well-typed skeleton: strict TS compiles clean, slices are correctly
split, the persisted/volatile separation is enforced at the type level, and the custom
`browser.storage.local` adapter is correct. The findings below are **latent risk / design-gap
observations on an M1.T4 skeleton**, not runtime defects: no context imports the store yet, so none
of them can currently manifest. The central one — no cross-context synchronization mechanism — is
**not scheduled by any roadmap task** (the roadmap never mentions `storage.onChanged`, rehydration on
change, or a "sync" task), so it needs a deliberate decision rather than assuming a later task
handles it. See "Roadmap coverage map" below for a per-finding verdict on whether future tasks close
the gap.

---

## Roadmap coverage map

Whether each finding is already owned by a scheduled task (the calibration a pure code read cannot
give on its own):

| Finding | Addressed by a scheduled task? | Basis |
|---|---|---|
| **CI-1** cross-context sync | **No — not explicitly.** Adjacent machinery exists but no mechanism is specified. | `grep` over `docs/roadmap-en.md`: **zero** hits for `onChanged`/`rehydrat`/`sync` (only "multi-device sync", which is out of scope). M1.T6 (typed message bus) and M1.T7 (background wiring) are the nearest tasks; M2.T7 says the background reapplies DNR "every time the blocklist changes" but never says *how it learns* of a change made from the popup. §1.1 line 47 asserts the three worlds communicate "via the persisted store and typed messages" — an assumption that only holds with a reconciliation mechanism no task introduces. |
| **CI-2** no `migrate` / shallow `merge` | **No.** | No task mentions `migrate` or `merge`. M2.T19 adds a slice (compiler-forced into `partialize`, see NI-2) but adds no migration path. Forward-looking only. |
| **CI-3** silent `getItem` fallback | **Likely yes, later.** | M4.T3 "Error hardening and centralized logging" (`utils/logger.ts`, "no empty `catch {}` remains") is the natural home. Still worth recording now so it is not missed. |
| **NV-1** timer/alarm mechanics | **Yes — but simply not built yet.** | M1.T5 (alarm adapter), M2.T1/M2.T2 own this. Nothing to fix in the store today. |
| **NI-3** `StateCreator` mutator array | n/a (revisit at M2). | No defect now; reconsider when M2 adds slice actions. |

---

## Confirmed issues

### CI-1 — No cross-context synchronization: popup and background will diverge and clobber each other

**Roadmap status: not covered by any scheduled task — needs an explicit design decision.**
Re-reading `docs/roadmap-en.md` end-to-end, the words `onChanged`, `rehydrate`, and `sync` (as a
cross-context concept) **do not appear**; there is no task that adds a reconciliation mechanism. The
nearest scheduled work is *adjacent*, not resolving:

- **M1.T6 (typed message bus)** provides a transport for `RuntimeMessage`s (e.g. `TIMER_TICK`,
  `SITE_BLOCKED_ATTEMPT`) — it does **not** by itself keep two Zustand instances consistent.
- **M1.T7 (background orchestrator)** wires the store + bus + listeners, but nothing states the
  background becomes the *single writer*.
- **M2.T7** requires the background to reapply DNR "every time the blocklist/allowlist changes", yet
  never says how the background *learns* of a change made from the popup — it could be a message or
  an `onChanged`→rehydrate; the roadmap leaves this open.

So this is a **genuine gap in the plan**, not a defect certain to persist: a future task *could* close
it (message-based state propagation, or an `onChanged`→`rehydrate` listener), but nothing in the
roadmap commits to doing so. Because no context imports `@/store` yet (see NV-2), it is **latent**
today. Recommendation: make it an explicit task or a documented decision before the background and
popup both consume the store (M1.T7 / M2.T3).

**Evidence**
- `store/index.ts:74` — `export const useAppStore = createAppStore();` is created **at module scope**.
  The comment on line 73 reads *"Single shared hook used by the popup and the background"*, which
  assumes shared memory that does not exist across extension contexts.
- `entrypoints/background.ts` (background service worker) and `entrypoints/popup/main.tsx` are
  **separate JS realms**: importing the same ES module gives each realm its own evaluation and
  therefore its own store instance, its own in-memory state, all pointed at the same key
  (`STORE_NAME = 'timer-focus-store'`, `store/index.ts:31`).
- `store/storage-adapter.ts` only implements read/write/remove; it registers **no** listener.
- A repo-wide search over `store lib components entrypoints utils` for
  `onChanged | runtime.connect | onMessage | sendMessage | alarms | setInterval | setTimeout | requestAnimationFrame`
  returned **NONE** (the only hits anywhere are in `docs/roadmap-en.md` prose).
  `lib/messaging/messages.types.ts` defines the `RuntimeMessage` union but there is **no bus**
  (`lib/messaging/` contains only `.gitkeep` + `messages.types.ts`; roadmap M1.T6 is not yet done).
- `zustand`'s `persist` hydrates **once, at store creation**
  (`node_modules/zustand/esm/middleware.mjs`, `persistImpl`: `if (!options.skipHydration) { hydrate(); }`),
  and `skipHydration` is not set. Nothing re-hydrates afterward.

**Why it is a problem**
`persist` writes the whole `partialize(state)` on **every** `setState` (`persistImpl` wraps
`set`/`api.setState` with `setItem()`). With two independent in-memory copies, every write from one
context can overwrite data the other context changed but has not re-read. There is no `onChanged`
subscription or message to reconcile them, so the stores only ever agree by accident.

**Concrete failure scenario**
1. User opens the popup and adds a custom tag → popup's store `setState` → `browser.storage.local['timer-focus-store']` now contains the tag.
2. The background service worker has been alive since before that; its in-memory `blocklist.customTags` is still `[]`.
3. The background handles any event that writes state (e.g. a future `TIMER_TICK` / city growth in M2).
4. Its `setItem()` persists its own stale snapshot → **the tag the user just added is silently erased.**

The symmetric case (background writes, popup's UI stays stale until reopened) is also unsynchronized.

**Suggested fix**
Reconcile contexts on external storage changes. Because `persist`'s internal `hydrate()` re-applies
via the *raw* store `set` (not the persisting wrapper — see `persistImpl`), rehydrating from an
`onChanged` handler does **not** cause a write storm/loop:

```ts
// store/index.ts (after useAppStore is created)
if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORE_NAME]) {
      void useAppStore.persist.rehydrate();
    }
  });
}
```

Longer term this should align with roadmap M1.T6/M1.T7 (typed message bus + "background is the
single writer"): pick **one** owner of each slice and have other contexts read via messages, rather
than letting multiple contexts write the same key.

> **Caveat (fair to the design):** the roadmap explicitly states the three "worlds" communicate
> "only via the persisted store and typed messages" (§1.1 line 47, §1.3). So *some* non-shared-memory
> design is intended. However, the roadmap never specifies a live cross-context reconciliation
> mechanism, and the message bus that would provide it is not implemented. The gap between intent and
> code is real and will bite the first time two contexts both use the store. Today it is **latent**:
> no context imports `@/store` yet (see NV-2).

---

### CI-2 — No `migrate` and only a shallow default `merge`: future state-shape changes silently corrupt or drop data

**Roadmap status: not covered by any scheduled task.**
No roadmap task introduces a `migrate`/`merge`. Adding new *slices* is compiler-forced into
`partialize` (see NI-2), but that is schema-source sync, **not** a data-migration path — it does not
protect already-persisted users when a slice's shape changes. Since the extension is unreleased
(`version: 1`, no users), this is a **forward-looking** risk, cheap to fix now and expensive later.
Do not treat it as "something a later task will handle" — nothing does.

**Evidence**
- `store/index.ts:62-70` — the `persist` options are `{ name, storage, partialize, version: 1 }`.
  There is **no `migrate` and no `merge`**.
- zustand `persistImpl` (`node_modules/zustand/esm/middleware.mjs`):
  - Default merge is **top-level shallow**: `merge: (persistedState, currentState) => ({ ...currentState, ...persistedState })`.
  - On version mismatch with no `migrate`: it logs
    `console.error("State loaded from storage couldn't be migrated since no migrate function was provided")`,
    then the promise resolves to `undefined`, which the next `.then` destructures
    (`const [migrated, migratedState] = migrationResult;`) → throws → caught by `.catch` →
    persisted state is **discarded** and the store keeps defaults.

**Why it is a problem**
- **Bumping `version` without `migrate`** = every existing user's persisted `timer`/`city`/`blocklist`/`score`
  is thrown away, reverting to defaults (the only diagnostic is a single `console.error`).
- **Changing a slice's shape without bumping `version`** is worse because it is silent: the default
  `merge` replaces the *entire* persisted slice object over the fresh default slice. So if e.g.
  `timer` gains a new field, a user with old persisted data gets that field `undefined` (the persisted
  `timer` object, lacking the key, wins wholesale over the fresh one). Same for `city.layers`,
  `score`, etc.

**Concrete failure scenario**
Session M2 adds `timer.distractionSeconds`. Release ships **without** bumping `version`. A user who
already has `{"timer":{"status":"idle","remainingSeconds":1500,...}}` persisted rehydrates; the new
`timer` object is the persisted one (no `distractionSeconds`), so any `score`/UI code reading it gets
`undefined` instead of `0`. Or: ship v2 and bump `version: 2` with no `migrate` → the whole persisted
state is dropped and the user loses their blocklist.

**Suggested fix**
Add a versioned migration path and a slice-aware merge now, while there are no users yet:

```ts
// store/index.ts
persist(createAppState, {
  name: STORE_NAME,
  storage: createJSONStorage<PersistedState>(() => storage),
  partialize,
  version: 2,
  migrate: (persisted, from) => {
    // narrow `persisted` (unknown) and upgrade slice-by-slice; return PersistedState
    return migratePersistedState(persisted, from);
  },
  // deep-ish merge per slice so new fields keep their defaults
  merge: (persisted, current) => ({
    ...current,
    ...(persisted as Partial<PersistedState>),
    timer: { ...current.timer, ...(persisted as PersistedState)?.timer },
    city: { ...current.city, ...(persisted as PersistedState)?.city },
    blocklist: { ...current.blocklist, ...(persisted as PersistedState)?.blocklist },
    score: { ...current.score, ...(persisted as PersistedState)?.score },
  }),
})
```

> Note: this is not urgent *today* (unreleased, `version: 1`, no real users), but it is cheap to add
> before data exists and expensive to retrofit afterwards.

---

### CI-3 — `getItem` silently converts unexpected stored values to "absent" with no logging

**Roadmap status: likely addressed later by M4.T3 ("Error hardening and centralized logging").**
Reported now so it is not lost, and because M4.T3's scope (a logger + "no empty `catch {}` remains")
is the natural owner. Until then the behavior is silent. Not a currently-manifesting defect (no
consumers, and values written by this code are always strings).

**Evidence**
- `store/storage-adapter.ts:11-17`:
  ```ts
  async getItem(name) {
    const result = await browser.storage.local.get(name);
    const value = result[name];
    // Persisted values are JSON strings; anything else is treated as absent
    return typeof value === 'string' ? value : null;
  }
  ```
  Any non-string value returns `null` — the same signal as "key not found" — with **no log**. A
  corrupt/partial JSON *string* is not caught here either; it fails inside
  `createJSONStorage(...).getItem` (`JSON.parse`) and is swallowed by `persistImpl`'s `.catch`
  (which only calls `onRehydrateStorage` if one is provided — none is set, `store/index.ts:62-70`).

**Why it is a problem**
The project's own quality bar (roadmap §1.4 / memory) says errors at untrusted boundaries must be
"logged consistently, never silenced", and forbids empty/blanket `catch {}`. Here an unexpected
stored shape or a JSON parse failure degrades the store to defaults with zero diagnostic, so a data
loss bug in the field would be invisible.

**Concrete failure scenario**
A future refactor writes the store value as an object (or another script/older build writes a
non-string under `timer-focus-store`). On next startup `getItem` returns `null`, `persist` treats the
store as empty, and the user's configuration vanishes — with nothing in the console to explain why.

**Suggested fix**
Keep the defensive behavior (don't crash rehydration) but make it observable, and wire an
`onRehydrateStorage` callback to surface parse/rehydrate failures:

```ts
async getItem(name: string): Promise<string | null> {
  const result = await browser.storage.local.get(name);
  const value = result[name];
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    console.warn(`[store] unexpected non-string value for "${name}"; treating as absent`);
    return null;
  }
  return value;
}
```
plus an `onRehydrateStorage: () => (state, error) => { if (error) console.error('[store] rehydrate failed', error); }`
in the `persist` options.

---

## Needs verification

### NV-1 — Timer/alarm mechanics are simply not implemented yet (so "does it survive SW termination?" is unanswerable from the store)

Searched `store lib components entrypoints utils` for `setInterval | setTimeout | requestAnimationFrame | browser.alarms`:
**zero** matches. `store/timer.slice.ts` has **no actions** (`startTimer`/`pauseTimer`/`resetTimer`
do not exist yet), and `entrypoints/background.ts` is a one-line stub
(`console.log('Hello background!', ...)`). The roadmap places this in M2.T1/M2.T2 and M1.T5 (alarm
adapter) — changelog confirms M1.T5–M1.T7 are still *to do*.

**Open question:** not "is there a bug?" (there is no code to be buggy), but *when* the timer is
implemented, where will the countdown live? Roadmap §1.3/technical note require `browser.alarms`
(60s minimum tick) as the source of truth and a derived volatile UI countdown; the store as written
provides the volatile slot (`ui.liveRemainingSeconds`) but nothing schedules anything. Verify the
implementation actually uses `browser.alarms` and the "characters due = elapsed ÷ 2s
recompute-on-wake" rule rather than `setInterval`, which does not survive MV3 SW termination.

### NV-2 — No context actually uses the store yet

`grep` for store imports across `store lib components entrypoints tests utils` matches only
`lib/messaging/messages.types.ts` (type-only import of `SessionSummary`) and the two test files.
`components/` is empty apart from `city.types.ts` + `.gitkeep`; `entrypoints/popup/App.tsx` is still
the WXT starter component (counter demo). So CI-1 and CI-3 are **latent**: they will manifest the
moment the background or popup imports `@/store`.

**Open question:** is it intended that the background be the single writer (per roadmap M1.T7), with
other contexts communicating via messages? If so, CI-1's fix should be "message-based", not merely
`onChanged`-based. This is an architecture decision not visible in the code (and, per the Roadmap
coverage map, not resolved by any scheduled task).

### NV-3 — Is `partialize`'s coupling to a single volatile slice acceptable long-term?

`PersistedState = Omit<AppState, keyof UiSlice>` (`store/index.ts:29`) hard-codes the assumption that
**`ui` is the only volatile slice**. Adding a *second* transient slice requires editing `UiSlice`/
`PersistedState` (the compiler will force it — see NI-2). **Open question:** is a single volatile
slice the intended long-term model, or should the volatile set be modelled explicitly (e.g. a
`VOLATILE_KEYS` list) before more transient state (modals, hover, malus flag) arrives?

### NV-4 — Render performance cannot be assessed (no consumers)

The roadmap's concern (fine-grained selectors vs. whole-store subscription) has **no code to
evaluate**: no component imports the store or calls `useAppStore(...)`. The selectors exist
(`selectLiveRemainingSeconds` is fine-grained; `selectUi` on line 76 returns the whole `ui` object
and would re-render on any `ui` field change) but nothing consumes them yet. Re-check after M2.T3/M3.T4
add UI. Not a confirmed bug at this time.

---

## Not an issue

### NI-1 — `StateStorage<Promise<void>>` is meaningful, not a no-op (hypothesis rejected)

`StateStorage` is imported correctly from `'zustand/middleware'` (re-exported from
`./middleware/persist`, verified in `node_modules/zustand/middleware.d.ts`). Its definition
(`node_modules/zustand/middleware/persist.d.ts`) is:

```ts
export interface StateStorage<R = unknown> {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => R;
  removeItem: (name: string) => R;
}
```

`R` is the **return type of `setItem`/`removeItem`**. `StateStorage<Promise<void>>`
(`storage-adapter.ts:7`) therefore correctly types the adapter's async writers as returning
`Promise<void>`, matching the implementations (`async setItem`/`async removeItem`). It is a real,
correctly-used type argument. (`createJSONStorage` discards `R`, returning
`PersistStorage<S, unknown> | undefined`, but that is compatible with `PersistOptions.storage`, which
allows `undefined` — no error, confirmed by clean `tsc`.)

### NI-2 — `partialize`/`PersistedState` DO have a compiler safety net (hypothesis rejected)

The hypothesis — "adding a new slice requires remembering to update both manually with no compiler
safety net" — is **not** what the code does. `PersistedState = Omit<AppState, keyof UiSlice>` is
**derived** from `AppState`, and `partialize`'s declared return type is `PersistedState`
(`store/index.ts:47`). If a new slice is added to `AppState`:
- forgetting it in `createAppState` → the object literal no longer satisfies
  `StateCreator<AppState, [], []>` (its `U` defaults to the full `AppState`) → compile error;
- forgetting it in `partialize` → the literal is now missing a required `PersistedState` key →
  compile error.

New *fields* added to an existing slice flow through automatically because `partialize` returns the
whole slice object (`state.timer` etc.). Adding a *second volatile* slice would be forced through
`UiSlice`/`PersistedState` (see NV-3). Net: the sync is compiler-enforced, not "manual and unsafe".

### NI-3 — `StateCreator<AppState, [], []>` mutator array: no current type error

`createAppState` is declared `StateCreator<AppState, [], []>` (`store/index.ts:39`), which matches
the M1.T4 spec. The recommended `["zustand/persist", PersistedState]` mutator only matters when a
creator needs persist-augmented `set`/`get` **inside** it. Here:
- the single `persist(...)` result already carries the mutator, so `create<AppState>()(...)` yields a
  store whose `.persist` API is present — the tests call `store.persist.rehydrate()`, and `tsc` is
  clean (exit 0);
- slices are typed `StateCreator<AppState, [], [], XSlice>` and currently do **not** use `set`/`get`
  (stubs), and none reference `persist`.

No `any`/`unknown` leaks were found, and `bun run compile` is clean. This is a stylistic deviation
from the "recommended" pattern, not a defect at present. (Worth revisiting when M2 adds slice
actions, purely for consistency.)

### NI-4 — Persisted/volatile separation works and is tested

`partialize` returns only `timer`/`city`/`blocklist`/`score`; the payload test asserts `ui` is absent
from stored JSON. `tests/integration/store/store.test.ts` covers: defaults for every slice, `partialize`
dropping `ui`, a persisted field surviving a simulated "restart", and a volatile field resetting to
default. Given CI-1 (no live sync), this "restart" only models a context that is recreated, which is
correct for what the test claims.

### NI-5 — `browser` import is test-safe

`storage-adapter.ts:1` imports `{ browser } from 'wxt/browser'` rather than using a global. Under
`WxtVitest()` this resolves to `fakeBrowser`, which is why `storage-adapter.test.ts` and `store.test.ts`
exercise real `storage.local` behavior. This is handled correctly.

---

## Quick reference (file → key lines)

| File | Line(s) | Relevance |
|---|---|---|
| `store/index.ts` | 39 | `StateCreator<AppState, [], []>` (NI-3) |
| `store/index.ts` | 47-52 | `partialize` (NI-2, CI-2) |
| `store/index.ts` | 62-70 | `persist` options: `version: 1`, **no `migrate`/`merge`** (CI-2) |
| `store/index.ts` | 73-74 | module-scope `useAppStore` "shared" across contexts (CI-1) |
| `store/index.ts` | 76 | `selectUi` coarse selector (NV-4) |
| `store/storage-adapter.ts` | 11-17 | `getItem` silent `null` fallback (CI-3) |
| `store/storage-adapter.ts` | 7 | `StateStorage<Promise<void>>` (NI-1) |
| `entrypoints/background.ts` | 1-3 | stub; no store import yet (NV-2) |
| `entrypoints/popup/App.tsx` | all | WXT starter; no store usage (NV-2, NV-4) |
| `lib/messaging/messages.types.ts` | all | types only; no bus exists (CI-1) |
