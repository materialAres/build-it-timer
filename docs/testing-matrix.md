# Testing matrix and critical-logic priority

> Reference file. Do not read in full: grep your task ID (e.g. `M2.T9`) and read only that row. Read §3.4 only when touching critical logic.

### 3.3 Test/task mapping

| Task | Test type | Tools | Edge cases to cover |
|---|---|---|---|
| M1.T2 (`domain.ts`) | Unit | vitest | Multiple subdomains (verify they are removed, not added), different protocols (http/https), URL without protocol, malformed URL, IP instead of domain, domain with explicit port, "bare" public suffix (`co.uk`, `com`) → `{ ok: false }`. |
| M1.T3 (storage adapter) | Integration | vitest + `wxt/testing` | Writing/reading a large value close to `storage.local` limits; `getItem` on a nonexistent key. |
| M1.T4 (store skeleton) | Unit + Integration | vitest | Volatile fields do not survive a simulated "restart"; persisted fields do; `partialize` does not accidentally exclude a field that should persist. |
| M1.T5 (alarm adapter) | Unit (via Fake) + Integration (via `wxt/testing`) | vitest | Calling `schedule` with a time in the past; `clear` on a nonexistent alarm; 60s minimum tick respected even when a shorter interval is requested. |
| M1.T6 (message bus) | Integration | vitest + `wxt/testing` | Message with unrecognized `type`; multiple listeners on the same `type`; no listener registered (no crash). |
| M1.T7 (background skeleton) | Integration | vitest + `wxt/testing` | Startup with no prior storage state (first install) vs. startup with existing state. |
| M1.T8 (store sync) | Integration | vitest + `wxt/testing` | An external write to the store key updates another context's store; no write echo/loop; unsubscribe stops syncing. |
| M1.T9 (read-only store) | Integration | vitest + `wxt/testing` | `setState` on a read-only store never calls `storage.local.set`; the read-only store still hydrates and still receives `onChanged` updates; the writable store persists. |
| M1.T10 (mutation path) | Integration | vitest + `wxt/testing` | A mutation message updates the background store exactly once; the popup store converges via sync; invalid payload → no mutation, no throw. |
| M2.T1 (`timerSlice`) | Unit | vitest | `pauseTimer()` when already `idle` (safe no-op, not an inconsistent state); `startTimer()` when already `running` (idempotence or explicit error, to be defined). |
| M2.T2 (restore timer) | Integration | vitest + `wxt/testing` (fake alarms) | Alarm firing exactly during the simulated "restart" (race condition); corrupted/partial persisted state. |
| M2.T3 (Timer UI) | Component | Testing Library | Rendering with `remainingSeconds` at 0; rendering with values > 3600s (formatting beyond 60 minutes, behavior to be clarified). |
| M2.T4 (`blocklistSlice`) | Unit | vitest | Adding a domain that is already present (duplicate no-op); adding a subdomain variant of an existing entry collapses onto the same canonical entry; removing a nonexistent domain. |
| M2.T5 (presets data) | Unit | vitest | Data structure validation (every preset has at least one domain, non-empty tag). |
| M2.T6 (DNR rules) | Unit | vitest | Empty blocklist → no rules; the same domain duplicated in the blocklist → a single rule; a non-canonical entry is canonicalized or rejected before it reaches a rule. |
| M2.T21 (input normalization) | Unit + Integration | vitest (+ `wxt/testing`) | "Bare" public suffix (`co.uk`, `com`) rejected with "Enter a valid URL"; same input → same canonical form from entry and from navigation check; malformed URL during check does not crash and does not incorrectly block. |
| M2.T7 (apply DNR rules) | Integration | vitest + `wxt/testing` | Blocklist changes while `status !== 'running'` → no call to `updateDynamicRules` (or agreed-upon behavior, see §4). |
| M2.T8 (overlay content script) | Component (for `BlockedOverlay.tsx`) + Integration (for the content script) | Testing Library, vitest + `wxt/testing` | Overlay mounted twice on the same page (idempotence); message sent to the background when the background doesn't respond (timeout). |
| M2.T9 (calculate score) | Unit | vitest | *(Amended by CR3)* Four levels from `builtCharacters / total`: exact band boundaries (`179/180`, `419/420`, `599/600` at total 600, and the same percentages at another total); `NaN`/negative/invalid total → `bad`; above total → `excellent`. |
| M2.T10 (apply malus) | Unit | vitest | Malus applied when the city is already "empty" (no building to destroy: behavior must be explicit, not a crash). |
| M2.T11 (`citySlice`) | Unit | vitest | `destroyBuilding` on out-of-grid coordinates. |
| M2.T11b (tile library) | Unit | vitest | Every module declares its own width; all modules in the same category have mutually compatible widths (no misalignment when stacked); no duplicate module ids. |
| M2.T11c (building composer) | Unit | vitest | The unlock schedule is respected for the same focused time; the same seed always composes the same building (determinism); the composer never calls `Math.random()` internally. |
| M2.T12 (growth engine) | Unit | vitest | Zero time delta (no-op); very large delta (beyond grid capacity: behavior to be clarified, see §4); grid already completely full. |
| M2.T12b (decoration engine) | Unit | vitest | Deterministic output for the same seed; decorations never overwrite an occupied cell; no internal `Math.random()`. |
| M2.T13 (palette) | Unit | vitest | Empty domain string; domain with Unicode characters (IDN). |
| M2.T13b (theme registry) | Unit | vitest | Deterministic theme selection from the session id; every registered theme has a non-empty palette; an unknown theme id falls back to the default. |
| M2.T14 (CityCanvas/CityCell) | Component | Testing Library | Empty grid (no buildings); grid with all cells `destroyed`. |
| M2.T15 (growth ↔ tick) | Integration | vitest + `wxt/testing` | A tick occurring while `status === 'paused'` (must not make the city grow). |
| M2.T16 (malus ↔ destruction) | Integration | vitest + `wxt/testing` | Two malus events in close succession (no double application unless intentional). |
| M2.T17 (ScoreBadge) | Component | Testing Library | *(Amended by CR3)* Four variants including `great`; state transition from `excellent` to `bad` between two consecutive renders. |
| M2.T18 (population) | Unit + Component | vitest, Testing Library | *(Amended by CR3)* Tiered marginal rate per completion band (5/10/20) plus a 7% bonus at 100%, no hard-coded total, a perfect session of every preset gives exactly `total` characters; `NaN`/negative/non-finite → `0`; `PopulationCounter` reads via the selector and computes nothing. |
| M2.T19 (session history slice) | Unit | vitest | Newest-first insertion; dedup by `sessionId` (a re-emitted `SESSION_ENDED` replaces, not grows); cap at 5 dropping the oldest; a no-op returns the same reference; the history survives a simulated "restart" while `ui` does not. |
| M2.T20 (allow/block mutual exclusion) | — | — | **Obsolete** (superseded by CR1): there is a single blocklist and no second list to conflict with. |
| M3.T1 (PresetPicker) | Component | Testing Library | Applying two presets with overlapping domains (no resulting duplicate, reuses the M2.T4 logic). |
| M3.T2 (TagEditor) | Component | Testing Library | Tag with a duplicate name (case-insensitive?); removing a tag still assigned to sites. |
| M3.T3 (SiteList) | Component | Testing Library | Empty/whitespace input; input that `tldts` cannot parse or a "bare" public suffix (`co.uk`) → "Enter a valid URL" message (visible error feedback). |
| M3.T3b (timer path: commands + tick emitter) | Integration | vitest + `wxt/testing` | A timer command sent from the popup updates the background store exactly once (not the popup's own copy); a sequence of simulated `TIMER_TICK`s produces the expected city growth; the emitter stops on unmount; a tick while `status !== 'running'` neither grows the city nor accrues malus. |
| M3.T3c (session completion) | Integration | vitest + `wxt/testing` (fake alarms) | A session run to completion records exactly one history entry with the expected score/population and emits `SESSION_ENDED`; a session paused/reset before completion records none; a re-emitted `SESSION_ENDED` for the same `sessionId` replaces the entry. |
| M3.T4 (App.tsx) | Integration (component-level) | Testing Library + `wxt/testing` (real in-process background, option A) | Full flow: open popup → apply preset → start timer → simulate tick → verify that both the timer and the city update in the same render tree; tab switching shows one section at a time; `ExportCityButton` only at session end. |
| M3.T5 (animations) | Component | Testing Library (with `framer-motion` mocked/disabled if needed for determinism) | No assertions on real animation timings in unit/component tests (fragile); only that the final state is correct. |
| M3.T6 (multi-browser) | Manual + preparation for M4.T5 | — | — |
| M3.T7 (SessionHistory) | Component | Testing Library | Empty history (explicit empty state, no crash) and a full 5-entry history; the stored order is preserved (newest first, never re-sorted or re-sliced); the transition when a new session is recorded. |
| M3.T8 (ExportCityButton) | Component | Testing Library | Triggering the export calls the injected exporter with the current grid and theme; the button is only rendered at session end; an export failure surfaces the error without crashing. |
| M3.T9 (i18n setup `@wxt-dev/i18n`) | Component (+ Integration) | Testing Library, vitest + `wxt/testing` | A component using `i18n.t(key)` renders the expected EN string; with the browser locale forced to IT it renders the IT string. |
| M3.T10 (IT translation, auto from browser) | Component + Unit (drift detection) | Testing Library, vitest | All EN keys have an IT counterpart (comparing the `en.yml`/`it.yml` trees, fails if an IT key is missing); no manual selector nor persisted preference present. |
| M4.T1 (proportional malus) | Unit | vitest | Monotonic property tested with several increasing time values (simple property-based test or case table). |
| M4.T2 (TexturePacker) | Component (manual visual regression) | — | — |
| M4.T3 (logging) | Unit + Integration | vitest | An error thrown at a known point is actually logged (spy on the logger) and does not propagate up to crash the listener. |
| M4.T4 (accessibility) | Component (a11y) | Testing Library + possibly `jest-axe` (to be evaluated whether to add it, see Section 1.4 on minimal dependencies) | — |
| M4.T5 (e2e) | E2E | Playwright | The three scenarios listed in the task's acceptance criterion, plus a fourth regression scenario: Firefox build with the same timer scenario (if Playwright + Firefox is available, otherwise Chromium only per the document's constraint). |
| M5.T1 (message bus hardening) | Integration | vitest + `wxt/testing` | Malformed/forged message (unknown type, missing fields, wrong types) → no crash and no mutation; `tabId` in the payload ignored and derived from `sender.tab.id`; sender with `id !== browser.runtime.id` rejected. |
| M5.T2 (domain hardening) | Unit + Integration | vitest | Non-http schemes (`ftp://`, `file://`, `javascript:`, `data:`) → `{ ok: false }`; trailing dot and uppercase canonicalized; userinfo trick (`https://facebook.com@evil.com`) → real host; IDN/homograph → punycode; hostile corpus with no exceptions. |
| M5.T3 (DNR urlFilter) | Unit | vitest | Entry with `*` does not become a wildcard (no over-blocking); `||` prefix does not alter the anchoring; non-canonical entry rejected/neutralized. |

