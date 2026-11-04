# Completion-based score and tiered population — code analysis

> Change request: **the session score and the population growth are both derived
> from the percentage of city characters built**, the score gains a fourth level
> (`great`), and the population grows faster in later bands with a completion
> bonus.
> Status: **proposed** (not implemented). File/line references describe the
> current tree (`main` @ `8bdbb57`).

## 1. Core idea

Today:

- the score level is a function of a **distraction ratio**
  (`calculateScore(distractionRatio)`: `0` → `excellent`, `≤ 0.3` → `good`,
  `> 0.3` → `bad`);
- the population is a flat `5 × (focus ticks − distraction ticks)`, max 3000.

After the change, a single quantity drives both: the **completion ratio**

```
builtCharacters = max(0, focusCharacters − distractionCharacters)
completion      = builtCharacters / TOTAL_CHARACTERS_PER_SESSION
```

`TOTAL_CHARACTERS_PER_SESSION` is 600 today (`lib/timer/focus-presets.ts:19`)
but may grow. **No rule may hard-code 600 or any population number**: every cutoff
is a percentage of the total and every derived number is computed from it.

### 1.1 The rules (agreed)

Bands are contiguous, half-open, and shared by the score and the population
growth rate:

| Completion | Score level | Population per character built in this band |
|---|---|---|
| `< 30%` | `bad` | 5 |
| `30%` to `< 70%` | `good` | 10 |
| `70%` to `< 100%` | `great` *(new)* | 20 |
| `= 100%` | `excellent` | — (no characters beyond 100%) + **completion bonus** |

- **Per-character (marginal) rate**: each character earns the rate of the band it
  is built in. Crossing a cutoff only changes the rate for the *next*
  characters; the population never jumps retroactively.
- **Distraction uses the net count**: a distraction character takes back the most
  recent character at its band's rate (in the `great` band it costs 20). The
  population never goes below 0. Reaching 100% therefore requires a full session
  with zero whole distraction ticks.
- **Completion bonus is proportional**: 7% of the population reached
  (the maximum before the bonus, 6900 today → 483). No fixed number: it scales
  with the total and the rates. Decided in §10, point 2.

### 1.2 Numbers today (`TOTAL_CHARACTERS_PER_SESSION = 600`)

Cutoffs in characters are `ceil(ratio × total)` (§4.1):

| Band | Characters (1-based) | Count | Rate | Population added | Population at end of band |
|---|---|---|---|---|---|
| `< 30%` | 1–180 | 180 | 5 | 900 | 900 |
| `30% – < 70%` | 181–420 | 240 | 10 | 2400 | 3300 |
| `70% – < 100%` | 421–600 | 180 | 20 | 3600 | 6900 |
| `= 100%` bonus | — | — | — | 483 (7% of 6900) | **7383** |

Score in characters: `bad` below 180, `good` from 180, `great` from 420,
`excellent` only at 600. The rate of character *k* is chosen by the completion
**before** it is built (`(k − 1) / total`), so the 180th character still earns 5
and the 181st earns 10.

### 1.3 Two structural facts

1. **The ratio path is dead in production.** `setDistractionRatio` is never
   called outside tests (its formula is still the roadmap §4 open point), so
   `score.level` stays at its initial `'excellent'` and every recorded
   `SessionSummary.score` is `'excellent'`. Removing it changes no observable
   behavior except fixing a constant badge.
2. **The inputs already exist.** `advanceProgress` and session completion
   already have `focusedMs`, `distractedMs` and `tickMs` (§3). Only the pure
   projection of those values changes, plus where the level is derived.

---

## 2. Reachability of 100% (must be guarded)

`excellent` and the bonus both require `builtCharacters === total` exactly, so
a perfect session **must** produce exactly `total` focus characters.

Today it does: `tickMs = round(minutes × 60_000 / 600) = minutes × 100`
(`focus-presets.ts`, `tickMsFor`) is an exact integer, accounting is capped at
`endsAt` (`lib/timer/session-progress.ts`), so a full session is exactly
`duration / tickMs = 600` ticks.

