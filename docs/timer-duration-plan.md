# Implementation Plan — User-selectable focus duration with duration-neutral city growth

- **Status**: **implemented** (see `docs/changelog.md` → I005); the three open decisions in §11 are resolved below
- **Type**: post-roadmap feature
- **Scope**: timer duration selection (presets) + scaling of the growth and malus cadence to the chosen duration
- **Baseline at writing**: `bun run test` → 615 passing / 69 files; `bun run compile` clean; `bun run lint` clean
- **Result**: `bun run test` → 642 passing / 70 files; `bun run compile` clean; `bun run lint` clean
- **Related docs**: `docs/roadmap-en.md` (M2.T1, M2.T10, M2.T12, M2.T15, M2.T16, M2.T18, M3.T3b), `docs/Increase-poppu-screen-size.md` (grid capacity), `docs/store-analysis.md` (CI-2 persistence/migration)
- **Related issues**: I001 (countdown estimate), I003 (60 × 20 grid + growth floor), I004 (population counter), I005 (this feature)

---

## 1. Goal

Today the focus session is hard-coded to 25 minutes (`DEFAULT_FOCUS_SECONDS = 25 * 60`, `store/timer.slice.ts:9`) and cannot be changed. This feature:

1. Lets the user **choose a session length** from a fixed set of presets.
2. Makes the city/population **grow faster for short sessions and slower for long sessions**, so the *pace* tracks the chosen duration.
3. Keeps the reward **duration-neutral**: every preset yields the same total number of characters and the same total population — there is no larger grid to fill, so a longer session buys patience, not a bigger payoff.
4. Scales the **malus at the same pace as growth**, so a distraction costs the same *in characters* regardless of the preset.
5. Puts the whole "preset → cadence" rule in **one centralized object**, so adding a preset is a single-line edit.

### Confirmed product decisions (from the requester)

| # | Decision |
|---|---|
| D1 | Reward is **duration-neutral** — every preset produces the same total city/population. |
| D2 | Growth is computed from **cumulative `focusedMs`** (option a), not from per-tick deltas. |
| D3 | The **malus cadence scales with the session tick** too; rewards and maluses run at the same pace. |
| D4 | The rule changes **pace only**, never the final city size. |
| D5 | Presets are **fixed**: 5, 10, 20, 30, 45, 60, 90, 120 minutes. |
| D6 | Preset and cadence live in **one centralized object**; adding a choice touches one place. |

---

## 2. Current behaviour (as-is)

### 2.1 The 25-minute constant

| Location | Role |
|---|---|
| `store/timer.slice.ts:9` | `DEFAULT_FOCUS_SECONDS = 25 * 60` — the only session length. |
| `store/timer.slice.ts:77-85` | `initialTimerState.remainingSeconds = DEFAULT_FOCUS_SECONDS`. |
| `store/timer.slice.ts:128-148` | `startTimer` idle branch uses `timer.remainingSeconds` as the fresh-session length. |
| `store/timer.slice.ts:174-182` | `resetTimer` restores `{ ...initialTimerState }` → always back to 25 min. |
| `components/timer/TimerControls.tsx` | Start / Pause / Reset only — no duration control. |

### 2.2 The 2-second cadence (fixed, module-level constants)

| Constant | File | Meaning |
|---|---|---|
| `GROWTH_TICK_MS = 2000` | `lib/city/growth-engine.ts:24` | One character per 2 s of undistracted focus. |
| `MALUS_TICK_MS = 2000` | `lib/score/apply-malus.ts:7` | One character removed per 2 s on a blocked site. |
| `POPULATION_PER_TICK = 5` | `lib/score/calculate-population.ts:9` | +5 population per completed 2 s focus tick (−5 per distraction tick). |
| `TICK_INTERVAL_MS = GROWTH_TICK_MS` | `lib/timer/tick-emitter.ts:13` | The popup's `TIMER_TICK` **sampling** interval (also 2 s). |

### 2.3 How growth is computed today

```
popup  --TIMER_TICK every 2s-->  background.createGrowthTick
                                     |
                                     | elapsed = now - lastGrowthAt        (running only)
                                     | focusedMs += elapsed                (persisted)
                                     v
                          citySlice.growCity(elapsedMs)
                                     |
                          growCity(layers, elapsedMs, seed)
                                     |
                          ticks = floor(elapsedMs / GROWTH_TICK_MS)   <-- one char per tick
```

`calculatePopulation(focusedMs, distractedMs)` divides the *same* `GROWTH_TICK_MS`, so city and population already share one cadence. That is the hook this feature generalizes.

### 2.4 Known consequences already documented