### 3.4 Priority on critical logic

In absolute priority order (to be tested most thoroughly, with the most edge cases, and never left without coverage even under time pressure):

1. **Timer persistence via `browser.alarms`** (M1.T5, M2.T1, M2.T2) — this is the logic with the largest surface for "silent" bugs (a timer that resets to zero, duplicates, or doesn't resume after a service worker restart). Highest priority because a bug here breaks the user's trust in the entire "focus session" concept.
2. **URL parsing with `tldts`** (M1.T2) — this is the security/correctness foundation of the entire blocking system: a bug here can let through sites that should be blocked (or, conversely, block legitimate sites). It must be tested against a broad, heterogeneous set of real URLs, not just the "happy" cases.
3. **Site blocking logic** (M2.T6, M2.T7, M2.T21) — directly dependent on the previous point; blocking is decided against the single blocklist only (there is no second list and no precedence rule — never reintroduce one; CR1.T4). Defensive input normalization (entry + navigation check, M2.T21) must be treated as critical logic.
4. **Score and malus calculation** (M2.T9, M2.T10, M4.T1) — this is the heart of the "gamification" and of the user's sense of fairness: the boundaries between Excellent/Great/Good/Bad (completion bands, CR3) must be exact and covered by parametric tests on all threshold values.
5. **Determinism of the building palette** (M2.T13) — lower priority than the previous ones (a "wrong" color doesn't break functionality), but determinism must still be guaranteed with repetition tests, because it's an explicit requirement of the source document ("the same building always has the same color").

These five points must also be re-verified (regression) every time a module they depend on is touched, even if the task being completed is nominally a different one (e.g. modifying `growth-engine.ts` for M4.T1 requires re-running the M2.T12 tests as well).

In addition to these, with **cross-cutting** priority, is **security hardening** (M5.T1–M5.T3): runtime validation of messages and sender provenance (`sender`), scheme restriction + canonicalization in `lib/url/domain.ts`, escaping of `urlFilter` in DNR generation. These are security prerequisites for critical logic items 1–3 and must be verified with a **hostile input corpus** (not just the happy path). These measures are additive with respect to tasks M1.T2/M1.T6/M2.T6 and do not modify their acceptance criteria.

