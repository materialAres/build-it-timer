# I008 — Blocked-site overlay reappeared after choosing "Yes"

- **Status**: **fixed**
- **Severity**: medium (the gate still worked, but only after a second confirmation)
- **Type**: real bug — overlay lifecycle, not a deferred side-effect
- **Found**: manual run of the built extension on a blocked site (M2.T8 overlay)
- **Fixed in**: uncommitted working tree (see the changelog entry for I008)
- **Related tasks**: M2.T8, M2.T10, M2.T16

---

## Symptom

On a blocked site the confirmation overlay ("Are you sure you want to access
`domain`?") was shown again right after pressing **Yes**: the overlay closed and
re-mounted, so the user had to press **Yes** a second time to reach the page.

## Root cause

`startBlockedOverlay` (`entrypoints/blocked-overlay.content.tsx`) unmounted the
overlay in `onProceed` but never recorded the decision. The content script
re-evaluates the page on every change of the persisted store
(`reader.subscribe` → `refreshAndEvaluate` → `evaluate`), and choosing **Yes**
is itself what triggers such a change: the `SITE_BLOCKED_ATTEMPT` message starts
the malus (M2.T10/M2.T16), the background persists the updated store, and the
content script observes the write. `evaluate` then saw a still-blocked domain
during a still-running session with `dismissed === false` — the flag only tracked
the **No** path, which keeps the encouragement on screen — and mounted a fresh
overlay.

The overlay was therefore not "stuck": it was correctly unmounted and then
resurrected by the store refresh caused by the user's own choice.

## Expected behaviour

Pressing **Yes** dismisses the overlay and hands the page over for the rest of
the visit: no later re-evaluation (store write, blocklist edit, background wake-up)
may mount it again. Pressing **No** keeps the encouragement, as before.

## Fix

- `entrypoints/blocked-overlay.content.tsx` — a `proceeded` flag is set before
  unmounting in `onProceed`. `evaluate` now returns early for
  `dismissed || proceeded`, so a refresh cannot resurrect the overlay. The flag
  is per content-script instance, i.e. per page visit, which is exactly the
  required lifetime; `detach` (context invalidation) still removes everything.

## Acceptance criteria

- Pressing **Yes** once closes the overlay; it does not re-appear after the
  store refresh caused by the attempt. ✅
- A later store change (e.g. blocklist edit) does not re-mount it for the same
  visit. ✅
- The **No** path still shows the encouragement instead of the question. ✅
- Idempotence, shadow-root isolation, error logging and teardown behaviour are
  unchanged. ✅

## Evidence

- `entrypoints/blocked-overlay.content.tsx` — `evaluate` only checked the
  `dismissed` flag (No path); `onProceed` called `unmount()` without recording
  the choice.
- `entrypoints/background.ts` — `createMalusWiring` handles
  `SITE_BLOCKED_ATTEMPT` with `choice === 'proceed'` and writes the store.
- `tests/integration/content/blocked-overlay.test.ts` — regression test
  "does not bring the overlay back after 'Yes' when the store refreshes"
  (verified red before the fix).