- **Growth only runs while the popup is open** (`components/timer/use-timer-tick-emitter.ts:12-17`): MV3 cannot wake the service worker faster than 60 s, so the 2 s tick lives in the popup. Unchanged by this feature.
- **The grid saturates before the session ends** (`docs/Increase-poppu-screen-size.md`): at 60 × 20 the measured capacity is ≈ **452 characters**, reached at ≈ 15.1 min of the current 25 min session. See §11.
- **`persist` has no `merge`/`migrate`** (`store/index.ts:177-182`; `docs/store-analysis.md` CI-2): adding a field to `timer` silently yields `undefined` for existing persisted data unless handled. See §5.2.

---

## 3. The centralized object (single edit point)

Create **`lib/timer/focus-presets.ts`**. This is the one file that encodes the entire rule "duration → pace".

```ts
/**
 * Total characters a session is worth, regardless of preset (D1/D4: the reward
 * is duration-neutral). Every preset earns exactly this many growth ticks, so a
 * longer session builds the same city more slowly.
 */
export const TOTAL_CHARACTERS_PER_SESSION = 600;

/**
 * The single source of truth for the selectable durations (D5). Adding a
 * preset is a one-line edit here: the cadence, the UI options and the
 * validation all derive from this array.
 */
export const PRESET_MINUTES = [5, 10, 20, 30, 45, 60, 90, 120] as const;

export interface FocusPreset {
  /** User-facing length in whole minutes. */
  readonly minutes: number;
  /** Length in seconds (the persisted timer value). */
  readonly durationSeconds: number;
  /** Growth AND malus cadence for this preset, in ms (D3). */
  readonly tickMs: number;
}

/**
 * Cadence for a preset: one tick per `TOTAL_CHARACTERS_PER_SESSION`, so the
 * total is constant. `minutes * 60_000 / TOTAL` is the whole rule.
 */
function tickMsFor(minutes: number): number {
  return Math.round((minutes * 60_000) / TOTAL_CHARACTERS_PER_SESSION);
}

export const FOCUS_PRESETS: ReadonlyArray<FocusPreset> = PRESET_MINUTES.map(
  (minutes) => ({ minutes, durationSeconds: minutes * 60, tickMs: tickMsFor(minutes) }),
);

/** Preset a fresh install starts on. See §11 "open decision 2". */
export const DEFAULT_FOCUS_PRESET: FocusPreset =
  FOCUS_PRESETS.find((p) => p.minutes === 20) ?? FOCUS_PRESETS[0]!;

export function findPresetByDurationSeconds(seconds: number): FocusPreset | undefined {
  return FOCUS_PRESETS.find((p) => p.durationSeconds === seconds);
}

/**
 * Session cadence for a persisted `durationSeconds`. Total/defensive: an unknown
 * value (corrupt storage, manual edit) degrades to the default preset rather
 * than producing NaN (§1.4).
 */
export function tickMsForDurationSeconds(seconds: number): number {
  return (findPresetByDurationSeconds(seconds) ?? DEFAULT_FOCUS_PRESET).tickMs;
}

/** Whether a value is one of the offered presets (untrusted-input guard). */
export function isPresetDurationSeconds(seconds: number): boolean {
  return findPresetByDurationSeconds(seconds) !== undefined;
}
```

### 3.1 The resulting mapping (with `TOTAL_CHARACTERS_PER_SESSION = 600`)

| Preset | `durationSeconds` | `tickMs` | Ticks = chars | Population (`×5`) |
|---|---|---|---|---|
| 5 min | 300 | 500 | 600 | 3000 |
| 10 min | 600 | 1 000 | 600 | 3000 |
| 20 min | 1 200 | 2 000 | 600 | 3000 |
| 30 min (default) | 1 800 | 3 000 | 600 | 3000 |
| 45 min | 2 700 | 4 500 | 600 | 3000 |
| 60 min | 3 600 | 6 000 | 600 | 3000 |
| 90 min | 5 400 | 9 000 | 600 | 3000 |
| 120 min | 7 200 | 12 000 | 600 | 3000 |

This matches the requester's example exactly (10 min → 1 s, 20 min → 2 s). 30 min is the default (§11.2). See §11 for the capacity caveat and the resolved `TOTAL` choice.

### 3.2 Why this is "one edit point"

To add, say, a 15-minute preset, append `15` to `PRESET_MINUTES`. Everything else follows automatically:

- `FOCUS_PRESETS` gains the entry with the derived `tickMs`.
- The duration picker (§8) maps over `FOCUS_PRESETS`, so a button appears.
- Validation (`isPresetDurationSeconds`) accepts it.
- Labels are generated (`'$1 min'`), so **no i18n edit** is required.
- A unit test (§12) fails if the new entry breaks duration-neutrality.

---

## 4. The cadence rule in one sentence

> One character (and one population step) per `durationSeconds × 1000 / TOTAL_CHARACTERS_PER_SESSION` ms of undistracted focus; the malus removes one character per the same interval of distraction.

