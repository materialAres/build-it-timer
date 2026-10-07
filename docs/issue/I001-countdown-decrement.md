# I001 — The countdown never decrements (timer display frozen at `00:25:00`)

- **Status**: **fixed**
- **Severity**: high (user-visible; the core "focus session" feedback is broken)
- **Type**: real bug — unowned gap, not a deferred side-effect
- **Found**: manual run of the built extension (M3.T4 popup)
- **Fixed in**: uncommitted working tree (see the changelog entry for I001)
- **Related tasks**: M2.T1, M2.T2, M2.T3, M3.T3b, M3.T3c
- **Related changelog issues**: #9 (tick emitter), and the M3.T3b deferral note

---

## Fix summary

The popup now projects the countdown from the session's absolute end time and
publishes it through the previously unused `ui.liveRemainingSeconds` field:

- `TimerState` gained `endsAt` (absolute epoch ms, `null` when no countdown is in
  flight), set by `startTimer` on both the fresh-start and the resume path, and
  cleared by `pauseTimer`/`resetTimer`/`completeTimer`.
- `lib/timer/countdown.ts` (new) — pure `estimateRemainingSeconds(timer, nowMs)`
  with ceil semantics (the last second stays visible until the deadline passes)
  and defensive fallbacks for non-finite input.
- `components/timer/use-countdown-estimate.ts` (new) — publishes the estimate
  once per second while `running`, recomputing from the store's `endsAt` on every
  tick so a background reconciliation self-corrects instead of drifting.
- `TimerDisplay` reads `selectLiveRemainingSeconds` (the estimate) instead of the
  background's `remainingSeconds`, which is only rewritten at session boundaries.
- `restoreTimer` re-derives `endsAt` from the still-pending alarm, so a
  service-worker restart resumes the estimate from the correct instant.
- `pauseTimer` now persists the *actual* remaining time (derived from `endsAt`)
  instead of leaving the session's full duration, so the frozen display does not
  jump back to `00:25:00`.

Verified in a real browser: counts down, freezes on pause at the real value, and
resumes from it.

---

## Symptom

Starting a session from the popup left `TimerDisplay` stuck at `00:25:00` for the whole
session. It only changed when the session completed, at which point it jumped to `00:00:00`.

The session itself worked: the alarm fired, the timer transitioned to `completed`, and the
history/population were recorded (M3.T3c). Only the **display** was frozen.

## Root cause

`timer.remainingSeconds` had no decrementer in production code. Its only writers were:

| Location | What it does |
|---|---|
| `store/timer.slice.ts` (`initialTimerState`) | sets the initial `DEFAULT_FOCUS_SECONDS` (25 min) |
| `store/timer.slice.ts` (`completeTimer`) | sets it to `0` at the end of the session |
| `lib/timer/restore-timer.ts` | recomputes it **only** on a service-worker restart, from the still-pending alarm |

`components/timer/TimerDisplay.tsx` read that value through `selectRemainingSeconds`, so it
rendered `25:00` for the entire session and then `00:00:00` at completion.

The session alarm could not drive the display either: it is **one-shot**.
`lib/timer/alarm-adapter.ts` creates it with `browser.alarms.create(name, { when: … })` — no
`periodInMinutes` — so it fires exactly once, at the end of the countdown. There was no
per-minute tick to update the display from.

## Why the recorded deferral was not valid

The M3.T3b changelog entry justified deferring the popup-side countdown with:

> "`TimerDisplay` keeps showing the last value the background persisted (updated on each alarm
> tick / sync), which is correct but not second-by-second."

There is no "each alarm tick": the alarm fires once. The deferral therefore did not leave a
coarse countdown in place — it left the countdown with **no** update mechanism at all. The
justification recorded in the changelog was factually wrong.

## Why no remaining task fixed it

- The roadmap's only mention of the popup-side countdown is **M3.T3b**
  (`docs/roadmap-en.md`), whose acceptance criterion explicitly allowed it to be *"either
  implemented here through `ui.liveRemainingSeconds` or explicitly deferred"*. M3.T3b is
  completed, and the deferral was taken.
- **M2.T2** reconciles the countdown only on a service-worker restart.
- No Milestone 4 or 5 card touches the countdown.
- `ui.liveRemainingSeconds` existed in the store (with `selectLiveRemainingSeconds`) but had no
  producer — nothing wrote it.

## Expected behaviour

While `status === 'running'`, the displayed countdown decreases once per second and is
reconciled against the background's authoritative alarm (the §1 "two distinct clocks" note:
`browser.alarms` remains the source of truth for persistence, the fine-grained UI clock only
estimates between reconciliations).

## Acceptance criteria for the fix

- Starting a session makes the display count down once per second. ✅
- Pausing freezes the displayed value; resuming continues from it. ✅
- A service-worker restart during a running session does not reset or duplicate the countdown. ✅
- The displayed value converges to the background's authoritative value at each reconciliation. ✅
- `TimerDisplay` still performs no computation (Separation of Concerns, §1.1). ✅

## Evidence

- `store/timer.slice.ts` — `remainingSeconds` was only ever set to the default or to `0`.
- `lib/timer/alarm-adapter.ts` — `schedule` uses `{ when }`, i.e. a one-shot alarm.
- `components/timer/TimerDisplay.tsx` — rendered `selectRemainingSeconds` verbatim.
- `store/index.ts` — `ui.liveRemainingSeconds` was declared and selected, never written.