This **breaks silently if the total changes**, whenever `tickMs` is rounded
*up*. Example with total 700:

| Preset | `tickMs = round(durationMs / 700)` | Characters in a perfect session |
|---|---|---|
| 5 min | `round(428.57) = 429` | `floor(300_000 / 429) = 699` ✗ |
| 30 min | `round(2571.43) = 2571` | `floor(1_800_000 / 2571) = 700` ✓ |
| 60 min | `round(5142.86) = 5143` | `floor(3_600_000 / 5143) = 699` ✗ |
| 120 min | `round(10285.71) = 10286` | `floor(7_200_000 / 10286) = 699` ✗ |

For 5, 60 and 120 minutes `excellent` and the bonus would become unreachable,
with no failing test.

**Recommendation**: compute the character counts from the session duration, not
from the rounded `tickMs`:

```
focusCharacters       = min(total, floor(focusedMs      × total / durationMs))
distractionCharacters =            floor(distractedMs   × total / durationMs)
```

This is exact for any total and any preset (a full session gives
`durationMs × total / durationMs = total`). The city growth can keep its `tickMs`
cadence; the difference is at most one character, invisible on screen, and the
score is never affected by it. A unit test must assert "a perfect session of
every preset gives `builtCharacters === total`" for today's total **and** for a
couple of hypothetical totals (e.g. 700, 1000).

Related note: these are characters *earned* (ticks), not the characters
currently drawn on the grid. The grid can differ slightly (the malus removes
nothing from an empty city; the layout can saturate). Counting earned ticks keeps
the score deterministic and independent of rendering.

---

## 3. Where the values are produced

| Location | Role today | Change |
|---|---|---|
| `lib/score/calculate-population.ts:44` | `calculatePopulation(focusedMs, distractedMs, tickMs)` — flat 5/tick, clamped at 0 | becomes a tiered function of `builtCharacters` (§4.2) |
| `lib/timer/session-progress.ts:97` (`advanceProgress`) | projects the accumulators into `population` | projects them into `builtCharacters` (§4.3) |
| `entrypoints/background.ts:210` | growth tracker writes the **live** population via `setPopulation` | writes `builtCharacters` via the new slice action |
| `entrypoints/background.ts:293-298` | completion recomputes the final population, `setPopulation` | recomputes `builtCharacters`, same new action |
| `entrypoints/background.ts:301-308` | `SessionSummary` with `score: score.level`, `population` | unchanged: both are read after the final write |

Both writers go through one slice action, which is therefore the single place
where population and level are derived. The doc comments at
`background.ts:103-110` and `:270-272` (population cadence, `distractionRatio`
open point) must be rewritten.

---

## 4. Pure logic (`lib/`)

### 4.1 `lib/score/completion-bands.ts` (new) — one table for both rules

The score bands and the growth-rate bands have the same cutoffs, so they live in
one data table (DRY, Open/Closed §1.1: adding a band is one entry):

```ts
export const COMPLETION_BANDS = [
  { fromRatio: 0,   level: 'bad',       populationPerCharacter: 5 },
  { fromRatio: 0.3, level: 'good',      populationPerCharacter: 10 },
  { fromRatio: 0.7, level: 'great',     populationPerCharacter: 20 },
  { fromRatio: 1,   level: 'excellent', populationPerCharacter: 0 },
] as const;

export const COMPLETION_BONUS_SHARE = 0.07; // 7% of the population reached (§1.1)
```

Helpers (pure, total):

- `bandCutoffCharacters(fromRatio, total) = ceil(fromRatio × total)` — the first
  character count belonging to the band. `ceil` keeps "≥ 30%" exact when
  `30% × total` is not an integer (total 601 → 181, i.e. 30.12%).