Both the background growth wiring and the malus wiring consume the *same* `tickMs`, read from the session's persisted `durationSeconds`.

---

## 5. Data model changes

### 5.1 Persisted `TimerState` gains a duration field

`store/store.types.ts` — add to `TimerState`:

```ts
/**
 * Currently selected session length in seconds. `remainingSeconds` is the live
 * countdown; this is the length a fresh start/reset returns to, and the value
 * that keys the growth/malus cadence (lib/timer/focus-presets.ts). Persisted so
 * the choice survives a popup reopen and a service-worker restart.
 */
readonly durationSeconds: number;
```

`initialTimerState` (`store/timer.slice.ts:77-85`):

```ts
const initialTimerState: TimerState = {
  status: 'idle',
  durationSeconds: DEFAULT_FOCUS_PRESET.durationSeconds,
  remainingSeconds: DEFAULT_FOCUS_PRESET.durationSeconds,
  // ...unchanged
};
```

`DEFAULT_FOCUS_SECONDS` is replaced by `DEFAULT_FOCUS_PRESET.durationSeconds`. Keep the old export name only if tests require it, otherwise update the handful of references (`store/index.ts`, `tests/**` — see §13).

### 5.2 Migration / rehydration (CI-2 — must not be skipped)

`persist` currently has no `merge` (`store/index.ts:177-182`). The default merge is **top-level shallow**, so a persisted `timer` object written before this feature (no `durationSeconds`) replaces the fresh `timer` wholesale and yields `undefined`. Add a slice-aware `merge`:

```ts
persist(createAppState(dependencies), {
  name: STORE_NAME,
  storage: createJSONStorage<PersistedState>(() => storage),
  partialize,
  version: 1,                 // kept: `merge` alone handles the added field
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<PersistedState>;
    return {
      ...current,
      ...saved,
      // Deep-merge only the slices that were persisted, so newly added fields
      // keep their defaults...
      timer: saved.timer ? { ...current.timer, ...saved.timer } : current.timer,
      city: saved.city ? { ...current.city, ...saved.city } : current.city,
      blocklist: saved.blocklist ? { ...current.blocklist, ...saved.blocklist } : current.blocklist,
      score: saved.score ? { ...current.score, ...saved.score } : current.score,
      sessionHistory: saved.sessionHistory ? { ...current.sessionHistory, ...saved.sessionHistory } : current.sessionHistory,
    };
  },
});
```

- With `merge`, **no `migrate` is required** for the added field; bumping `version` without `migrate` would otherwise wipe persisted state (`docs/store-analysis.md` CI-2), while bumping `version` *with* a no-op `migrate` makes zustand write the upgraded payload back on every read of an old snapshot. **Implemented: keep `version: 1` and rely on `merge`** — it alone fixes the `undefined` field with no migration write-back (and the existing "no echo/loop" storage test stays green). A future *shape* change that genuinely needs a transform can add `migrate` then.
- A slice that was **not** persisted must keep its *current reference* (`saved.x ? … : current.x`). Rebuilding every slice on each hydration churns references the app already observes (`selectCity`-style identity checks) and can clobber state written between store creation and the async hydration completing — the naive `{ ...current.x, ...undefined }` version breaks `tests/unit/store/city-slice.test.ts`'s reference-equality assertion.
- Defensive belt-and-braces: `tickMsForDurationSeconds` already falls back to the default preset for an unknown value (§3), so even an unmigrated `undefined` cannot produce `NaN`.

### 5.3 Slice actions

`store/timer.slice.ts`:

```ts
/** Change the session length. Only legal outside a session (idle/completed). */
setFocusDuration(durationSeconds: number): void;
/** Ask the background (the owner) to change the session length (read-only popup). */
requestSetDuration(durationSeconds: number): void;
```

```ts
setFocusDuration(durationSeconds: number): void {
  const { timer } = get();
  // Changing the length mid-run would desync `endsAt`, the pending alarm and the
  // cadence: it is a no-op outside idle/completed (§1.4 defensive boundary).
  if (timer.status === 'running' || timer.status === 'paused') return;
  if (!isPresetDurationSeconds(durationSeconds)) return;
  if (timer.durationSeconds === durationSeconds) return;
  set({
    timer: {
      ...timer,
      durationSeconds,
      remainingSeconds: durationSeconds, // idle display follows the choice
    },
  });
}

requestSetDuration(durationSeconds: number): void {
  sendMutation?.({ type: 'TIMER_SET_DURATION', payload: { durationSeconds } });
}
```

`startTimer` (idle branch) and `resetTimer` continue to use `timer.remainingSeconds`, but:

- `resetTimer` must reset to the **selected** duration, not a constant:

```ts
async resetTimer(): Promise<void> {
  const { sessionId, durationSeconds } = get().timer;
  set({
    timer: { ...initialTimerState, durationSeconds, remainingSeconds: durationSeconds },
  });
  if (sessionId !== null) await alarmProvider.clear(timerAlarmName(sessionId));
}
```

- On a fresh start, `remainingSeconds` already equals `durationSeconds` (set by `setFocusDuration`), so the idle branch needs no change beyond keeping `durationSeconds` in the written object.

---

## 6. Growth: cumulative-target cadence (option a, D2)

### 6.1 Why the current approach breaks under a variable tick

`createGrowthTick` (`entrypoints/background.ts:122-187`) passes the **per-tick elapsed** (~2 s) to `growCity`, which floors `elapsed / GROWTH_TICK_MS`. That only works because the sampling interval equals the tick (both 2 s). With a session tick **longer than the sampling interval** (e.g. 6 s for the 60-min preset), every 2 s sample floors `2000 / 6000 = 0` and the city **never grows**. Option (a) fixes this by deriving the *target* from the cumulative, persisted `focusedMs` and carrying the remainder for free:

```
targetTicks = floor(focusedMs / tickMs)      // monotonic, restart-safe
pending     = targetTicks - appliedTicks     // appliedTicks is a closure baseline
```

Because `focusedMs` is persisted and monotonic within a session, and the city is persisted alongside it, initializing `appliedTicks = floor(persistedFocusedMs / tickMs)` at wiring creation guarantees a worker restart **cannot replay** the session (preserves the M2.T15 invariant).

### 6.2 Engine refactor: make ticks the unit

`lib/city/growth-engine.ts`:

- Extract the current growth loop into the primitive:

```ts
export function growCityByTicks(layers: CityLayers, ticks: number, seed = 0): CityLayers;
```

- Keep the elapsed-based entry point as a thin wrapper so existing tests and any elapsed callers keep working:

```ts
export function growCity(layers: CityLayers, elapsedMs: number, seed = 0): CityLayers {
  return growCityByTicks(layers, ticksFor(elapsedMs), seed);
}
```

- `GROWTH_TICK_MS` becomes only the default used by the elapsed wrapper; the *session* tick is passed in by the caller.
- The DI type (`store/city.slice.ts:32-36`) becomes ticks-based:

```ts
export type CityGrowthEngine = (layers: CityLayers, ticks: number, seed: number) => CityLayers;
export const identityGrowthEngine: CityGrowthEngine = (layers) => layers;
```

- `store/index.ts:90` injects `growthEngine: growCityByTicks`.
- `store/city.slice.ts` action: replace `growCity(elapsedMs)` with `growCityByTicks(ticks: number)` (delegates, identity-checked write).

### 6.3 The rewritten growth wiring

`entrypoints/background.ts` `createGrowthTick`:

```ts
const sessionTickMs = (): number =>
  tickMsForDurationSeconds(store.getState().timer.durationSeconds);

let appliedTicks = Math.floor(
  store.getState().timer.focusedMs / sessionTickMs(),
);

// New session: focusedMs resets to 0 → applied baseline resets too.
store.subscribe(() => {
  /* on sessionId change */ appliedTicks = 0;
});

const handleTick = (): void => {
  const { timer } = store.getState();
  if (timer.status !== 'running') { lastGrowthAt = null; return; }

  const current = now();
  const elapsed = current - (lastGrowthAt ?? current);
  lastGrowthAt = current;
  if (elapsed <= 0) return;

  const distracted = isDistracted();
  const focusedMs = distracted ? timer.focusedMs : timer.focusedMs + elapsed;
  const distractedMs = distracted ? timer.distractedMs + elapsed : timer.distractedMs;
  if (distracted) store.getState().recordDistractedMs(distractedMs);
  else store.getState().recordFocusedMs(focusedMs);

  const tickMs = sessionTickMs();
  const targetTicks = Math.floor(focusedMs / tickMs);
  if (targetTicks > appliedTicks) {
    store.getState().growCityByTicks(targetTicks - appliedTicks);
    appliedTicks = targetTicks;
  }

  const population = calculatePopulation(focusedMs, distractedMs, tickMs);
  if (population !== store.getState().score.population) {
    store.getState().setPopulation(population);
  }
};
```

**Invariants preserved**: one character per tick; layer rotation by global tick index (the engine still computes `placedBefore` from the grid); paused/idle time never counted; restart never replays.

---

## 7. Malus: same pace as growth (D3)

### 7.1 Change the tracker's unit from "ticks" to "weighted tab-ms"

The tracker (`lib/timer/tab-distraction-tracker.ts`) currently converts accumulated ms to **2 s ticks** internally (`getTicks`, `tickMs = MALUS_TICK_MS`). To scale the cadence per session, expose the raw **weighted accumulated time** and let the malus wiring do the conversion:

