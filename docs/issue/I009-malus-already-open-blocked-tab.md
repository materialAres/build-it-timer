# I009 — Malus not applied to a blocked site already open when the session starts

- **Status**: **fixed**
- **Severity**: medium (the reward/penalty model is inverted for the whole stay: no malus, and the city grows)
- **Type**: real bug — stale tab set in the distraction tracker
- **Found**: manual run of the built extension (blocked site already open, then Start)
- **Fixed in**: uncommitted working tree (see the changelog entry for I009)
- **Related tasks**: M2.T10, M2.T16, M2.T18, I006

---

## Symptom

A blocked site that was already open when the focus timer started accrued **no
malus**. Confirming the overlay applied at most the single "proceed" character
(and nothing at all when the city was still empty at session start); afterwards
the city kept **growing** while the user stayed on the blocked page. A blocked
site opened *after* the timer started behaved correctly.

## Root cause

The malus is driven by `TabDistractionTracker.getAccumulatedMs()`: the wiring's
`pump()` converts elapsed distraction time into ticks and removes characters. The
tracker learns about tabs from exactly two places:

1. `tabs.onUpdated` / `tabs.onRemoved` events, and
2. a one-shot `queryTabs()` seed at tracker construction
   (`lib/timer/tab-distraction-tracker.ts`).

The predicate handed to the tracker (`createDistractionPredicate`,
`entrypoints/background.ts`) only counts a tab while
`timer.status === 'running'`. At construction the store is still **idle**: a
fresh session has not started yet, and on a worker restart the tracker is built
before `store.persist.rehydrate()` resolves. The startup seed therefore registers
no tabs, and a tab that was already open on the blocked site never fires
`tabs.onUpdated` when the timer starts (its URL does not change).

Consequences:

- `getAccumulatedMs()` stays flat → `pump()` sees `elapsedTicks = 0` on every
  tick, so after the initial "proceed" character nothing is ever removed.
- `isDistracted()` also stays `false` → the growth engine books the time as
  **focus**, so the city and population keep increasing while the user is on the
  blocked site.

The trigger points were therefore asymmetric: navigation registers the tab via
`onUpdated`, but "timer start" did not re-evaluate the already-open tabs at all.

## Fix

- `lib/timer/tab-distraction-tracker.ts` — the tracker exposes
  `refresh(): Promise<void>`. It re-reads the open tabs, samples the elapsed
  stretch against the *previous* membership first, then replaces the set with the
  freshly read tabs (a tab that navigated away stops counting). The original seed
  and the refresh share a `syncTabs` helper.
- `entrypoints/background.ts` — the existing timer-status subscription calls
  `refresh()` whenever the status becomes `running` (fresh start, resume, or a
  rehydrated running session), logging failures at the `tab-tracker` boundary.
  Startup additionally **awaits** one refresh before `growthTick.account()`, so a
  sleep gap is classified with the open tabs already known.

The malus still starts only on the overlay's **Yes** (pre-`proceed` time remains
forgiven, M2.T10); the fix only makes the already-open tab visible to the
tracker.

## Acceptance criteria

- Starting a session with a blocked tab already open registers that tab: after
  **Yes**, each session tick removes characters. ✅
- The stretch before the re-read is preserved; a tab that navigated away during
  the read is dropped. ✅
- A blocked site opened after the session starts keeps working (`onUpdated`
  path). ✅
- Failures of the re-read are logged and contained (no unhandled rejection). ✅

## Evidence

- `lib/timer/tab-distraction-tracker.ts` — seed ran once at construction; no
  re-read on session start.
- `entrypoints/background.ts` — `createDistractionPredicate` requires a running
  session; the status subscription started the accounting clock and the progress
  alarm but never re-read the tabs.
- `tests/integration/background/malus.test.ts` — regression test
  "keeps applying the malus to a blocked tab that was already open when the
  session started" (verified red before the fix).
- `tests/unit/lib/timer/tab-distraction-tracker.test.ts` — `refresh()` tests for
  the session-start re-read and for dropping a tab that navigated away.