- `calculateCompletion(builtCharacters, total)` → ratio clamped to `[0, 1]`.
- A table-validation test: ratios strictly ascending, starting at `0`, ending at
  exactly `1`; the `excellent` band adds no per-character rate.

### 4.2 `lib/score/calculate-population.ts`

`calculatePopulation(builtCharacters: number, total: number): number`

1. Normalize: non-finite/negative → 0, floor, clamp to `total`; invalid `total`
   (non-finite, ≤ 0) → 0.
2. For each band below `excellent`, add
   `rate × (characters of builtCharacters that fall in [cutoff, nextCutoff))`.
3. If `builtCharacters === total`, add
   `round(maxBeforeBonus(total) × COMPLETION_BONUS_SHARE)`, where
   `maxBeforeBonus` is step 2 evaluated at `total` (6900 today → bonus 483).

`POPULATION_PER_TICK` is removed. The `tickMs` parameter moves out (the
character counting is §4.3's job), so the function only owns "characters →
inhabitants".

### 4.3 Counting built characters

New pure `calculateBuiltCharacters(focusedMs, distractedMs, durationMs, total)`
(in `lib/score/`), implementing §2's formula:
`max(0, min(total, floor(focusedMs × total / durationMs)) − floor(distractedMs × total / durationMs))`,
with the same defensive clamps as today (`NaN` → 0, negatives → 0, invalid
`durationMs` → 0).

- `advanceProgress` (`lib/timer/session-progress.ts`) replaces
  `population` in `SessionProgress` with `builtCharacters`; it needs
  `durationMs` (from `timer.durationSeconds`) in its options next to `tickMs`.
- Session completion (`background.ts:293`) calls the same function. One
  counting function for live and final values means they can never disagree.

### 4.4 `lib/score/calculate-score.ts`

`calculateScore(builtCharacters: number, total: number): ScoreLevel` — the
level of the highest band whose cutoff `builtCharacters` reaches. Defensive:
`NaN`/negative → `bad`; invalid `total` → `bad`; above `total` → clamped
(`excellent`). `GOOD_MAX_RATIO` is removed, and so is the ratio doc comment
(the §4 "ratio formula" open point no longer applies to scoring).

### 4.5 `store/store.types.ts:3`

`ScoreLevel` becomes `'excellent' | 'great' | 'good' | 'bad'` — ideally derived
from the table (`(typeof COMPLETION_BANDS)[number]['level']`) so the type and
the bands cannot drift. `SessionSummary.score` (`:95`) and the `SESSION_ENDED`
payload inherit the change; there is no runtime level validator in
`lib/messaging` to extend.

---

## 5. Score slice (`store/score.slice.ts`)

| Line | Current | Change |
|---|---|---|
| `:7-8` | `level`, `distractionRatio` | drop `distractionRatio`; add `builtCharacters` |
| `:23`, `:56-63` | `setDistractionRatio` | remove |
| `:29`, `:65-67` | `setPopulation(population)` | replace with `setBuiltCharacters(builtCharacters)`: normalizes, then stores `builtCharacters`, `population = calculatePopulation(...)`, `level = calculateScore(...)` (pure delegations, with `TOTAL_CHARACTERS_PER_SESSION`) |
| `:33` | initial `level: 'excellent'` | initial state derived from `0` characters → `level: 'bad'`, `population: 0` |
| `:73-74` | `selectDistractionRatio` | remove (and its re-export in `store/index.ts`) |

`population` and `level` remain stored fields, so `PopulationCounter`,
`ScoreBadge` (`selectScoreLevel`) and session completion (`score.level`) keep
their current contracts. The slice stays a thin delegation layer: the rules live
only in `lib/`.

**Live level (decision)**: the badge updates during the session — `bad` at the
start, `good` at 30%, `great` at 70%, `excellent` only on the final character —
and drops back when a distraction takes characters away. This matches the live
population counter and the M2.T9 "level can change during a session" intent.

---

## 6. Persistence

- `score` is persisted (`store/index.ts:145`) and merged as
  `{ ...current.score, ...saved.score }` (`:266`). A snapshot written before the
  change carries `distractionRatio`, a stale `level: 'excellent'`, a flat-rate
  `population` and no `builtCharacters`. Proposed: in `merge`, rebuild `score`
  from `saved.score.builtCharacters` (default `0`) through the same derivation
  and ignore every other saved score field. During a running session, the
  startup reconciliation (`account()`) recomputes `builtCharacters` from the
  persisted `timer.focusedMs`/`distractedMs` immediately anyway. No `version`
  bump / `migrate` needed.
- `sessionHistory`: old entries keep their level (still a valid member of the
  union; in practice always `'excellent'`, §1.3) and a flat-rate population
  (≤ 3000), so they are not comparable with new entries (≤ 7383). With a
  5-entry cap they age out quickly — **no migration**.
  `SessionHistory.scoreLabel` (`components/score/SessionHistory.tsx:61-64`)
  already degrades an unknown level to its raw string.
- `lib/blocking/store-snapshot.ts` (content script) ignores `score`: unaffected.

---

## 7. UI and i18n

**`components/score/ScoreBadge.tsx`**

- `SCORE_LEVEL_LABEL_KEYS` (`:10-14`) — add `great: 'score.great'`; the
  `satisfies Record<ScoreLevel, string>` makes the compiler enforce it.
- `SCORE_BADGE_STYLES` (`:38-40`) — add `.score-badge--great` with a fourth
  distinct blue `#4dabf7`, between green (`#51cf66`) and yellow (`#fcc419`). Update the "three variants" comment (`:22`).

**`components/score/SessionHistory.tsx:49-51`** — add
`.session-history__score--great` with the same color.

**`components/score/PopulationCounter.tsx`** — no logic change; it now shows up
to 7383 (4 digits, as before).

**Locales** (`locales/en.yml:31-34`, `locales/it.yml:32-35`) — add
`score.great: Great` / `score.great: Ottimo`. The EN/IT key-parity test
(M3.T10) fails if one side is missing.

**`README.md:12`** — rewrite the score bullet with the completion bands and the
tiered population.

---

## 8. Tests affected

| Test file | Change |
|---|---|
| `tests/unit/lib/score/completion-bands.test.ts` *(new)* | table validity (ascending, `0`…`1`, no rate at 100%); `ceil` cutoffs for totals 600, 601, 700 |
| `tests/unit/lib/score/calculate-score.test.ts` | rewrite (today 8 ratio tests): parametric table at 600 on `0, 179, 180, 419, 420, 599, 600`; same boundaries for a hypothetical total (e.g. 1000 → `299/300/699/700/999/1000`); defensive `NaN`/negative/`±Infinity`/invalid total |
| `tests/unit/lib/score/calculate-population.test.ts` | rewrite (today 41 references to the flat rate): rate per band (`179 → 895`, `180 → 900`, `181 → 910`, `420 → 3300`, `421 → 3320`, `599 → 6880`, `600 → 7383`); bonus only at 100% and proportional for another total; marginal rate (no retroactive jump); monotonic; defensive inputs |
| `tests/unit/lib/score/calculate-built-characters.test.ts` *(new)* | net count clamped at 0; capped at total; **a perfect session of every preset gives exactly `total`**, for today's total and hypothetical ones (§2) |
| `tests/unit/lib/timer/session-progress.test.ts` | `builtCharacters` instead of `population` |
| `tests/unit/store/score-slice.test.ts` | initial `bad`/0; `setBuiltCharacters` derives population and level in every band; ratio tests removed |
| `tests/integration/background/growth-tick.test.ts`, `session-completion.test.ts`, `background.test.ts`, `tests/integration/messaging/timer-mutation-bus.test.ts` | population expectations move to the tiered values; completion: a perfect session records `excellent` + 7383, a shortened/distracted one lands in `great`/`good`/`bad` with the matching population; a distraction in the `great` band costs 20 |
| `tests/integration/store/store.test.ts` | default `bad`; rehydrating a legacy `score` rebuilds it from `builtCharacters` and drops `distractionRatio` |
| `tests/unit/components/score/ScoreBadge.test.tsx` | four variants incl. `great`; labels `['Excellent','Great','Good','Bad']`; `--great` style rule |
| `tests/unit/components/score/SessionHistory.test.tsx` | drop `distractionRatio` fixture (`:55`); render a `great` entry |
| `tests/unit/components/score/PopulationCounter.test.tsx`, `tests/unit/store/session-history-slice.test.ts`, `tests/unit/i18n/i18n.test.tsx`, `tests/unit/lib/blocking/store-snapshot.test.ts` | literals stay valid; parity covers `score.great` automatically |

Score and malus calculation is critical logic item 4 (§3.4 of the
instructions): every band boundary must be covered by parametric tests, and the
timer/population regression suites (M2.T2, M2.T18, M3.T3c) must be re-run.

---

## 9. Documentation to update

- `docs/roadmap-en.md` — add **CR3** under §2 Change requests; mark M2.T9
  (`:321`, ratio thresholds), M2.T17 (three variants), M2.T18 (flat population)
  and the §4 "ratio formula" open point as *Superseded/Amended by CR3*.
- `.github/copilot-instructions.md` — `calculate-score.ts`/`calculate-population.ts`
  comments in §1.2 (`:93`, "+5 per house…"), §3.3 rows M2.T9 / M2.T17 / M2.T18,
  §3.4 item 4 (four levels, completion bands).
- `docs/changelog.md` — task entries; remove the "exact `distractionRatio`
  formula" from Open issues item 1.
- `.serena/memories/core.md` — score/population description.

---

## 10. Proposed task breakdown (CR3) and open points

| ID | Task | Depends on |
|---|---|---|
| CR3.T1 | `completion-bands.ts` table + `calculateBuiltCharacters` + `calculateScore(builtCharacters, total)` + tiered `calculatePopulation`; `ScoreLevel` gains `great`; reachability tests | — |
| CR3.T2 | `advanceProgress` and session completion produce `builtCharacters`; score slice `setBuiltCharacters` replaces `setPopulation`/`setDistractionRatio`; `merge` rebuilds `score` | CR3.T1 |
| CR3.T3 | UI + i18n: `great` label key, badge/history colors, `en.yml`/`it.yml` | CR3.T1 |
| CR3.T4 | Integration coverage (live bands, completion, distraction at band rate, legacy rehydration), docs (README, roadmap CR3, instructions, changelog, memory) and final verification | CR3.T2, CR3.T3 |

Dependency chain after the change:

```
timer.focusedMs / distractedMs / durationSeconds
  └── calculateBuiltCharacters            (lib/score, pure)
        ├── advanceProgress  → live       (background growth tracker)
        └── session completion → final    (background)
              └── scoreSlice.setBuiltCharacters
                    ├── builtCharacters   (persisted, source of truth)
                    ├── population = calculatePopulation(built, total)  ← COMPLETION_BANDS + bonus
                    └── level      = calculateScore(built, total)       ← COMPLETION_BANDS
                          ├── ScoreBadge (live, 4 variants)
                          ├── PopulationCounter
                          └── SessionSummary → sessionHistory + SESSION_ENDED

removed: distractionRatio, setDistractionRatio, selectDistractionRatio,
         setPopulation, GOOD_MAX_RATIO, POPULATION_PER_TICK
```

Decided points (all completed):

1. ✅ **Color and label for `great`**: blue `#4dabf7`; Italian label `Ottimo`
   (English `Great`).
2. ✅ **Bonus**: 7% of the population reached (`COMPLETION_BONUS_SHARE = 0.07`,
   `round(0.07 × 6900) = 483` today, final population 7383) instead of the
   fixed 500.
3. ✅ **Counting from `durationMs`** instead of `tickMs` (§2), so 100% stays
   reachable for any future total.