```ts
export interface TabDistractionTracker {
  readonly ready: Promise<void>;
  /** Weighted blocked-tab time accumulated so far, in ms (N open tabs → N× elapsed). */
  getAccumulatedMs(): number;
  isDistracted(): boolean;
  dispose(): void;
}
```

- Remove the `tickMs` dependency and the `MALUS_TICK_MS` import (the tracker no longer needs to know a cadence).
- Keep the multi-tab weighting (`accumulatedMs += elapsedMs * openBlockedTabs.size`) — it is what makes N open blocked tabs cost N× (M2.T10).

### 7.2 Rewrite the malus wiring

`entrypoints/background.ts` `createMalusWiring` — the number of ticks is now derived from the tracker's accumulated ms and the session tick:

```ts
let baselineMsAtProceed = 0;  // replaces baselineTicks

handleAttempt(message) {
  // ...unchanged guards...
  active = true;
  domain = message.payload.domain;
  baselineMsAtProceed = tracker.getAccumulatedMs(); // pre-proceed time forgiven (M2.T10)
  applied = 0;
  pump();
}

const pump = (): void => {
  if (!active) return;
  const tickMs = tickMsForDurationSeconds(store.getState().timer.durationSeconds);
  const elapsedTabMs = tracker.getAccumulatedMs() - baselineMsAtProceed;
  const elapsedTicks = Math.max(0, Math.floor(elapsedTabMs / tickMs));
  const expected = 1 + malusForDistractionTicks(elapsedTicks); // +1 = the "proceed" char
  const pending = expected - applied;
  if (pending <= 0) return;
  // ...unchanged apply + MALUS_APPLIED reporting...
};
```

- `malusForDistractionTicks` and `applyMalus` are **unchanged** — the escalation schedule is expressed in ticks, so it stays duration-neutral in *character* terms (a fixed number of ticks is a fixed number of characters), which is exactly D3/D4. No change to `lib/score/apply-malus.ts`.
- The session-tick change is the only difference: a 10-min preset removes one char per 1 s, a 60-min preset per 6 s. Distraction costs the same characters per tick at every preset.

> **Note on the two distraction measures.** The population penalty uses `timer.distractedMs` (a boolean "some blocked tab is open" measure, `entrypoints/background.ts:159-167`), while the malus uses the tracker's multi-tab-weighted ms. That split is **pre-existing** and is preserved here deliberately; unifying them is out of scope.

---

## 8. Population: pass the session tick

`lib/score/calculate-population.ts`:

```ts
export function calculatePopulation(
  focusedMs: number,
  distractedMs = 0,
  tickMs: number,            // NEW, required: the session cadence
): number {
  const focusTicks = Math.floor(normalizeFocusedMs(focusedMs) / tickMs);
  const distractionTicks = Math.floor(normalizeFocusedMs(distractedMs) / tickMs);
  return Math.max(0, focusTicks - distractionTicks) * POPULATION_PER_TICK;
}
```

- Remove the `GROWTH_TICK_MS` import; the cadence is now a parameter.
- Callers to update:
  - `entrypoints/background.ts:175` (growth tick) → pass the session `tickMs` (already computed).
  - `entrypoints/background.ts:246` (session completion) → `tickMsForDurationSeconds(timer.durationSeconds)`.
- Duration-neutral by construction: total ticks = `TOTAL_CHARACTERS_PER_SESSION`, so total population = `TOTAL × 5` for every preset.

---

## 9. Sampling vs. cadence: decouple the tick emitter

`lib/timer/tick-emitter.ts` currently sets `TICK_INTERVAL_MS = GROWTH_TICK_MS` (2 s). With a session tick that can be 500 ms (5 min) or 12 s (120 min), the sampling interval must be **independent** of the cadence (D2 makes correctness independent of sampling; it only affects smoothness/latency):

```ts
/**
 * Fixed sampling interval for the popup's TIMER_TICK. It is NOT the growth
 * cadence (that is per-session, lib/timer/focus-presets.ts): with target-based
 * growth it only bounds how promptly a due character appears.
 */
export const SAMPLE_INTERVAL_MS = 1_000;
export const TICK_INTERVAL_MS = SAMPLE_INTERVAL_MS; // keep the existing name if preferred
```

- Remove the `GROWTH_TICK_MS` import.
- Trade-off: 1 s gives ≤2 characters of visual lag even on the 5-min preset; 2 s is cheaper but jumps up to 4 characters. **Recommendation: 1 s.**
- The emitter stays a dumb clock; the background ignores ticks outside `running`.

---

## 10. Cross-context plumbing (popup is read-only, M1.T9)

### 10.1 Message type

`lib/messaging/messages.types.ts`:

```ts
// Timer duration (new). The popup is read-only (M1.T9), so it requests the
// change and the background — the timer's owner — validates and applies it.
interface TimerSetDurationMessage {
  readonly type: 'TIMER_SET_DURATION';
  readonly payload: { readonly durationSeconds: number };
}
```

- Add `TimerSetDurationMessage` to the `RuntimeMessage` union.
- Add `'TIMER_SET_DURATION'` to `MUTATION_TYPES` (`messages.types.ts:133-144`) so the background routes it through the mutation handler.

### 10.2 Mutation handler

`lib/messaging/apply-mutation.ts` — add a case next to the timer commands:

```ts
case 'TIMER_SET_DURATION': {
  const { durationSeconds } = message.payload;
  // Untrusted payload (M5.T1): whole number AND one of the offered presets.
  if (!Number.isInteger(durationSeconds) || !isPresetDurationSeconds(durationSeconds)) return;
  store.getState().setFocusDuration(durationSeconds);
  return;
}
```

- Uses the same `MUTATION_TYPES`-driven dispatch as `TIMER_STARTED`/`TIMER_PAUSED`/`TIMER_RESET`.

### 10.3 Request action

`store/timer.slice.ts` — `requestSetDuration` (§5.3) sends the mutation; the popup never writes the persisted field directly (single-writer, M1.T9), and converges through the M1.T8 sync bridge like every other timer command.

---

## 11. Capacity interaction and decisions (resolved)

### 11.1 The grid saturates before the session ends

`docs/Increase-poppu-screen-size.md` measured **≈ 452 characters** at 60 × 20 (seed-dependent). Re-measured for this feature across 9 seeds (0, 1, 7, 42, 999, 12345, 777, 2024, 31337), the grid holds **439–561 characters** (mean ≈ 505). With `TOTAL_CHARACTERS_PER_SESSION = 600`:

- Every preset saturates at 439–561 characters, i.e. at **~73–94 % of the session** (mean ≈ 84 %) — the city freezes for the last stretch at *every* preset.
- The final size is identical for all presets (they all saturate), so D1/D4 still hold; it is only the *freeze point* that moves. The old fixed 25-min default saturated at ~452 / 750 = 60 %, so this is a mild change, not a new behaviour.

**Decision 1 — `TOTAL_CHARACTERS_PER_SESSION` = `600`** (requester's choice). It honours their example exactly (10 min → 1 s, 20 min → 2 s) and keeps round cadence numbers; the pre-existing "last stretch is frozen" behaviour is accepted (the alternative, ≈ 505, would only shift the freeze point). It remains a **one-constant change** (§3).

### 11.2 Default preset

**Decision 2 — default preset = `30 min`** (requester's choice; replaces the old 25 min). It sits in the middle of the list and yields `tickMs = 3000`. One-line change (`DEFAULT_FOCUS_MINUTES` in `lib/timer/focus-presets.ts`).

### 11.3 Changing duration mid-session

**Decision 3 — allowed only while `idle` or `completed`** (§5.3). Changing the length while `running`/`paused` would desync `endsAt`, the pending alarm and the cadence; the store ignores it and the picker is disabled. If a mid-pause change is ever wanted, it must re-arm the alarm and recompute `remainingSeconds`.

---

## 12. UI

### 12.1 New component — `components/timer/DurationPicker.tsx`

- Reads `FOCUS_PRESETS` (the centralized object) and renders one button per preset; the label is generated (`i18n.t('timer.durationOption', [minutes])`), so **no i18n edit when a preset is added**.
- Selected state = `useAppStore(selectTimer).durationSeconds`.
- Disabled when `status === 'running' || status === 'paused'` (see §11.3).
- `onClick` → `useAppStore.getState().requestSetDuration(preset.durationSeconds)` (read-only popup path).
- Contains no logic beyond mapping the table to buttons (Separation of Concerns, §1.1).

### 12.2 Mount point

`entrypoints/popup/App.tsx` `TimerSection` (`App.tsx:27-34`) — add `<DurationPicker />` above/below `TimerDisplay`.

### 12.3 i18n

`locales/en.yml` and `locales/it.yml`:

```yaml
timer:
  durationLabel: Focus duration
  durationOption: '$1 min'
```

```yaml
timer:
  durationLabel: Durata della sessione
  durationOption: '$1 min'
```

(Confirm the Italian wording against the existing `it.yml` conventions.)

---

## 13. File-by-file change list

| File | Change |
|---|---|
| `lib/timer/focus-presets.ts` | **NEW** — the centralized preset → cadence object (§3). |
| `lib/city/growth-engine.ts` | Add `growCityByTicks`; make `growCity` a wrapper; `GROWTH_TICK_MS` becomes the elapsed-wrapper default. |
| `lib/score/calculate-population.ts` | `tickMs` parameter; drop `GROWTH_TICK_MS` import. |
| `lib/score/apply-malus.ts` | **Unchanged** (`malusForDistractionTicks`/`applyMalus`); possibly remove now-unused `MALUS_TICK_MS`. |
| `lib/timer/tab-distraction-tracker.ts` | Replace `getTicks()` with `getAccumulatedMs()`; drop `tickMs`/`MALUS_TICK_MS`. |
| `lib/timer/tick-emitter.ts` | Fixed `SAMPLE_INTERVAL_MS`; drop `GROWTH_TICK_MS` import. |
| `lib/timer/session.ts`, `alarm-adapter.ts`, `countdown.ts`, `restore-timer.ts` | **Unchanged.** |
| `store/store.types.ts` | `TimerState.durationSeconds`. |
| `store/timer.slice.ts` | `durationSeconds` in initial state; `setFocusDuration`; `requestSetDuration`; `resetTimer` resets to the selected duration; replace `DEFAULT_FOCUS_SECONDS`. |
| `store/city.slice.ts` | `CityGrowthEngine` becomes ticks-based; `growCityByTicks` action; default engine. |
| `store/index.ts` | Inject `growCityByTicks`; add the slice-aware `merge` (kept `version: 1`, no `migrate`); re-export new symbols. |
| `entrypoints/background.ts` | Cumulative-target growth wiring (§6.3); malus cadence from session tick (§7.2); population call sites (§8). |
| `lib/messaging/messages.types.ts` | `TimerSetDurationMessage`; add to `RuntimeMessage` and `MUTATION_TYPES`. |
| `lib/messaging/apply-mutation.ts` | `TIMER_SET_DURATION` case with preset validation. |
| `components/timer/DurationPicker.tsx` | **NEW** (§12.1). |
| `entrypoints/popup/App.tsx` | Mount `DurationPicker`. |
| `locales/en.yml`, `locales/it.yml` | `timer.durationLabel`, `timer.durationOption`. |
| `docs/timer-duration-plan.md` | This document. |
| `docs/changelog.md` | New post-roadmap feature entry (per `docs/changelog.md` rules). |

---

## 14. Test plan

### 14.1 New unit tests

| Test file | Assertions |
|---|---|
| `tests/unit/lib/timer/focus-presets.test.ts` (new) | Every preset is duration-neutral: `durationSeconds * 1000 / tickMs ≈ TOTAL` for all entries; `tickMs` increases monotonically with minutes; `isPresetDurationSeconds` accepts presets and rejects others; `tickMsForDurationSeconds` falls back to the default for unknown values; the mapping table equals the documented table (guards accidental edits). |
| `tests/unit/lib/city/growth-engine.test.ts` | `growCityByTicks(layers, n)` inserts exactly `n` characters (same invariants as `growCity`); `growCity(elapsed)` still equals `growCityByTicks(floor(elapsed / GROWTH_TICK_MS))`; same-reference at the cap. |
| `tests/unit/lib/score/calculate-population.test.ts` | Total population is identical across all presets (duration-neutral); `tickMs` scaling; non-finite/partial-tick behaviour preserved. |
| `tests/unit/lib/score/apply-malus.test.ts` | Unchanged behaviour (schedule still in ticks); add a case showing a longer `tickMs` yields fewer ticks for the same wall-clock ms (cadence scaling) at the wiring level. |
| `tests/unit/lib/timer/tab-distraction-tracker.test.ts` | `getAccumulatedMs()` returns weighted multi-tab ms; no cadence dependency. |
| `tests/unit/store/timer-slice.test.ts` | `setFocusDuration` sets `durationSeconds` + `remainingSeconds` on idle/completed and is a no-op while running/paused and for non-preset values; `requestSetDuration` emits `TIMER_SET_DURATION`; `resetTimer` returns to the **selected** duration, not 25 min; `startTimer` uses the selected duration. |
| `tests/unit/messaging/*` (timer-mutation-bus) | `TIMER_SET_DURATION` reaches `setFocusDuration`; a malformed/non-preset payload is rejected with no state write. |

### 14.2 Updated tests (behaviour changed deliberately)

- `tests/integration/background/growth-tick.test.ts` — replace per-tick elapsed expectations with cumulative-target expectations; add a case where the session tick **exceeds** the sampling interval and the city still grows (the regression that option (a) fixes); add a restart case proving no replay.
- `tests/integration/background/malus.test.ts` — malus tick count now derives from weighted ms ÷ session tick; verify one char per session tick.
- `tests/integration/background/session-completion.test.ts` — population uses the session tick.
- `tests/unit/components/timer/*` and `tests/integration/popup/app-composition.test.tsx` — replace `DEFAULT_FOCUS_SECONDS` with the default preset; add a `DurationPicker` interaction test (select a preset → `TIMER_SET_DURATION` → timer reflects it via the sync bridge).
- `tests/unit/i18n/locales.test.ts` — new keys present in every locale (this test likely enumerates keys).

### 14.3 Regression guards

1. **Duration-neutrality** — for every preset, `TOTAL` characters and `TOTAL × 5` population at session end (the acceptance criterion for D1).
2. **Monotone cadence** — `tickMs` strictly increases with preset minutes (D5).
3. **Slow-tick growth** — a session tick longer than the sampling interval still grows the city (the stall bug prevented).
4. **Restart safety** — a service-worker restart mid-session neither replays nor loses growth (M2.T15 invariant).
5. **Single edit point** — the preset test fails if `PRESET_MINUTES` and the derived table disagree.

---

## 15. Acceptance criteria

- [ ] The user can pick any of 5/10/20/30/45/60/90/120 minutes while the timer is not running; the choice persists and survives a popup reopen and a worker restart.
- [ ] Starting a session uses the selected duration; the countdown starts at it and the alarm is scheduled at `now + durationSeconds`.
- [ ] Short sessions grow the city/population faster than long sessions (cadence strictly increases with minutes).
- [ ] Every preset yields the **same** total characters and population (duration-neutral).
- [ ] A distraction costs characters at the same *pace* as growth for the chosen preset.
- [ ] Growth continues for the whole session even when the cadence is slower than the popup sampling interval.
- [ ] Adding a preset is a single-line edit (`PRESET_MINUTES`) with no other file touched.
- [ ] `bun run test`, `bun run compile`, `bun run lint`, `bun run build`, `bun run build:firefox` all pass.
- [ ] The changelog is updated per `docs/changelog.md`.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Persisted `timer` without `durationSeconds` → `undefined` cadence (CI-2) | Slice-aware `persist.merge` (kept `version: 1`); `tickMsForDurationSeconds` falls back to the default. |
| Slow cadence silently stalls growth | Cumulative-target design (§6) + a dedicated regression test. |
| Remainder loss at each sample | Derive `targetTicks` from cumulative `focusedMs`, never from the per-call delta. |
| Worker restart replays the session into the city | Initialize `appliedTicks` from persisted `focusedMs`; test it. |
| Malus severity drifts across presets | Keep the escalation schedule in **ticks** (fixed character count per tick), so it is duration-neutral. |
| Changing duration mid-run desyncs `endsAt`/alarm | `setFocusDuration` is a no-op outside idle/completed. |
| City saturates before session end | Resolved: `TOTAL = 600` is accepted (mean ≈ 84 % of the session; §11.1). |
| Untrusted `durationSeconds` from a forged message | `Number.isInteger` + `isPresetDurationSeconds` validation in the mutation handler. |
| A 5-min preset samples finer than the popup can render smoothly | Target-based growth makes cadence independent of sampling; 1 s sampling bounds the visual lag. |
| Existing tests assume 2 s cadence / 25 min | Update `growth-tick`, `malus`, `session-completion`, timer component and popup composition tests (§14.2). |

---

## 17. Work breakdown (suggested order)

1. **`lib/timer/focus-presets.ts` + its unit test** — the centralized object and the duration-neutrality guard. No consumers yet.
2. **Engine primitives** — `growCityByTicks`; `calculatePopulation(…, tickMs)`; tracker `getAccumulatedMs`; fixed `SAMPLE_INTERVAL_MS`. Update their unit tests.
3. **Store** — `TimerState.durationSeconds`; `setFocusDuration`/`requestSetDuration`; `resetTimer` fix; ticks-based `CityGrowthEngine`; `persist.merge`/`migrate`/`version`. Update store tests.
4. **Messaging** — `TIMER_SET_DURATION` in `RuntimeMessage`/`MUTATION_TYPES`/`apply-mutation`. Update messaging tests.
5. **Background wiring** — cumulative-target growth (§6.3); scaled malus (§7.2); population call sites. Update integration tests.
6. **UI + i18n** — `DurationPicker`; mount in `App.tsx`; `en.yml`/`it.yml`. Add the component and popup-composition tests.
7. **Validation** — `bun run test` → `bun run compile` → `bun run lint` → `bun run build` + `bun run build:firefox`; manual check in a real browser (pick each preset, confirm the cadence and that the city fills across the session).
8. **Docs** — changelog entry; resolve the open decisions (§11) and fold the chosen constants into this document.

---

## 18. Summary

The feature decomposes cleanly because the codebase already funnels both growth and population through a single cadence constant. The plan generalizes that constant into a **per-session tick derived from the persisted `durationSeconds`**, sourced from **one centralized preset table**, and switches growth from per-tick deltas to a **cumulative `focusedMs` target** so a slower-than-sampling cadence can never stall. The malus reads the same session tick, so destruction keeps pace with construction, and the whole reward stays duration-neutral — a shorter focus builds the same city, just faster.
