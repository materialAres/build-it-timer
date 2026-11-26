# Development Plan — Focus Timer (BuildIt)

## 1. Breaking down the work into tasks

### 1.1 Legend and task structure

Each task is a standalone card, with this fixed format:

* **ID** — unique identifier `M<milestone>.T<number>`.
* **Title**
* **Objective** — what the task must do, in one sentence.
* **Files to create/modify**
* **Dependencies** — IDs of other tasks that must be completed first.
* **Acceptance criteria** — verifiable, checkable conditions.
* **Nice to have** — explicitly marked when the task covers an optional feature from the source document.

### 1.2 Summary table

| ID | Title | Milestone | Dependencies |
|---|---|---|---|
| M0.T1 | WXT + React + TS project scaffolding | 0 | — |
| M0.T2 | Linting/formatting configuration and strict tsconfig | 0 | M0.T1 |
| M0.T3 | Test runner setup (vitest + wxt/testing + happy-dom + Testing Library) | 0 | M0.T1 |
| M0.T4 | Playwright setup for e2e (Chromium) | 0 | M0.T1 |
| M0.T5 | Initial folder structure and barrel files | 0 | M0.T1 |
| M1.T1 | Definition of shared domain types | 1 | M0.T5 |
| M1.T2 | `lib/url/domain.ts` module (`tldts` wrapper) | 1 | M1.T1 |
| M1.T3 | Storage adapter for `persist` on `browser.storage.local` | 1 | M1.T1 |
| M1.T4 | Zustand store — skeleton + slice combination | 1 | M1.T3 |
| M1.T5 | `browser.alarms` adapter (`AlarmProvider`) | 1 | M1.T1 |
| M1.T6 | Typed message bus background↔content↔popup | 1 | M1.T1 |
| M1.T7 | Background entrypoint — orchestrator skeleton | 1 | M1.T4, M1.T5, M1.T6 |
| M1.T8 | Cross-context store synchronization (`browser.storage.onChanged`) | 1 | M1.T4 |
| M1.T9 | Single-writer ownership: read-only stores for non-writer contexts | 1 | M1.T4, M1.T8 |
| M1.T10 | Cross-context mutation path (popup → background) | 1 | M1.T6, M1.T9 |
| M2.T1 | `timerSlice` — timer state and actions | 2 | M1.T4, M1.T5 |
| M2.T2 | Timer persistence/restore logic via alarms | 2 | M2.T1, M1.T7 |
| M2.T3 | `TimerDisplay` + `TimerControls` (UI) | 2 | M2.T1 |
| M2.T4 | `blocklistSlice` — allowlist/blocklist state | 2 | M1.T4, M1.T2 |
| M2.T5 | Predefined presets (data) | 2 | M2.T4 |
| M2.T6 | `declarativeNetRequest` rule generator | 2 | M1.T2, M2.T4 |
| M2.T7 | Applying DNR rules from the background, active only in-session | 2 | M2.T6, M1.T7 |
| M2.T8 | Overlay alert content script (Shadow DOM) | 2 | M1.T6, M2.T4 |
| M2.T9 | `scoreSlice` + `lib/score/calculate-score.ts` (Excellent/Good/Bad thresholds) | 2 | M1.T4 |
| M2.T10 | `lib/score/apply-malus.ts` — progressive character-by-character deletion | 2 | M2.T9, M2.T8 |
| M2.T11 | `citySlice` — city grid/layer state, new every session | 2 | M1.T4 |
| M2.T11b | `lib/city/tile-library.ts` — library of composable ASCII modules | 2 | M1.T1 |
| M2.T11c | `lib/city/building-composer.ts` — building composition from modules based on minutes | 2 | M2.T11b |
| M2.T12 | `lib/city/growth-engine.ts` — growth across 3 layers, capped at full grid | 2 | M2.T11, M2.T11c, M2.T1 |
| M2.T12b | `lib/city/decoration-engine.ts` — procedural details (windows, trees, cars, clouds) | 2 | M2.T12 |
| M2.T13 | `lib/city/palette.ts` (domain hash → color, within active theme) | 2 | M1.T2 |
| M2.T13b | `lib/city/theme-registry.ts` — color themes/biomes per session | 2 | M1.T1 |
| M2.T14 | `CityCanvas` + `CityLayer` + `CityCell` (multi-layer ASCII render + CRT glow) | 2 | M2.T12, M2.T13, M2.T13b |
| M2.T15 | Linking growth-engine ↔ character-insertion tick (2s) | 2 | M2.T12, M2.T2 |
| M2.T16 | Linking malus ↔ progressive building deletion | 2 | M2.T10, M2.T12 |
| M2.T17 | `ScoreBadge` (Excellent/Good/Bad UI) | 2 | M2.T9 |
| M2.T18 | `PopulationCounter` + `lib/score/calculate-population.ts` | 2 | M2.T11c |
| M2.T19 | `session-history.slice.ts` — history of the last 5 sessions | 2 | M2.T9 |
| M2.T20 | Allowlist/blocklist mutual-exclusion validation (allowlist wins) | 2 | M2.T4 |
| M2.T21 | Defensive blocklist input normalization (entry + navigation check) | 2 | M1.T2, M2.T4, M2.T6 |
| M3.T1 | `PresetPicker` (preset selection UI) | 3 | M2.T5, M2.T4 |
| M3.T2 | `TagEditor` — custom categories via tags | 3 | M2.T4 |
| M3.T3 | `SiteList` — site CRUD in allow/blocklist | 3 | M2.T4, M1.T2, M2.T20, M2.T21 |
| M3.T3b | Popup → background timer path (commands + 2s tick emitter) | 3 | M2.T1, M2.T2, M2.T3, M1.T10, M2.T15 |
| M3.T3c | Session completion (`SESSION_ENDED` → history + population) | 3 | M2.T2, M2.T18, M2.T19 |
| M3.T4 | Popup `App.tsx` — full UI composition | 3 | M2.T3, M2.T14, M2.T17, M2.T18, M2.T19, M3.T1–M3.T3, M3.T3b, M3.T3c, M3.T7, M3.T8 |
| M3.T5 | `framer-motion` animations on building growth/deletion | 3 | M2.T14 |
| M3.T6 | Multi-browser persistence: Firefox/Chrome build verification | 3 | M3.T4 |
| M3.T7 | `SessionHistory` (5-session history UI) | 3 | M2.T19 |
| M3.T8 | `ExportCityButton` — export city as JPEG/PNG at end of focus | 3 | M2.T14 |
| M3.T9 | Internationalization (i18n) — WXT `@wxt-dev/i18n` module setup (EN default) | 3 | M3.T4 |
| M3.T10 | IT translation (language auto-detected from browser) | 3 | M3.T9 |
| M4.T1 | *(Nice to have)* Malus proportional to time spent on the blocked site | 4 | M2.T10 |
| M4.T2 | *(Nice to have)* TexturePacker / building sprite sheet integration | 4 | M2.T14 |
| M4.T3a | Error hardening — centralized logger foundation | 4 | M0.T2 |
| M4.T3b | Error hardening — background and message-bus boundaries | 4 | M4.T3a, M1.T6, M2.T7 |
| M4.T3c | Error hardening — persistence read/rehydration (CI-3) | 4 | M4.T3a, M1.T9 |
| M4.T3d | Error hardening — popup React error boundary | 4 | M4.T3a, M3.T4, M3.T10 |
| M4.T3e | Error hardening — content/export boundaries + logging guardrails | 4 | M4.T3a, M2.T8, M3.T8 |
| M4.T4 | Popup accessibility polish | 4 | M3.T4 |
| M4.T5 | Full multi-scenario e2e suite | 4 | M3.T6 |
| M5.T1 | Sound types and the four sound themes (data) | 5 | — |
| M5.T2 | `lib/sound/playback-plan.ts` — recipe + volume → timed tones (pure) | 5 | M5.T1 |
| M5.T3 | `lib/sound/waveshapes.ts` — noise samples and bit-crush curve (pure) | 5 | — |
| M5.T4 | Web Audio renderer behind an injected `AudioContext` | 5 | M5.T2, M5.T3 |
| M5.T5 | Sound preferences model and validation (pure) | 5 | M5.T1 |
| M5.T6 | `preferences.slice.ts` — sound preferences state and selectors | 5 | M5.T5, M1.T4 |
| M5.T7 | Persist the sound preferences (no version bump) | 5 | M5.T6 |
| M5.T8 | `PREFERENCES_SOUND_SET` mutation and its background handler | 5 | M5.T6, M1.T10 |
| M5.T9 | Popup request action `requestSetSoundPreferences` | 5 | M5.T8 |
| M5.T10 | `SoundPlayer` port, direct player and the `PLAY_SOUND` message | 5 | M5.T1, M5.T2, M5.T4, M1.T6 |
| M5.T11 | Offscreen document page that plays sounds (Chrome) | 5 | M5.T10 |
| M5.T12 | Background offscreen player + `offscreen` permission (Chrome) | 5 | M5.T10, M5.T11 |
| M5.T13 | Platform player selection (offscreen on Chrome, direct on Firefox) | 5 | M5.T4, M5.T10, M5.T12 |
| M5.T14 | Sound cues: start/end decisions and the 60 s lateness guard (pure) | 5 | M5.T5, M5.T10 |
| M5.T15 | Background wiring of the start and end sounds | 5 | M5.T6, M5.T13, M5.T14, M3.T3c |
| M5.T16 | Settings and sound locale strings (EN/IT) | 5 | M5.T1, M3.T10 |
| M5.T17 | Settings tab with a gear icon | 5 | M5.T16, M3.T4 |
| M5.T18 | `use-sound-preview` hook (popup preview playback) | 5 | M5.T4, M5.T10 |
| M5.T19 | `SoundSettings` panel (toggle, theme list, volume slider) | 5 | M5.T9, M5.T16, M5.T17, M5.T18 |
| M5.T20 | E2E: sound settings and offscreen playback | 5 | M5.T15, M5.T19, M0.T4 |
| M6.T1 | Message bus hardening: runtime validation + sender provenance | 6 | M1.T6 |
| M6.T2 | `lib/url/domain.ts` hardening: scheme restriction + canonicalization + IDN | 6 | M1.T2 |
| M6.T3 | Escaping/validation of `urlFilter` in DNR rule generation | 6 | M2.T6 |

### 1.3 Milestone 0 — Project setup

#### M0.T1 — WXT + React + TS project scaffolding
* **Objective**: initialize the project with the `wxt` React + TypeScript template, targeting multi-browser manifest v3.
* **Files**: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/background.ts` (stub), `entrypoints/popup/` (stub).
* **Dependencies**: —
* **Acceptance criteria**:
  - `bun run dev` starts WXT without errors and produces an extension loadable in Chrome.
  - `wxt build -b firefox` completes without errors.
  - The stub popup opens and shows placeholder text.

#### M0.T2 — Linting/formatting configuration and strict tsconfig
* **Objective**: set up ESLint + Prettier (or Biome) and `tsconfig.json` with `strict: true`, consistent with the rules in Section 1.2.
* **Files**: `.eslintrc.*` (or `biome.json`), `.prettierrc`, `tsconfig.json`.
* **Dependencies**: M0.T1
* **Acceptance criteria**:
  - `tsconfig.json` has `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`.
  - The lint script fails on a deliberately introduced explicit `any`, then passes after removal.

#### M0.T3 — Test runner setup (vitest + wxt/testing + happy-dom + Testing Library)
* **Objective**: configure `vitest` with the official `wxt/testing` integration, a `happy-dom` environment, and the React testing libraries.
* **Files**: `vitest.config.ts`, `tests/setup.ts`.
* **Dependencies**: M0.T1
* **Acceptance criteria**:
  - A placeholder test (`1 + 1 === 2`) runs with `vitest run`.
  - A placeholder test that mounts a trivial React component with `@testing-library/react` passes in the `happy-dom` environment.
  - The `browser.*` API mocks provided by `wxt/testing` are available and working in a test (e.g. `fakeBrowser.storage.local`).

#### M0.T4 — Playwright setup for e2e (Chromium)
* **Objective**: configure `@playwright/test` for e2e on Chromium with the extension loaded.
* **Files**: `playwright.config.ts`, `tests/e2e/setup.ts`.
* **Dependencies**: M0.T1
* **Acceptance criteria**:
  - A placeholder e2e test loads the built extension in a persistent Chromium context and verifies that the popup opens.

#### M0.T5 — Initial folder structure and barrel files
* **Objective**: create the folder structure defined in Section 1.2, with index/barrel files where useful, and empty folders with `.gitkeep` where not yet populated.
* **Files**: the entire `components/`, `store/`, `lib/`, `utils/`, `assets/ascii/`, `tests/{unit,integration,e2e}` structure.
* **Dependencies**: M0.T1
* **Acceptance criteria**:
  - The folder structure exactly matches the one in Section 1.2.
  - `tsconfig.json` includes consistent path aliases (e.g. `@/lib/*`, `@/store/*`, `@/components/*`).

### 1.4 Milestone 1 — Core infrastructure

#### M1.T1 — Definition of shared domain types
* **Objective**: define, in `lib/`/`store/`, the shared TypeScript types: `Domain`, `BlocklistEntry`, `Preset`, `Tag`, `CityCell`, `CityLayer` (`'background'|'middleground'|'foreground'`), `CityGrid` (the three grids/layers), `BuildingModule` (base/floor/top), `Theme` (color palette/biome), `ScoreLevel`, `SessionSummary` (for history), `TimerState` (with `hours`/`minutes`/`seconds`), `RuntimeMessage` (discriminated union).
* **Files**: `store/store.types.ts`, `components/city/city.types.ts`, a `lib/messages.types.ts` file for `RuntimeMessage`.
* **Dependencies**: M0.T5
* **Acceptance criteria**:
  - No type uses `any`.
  - `RuntimeMessage` is a discriminated union on the `type` field, with at least these variants: `TIMER_TICK`, `TIMER_STARTED`, `TIMER_PAUSED`, `SITE_BLOCKED_ATTEMPT`, `MALUS_APPLIED`, `SESSION_ENDED`.
  - `SessionSummary` includes at least `score`, `population`, `endedAt`; it is the type the last-5-sessions history (M2.T19) is based on and is surfaced in the popup by M3.T7.
  - The types compile (`tsc --noEmit`) without errors.

#### M1.T2 — `lib/url/domain.ts` module (`tldts` wrapper)
* **Objective**: pure function `getRegistrableDomain(url: string): Result<string>` that uses `tldts` to extract the normalized registrable domain (e.g. `m.facebook.com` → `facebook.com`).
* **Files**: `lib/url/domain.ts`
* **Dependencies**: M1.T1
* **Design decision — normalization *removes* subdomains, it doesn't add them**: the function always collapses toward the canonical registrable domain (`eTLD+1`), so `m.facebook.com`, `www.facebook.com`, and `facebook.com` all converge on `facebook.com`. The subdomain variant is never preserved, nor is a subdomain ever "constructed" from a partial input. This canonical form is the only allowed representation of a domain throughout the system (blocklist/allowlist, navigation matching, palette): it's the premise that makes entry deduplication (M2.T4), allowlist/blocklist mutual exclusion (M2.T20), and allowlist precedence (M2.T6) possible. Any subdomains needed for future logic must be handled explicitly elsewhere, never as a side effect of this function.
* **Acceptance criteria**:
  - For `https://m.facebook.com/foo`, `https://www.facebook.com`, `https://facebook.com` → same result `facebook.com`.
  - For a malformed URL → returns the `{ ok: false, error }` variant, does not throw.
  - Correctly handles domains with ccSLDs (e.g. `facebook.co.uk` if applicable) thanks to `tldts`.
  - A "bare" public suffix (e.g. `co.uk`, `com`, `github.io`) is not a valid registrable domain → returns `{ ok: false, error }` (the "Enter a valid URL" user message is the caller's responsibility, see M2.T21 and M3.T3).

#### M1.T3 — Storage adapter for `persist` on `browser.storage.local`
* **Objective**: implement a storage adapter compatible with the interface required by Zustand's `persist` middleware, writing to `browser.storage.local` instead of `localStorage` (unavailable/unsuitable in a service worker).
* **Files**: `store/storage-adapter.ts`
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - Implements `getItem`, `setItem`, `removeItem` in an async form compatible with `persist`.
  - In a test with `wxt/testing`'s `fakeBrowser`, a `setItem` followed by `getItem` returns the written value.

#### M1.T4 — Zustand store — skeleton + slice combination
* **Objective**: create `store/index.ts` that combines the slices (still empty/stub) with `persist`, explicitly separating persisted keys from volatile keys (`partialize`).
* **Files**: `store/index.ts`, stub `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`.
* **Dependencies**: M1.T3
* **Acceptance criteria**:
  - The store exports a single `useAppStore` hook plus dedicated per-slice selectors.
  - `partialize` explicitly excludes the volatile fields defined in Section 1.3.
  - Test: modify a persisted field, "restart" the store (a new instance pointing to the same fake storage), and verify the value is recovered; a volatile field instead reverts to its default.

#### M1.T5 — `browser.alarms` adapter (`AlarmProvider`)
* **Objective**: abstract interface `AlarmProvider { schedule(name, whenMs), clear(name), onFire(cb) }` with a real implementation on top of `browser.alarms` and a `FakeAlarmProvider` for tests (see principle L, Section 1.1).
* **Files**: `lib/timer/alarm-adapter.ts`, `lib/timer/fake-alarm-adapter.ts` (in `tests/` or nearby, to be decided during scaffolding — in any case placed outside the production bundle).
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - The real implementation respects the 60s minimum-tick constraint (documented with a comment, see Section 1.4).
  - `FakeAlarmProvider` allows manually "advancing time" in tests and deterministically invokes `onFire`.
  - No module in `lib/` outside this file imports `browser.alarms` directly.

#### M1.T6 — Typed message bus background↔content↔popup
* **Objective**: typed wrapper on top of `browser.runtime.sendMessage`/`onMessage` that uses `RuntimeMessage` (M1.T1) to guarantee type-safety of messages.
* **Files**: `lib/messaging/bus.ts`
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - `sendMessage` accepts only valid `RuntimeMessage` variants (verified at the type level, not just at runtime).
  - A listener registered with `onMessage('SITE_BLOCKED_ATTEMPT', handler)` correctly receives the typed payload in a test with `fakeBrowser`.

#### M1.T7 — Background entrypoint — orchestrator skeleton
* **Objective**: `entrypoints/background.ts` initializes the store, alarm provider, message bus, and registers the main listeners (still without full business logic, wiring only).
* **Files**: `entrypoints/background.ts`
* **Dependencies**: M1.T4, M1.T5, M1.T6
* **Acceptance criteria**:
  - The background starts without errors in a test with `wxt/testing`.
  - The listeners for the messages defined in M1.T1 are registered (verifiable via spy).

> **Cross-context synchronization (CI-1).** `zustand/persist` hydrates a context's store only once,
> at creation, and there is no listener for `browser.storage.onChanged`. Because the popup and the
> background service worker are separate JS realms, importing the same store module gives each its own
> in-memory copy of the same persisted key; writes from one context can silently clobber the other.
> The three tasks below fix this additively (see CI-1 in `docs/store-analysis.md`): **M1.T8** makes contexts converge on the persisted state, **M1.T9** makes the
> background the single writer, and **M1.T10** routes popup mutations through the background so the
> single-writer rule does not remove the popup's ability to edit configuration.

#### M1.T8 — Cross-context store synchronization via `browser.storage.onChanged`
* **Objective**: make every context that creates a store converge on the persisted state by rehydrating whenever another context writes the store key, instead of hydrating only once at creation (the "diverge" half of CI-1).
* **Files**: `store/sync-storage.ts` (new: `attachStoreSync(store): () => void`), `store/index.ts` (re-export the helper), `entrypoints/background.ts` (attach), `entrypoints/popup/main.tsx` (attach), `tests/integration/store/sync-storage.test.ts`.
* **Dependencies**: M1.T4.
* **Acceptance criteria**:
  - `attachStoreSync(store)` subscribes to `browser.storage.onChanged` and, when `area === 'local'` and `changes[STORE_NAME]` is present, calls `store.persist.rehydrate()`.
  - An external write to the store key (simulating another context) updates the in-memory store without recreating it; verified with `fakeBrowser` (context A writes directly to `storage.local`; context B's store reflects the new value).
  - No write echo/loop: a rehydrate triggered by `onChanged` does **not** re-persist (assert with a spy that `storage.local.set` is not called while handling an external change), because `zustand/persist` rehydrates through the raw `set`, not the persisting wrapper.
  - The helper returns an unsubscribe function; after calling it, further external changes no longer rehydrate the store.
* **Notes**: this supersedes the "hydrate once" default of `zustand/persist`. It synchronizes *state between contexts*, not time: the `browser.alarms` 60s tick (M1.T5) and the 2s UI tick remain separate clocks (Section 1, technical note). Consumed by M1.T7 (background wiring) and the popup bootstrap.
* **Nice to have**: no.

#### M1.T9 — Single-writer ownership: read-only stores for non-writer contexts
* **Objective**: designate the background service worker as the **sole writer** of the persisted store and give every other context a read-only store, eliminating last-writer-wins clobbering between contexts (the "clobber" half of CI-1).
* **Files**: `store/storage-adapter.ts` (add a read-only wrapper: `getItem` reads normally, `setItem`/`removeItem` become no-ops — or throw in dev — so reads still work), `store/index.ts` (extend `createAppStore` with a `{ readOnly?: boolean }` option, or add `createReadOnlyAppStore`), `entrypoints/background.ts` (writable store), `entrypoints/popup/main.tsx` (read-only store), `tests/integration/store/read-only-store.test.ts`.
* **Dependencies**: M1.T4, M1.T8.
* **Acceptance criteria**:
  - A store created read-only still hydrates from storage and still receives external updates via `attachStoreSync` (M1.T8), but calling `setState` never writes to `browser.storage.local` (spy: `storage.local.set` is not called) — verified with `fakeBrowser`.
  - A writable store (the background's) persists exactly as before.
  - The popup's `useAppStore` is read-only; the background uses the writable instance.
  - The ownership rule is documented (a "why" comment plus a short table): the background owns `timer`/`city`/`score`; `blocklist` configuration is changed only through M1.T10.
* **Notes**: consistent with Section 1.1 ("background — timer, alarms, DNR, score/malus"; "popup/UI — presentation only") and Section 1.3 (a store action "sends a message to the background"). Read-only contexts do not lose the ability to change state; that path is M1.T10.
* **Nice to have**: no.

#### M1.T10 — Cross-context mutation path: popup mutations routed to the background
> **Amended by CR2** (see §2.5.3): blocklist/tag mutations are accepted only while the timer is `idle`; outside it they are dropped without persisting (CR2.T2).
* **Objective**: let a read-only context (the popup) change persisted state by sending typed mutation messages that the background applies to its single writable store, with the change propagating back to the popup through M1.T8 — completing the CI-1 fix so the single-writer rule does not break the popup's ability to edit configuration.
* **Files**: `lib/messaging/messages.types.ts` (add mutation variants to `RuntimeMessage`, e.g. `BLOCKLIST_ADD_SITE` / `BLOCKLIST_REMOVE_SITE` / `BLOCKLIST_APPLY_PRESET` / `TAG_UPSERT` / `TAG_REMOVE`), `lib/messaging/bus.ts` (M1.T6; typed send helper), `entrypoints/background.ts` (a mutation handler that applies the change to the writable store and persists it), `store/blocklist.slice.ts` (pure mutation helpers shared by both sides), `tests/integration/messaging/mutation-bus.test.ts`.
* **Dependencies**: M1.T6, M1.T9.
* **Acceptance criteria**:
  - Sending a mutation message (at least one, e.g. `BLOCKLIST_ADD_SITE`) from a popup-like context results in the background store being updated and persisted exactly once (integration test with `fakeBrowser`).
  - After the background persists, the popup's read-only store converges to the new value via the M1.T8 sync bridge, with no manual rehydrate call in the test.
  - Invalid/unknown payloads are ignored without throwing and without mutating the store (forward-compatible with M6.T1 hardening).
  - Mutation helpers are pure, so blocklist normalization (M1.T2, M2.T4) runs on the background side and the popup only requests the change.
* **Notes**: this task defines only the **transport + background application**; the concrete CRUD semantics (normalization, dedup, allowlist/blocklist precedence, "Enter a valid URL") remain owned by M2.T4/M2.T20/M2.T21, and the DNR side-effect by M2.T7.
* **Nice to have**: no.

### 1.5 Milestone 2 — Core features

#### M2.T1 — `timerSlice` — timer state and actions
* **Objective**: slice with state `{ status: 'idle'|'running'|'paused', remainingSeconds, sessionStartedAt, sessionId }` and actions `startTimer`, `pauseTimer`, `resetTimer`. `remainingSeconds` is the internal source of truth; the UI derives hours/minutes/seconds from this value (see M2.T3), it does not keep them as separate fields in the store.
* **Files**: `store/timer.slice.ts`
* **Dependencies**: M1.T4, M1.T5
* **Acceptance criteria**:
  - The actions are pure with respect to the store (no direct calls to `browser.alarms` inside the slice: delegated to the injected `AlarmProvider`, see Section 1.3).
  - Test: `startTimer()` sets `status` to `running`, generates a new unique `sessionId`, and calls `AlarmProvider.schedule`.

#### M2.T2 — Timer persistence/restore logic via alarms
* **Objective**: on service worker restart, the background reconstructs the current timer state by reading the persisted store plus any still-pending alarm.
* **Files**: `entrypoints/background.ts` (extension), `lib/timer/restore-timer.ts`
* **Dependencies**: M2.T1, M1.T7
* **Acceptance criteria**:
  - Simulating a "restart" (new background instance, same fake storage) with a `running` timer, the countdown resumes from a consistent value (not from zero, not duplicated).
  - If there is no pending alarm but the persisted state says `running`, the system detects this as an inconsistency and reverts it to `paused` (explicit behavior, not silent).

#### M2.T3 — `TimerDisplay` + `TimerControls` (UI)
* **Objective**: presentational components to show the countdown and the start/pause/reset controls, wired to the store via selectors.
* **Files**: `components/timer/TimerDisplay.tsx`, `components/timer/TimerControls.tsx`
* **Dependencies**: M2.T1
* **Acceptance criteria**:
  - `TimerDisplay` renders `remainingSeconds` formatted as `hh:mm:ss` (a separate pure formatting function, e.g. `utils/format-duration.ts`, testable in isolation).
  - Clicking "Start" in `TimerControls` invokes the store action, not local logic.
  - Test with Testing Library: render, click, assert on the action call (via a spy on the store).

#### M2.T4 — `blocklistSlice` — allowlist/blocklist state
> **Superseded by CR1** (see §2.4): the two-list state and its CRUD are replaced by the single `{ blocklist, customTags }` state (CR1.T5a).
* **Objective**: slice with `{ allowlist: BlocklistEntry[], blocklist: BlocklistEntry[], customTags: Tag[] }` and CRUD actions.
* **Files**: `store/blocklist.slice.ts`
* **Dependencies**: M1.T4, M1.T2
* **Acceptance criteria**:
  - Adding a site normalizes the domain via `getRegistrableDomain` before saving it (no duplicates like `facebook.com` and `www.facebook.com`).
  - User input is **untrusted**: entry always goes through `getRegistrableDomain` (the raw string is never saved as-is). If the function returns `{ ok: false }` — for example for a "bare" public suffix like `co.uk`/`com`, or a malformed URL — the entry is rejected and the UI shows the error **"Enter a valid URL"** (see M2.T21); no exception propagates.
  - The slice keeps entries only in their canonical form (registrable domain), consistent with the M1.T2 design decision.
  - CRUD actions covered by unit tests (add/remove/update tag).

#### M2.T5 — Predefined presets (data)
* **Objective**: static dataset of ready-made presets (Social, Video, etc.) as per the document, each with a domain list and associated tag.
* **Files**: `lib/blocking/presets.ts`
* **Dependencies**: M2.T4
* **Acceptance criteria**:
  - At least the "Social" preset (instagram.com, facebook.com, x.com/twitter.com, tiktok.com) is present.
  - Data structure conforms to the `Preset` type (Section M1.T1) — no application logic here, data only (Open/Closed principle, Section 1.1).

#### M2.T6 — `declarativeNetRequest` rule generator
> **Superseded by CR1** (see §2.4): the allowlist parameter and the "allowlist wins" precedence are gone; the generator takes the blocklist only (CR1.T4).
* **Objective**: pure function `buildDnrRules(blocklist: BlocklistEntry[], allowlist: BlocklistEntry[]): DeclarativeNetRequestRule[]` that translates the state into valid DNR rules.
* **Files**: `lib/blocking/rules.ts`
* **Dependencies**: M1.T2, M2.T4
* **Acceptance criteria**:
  - A domain in the blocklist generates a correct blocking rule (normalized `urlFilter`).
  - **Precedence order (design decision)**: the **allowlist always wins** over the blocklist. A domain present in both allowlist and blocklist is not blocked: the allowlist rule has higher priority and cancels the block. Behavior explicitly tested as a first-class case (not as an edge case).
  - **Resource types (design decision, revised during M2.T8)**: the generated rules intercept **`sub_frame` only**, never `main_frame`. A DNR `block` on `main_frame` is resolved before the document exists, so the browser renders its own `ERR_BLOCKED_BY_CLIENT` page, where no content script can run: the top-level navigation is gated by the Shadow DOM overlay instead (M2.T8), which requires the page to load. Embedded frames of a blocked domain remain hard-blocked, so DNR stays as a secondary layer.
  - No real calls to `browser.declarativeNetRequest` in this module (pure, testable without a browser).

#### M2.T7 — Applying DNR rules from the background
* **Objective**: the background calls `browser.declarativeNetRequest.updateDynamicRules` with the output of `buildDnrRules`, every time the blocklist/allowlist changes or the timer transitions to `running`/`idle`.
* **Files**: `entrypoints/background.ts` (extension), `lib/blocking/apply-rules.ts`
* **Dependencies**: M2.T6, M1.T7
* **Acceptance criteria**:
  - Blocking rules are active **exclusively** during `status === 'running'`: on the `running → paused/idle` transition the dynamic rules are removed (`updateDynamicRules` with `removeRuleIds`), and on the transition to `running` they are reapplied. Outside a focus session, navigation is always free, with no exceptions.
  - Test with `fakeBrowser`: changing the blocklist during `running` triggers a call to `updateDynamicRules` with the expected rules; a transition to `paused` triggers a rule-removal call.

#### M2.T8 — Overlay alert content script (Shadow DOM)
> **Superseded by CR1** (see §2.4): the overlay decision uses `isDomainBlocked({ blocklist }, domain)` only — there is no allowlist precedence anymore (CR1.T4).
* **Objective**: content script that, when the user lands on a domain in the blocklist while the timer is `running`, mounts a Shadow DOM overlay covering the page — "You put this site on your blocklist. Are you sure you want to access it?" — with two choices: **Yes** (access the site, malus then accrues while the user stays there, M2.T10) and **No** (go back, no malus; when the tab has no history to go back to, the overlay stays up showing "Great! Keep focusing!").
* **Files**: `entrypoints/blocked-overlay.content.ts`, `components/common/BlockedOverlay.tsx`, `wxt.config.ts` (`host_permissions` + `matches: ['<all_urls>']`)
* **Dependencies**: M1.T6, M2.T4
* **Design decision (soft-block, agreed with the maintainer while implementing this task)**: top-level navigation is **not** blocked by DNR — M2.T6 now emits `sub_frame`-only rules — because a `main_frame` block is resolved before the document exists, leaving the user on `ERR_BLOCKED_BY_CLIENT` where no content script runs: the overlay would be unreachable and "proceed anyway" would have nothing to proceed to. The overlay therefore *is* the gate for top-level navigation, and DNR remains a secondary layer for embedded frames. Consequence for M2.T10: the malus starts from the "Yes" choice on an actually reachable page, not from a DNR block event.
* **Acceptance criteria**:
  - The overlay is isolated in Shadow DOM (host-page styles do not affect it, verifiable in test/e2e): open shadow root on a dedicated host element, styles carried inside the root, `all: initial` on the root container so inheritable properties (`color`, `font`, `line-height`, `visibility`) do not leak across the boundary.
  - Choosing **Yes** sends a `SITE_BLOCKED_ATTEMPT` message with `choice: 'proceed'` to the background via the M1.T6 bus, then dismisses the overlay and leaves the page usable. No malus is computed here: applying it is M2.T10's job.
  - Choosing **No** sends `SITE_BLOCKED_ATTEMPT` with `choice: 'go-back'` and closes the overlay without sending any malus message (`MALUS_APPLIED` is never emitted by this task).
  - The domain is resolved with `getRegistrableDomain` (M1.T2 — the single normalization point, DRY) and the block decision reuses M2.T6's precedence: **allowlist wins**. The overlay never mounts when `status !== 'running'`.
  - The content script is registered for `<all_urls>` with `runAt: 'document_idle'` and the required `host_permissions`; mounting twice on the same page yields a single overlay (idempotence).
  - A background that does not respond (no listener, or a rejected `sendMessage`) is handled without crashing the page and without leaving the overlay in a stuck state.
* **Notes / accepted limitations**: at `document_idle` the page is already rendered, so a brief flash of content precedes the overlay (accepted trade-off, no `document_start` pre-hide hack); pages where content scripts cannot run (Chrome Web Store, PDF viewer, other extensions' pages) cannot be gated; re-navigating to a blocked domain shows the overlay again, and malus continuity across that re-mount belongs to the background (M2.T10/M2.T16), not to the overlay. The content script reads the persisted store straight from `browser.storage.local` (light reader, no zustand in the content bundle) and subscribes to `storage.onChanged`, so list edits are picked up live and no "lists are frozen while running" restriction is needed.
* **Follow-ups**: overlay strings are hardcoded in EN here and moved to `i18n.t(...)` in M3.T9; the `tabId` field was removed from the `SITE_BLOCKED_ATTEMPT` payload with this task (its M6.T1 removal landed early).

#### M2.T9 — `scoreSlice` + `lib/score/calculate-score.ts`
* **Objective**: pure function `calculateScore(distractionRatio: number): 'excellent'|'good'|'bad'` according to the updated thresholds — Excellent (0%), Good (≤30%), Bad (>30%) — plus a slice that keeps this state for the current session. `distractionRatio` is calculated based on distraction time relative to the focus time **actually elapsed up to the moment of the check** (not the session's planned duration), so the value is recalculated at every check and can change over the course of the session.
* **Files**: `lib/score/calculate-score.ts`, `store/score.slice.ts`
* **Dependencies**: M1.T4
* **Acceptance criteria**:
  - `calculateScore(0)` → `'excellent'`.
  - `calculateScore(0.3)` → `'good'`, `calculateScore(0.31)` → `'bad'` (no intermediate band: two thresholds, three levels, no gray zones).
  - All boundary values (0, 0.3, 0.31, 1.0) covered by parametric tests.
  - **Note**: the exact formula by which `distractionRatio` is derived from individual distraction events (duration, number of events, weight of each) remains an **open point**, to be defined in a later revision of the plan — see Section 4. This task implements only the threshold function (`ratio → level`), which is stable regardless of how the ratio is computed upstream.

#### M2.T10 — `lib/score/apply-malus.ts` — progressive character-by-character deletion
> **Superseded by CR6** (see §2.9.3): the malus lowers `builtCharacters`; the city follows, and `apply-malus.ts` is gone (CR6.T5b, CR6.T9a).
* **Objective**: when the `SITE_BLOCKED_ATTEMPT` message (from M2.T8) arrives with the "proceed" choice, the background applies the malus as the **inverse of growth**: as long as the user stays on the blocked site (or keeps a tab open on it, see below), the characters of the affected building are removed one at a time at the same 2s cadence used for construction (M2.T15), rather than being destroyed all at once.
* **Files**: `lib/score/apply-malus.ts`
* **Dependencies**: M2.T9, M2.T8
* **Note (soft-block model, M2.T8)**: the malus starts after the user chooses "Yes" in the overlay, on a page that **is** reachable — top-level navigation is not blocked by DNR (see M2.T6/M2.T8). The background therefore cannot rely on a DNR `block` event to detect distraction: it tracks the tab (per the multi-tab rule below) starting from the `SITE_BLOCKED_ATTEMPT` message with the `proceed` choice.
* **Acceptance criteria**:
  - Pure function `applyMalus(cityState, ticksOfDistraction) → newCityState` that removes one character for each 2s tick spent in a distracted state, symmetric to `growth-engine.ts` (see M2.T12) but in the opposite direction.
  - If the building reaches zero characters, it stays in the "empty cell" state (no error, no undefined intermediate state).
  - **Distraction detection with multiple open tabs**: as a first choice, the implementation attempts to apply the malus simply because a tab on a blocked site is open, **regardless of whether it is the active tab** (based on the `tabs.onUpdated`/`tabs.onRemoved` events available to the background, accumulating distraction time across all simultaneously open blocked tabs). If this approach turns out not to be reliably feasible during implementation (due to limits of the available APIs), the explicit fallback is to apply the malus only when the blocked tab is the **active** one (`tabs.onActivated` + `windows.onFocusChanged`). The actual choice must be documented with a "why" comment in the code (see Section 1.4 on comments) and reported in the task's changelog.
  - Pure and testable without a browser; multi-tab detection (which requires browser APIs) lives separately in a dedicated adapter (`lib/timer/tab-distraction-tracker.ts` or similar), never mixed with `apply-malus.ts`.

#### M2.T11 — `citySlice` — city grid/layer state, new every session
> **Amended by CR6** (see §2.9.3): the slice stores only the session id; the plan is derived from it (CR6.T5a, CR6.T9a).
* **Objective**: slice with `{ layers: { background: CityGrid, middleground: CityGrid, foreground: CityGrid }, buildings: Record<domain, BuildingMeta>, themeId, sessionId }`.
* **Files**: `store/city.slice.ts`
* **Dependencies**: M1.T4
* **Acceptance criteria**:
  - The initial state consists of the three "empty" layers of configurable dimensions.
  - The slice exposes a `resetCityForNewSession(sessionId, themeId)` action that fully resets the three layers and assigns a new theme: it must be invoked by `startTimer()` (M2.T1) so that every focus session always starts from a brand-new city, never from the previous session's.
  - The slice exposes `growCity(delta)`, `applyMalusToCity(ticks)` actions that delegate to the growth engine (M2.T12) and to `apply-malus.ts` (M2.T10) respectively, without computing anything internally.

#### M2.T11b — `lib/city/tile-library.ts` — library of composable ASCII modules
> **Superseded by CR6** (see §2.9.3): the ASCII module library is replaced by data-driven archetypes in the plan generator (CR6.T2b).
* **Objective**: static, typed dataset of reusable ASCII modules, all of compatible width (e.g. multiples of a configurable base width): bases/foundations, floor sections (office, residential, glass-front), top elements (antennas, domes, helipads).
* **Files**: `lib/city/tile-library.ts`
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - Each module explicitly declares its own width in characters; a test verifies that all modules in the same category (e.g. all "floor sections") have mutually compatible widths, which prevents misalignment when modules are stacked vertically.
  - At least 2 variants per category (base, floor, top) are present, to allow different combinations from the MVP onward.
  - Data only, no selection logic here (Open/Closed principle, Section 1.1) — selection is the job of `building-composer.ts` (M2.T11c).

#### M2.T11c — `lib/city/building-composer.ts` — building composition from modules based on minutes
> **Superseded by CR6** (see §2.9.3): the building composer is replaced by the plan generator (CR6.T2b).
* **Objective**: pure function `composeBuilding(minutesFocused: number, rng: SeededRandom): Building` that progressively unlocks modules via minute thresholds (e.g. minute 5 → base, minute 10 → first floor, minute 20 → additional floor, minute 25 → top element), choosing the specific variant of each module pseudo-randomly via the seeded generator received as a parameter (see Section 1.4).
* **Files**: `lib/city/building-composer.ts`
* **Dependencies**: M2.T11b
* **Acceptance criteria**:
  - Unlock thresholds are defined as configurable data (an ordered array `{ minuteThreshold, moduleCategory }`), not hardwired `if/else` — consistent with the Open/Closed principle.
  - Same `minutesFocused` + same seed → same building, always (determinism for tests).
  - An "unbuilt" building (minutes = 0) is representable and distinct from a building with only the base.

#### M2.T12 — `lib/city/growth-engine.ts` — growth across 3 layers, capped at full grid
> **Superseded by CR6** (see §2.9.3): the growth engine is replaced by visible floors derived from `builtCharacters` (CR6.T4).
* **Objective**: pure engine that, given the current state of the three layers and an "elapsed focus time", computes the new state: every 2 seconds of undistracted focus, one character (from a module composed by `building-composer.ts`, M2.T11c) is inserted into a cell, distributing growth across the three layers (background with small buildings/stars, middleground with the main skyscrapers, foreground with street/cars/trees).
* **Files**: `lib/city/growth-engine.ts`
* **Dependencies**: M2.T11, M2.T11c, M2.T1
* **Acceptance criteria**:
  - Same state + same time delta + same seed → same result (determinism, no internal `Date.now()`, no non-injected `Math.random()`).
  - Test over at least 3 consecutive growth steps (each 2s) verifying that one character is inserted at a time, not in blocks.
  - **Behavior at a full grid**: when all three layers are completely occupied, further growth ticks **no longer modify the grid** (no error, no extension beyond the configured dimensions) — the function returns the same unchanged city state. Score and population (M2.T9, M2.T18), which are calculated elsewhere based on elapsed time and not on the grid state, continue instead to evolve normally even beyond this point: the cap is purely visual/rendering-related, not a cap on session progress.

#### M2.T12b — `lib/city/decoration-engine.ts` — procedural details
> **Superseded by CR6** (see §2.9.3): the decoration engine is replaced by the ambient layer of the 3D view (CR6.T7).
* **Objective**: pure function `decorate(cityState, rng: SeededRandom): CityState` that, while keeping the already-composed building structure intact, randomizes fine details: lit/unlit windows (occasionally replacing `[ ]` with `[*]`/`[#]`/`[░]`), background/foreground decorative elements (trees, streetlights, cars, clouds).
* **Files**: `lib/city/decoration-engine.ts`
* **Dependencies**: M2.T12
* **Acceptance criteria**:
  - Never alters a building's load-bearing structure (bases/floors/tops remain those composed by `building-composer.ts`), only overlay details.
  - Same state + same seed → same decorated result (determinism for tests).
  - Distinct and decoupled from the growth engine: decoration is a subsequent, optional step, disableable without breaking structural growth (Separation of Concerns principle).

#### M2.T13 — `lib/city/palette.ts` (domain hash → color)
> **Superseded by CR6** (see §2.9.3): the domain hash → color is replaced by a random session palette with a hue shift (CR6.T3).
* **Objective**: deterministic pure function `getBuildingColor(domain: string): string` that always assigns the same color to the same domain, drawing from a defined palette (blue/orange/green/yellow).
* **Files**: `lib/city/palette.ts`
* **Dependencies**: M1.T2
* **Acceptance criteria**:
  - Same normalized domain → same color, always (test with repeated calls).
  - Reasonably uniform distribution over a sample of N test domains (no gross bias toward a single color) — verifiable with a simple, non-rigorous statistical test.

#### M2.T13b — `lib/city/theme-registry.ts` — color themes/biomes per session
> **Superseded by CR6** (see §2.9.3): the theme registry is replaced by the session palettes (CR6.T3).
* **Objective**: define the available color themes/biomes as **data** (Open/Closed principle, Section 1.1) and assign one to each session **deterministically**, so the same session always renders in the same biome across a service-worker restart while different sessions vary. A biome supplies the palette the M2.T13 domain hash draws from and the CRT backdrop color, without changing the hash logic itself.
* **Files**: `lib/city/theme-registry.ts`, `utils/hash.ts` (shared FNV-1a hash), `store/city.slice.ts` (re-export of `DEFAULT_THEME_ID`), `store/index.ts` (wiring of the `selectThemeId` port).
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - Themes are defined as an array of data entries (at least two), each with a non-empty `palette` and `backgroundColor`; adding a new biome requires only adding an entry, never modifying the selection logic.
  - `selectThemeId(sessionId)` is pure and deterministic: the same session id always maps to the same theme id (verified with repeated calls), and a sample of sessions spreads over more than one biome (no gross bias).
  - The documented default theme id is a real member of the registry, so the fallback is always renderable; an empty/unknown session id degrades to it instead of throwing (untrusted boundary, Section 1.4).
  - The palette remains a parameter of `getBuildingColor` (M2.T13), so applying a biome's palette is the renderer's job (M2.T14).
  - No internal `Date.now()`/`Math.random()` (Dependency Inversion principle).

#### M2.T14 — `CityCanvas` + `CityCell` (ASCII render + CRT glow)
> **Superseded by CR6** (see §2.9.3): `CityCanvas`/`CityCell` are replaced by the three.js view with bloom and CRT pass, and a text fallback (CR6.T6a–T8b).
* **Objective**: React components that render the city grid as monospace `<pre>`/`<span>` with green CRT `text-shadow`, applying colors from `palette.ts`.
* **Files**: `components/city/CityCanvas.tsx`, `components/city/CityCell.tsx`
* **Dependencies**: M2.T12, M2.T13
* **Acceptance criteria**:
  - The component receives `CityGrid` as a prop (no direct store reads inside `CityCell`, only in `CityCanvas` — Separation of Concerns principle).
  - CSS applies `text-shadow: 0 0 4px currentColor` as per the document.
  - A snapshot/rendering test verifies that a `destroyed` cell no longer shows the building's character/color.

#### M2.T15 — Linking growth-engine ↔ timer tick
> **Amended by CR6** (see §2.9.3): the growth tick advances session progress only; the view derives the floors (CR6.T5b).
* **Objective**: every timer tick (M2.T1/M2.T2) invokes `growCity` on the city store with the elapsed, distraction-free time delta.
* **Files**: `entrypoints/background.ts` (extension)
* **Dependencies**: M2.T12, M2.T2
* **Acceptance criteria**:
  - A tick with `status === 'running'` and no violation during the period → the city grows by the expected delta.
  - Integration test: a sequence of simulated ticks produces a grid consistent with the growth engine's expected output.

#### M2.T16 — Linking malus ↔ building destruction
> **Amended by CR6** (see §2.9.3): the malus wiring lowers the score; the newest floors disappear and a partly paid floor shows as damaged (CR6.T4, CR6.T5b).
* **Objective**: the malus event (M2.T10) applies `destroyBuilding` on the actual city state in the store, not just on the isolated model.
* **Files**: `entrypoints/background.ts` (extension)
* **Dependencies**: M2.T10, M2.T12
* **Acceptance criteria**:
  - Integration test: simulate `SITE_BLOCKED_ATTEMPT` with the "proceed" choice → the city store reflects the destruction within the same update cycle.

#### M2.T17 — `ScoreBadge` (Excellent/Good/Bad UI)
* **Objective**: component that shows the current score level with a distinctive style for each level.
* **Files**: `components/score/ScoreBadge.tsx`
* **Dependencies**: M2.T9
* **Acceptance criteria**:
  - Correctly renders the three variants based on the store value (test with the three states forced).

#### M2.T18 — `PopulationCounter` + `lib/score/calculate-population.ts`
* **Objective**: derive the session population from the focused time — **+5 per house** (an unlocked building base) and **+15 per building floor** — and expose it in the UI. Because population is a function of elapsed focus time, it keeps evolving even after the grid is visually full (see the M2.T12 note): the cap is on rendering, not on session progress.
* **Files**: `lib/score/calculate-population.ts` (pure), `components/score/PopulationCounter.tsx`, `store/score.slice.ts` (the `population` field + `setPopulation`), `store/index.ts` (selector re-export).
* **Dependencies**: M2.T11c
* **Acceptance criteria**:
  - The formula is derived from the M2.T11c unlock schedule rather than duplicating its minute thresholds, so the value agrees with what `composeBuilding` actually unlocks for the same focused time, and is independent of the randomly chosen module variant (only categories count).
  - Decorative `top` elements add no inhabitants.
  - Pure and total (Section 1.4): no internal `Date.now()`/`Math.random()`; `NaN`, negative and `-Infinity` inputs yield `0`, `+Infinity` yields the maximum.
  - `PopulationCounter` reads the value through the store selector and performs no calculation itself (Separation of Concerns principle).
  - Population lives in the persisted `score` slice (M2.T9) so it survives a service-worker restart and can feed `SessionSummary.population` (M1.T1/M2.T19).

#### M2.T19 — `session-history.slice.ts` — history of the last 5 sessions
* **Objective**: keep the history of the last 5 completed sessions in the persisted state (Section 1.3), so the popup can show past scores and populations (M3.T7).
* **Files**: `store/session-history.slice.ts`, `store/index.ts` (slice combination, `partialize`, selectors).
* **Dependencies**: M2.T9
* **Acceptance criteria**:
  - The slice holds `ReadonlyArray<SessionSummary>` (the M1.T1 type: `sessionId`, `score`, `population`, `endedAt`) plus a `recordSession(summary)` action.
  - A pure helper (e.g. `appendSessionSummary`) inserts the new summary **newest first**, **dedups by `sessionId`** (a re-emitted `SESSION_ENDED` replaces the existing entry instead of growing the history) and **caps at 5** entries, dropping the oldest. It never mutates its input; a no-op returns the same reference so the caller can skip persisting/re-rendering (Section 1.4).
  - The slice is a thin store layer that computes nothing: it delegates to the pure helper and writes only when the array reference changed.
  - The history is part of `PersistedState`/`partialize`, so it survives a service-worker restart; `ui` is still excluded.
  - Runtime population of the slice is owned by the task that implements session completion (the `SESSION_ENDED` event), not by this task.

#### M2.T20 — Allowlist/blocklist mutual-exclusion validation
> **Superseded by CR1** (see §2.4): the task is obsolete — with a single blocklist there is no second list to conflict with (CR1.T5a).
* **Objective**: prevent the same canonical domain from ending up in both allowlist and blocklist simultaneously, and explicitly establish the resolution rule for when the conflict exists anyway (import, preset, pre-existing state).
* **Files**: `store/blocklist.slice.ts`, `components/blocklist/SiteList.tsx` (UI feedback).
* **Dependencies**: M2.T4
* **Acceptance criteria**:
  - Adding to the blocklist a domain already present in the allowlist (or vice versa) does not create a double entry: the UI offers to move it or shows explicit feedback. The comparison is performed on already-normalized domains (M1.T2/M2.T4).
  - **Precedence order (design decision)**: in case of a residual conflict, the **allowlist always wins** over the blocklist — no domain present in the allowlist is ever blocked (consistent with M2.T6).

#### M2.T21 — Defensive normalization of blocklist input (entry + navigation check)
> **Superseded by CR1** (see §2.4): the normalization still applies, but the navigation check matches the blocklist only — no allowlist precedence (CR1.T4).
* **Objective**: ensure domains are always in canonical registrable form at **two distinct points**, reusing the single `getRegistrableDomain` function (DRY, Section 1.1): (1) **at entry time** (user/preset input, untrusted) and (2) **at navigation-check time** (the tab's URL, untrusted). An already-saved entry and a URL received from content/browser are never trusted.
* **Files**: `lib/blocking/normalize-entry.ts` (pure entry normalization/validation function), `store/blocklist.slice.ts` (entry), `entrypoints/background.ts` (navigation check), `lib/blocking/rules.ts` (consumption of the canonical form).
* **Dependencies**: M1.T2, M2.T4, M2.T6
* **Acceptance criteria**:
  - **Entry**: every entry (even from a preset, M2.T5/M3.T1) goes through `getRegistrableDomain`; if the input is not a valid registrable domain — a "bare" public suffix (`co.uk`, `com`, `github.io`) or a malformed URL — the entry is rejected and the UI shows the error **"Enter a valid URL"** (see M3.T3).
  - **Navigation check**: the tab's URL is normalized with the same function before matching against blocklist/allowlist; a non-normalizable URL does not cause a crash and does not trigger an erroneous block (allowlist > blocklist precedence applies, M2.T6).
  - Test: the same inputs (with/without subdomain, with/without protocol) always produce the same canonical form regardless of the entry point; an input of equal content, whether entered by hand or arriving as a navigation URL, normalizes to the same domain.
  - **Notes/decisions**: normalization **removes** subdomains (collapses toward `eTLD+1`), it does not add them — a design decision made explicit in M1.T2.

### 1.6 Milestone 3 — Secondary features

#### M3.T1 — `PresetPicker` (preset selection UI)
> **Amended by CR2** (see §2.5.3): the preset buttons are disabled outside `idle` (CR2.T3a).
* **Objective**: component that lists the presets (M2.T5) and allows applying them to the blocklist all at once.
* **Files**: `components/blocklist/PresetPicker.tsx`
* **Dependencies**: M2.T5, M2.T4
* **Acceptance criteria**:
  - Selecting "Social" adds all the preset's domains to the blocklist in a single store action (not N separate actions causing N re-renders/persists).

#### M3.T2 — `TagEditor` — custom categories via tags
> **Amended by CR2** (see §2.5.3): tag creation, deletion and assignment are disabled outside `idle`; the tag filter stays usable (CR2.T3b).
* **Objective**: UI to create/assign custom tags to a group of sites, to build custom presets.
* **Files**: `components/blocklist/TagEditor.tsx`
* **Dependencies**: M2.T4
* **Acceptance criteria**:
  - Creating a tag and assigning it to ≥2 sites; filtering the site list by that tag shows only those.

#### M3.T3 — `SiteList` — site CRUD in allow/blocklist
> **Superseded by CR1** (see §2.4): the component is blocklist-only — no generic list prop and no cross-list move feedback (CR1.T1).
> **Amended by CR2** (see §2.5.3): the add form and the remove buttons are disabled outside `idle` (CR2.T3a).
* **Objective**: manual management UI (add/remove a single domain), with real-time normalization via `tldts` in the input.
* **Files**: `components/blocklist/SiteList.tsx`
* **Dependencies**: M2.T4, M1.T2, M2.T20, M2.T21
* **Acceptance criteria**:
  - Entering a full URL (`https://m.facebook.com/something`) results in a single normalized `facebook.com` entry.
  - Attempting to add an already-present domain does not create a duplicate (explicit UI feedback).
  - If the input is not a valid registrable domain — for example a "bare" public suffix (`co.uk`, `com`, `github.io`) or a malformed URL — the error message **"Enter a valid URL"** appears and the entry is not added (no exception, see M2.T21 and M1.T2).
  - The **allowlist > blocklist** precedence (M2.T6, M2.T20) is respected in the feedback too: adding to the allowlist a domain already in the blocklist (or vice versa) never creates a double entry.

#### M3.T3b — Popup → background timer path (commands + 2s tick emitter)
* **Objective**: close the popup → background timer path so the UI can actually drive the session the background owns: route the timer commands through the mutation bus (the popup store is read-only, M1.T9) and emit the fine-grained 2s `TIMER_TICK` that the background already consumes for growth (M2.T15) and malus (M2.T16).
* **Files**: `lib/messaging/messages.types.ts` (add the timer variants to `MutationMessage`/`MUTATION_TYPES`), `entrypoints/background.ts` (handle the timer mutations), `components/timer/TimerControls.tsx` (route through `sendMutation` instead of mutating the read-only store), `entrypoints/popup/App.tsx` (start/stop the tick emitter with the popup's lifetime), `store/index.ts` (the `ui.liveRemainingSeconds` field, if the popup-side countdown is implemented here).
* **Dependencies**: M2.T1, M2.T2, M2.T3, M1.T10, M2.T15
* **Acceptance criteria**:
  - `TIMER_STARTED`/`TIMER_PAUSED` (and the reset transition, if it needs a variant) are part of `MutationMessage` and handled by the background's mutation path, so `startTimer()`/`pauseTimer()`/`resetTimer()` invoked from the popup change the **background's** timer state and schedule/clear the alarm on the background's provider — not on the popup's own in-memory copy (closes changelog issue #6).
  - The popup emits `TIMER_TICK` on the 2s cadence while a session is `running`, and the background's existing growth/malus wiring consumes it unchanged (closes changelog issue #9).
  - The emitter is tied to the popup's lifetime and stops on unmount; a tick arriving while `status !== 'running'` neither grows the city nor accrues malus (M2.T15 behaviour preserved).
  - The popup-side estimated countdown (the §1 "two distinct clocks" note) is either implemented here through `ui.liveRemainingSeconds` or explicitly deferred, with the decision recorded in the changelog.
  - Integration test (`fakeBrowser`): a command sent from the popup updates the background store exactly once; a sequence of simulated ticks produces the expected city growth.
* **Notes/decisions**: the popup closes when the user clicks away, so a popup-owned emitter means the city only grows while the popup is open. The §1 technical note ("lives on the popup/background side only while the context is active") is ambiguous about which side owns the tick; the chosen side must be documented with a "why" comment (§1.4) and reported in the changelog.

#### M3.T3c — Session completion (`SESSION_ENDED` → history + population)
* **Objective**: implement the end-of-session path so the timer actually reaches zero and the session's outcome is recorded: emit `SESSION_ENDED` and populate the session history (M2.T19) and the population counter (M2.T18).
* **Files**: `entrypoints/background.ts` (replace the empty `handlePlaceholder` on alarm fire with the real completion handler), `store/session-history.slice.ts` (consumption via `recordSession`), `store/score.slice.ts` (consumption via `setPopulation`), `lib/score/calculate-population.ts` (consumption).
* **Dependencies**: M2.T2, M2.T18, M2.T19
* **Acceptance criteria**:
  - The alarm firing at the end of a session transitions the timer out of `running` and emits `SESSION_ENDED` with a `SessionSummary` (`sessionId`, `score`, `population`, `endedAt`) — the M1.T1 variant that is currently declared but never emitted (closes changelog issue #13).
  - The background records the summary through `recordSession` (newest first, dedup by `sessionId`, capped at 5 — the M2.T19 contract) and computes the session population from the elapsed focus time through `calculatePopulation`, writing it with `setPopulation` (closes changelog issue #12).
  - A re-emitted `SESSION_ENDED` for the same `sessionId` replaces the existing entry instead of growing the history.
  - Integration test (`fakeBrowser` + fake alarms): a session that runs to completion records exactly one history entry with the expected score/population; a session that is paused/reset before completion records none.
* **Notes/decisions**: the exact `distractionRatio` formula remains the roadmap §4 open point; this task consumes whatever ratio the existing score slice holds rather than defining the formula.

#### M3.T4 — Popup `App.tsx` — full UI composition
> **Amended by CR2** (see §2.5.3): the blocklist section also renders the single lock notice (CR2.T3c).
* **Objective**: compose all components (timer, city, score, blocklist) in the main popup behind a **tab bar** (one section visible at a time), replacing the WXT starter UI.
* **Files**: `entrypoints/popup/App.tsx`, `entrypoints/popup/App.css` + `entrypoints/popup/style.css` (replace the WXT starter styles), `locales/en.yml` + `locales/it.yml` (new composition strings), `store/index.ts` (a `setActiveTab` action for the existing `ui.activeTab` field)
* **Dependencies**: M2.T3, M2.T14, M2.T17, M2.T18, M2.T19, M3.T1, M3.T2, M3.T3, M3.T3b, M3.T3c, M3.T7, M3.T8
* **Acceptance criteria**:
  - All sections are reachable and functional from a single entry point: `TimerDisplay` + `TimerControls` (M2.T3), `CityCanvas` (M2.T14), `ScoreBadge` (M2.T17) + `PopulationCounter` (M2.T18) + `SessionHistory` (M3.T7), `PresetPicker` (M3.T1) + `TagEditor` (M3.T2) + `SiteList` (M3.T3), and `ExportCityButton` (M3.T8).
  - **Layout decision (tabs)**: the popup shows one section at a time behind a tab bar driven by the existing `ui.activeTab` field (`PopupTab`, M1.T4) through a new `setActiveTab` action; the field is volatile, so the popup always opens on the default tab. The tab bar is keyboard-navigable with the correct ARIA roles (`tablist`/`tab`/`tabpanel`), which M4.T4 then polishes.
  - **Sizing decision (content-sized)**: the popup is sized by its content and must not scroll; the city canvas and the blocklist sections are laid out to fit the popup's natural width rather than forcing a fixed viewport.
  - **Visual decision (CRT)**: the black-and-green CRT look is kept, consistent with the components' own inline styles (M2.T14/M2.T17/M2.T18); `App.css`/`style.css` provide the reset, the dark background and the tab-bar/section layout, and drop the starter's `#root { max-width: 1280px }` and `body { min-height: 100vh }`.
  - `ExportCityButton` is visible at session end, not during the session.
  - Every string in `App.tsx` goes through `i18n.t(...)` (M3.T9), with the new keys added to **both** `locales/en.yml` and `locales/it.yml` so the M3.T10 drift test stays green (closes changelog issue #17).
  - End-to-end integration test at the component level (not a real browser): starting a timer from the UI updates both `TimerDisplay` and (indirectly) the city state after a simulated tick.
* **Notes/decisions**: the composition is deliberately split from the timer path (M3.T3b) and session completion (M3.T3c) so this card stays a pure composition task; its acceptance criteria depend on those two landing first. **Test seam (decision: option A)**: the integration test starts the real background in-process with `fakeBrowser` (the pattern of `tests/integration/messaging/mutation-bus.test.ts`) and renders `<App />` against the module-level `useAppStore` singleton, letting the background's writes reach the popup through `attachStoreSync` (M1.T8) — no injectable-store refactor of the components. The dead `ui.malusAlertVisible` field is dropped here: the malus alert is the content-script overlay (M2.T8), not a popup element, so the flag has no consumer.

#### M3.T5 — `framer-motion` animations on building growth/destruction
> **Superseded by CR6** (see §2.9.3): the `framer-motion` character animations are replaced by floor drop, glitch-out and damaged-floor effects in the renderer (CR6.T7).
* **Objective**: animated transitions when a cell moves from `growing→building` or is destroyed.
* **Files**: `components/city/CityCell.tsx` (extension)
* **Dependencies**: M2.T14
* **Acceptance criteria**:
  - Transitions do not block rendering in tests (mock/disable `framer-motion` in tests if needed for stability).
  - No regression in the M2.T14 tests.

#### M3.T6 — Multi-browser persistence: Firefox/Chrome build verification
* **Objective**: validate that the manifest, `declarativeNetRequest`, `browser.alarms`, and the Shadow DOM overlay work identically on both WXT build targets.
* **Files**: any adjustments in `wxt.config.ts`, notes in `README.md`.
* **Dependencies**: M3.T4
* **Acceptance criteria**:
  - `wxt build -b chrome` and `wxt build -b firefox` produce working extensions (verified at least manually for the first pass, then covered by M4.T5).

#### M3.T7 — `SessionHistory` (5-session history UI)
* **Objective**: show the last 5 completed sessions (score and population) in the popup, reading them from the persisted `sessionHistory` slice (M2.T19).
* **Files**: `components/score/SessionHistory.tsx`, `store/session-history.slice.ts` (consumption via `selectSessionHistory` only), `entrypoints/popup/App.tsx` (composition, M3.T4).
* **Dependencies**: M2.T19
* **Acceptance criteria**:
  - The component is presentational: it reads the history through the M2.T19 selector and computes nothing (Separation of Concerns principle); the score level is rendered from the stored value, never recalculated.
  - Renders correctly with an **empty history** (no crash, explicit empty state) and with a full 5-entry history, showing the sessions newest first (the slice's order is preserved, not re-sorted).
  - The displayed order and cap match the slice's contract (max 5, newest first) rather than being re-implemented in the component.
  - Strings are hardcoded in EN here and moved to `i18n.t(...)` in M3.T9, like the other components.
  - Test: rendering with an empty history and with 5 entries, and the transition when a new session is recorded.

#### M3.T8 — `ExportCityButton` — export city as JPEG/PNG at end of focus
> **Amended by CR6** (see §2.9.3): the export serializes the text city until CR6.T10 adds the 3D frame capture (CR6.T9a, CR6.T10).
* **Objective**: let the user export the city of a finished session as an image, so the "one city per session" result can be kept outside the extension.
* **Files**: `lib/city/export-image.ts` (DOM/canvas serialization → JPEG/PNG), `components/city/ExportCityButton.tsx`, `entrypoints/popup/App.tsx` (composition, M3.T4).
* **Dependencies**: M2.T14
* **Acceptance criteria**:
  - The export renders the current three layers exactly as `CityCanvas` (M2.T14) displays them, including the active theme's palette and `backgroundColor` (M2.T13/M2.T13b), so the image matches what the user sees.
  - The serialization logic lives in `lib/city/export-image.ts` and is kept separate from the component, which only triggers the export and handles the download (Separation of Concerns principle).
  - Both JPEG and PNG outputs are available.
  - A failure during export is handled at a known boundary and does not break the popup (Section 1.4).
  - Test: the serialization function is unit-tested against a known grid (deterministic output dimensions/content); the component test asserts that triggering the export calls it with the current grid and theme.

#### M3.T9 — Internationalization (i18n) — WXT `@wxt-dev/i18n` module setup (EN default)
* **Objective**: configure the official WXT `@wxt-dev/i18n` module (a type-safe, synchronous wrapper around `browser.i18n`) for all visible popup strings and content script messages, with **English as the default language** (and as the fallback for missing keys). The actual language is determined **automatically from the browser's language**: if the browser is set to Italian, the extension shows Italian; in every other case it shows English. **There is no manual language selector** nor any persisted user preference: changing language requires changing the browser's language (an intrinsic limitation of the `browser.i18n` API, accepted at design time in exchange for lightness, synchronous loading, and native caching). Translations live in `locales/<lang>.yml` files with nested keys, compiled at build time into the `_locales/<lang>/messages.json` files expected by the browser: no async fetch, no duplicated translation bundle per entrypoint.
* **Files**: `wxt.config.ts` (registration of the `'@wxt-dev/i18n/module'` module + `manifest.default_locale: 'en'`), `locales/en.yml` (default EN strings, grouped by area: `timer`, `city`, `score`, `blocklist`, `overlay`, `common`), `components/**` components and `entrypoints/popup/App.tsx` (use of `i18n.t(...)`), `entrypoints/blocked-overlay.content.ts` (use of `i18n.t(...)` for overlay messages).
* **Dependencies**: M3.T4
* **Added runtime dependencies**: `@wxt-dev/i18n` (`^0.2.7`).
* **Acceptance criteria**:
  - `wxt.config.ts` registers the `'@wxt-dev/i18n/module'` module and sets `manifest.default_locale: 'en'`.
  - All strings visible in the popup and the overlay go through `i18n.t(...)` (auto-imported from `#i18n`): no hardcoded literal strings in the components.
  - There is no manual language selector nor a `language` field in any user slice: the language is automatically read from the browser's own via the native API.
  - Translations are loaded synchronously (no `await`, no fetch) to avoid flicker on first render.
  - The `i18n` instance is a single one shared across all contexts (popup and content script): the content script does not initialize its own separate instance and does not depend on the popup.
  - Adding a new language only requires creating `locales/<lang>.yml` with the same keys as `locales/en.yml` — no changes to the components or the config.
  - Test: a component using `i18n.t(key)` renders the expected EN string; with the IT locale forced (M3.T10) it renders the IT string.

#### M3.T10 — IT translation (language auto-detected from browser)
* **Objective**: add the complete Italian translation, with the **same key tree** as `locales/en.yml`. Italian is shown **automatically** when the user's browser is set to Italian; in every other case English remains. There is no UI control nor persisted language preference on the extension side: the language follows the browser's.
* **Files**: `locales/it.yml` (IT translation of every key present in `locales/en.yml`).
* **Dependencies**: M3.T9
* **Acceptance criteria**:
  - Every key present in `locales/en.yml` has a counterpart in `locales/it.yml` with the same tree (no missing keys; any that were missing would still fall back to the EN default language).
  - Language selection is **automatic only** (browser in Italian → Italian, otherwise English): no selector, no persisted preference, no dedicated store action.
  - The content script receives Italian when the browser is set to Italian (same shared `i18n` instance, no additional logic).
  - Test: EN/IT key coverage is verified by a test that compares the trees of the two files and fails if an IT key is missing (drift detection).

### 1.7 Milestone 4 — Polish and Nice-to-have

#### M4.T1 — *(Nice to have)* Malus proportional to time spent on the blocked site
> **Amended by CR6** (see §2.9.3): the escalation is part of `builtCharacters`, so it lowers the score and the city alike (CR6.T5b).
* **Objective**: extend `apply-malus.ts` (M2.T10) so that the malus grows as a function of time spent on the blocked site, not just the single event.
* **Files**: `lib/score/apply-malus.ts` (extension)
* **Dependencies**: M2.T10
* **Acceptance criteria**:
  - All else being equal, more time spent on the blocked site produces a greater or equal malus, never a smaller one (monotonic property tested).

#### M4.T2 — *(Nice to have)* TexturePacker / building sprite sheet integration
> **Superseded by CR6** (see §2.9.3): the 3D view needs no sprite sheet.
* **Objective**: replace (or complement) pure ASCII rendering with optimized sprites generated via TexturePacker to reduce rendering calls, while keeping the deterministic palette from M2.T13.
* **Files**: `assets/ascii/` (or a new `assets/sprites/` folder), update to `CityCell.tsx`.
* **Dependencies**: M2.T14
* **Acceptance criteria**:
  - No visual regression compared to the base ASCII behavior (ASCII remains the fallback/default if the sprite is unavailable).

> **Split note (planning, before implementation).** The original M4.T3 bundled five
> independent concerns — a shared logger, the background/bus boundaries, persistence
> diagnostics, the popup error boundary and the remaining UI/content boundaries — plus
> a lint guardrail. That is too much for one reviewable change, so M4.T3 is now an
> **umbrella** split into `M4.T3a` … `M4.T3e`; there is no standalone M4.T3 deliverable.
> Each subtask is independently shippable and verifiable. Order: **a first**, then
> b/c/d/e in any order (each depends only on a and on the feature it hardens).
> The changelog records the subtasks as they close; the M4.T3 umbrella is complete when
> all five are done.

#### M4.T3a — Centralized logger foundation
* **Objective**: provide the shared, dependency-free logging primitive that every other subtask consumes: levels, a scope/prefix, structured context and an injectable sink, with no call-site changes yet.
* **Files**: `utils/logger.ts` (new), `tests/unit/utils/logger.test.ts` (new).
* **Dependencies**: M0.T2
* **Acceptance criteria**:
  - API: `createLogger(scope, { sink?, minLevel? })` returns `debug`/`info`/`warn`/`error` plus `child(scope)`, so a module can log as `[buildit:background:dnr]`.
  - Levels are real and filtered by threshold: `debug`/`info` are enabled in development, `warn`/`error` in production; the threshold is overridable for tests. Default sink is `console`, but a test can inject a fake without spying on console.
  - `error(message, cause?, context?)` accepts `unknown`, normalizes non-`Error` values to `Error` (preserving the stack when available) and carries technical context. No throw from the logger itself.
  - No remote transport, no persistence and no user data in the context: scopes and technical fields only (message type, storage key, export format), never URLs, domains or message payloads.
  - Unit tests cover level thresholds, prefix/child scopes, cause/context forwarding, sink injection and a missing/failing sink (the logger must not throw into the caller).
* **Notes/decisions**: `no-console` enforcement is deliberately deferred to M4.T3e: enabling it here would fail on the three existing `console.error` calls in the background, which M4.T3b removes.

#### M4.T3b — Background and message-bus error boundaries
* **Objective**: route every asynchronous background boundary through the logger and stop an async message handler from becoming an unhandled rejection.
* **Files**: `entrypoints/background.ts`, `lib/messaging/bus.ts`, `tests/integration/background/background.test.ts`, `tests/integration/background/dnr-rules.test.ts`, `tests/integration/messaging/bus.test.ts`.
* **Dependencies**: M4.T3a, M1.T6, M2.T7
* **Acceptance criteria**:
  - The three `console.error` calls in `entrypoints/background.ts` are replaced by a scoped logger: DNR rule sync, tab-distraction-tracker startup and startup reconciliation. Messages and causes are preserved (and asserted through an injected logger/sink, not exact console text).
  - A `bootstrapBackground()` wrapper catches synchronous failures from `startBackground()`, logs scope + cause and returns `null`, so a failed initialization cannot kill the service worker; the default WXT entrypoint calls the wrapper. Asynchronous `ready` failures remain caught.
  - `onMessage` wraps handler invocation (sync throws **and** async rejections) and logs `error` with `{ type }`; the listener still returns `void` to the browser and a rejecting handler does not surface as an unhandled rejection.
  - A simulated DNR failure is logged with context and the service worker remains usable (store still starts a timer); the normal session-completion path still logs nothing.
  - Tests: failing DNR fake → logger error + `handle.ready` resolves + store usable; throwing/rejecting handler → log + no propagation; bootstrap failure → log + `null`.

#### M4.T3c — Persistence read/rehydration hardening (CI-3)
* **Objective**: close store-analysis CI-3 by making corrupt or unexpected persisted values visible instead of silently degrading to defaults, without changing the fallback behaviour itself.
* **Files**: `store/storage-adapter.ts`, `store/index.ts`, `tests/integration/store/storage-adapter.test.ts`, `tests/integration/store/store.test.ts`.
* **Dependencies**: M4.T3a, M1.T9
* **Acceptance criteria**:
  - A missing storage key still returns `null` **without logging** (first hydration is normal). A present but non-string value logs `warn` with the key and still returns `null`; the adapter accepts an optional logger for tests.
  - `onRehydrateStorage` logs `error` when the persisted JSON cannot be parsed/migrated, then the store keeps its existing defaults; a malformed payload no longer disappears without a diagnostic.
  - Logs contain the storage key and the error only — never the raw persisted value or user domains.
  - Tests: non-string value → warn + `null`; absent key → no warn; corrupt JSON → error + default state; a valid payload logs nothing.

#### M4.T3d — Popup React error boundary
* **Objective**: ensure a render/lifecycle error in a popup component logs with component context and shows a localized recovery screen instead of a blank/dead popup.
* **Files**: `components/common/ErrorBoundary.tsx` (new), `entrypoints/popup/main.tsx`, `locales/en.yml`, `locales/it.yml`, `tests/unit/components/common/ErrorBoundary.test.tsx` (new).
* **Dependencies**: M4.T3a, M3.T4, M3.T10
* **Acceptance criteria**:
  - A class-based `ErrorBoundary` implements `getDerivedStateFromError` + `componentDidCatch`, logs the error and `componentStack` through the scoped logger and renders an accessible fallback (`role="alert"`).
  - The fallback is fully localized: three new `common` keys (`errorTitle`, `errorBody`, `reload`) exist in **both** `locales/en.yml` and `locales/it.yml`, so the M3.T10 drift test stays green. The reload button calls `window.location.reload()` by default; `onReset`/`onError` props allow deterministic tests and a future reset strategy.
  - `<App />` is wrapped in the boundary in `entrypoints/popup/main.tsx`; the normal popup composition and all existing tests are unchanged.
  - Test: a child that throws is contained, the injected logger/error hook receives the error, the fallback text is translated, and reset recovers when the child stops throwing.
  - Scope limit: event-handler and async errors are not caught here; they are covered by M4.T3b (bus), M4.T3c (store) and M4.T3e (content/export).

#### M4.T3e — Content/export boundaries + logging guardrails
* **Objective**: close the remaining silent boundaries and make the “no empty catch / no scattered console” rule enforceable, so the next feature cannot regress M4.T3.
* **Files**: `entrypoints/blocked-overlay.content.tsx`, `components/city/ExportCityButton.tsx`, `eslint.config.js`, `tests/integration/content/blocked-overlay.test.ts`, `tests/unit/components/city/ExportCityButton.test.tsx`.
* **Dependencies**: M4.T3a, M2.T8, M3.T8
* **Acceptance criteria**:
  - The content script logs (with scope) a rejected `reader.refresh()`, an unreadable persisted snapshot and a rejected `sendAttempt`; the overlay still unmounts/mounts correctly and a failed background send leaves the page alive. No URL/domain is logged.
  - `ExportCityButton` logs a failed `Result` and a rejected exporter promise (format as context) while keeping the existing localized user-facing error; the popup never throws.
  - ESLint enforces `no-empty` with `allowEmptyCatch: false` and `no-console` (exceptions: `utils/logger.ts` and `tests/**`). The intentional `apply-rules.ts` queue guard `.catch(() => undefined)` stays, with its comment explaining that the returned promise still rejects; it is not an empty catch and does not silence the caller.
  - Manual search `rg -n 'catch\s*(\([^)]*\))?\s*\{\s*\}' entrypoints components lib store utils` returns zero results; `bun run compile`, `bun run lint`, `bun run test`, `bun run build` and `bun run build:firefox` are green.
  - This subtask closes the umbrella's original acceptance criteria: every known boundary logs with context and the simulated background failure does not crash the worker.

> **Changelog convention for the split.** Each subtask gets its own changelog entry (files, tests, commit) when it closes; the final M4.T3e entry records the full-suite/build verification and marks M4.T3a–e complete. Do not rewrite the historical M4.T2 “skipped” entry.

#### M4.T4 — Popup accessibility polish
* **Objective**: a pass on color contrast (particularly the CRT glow effect), keyboard focus, and ARIA labels on timer/blocklist controls.
* **Files**: components in `components/` involved.
* **Dependencies**: M3.T4
* **Acceptance criteria**:
  - All interactive controls reachable via keyboard (sensible tab order).
  - No interactive element without an accessible label.

#### M4.T5 — Full multi-scenario e2e suite
* **Objective**: cover with Playwright the main end-to-end scenarios: start timer → city growth, attempt to access a blocked site → overlay → malus, apply preset → verify effective blocking.
* **Files**: `tests/e2e/*.spec.ts`
* **Dependencies**: M3.T6
* **Acceptance criteria**:
  - Each of the three scenarios above has at least one green e2e test on Chromium.

### 1.8 Milestone 5 — Sound cues

> **Goal.** Play a short synthesized sound when a focus session **starts** and when it **ends on its own**. In a new **Settings** tab the user picks one **sound theme** (a start + end pair), sets the volume, or turns sounds off.
>
> **Decisions (fixed; a task does not reopen them).**
> - **Synthesized live, no audio files.** Every sound is a *recipe* (plain data) rendered with the Web Audio API. No `.ogg`/`.wav` assets, no new dependency, no licence to track. Pre-rendering to files is out of scope.
> - **Four themes**, defined as data (Open/Closed): `neon` (detuned chime), `synthwave` (rising arpeggio), `glitch` (bit-crushed burst), `terminal` (retro beeps). The default is `glitch`.
> - **Only two events make a sound.** A *fresh start* (`TIMER_STARTED` while `idle`, which creates a new session) plays the start sound. A *natural completion* (`createSessionCompletion` closes the session: the alarm fired, or the startup catch-up found the deadline passed) plays the end sound. Resume, pause, reset and duration changes are silent.
> - **Lateness guard.** The end sound plays only if the completion is handled at most **60 s** after `timer.endsAt` (`END_SOUND_MAX_LATENESS_MS = 60_000`). When it is handled later (machine asleep, browser closed at the deadline), the session still completes, silently. 60 s absorbs normal alarm and worker wake-up delays.
> - **Preferences** are `{ enabled, themeId, volume }`, defaults `{ true, 'glitch', 50 }`, with `volume` an integer 0–100. They are persisted and written only by the background (single writer, M1.T9) through the `PREFERENCES_SOUND_SET` mutation. They are **not locked** during a session.
> - **Settings UI**: a fifth popup tab, placed last and shown as a **gear icon** whose accessible name comes from `tabs.settings`. A text label could overflow the fixed 32 rem tab row in longer languages.
> - **Where sound plays.** Both cues are triggered by the **background**, the only context that sees both events with the popup closed.
>   - **Chrome:** the MV3 service worker has no `AudioContext`, so it plays through an **offscreen document** (`browser.offscreen`, reason `AUDIO_PLAYBACK`). The existence check uses `browser.runtime.getContexts` (Chrome 116+).
>   - **Firefox:** the MV3 background is an event page with a DOM, so it plays **directly**.
>   - **Popup:** plays only the theme **preview**, after a click.
> - **No persist version bump.** The slice-aware `merge` (store-analysis CI-2) already gives a field that an older payload lacks its default value, so `version` stays 4 and `migrate` is untouched.
>
> **Module map.**
> - `lib/sound/` holds pure code, testable in Node:
>   - `sound.types.ts` and `sound-themes.ts`: the recipes.
>   - `playback-plan.ts`: recipe + volume → timed tones.
>   - `waveshapes.ts`: noise and bit-crush samples.
>   - `sound-preferences.ts`: the preferences shape, defaults and validation.
>   - `sound-cues.ts`: when to play.
> - **Thin adapters**, each behind an injected port:
>   - `web-audio-renderer.ts`: plan → Web Audio nodes, with the context injected.
>   - `sound-player.ts`: the `SoundPlayer` port, the direct player and the silent player.
>   - `offscreen-sound-player.ts`: Chrome only.
>   - `platform-sound-player.ts`: picks the right player for the browser.
> - **Contexts:**
>   - the **background** decides and plays;
>   - the **offscreen page** (`entrypoints/offscreen/`) is a *fourth context* next to background, content script and popup (§1.1 Separation of Concerns). It holds no state and no logic: it turns a validated `PLAY_SOUND` message into sound;
>   - the **popup** shows the settings and plays previews.
>
> **Rules for every task in this milestone.**
> - TDD (CLAUDE.md §3.1, red → green → refactor) applies to every task.
> - `lib/sound/` never imports React or the store, and never reads `Date.now()` or `Math.random()`.
> - The only code that touches `browser.offscreen` is `createBrowserOffscreenApi` (M5.T12); M5.T13 only checks that the API exists.
> - All user-visible copy goes through `i18n.t`, with keys in both locale files.
> - Each card lists every file it may touch. A change needed outside that list belongs to another task: stop and report it instead of widening the task.

#### M5.T1 — Sound types and the four sound themes (data)
* **Objective**: define the types that describe a synthesized sound (a *recipe*) and the four themes as plain data. No playback code.
* **Files**: `lib/sound/sound.types.ts` (new, type-only), `lib/sound/sound-themes.ts` (new), `tests/unit/lib/sound/sound-themes.test.ts` (new).
* **Dependencies**: —
* **Types** (`sound.types.ts`; every field `readonly`, every array `ReadonlyArray`):
  - `SoundCue = 'start' | 'end'`; `SoundThemeId = 'neon' | 'synthwave' | 'glitch' | 'terminal'`; `Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle'`.
  - `SoundNote { frequencyHz; startSec; durationSec; glideToHz? }`: `glideToHz` slides the pitch over the note.
  - `SoundEnvelope { attackSec; releaseSec }`: the release starts after `durationSec`.
  - `SoundFilter { type: 'lowpass' | 'highpass' | 'bandpass'; fromHz; toHz; q }`: the cutoff sweeps from `fromHz` to `toHz` over each note.
  - `OscillatorVoice { kind: 'oscillator'; waveform; detuneCents: number[]; gain; envelope; notes: SoundNote[]; filter? }`: one oscillator per detune value per note (unison).
  - `NoiseVoice { kind: 'noise'; gain; envelope; bursts: { startSec; durationSec }[]; filter? }`.
  - `SoundEffects { delay?: { timeSec; feedback; mix }; bitcrush?: { bits } }`.
  - `SoundRecipe { voices: (OscillatorVoice | NoiseVoice)[]; effects: SoundEffects }`; `SoundTheme { id: SoundThemeId; start: SoundRecipe; end: SoundRecipe }`.
* **Data** (`sound-themes.ts`):
  - `SOUND_THEMES: ReadonlyArray<SoundTheme>` in the order neon, synthwave, glitch, terminal.
  - `DEFAULT_SOUND_THEME_ID = 'glitch'`.
  - `isSoundThemeId(value: unknown): value is SoundThemeId`.
  - `findSoundTheme(id: SoundThemeId): SoundTheme`.
  - Labels are **not** here: i18n belongs to the UI (M5.T16).
* **Starting values** (to be re-tuned by ear later, as long as the criteria below still hold). Notes are written as pitch name, then frequency in Hz, then (start s, duration s):
  - `neon` — **start**: a sawtooth voice, detune `[-8, 8]`, gain 0.3, envelope 0.005/0.25, lowpass 600→5000 Hz q 6, with notes A4 440 (0, 0.12), E5 659.25 (0.10, 0.12) and A5 880 (0.20, 0.35); plus a sine A3 220 (0.20, 0.35) at gain 0.2. Effects: delay 0.18 s, feedback 0.35, mix 0.3. **End**: the same voices with the notes reversed (A5, E5, A4; the last one 0.5 s) and the lowpass sweeping 5000→500 Hz.
  - `synthwave` — **start**: a square voice, detune `[0]`, gain 0.25, lowpass 2000→6000 Hz, playing C5 523.25, E♭5 622.25, G5 783.99 and C6 1046.5, each 0.08 s long and 0.07 s apart. Effects: delay 0.12 s, feedback 0.4, mix 0.35. **End**: the same arpeggio descending, then a sawtooth pad of C4 261.63 + G4 392 (0.6 s) with lowpass 3000→300 Hz.
  - `glitch` — **start**: noise bursts at 0, 0.05 and 0.10 s (0.03 s each) through a bandpass at 3000 Hz q 8, plus square blips of 1318.5, 659.25 and 1975.5 Hz (0.03 s) at the same times; bit-crush 4 bits. **End**: a 0.4 s noise burst through a bandpass sweeping 6000→400 Hz, plus a square note at 880 Hz gliding to 110 Hz over 0.5 s; bit-crush 5 bits.
  - `terminal` — **start**: square beeps, gain 0.2, no effects: 1000 Hz (0, 0.05), 1000 Hz (0.09, 0.05), 1500 Hz (0.18, 0.12). **End**: 1500 Hz (0, 0.08), 1000 Hz (0.12, 0.08), 750 Hz (0.24, 0.25).
* **Acceptance criteria**:
  - Exactly four themes, ids unique and in the order above. `DEFAULT_SOUND_THEME_ID` is one of them, and `findSoundTheme` returns the matching theme for each id.
  - `isSoundThemeId` accepts the four ids and rejects `'NEON'`, `''`, `1`, `null`, `undefined` and `{}`.
  - Every one of the 8 recipes (4 themes × start/end) satisfies all of the following:
    - it has at least one voice;
    - every frequency, including `glideToHz`, is between 20 and 20 000 Hz;
    - every `gain` is in (0, 1], and the voice gains of the recipe sum to at most 1;
    - every note and burst ends (`start + duration + release`) within **1.5 s**;
    - `attackSec` and `releaseSec` are > 0;
    - `bits`, when present, is an integer from 2 to 8;
    - `delay.feedback`, when present, is in [0, 0.8), and `delay.mix` in [0, 1].
  - The module imports nothing from `browser`, React, the store or Web Audio: data and two helpers only.

#### M5.T2 — `lib/sound/playback-plan.ts` — recipe + volume → timed tones (pure)
* **Objective**: turn a recipe and a volume into a flat, fully timed list of tones, so the renderer only schedules and decides nothing.
* **Files**: `lib/sound/playback-plan.ts` (new), `tests/unit/lib/sound/playback-plan.test.ts` (new).
* **Dependencies**: M5.T1
* **API**:
  - `PlannedTone` is one of two shapes:
    - `{ kind: 'oscillator'; waveform; frequencyHz; glideToHz?; detuneCents; startSec; durationSec; peakGain; attackSec; releaseSec; filter? }`, with `detuneCents` a single number;
    - `{ kind: 'noise'; startSec; durationSec; peakGain; attackSec; releaseSec; filter? }`.
  - `PlaybackPlan { tones: ReadonlyArray<PlannedTone>; masterGain: number; effects: SoundEffects; durationSec: number }`.
  - `calculateVolumeGain(volume: number): number` = `(clamp(volume, 0, 100) / 100) ** 2`. The square is a perceptual curve; a non-finite volume gives 0.
  - `calculatePlaybackPlan(recipe: SoundRecipe, volume: number): PlaybackPlan`.
* **Acceptance criteria**:
  - One oscillator tone per (note × detune value) and one noise tone per burst. `peakGain` is the voice's `gain`, and times are relative to 0 (the renderer adds its own clock).
  - `masterGain` = `calculateVolumeGain(volume)`. A volume ≤ 0 or `NaN` gives `tones: []` and `durationSec: 0`.
  - `durationSec` is the latest `startSec + durationSec + releaseSec` over all tones, plus a delay tail of `4 × delay.timeSec` when `effects.delay` is set.
  - `calculateVolumeGain`: 0 → 0, 50 → 0.25, 100 → 1, 150 → 1, −5 → 0, `NaN` → 0.
  - Pure: the same input gives the same output, and the input is not mutated (the test passes a deep-frozen recipe).
  - Tests use small hand-written recipes, so re-tuning a theme never breaks them. One extra test checks that every real theme recipe at volume 100 gives a non-empty plan of at most 2.5 s.

#### M5.T3 — `lib/sound/waveshapes.ts` — noise samples and bit-crush curve (pure)
* **Objective**: provide the two sample arrays the renderer needs and that are pure math: deterministic white noise and the bit-crush shaping curve.
* **Files**: `lib/sound/waveshapes.ts` (new), `tests/unit/lib/sound/waveshapes.test.ts` (new).
* **Dependencies**: —
* **API**:
  - `calculateNoiseSamples(length: number, seed: number): Float32Array`: values in [−1, 1], drawn from `createRng(seed)` (`lib/city/plan/rng.ts`), never `Math.random`.
  - `calculateBitcrushCurve(bits: number, size = 4096): Float32Array`: the `WaveShaperNode.curve` that maps the input range [−1, 1] onto `2 ** bits` evenly spaced output levels.
* **Acceptance criteria**:
  - Noise:
    - the array has the requested length and every value is in [−1, 1];
    - the same seed gives an identical array, and different seeds give different arrays;
    - a length of 0 gives an empty array; a negative length counts as 0, and a non-integer length is floored.
  - Bit-crush:
    - the curve has `size` entries and never decreases;
    - it has exactly `2 ** bits` distinct values for bits 2–8;
    - the first value is −1 and the last is 1;
    - `bits` outside 2–8 is clamped into that range.
  - No Web Audio, `browser` or store imports.

#### M5.T4 — Web Audio renderer behind an injected `AudioContext`
* **Objective**: schedule a `PlaybackPlan` on a Web Audio context as a thin adapter with no decisions of its own, testable with a fake context.
* **Files**: `lib/sound/web-audio-renderer.ts` (new), `lib/sound/audio-context.types.ts` (new, type-only: `AudioContextLike` and the node interfaces; the renderer re-exports `AudioContextLike`), `tests/helpers/fake-audio-context.ts` (new), `tests/unit/lib/sound/web-audio-renderer.test.ts` (new).
* **Dependencies**: M5.T2, M5.T3
* **API**:
  - `AudioContextLike`: the minimal subset of `AudioContext` the renderer uses, so the real `AudioContext` satisfies it structurally: `currentTime`, `state`, `sampleRate`, `destination`, `resume()`, `close()`, `createOscillator()`, `createGain()`, `createBiquadFilter()`, `createBufferSource()`, `createBuffer()`, `createDelay()`, `createWaveShaper()`.
  - `SoundRenderer { play(plan: PlaybackPlan): Promise<Result<void>>; stopAll(): void; dispose(): Promise<void> }`.
  - `createWebAudioRenderer(createContext: () => AudioContextLike): SoundRenderer`.
* **Behaviour**:
  - The context is created lazily on the first `play` and then reused. A `suspended` context is `resume()`d before scheduling.
  - The signal path:
    - each tone → its `BiquadFilterNode`, if it has a filter → its own envelope `GainNode` → one shared master `GainNode` set to `plan.masterGain`;
    - master → a `WaveShaperNode` using `calculateBitcrushCurve`, if `bitcrush` is set → destination;
    - when `delay` is set, a parallel branch: a `DelayNode` with a feedback gain, mixed in through a wet gain set to `mix`.
  - Timing (every time is offset by `context.currentTime + 0.02` s):
    - **envelope:** gain 0 at the tone's start, a linear ramp to `peakGain` at `start + attack`, a hold, then an exponential ramp to 0.0001 at `start + duration + release`, where the source stops;
    - **filter cutoff:** an exponential ramp from `fromHz` to `toHz` over the tone's duration;
    - **`glideToHz`:** an exponential frequency ramp over the tone's duration.
  - Noise tones share one buffer per context: 1 s of `calculateNoiseSamples(sampleRate, NOISE_SEED)`, looped.
  - An empty plan resolves `ok` without creating a context. A throwing factory or a failed `resume()` resolves `err(...)`; the renderer never throws (§1.4).
  - `stopAll()` stops every source still scheduled (used by the preview, M5.T18), and `dispose()` closes the context.
* **Acceptance criteria**:
  - With the fake context:
    - the number of oscillator and buffer sources equals the number of tones;
    - start/stop times and envelope ramps match the plan plus the offset;
    - the master gain equals `masterGain`;
    - the bit-crush and delay nodes exist only when the plan has them.
  - The factory is called once across two `play` calls, and a suspended fake is resumed before any `start()`.
  - A throwing factory makes `play` resolve `{ ok: false }`; nothing reaches the caller as an exception.
  - `stopAll()` calls `stop()` on started sources; `dispose()` calls `close()` exactly once.
  - The fake (`tests/helpers/fake-audio-context.ts`) records the created nodes, their connections and every `AudioParam` call (`setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`), so tests assert on records, not on sound.
* **Notes**: the renderer lives in `lib/` because the context is injected and it never imports `browser.*`. It is the only module that knows Web Audio node types.

#### M5.T5 — Sound preferences model and validation (pure)
* **Objective**: one pure module that owns the shape, the defaults and the validation of the sound preferences, shared by the store, the mutation handler and the cues.
* **Files**: `lib/sound/sound-preferences.ts` (new), `tests/unit/lib/sound/sound-preferences.test.ts` (new).
* **Dependencies**: M5.T1
* **API**:
  - `SoundPreferences { readonly enabled: boolean; readonly themeId: SoundThemeId; readonly volume: number }`, with `volume` an integer 0–100; `SoundPreferencesPatch = Partial<SoundPreferences>`.
  - `DEFAULT_SOUND_PREFERENCES = { enabled: true, themeId: DEFAULT_SOUND_THEME_ID, volume: 50 }`.
  - `sanitizeSoundPreferences(value: unknown): SoundPreferences` — *lenient*, for persisted data. Each invalid or missing field falls back to its own default; a non-integer volume in range is rounded; an out-of-range volume is clamped.
  - `applySoundPreferencesPatch(current: SoundPreferences, patch: unknown): Result<SoundPreferences>` — *strict*, for incoming messages.
  - `isSoundAudible(preferences: SoundPreferences): boolean` = `enabled && volume > 0`.
* **Acceptance criteria**:
  - `sanitizeSoundPreferences`:
    - `undefined`, `null`, `'x'` and `[]` give the defaults;
    - `{ enabled: false }` gives the defaults with `enabled: false`;
    - `{ themeId: 'bogus' }` gives the default theme;
    - volume `49.6` → 50, `-3` → 0, `140` → 100, and `NaN` or `'50'` → 50.
  - `applySoundPreferencesPatch` returns `err` (and leaves `current` untouched) for: a non-object, an array, `{}`, an unknown key, an `enabled` that is not boolean, an unknown `themeId`, or a `volume` that is not an integer from 0 to 100. A valid patch with one, two or three keys returns the merged preferences.
  - `isSoundAudible` is false when sounds are disabled or the volume is 0, and true otherwise.
  - No imports from the store, React, `browser` or Web Audio.

#### M5.T6 — `preferences.slice.ts` — sound preferences state and selectors
* **Objective**: add a `preferences` slice that holds the sound preferences, with one background-side action and granular selectors. No persistence and no messaging yet.
* **Files**: `store/preferences.slice.ts` (new), `store/index.ts` (compose the slice and add the selectors), `tests/unit/store/preferences-slice.test.ts` (new).
* **Dependencies**: M5.T5, M1.T4
* **Acceptance criteria**:
  - `PreferencesSlice { preferences: { sound: SoundPreferences }; setSoundPreferences(patch: unknown): void }`, created by `createPreferencesSlice()` with the same factory shape as the other slices and composed in `createAppState`. The initial state is `DEFAULT_SOUND_PREFERENCES`.
  - `setSoundPreferences` applies `applySoundPreferencesPatch`. An `err` result or an unchanged value calls **no `set`**, so subscribers are not notified (checked with a subscribe spy).
  - New granular selectors in `store/index.ts` (§1.3): `selectSoundEnabled`, `selectSoundThemeId`, `selectSoundVolume`.
  - The action works in every timer status (`idle`, `running`, `paused`, `completed`): there is no lock.
  - Existing tests still pass.

#### M5.T7 — Persist the sound preferences (no version bump)
* **Objective**: make `preferences.sound` survive a browser restart while keeping persist `version: 4`.
* **Files**: `store/index.ts` (`PersistedState`, `partialize`, `merge`), `tests/integration/store/store.test.ts`.
* **Dependencies**: M5.T6
* **Acceptance criteria**:
  - `PersistedState` gains `preferences: { sound: SoundPreferences }`, and `partialize` writes it.
  - `merge` gives `{ sound: sanitizeSoundPreferences(saved.preferences.sound) }` when `saved.preferences` is present, and keeps the current defaults when it is absent (every payload saved before this task). No `migrate` branch and no version change. A comment explains why: the slice-aware merge (CI-2) already covers a missing field.
  - Tests:
    - round trip: change → persist → a new store rehydrates the same values;
    - a v4 payload without `preferences` → defaults;
    - `preferences.sound = { volume: 'loud', themeId: 'bogus' }` → defaults for those fields, without throwing;
    - `ui` is still not persisted.

#### M5.T8 — `PREFERENCES_SOUND_SET` mutation and its background handler
* **Objective**: let the background apply a sound-preferences change that another context requests, through the existing typed mutation path.
* **Files**: `lib/messaging/messages.types.ts`, `lib/messaging/apply-mutation.ts`, `tests/integration/messaging/mutation-bus.test.ts`.
* **Dependencies**: M5.T6, M1.T10
* **Acceptance criteria**:
  - New `RuntimeMessage` variant `{ type: 'PREFERENCES_SOUND_SET'; payload: SoundPreferencesPatch }`.
  - New `PREFERENCES_MUTATION_TYPES = ['PREFERENCES_SOUND_SET']`, spread into `MUTATION_TYPES`. The background then registers it on its own (`startBackground` loops over `MUTATION_TYPES`), and it waits for the startup gate like every other mutation.
  - `createMutationHandler` handles it with `store.getState().setSoundPreferences(message.payload)`. The payload is untrusted and is validated inside the action (M5.T5), so the handler adds no checks of its own. The `never` exhaustiveness check still compiles.
  - Not locked: applied in every timer status.
  - Tests, through the bus like the existing ones:
    - a valid patch updates and persists `preferences.sound`;
    - an invalid payload (`{ volume: 500 }`, `{ themeId: 'x' }`, `{}`) leaves it unchanged and does not throw;
    - a patch sent while `running` is applied.

#### M5.T9 — Popup request action `requestSetSoundPreferences`
* **Objective**: give the popup a store action that asks the background to change the sound preferences, following the existing `request*` pattern.
* **Files**: `store/preferences.slice.ts`, `store/index.ts` (pass `dependencies` to the slice factory), `tests/unit/store/preferences-slice.test.ts`.
* **Dependencies**: M5.T8
* **Acceptance criteria**:
  - The factory becomes `createPreferencesSlice(dependencies: MessagingDependencies = {})`.
  - New action `requestSetSoundPreferences(patch: SoundPreferencesPatch): void`. It sends exactly one `{ type: 'PREFERENCES_SOUND_SET', payload: patch }` through `dependencies.sendMutation` and does **not** change local state: the popup converges through the storage sync (M1.T8).
  - With no `sendMutation`, the action is a no-op and does not throw.
  - Tests: one message with the given payload; local state unchanged after the call.

#### M5.T10 — `SoundPlayer` port, direct player and the `PLAY_SOUND` message
* **Objective**: define the single interface every context uses to play a cue, its direct implementation over the renderer, and the message the background sends to the offscreen page.
* **Files**: `lib/sound/sound-player.ts` (new), `lib/messaging/messages.types.ts` (new `PLAY_SOUND` variant), `lib/sound/sound-preferences.ts` (export the volume check as `isSoundVolume`, reused by `isSoundPlayRequest`), `tests/unit/lib/sound/sound-player.test.ts` (new).
* **Dependencies**: M5.T1, M5.T2, M5.T4, M1.T6
* **API**:
  - `SoundPlayRequest { themeId: SoundThemeId; cue: SoundCue; volume: number }`, plus `isSoundPlayRequest(value: unknown): value is SoundPlayRequest`, which requires a known theme, a cue of `'start'` or `'end'`, and an integer volume from 0 to 100.
  - `SoundPlayer { play(request: SoundPlayRequest): Promise<Result<void>> }` is the port. Every implementation and every fake honours it and never throws (Liskov).
  - `createDirectSoundPlayer(renderer: SoundRenderer): SoundPlayer` runs `findSoundTheme` → the recipe for the cue → `calculatePlaybackPlan(recipe, volume)` → `renderer.play(plan)`.
  - `createSilentSoundPlayer(): SoundPlayer` always returns `ok` and plays nothing; it is used where no audio is available (M5.T13).
  - New `RuntimeMessage` variant `{ type: 'PLAY_SOUND'; payload: SoundPlayRequest }`. It is **not** a mutation: it goes neither in `MUTATION_TYPES` nor in the background's `MESSAGE_TYPES`.
* **Acceptance criteria**:
  - With a fake renderer, `play({ themeId: 'neon', cue: 'end', volume: 50 })` renders the plan of `neon.end` at volume 50. `volume: 0` renders nothing and returns `ok`.
  - An invalid request (one that fails `isSoundPlayRequest`) returns `err` without calling the renderer.
  - A renderer that returns `err` or rejects makes `play` resolve `err`; nothing throws.
  - `isSoundPlayRequest` rejects non-objects, unknown themes, the cue `'pause'`, and volumes `-1`, `101`, `2.5` and `'50'`.

#### M5.T11 — Offscreen document page that plays sounds (Chrome)
* **Objective**: add the hidden extension page that Chrome's background opens to play sounds. The page only listens for `PLAY_SOUND` and plays it.
* **Files**: `entrypoints/offscreen/index.html` (new), `entrypoints/offscreen/main.ts` (new), `lib/sound/play-sound-listener.ts` (new), `tests/integration/sound/play-sound-listener.test.ts` (new).
* **Dependencies**: M5.T10
* **Acceptance criteria**:
  - `index.html` is a minimal WXT unlisted page, built as `/offscreen.html`, that loads `main.ts`. A `manifest.include` meta option limits it to the Chrome build; check the exact syntax in the WXT docs for HTML entrypoint options.
  - `listenForPlaySound(player: SoundPlayer, logger: Logger): () => void`:
    - registers `onMessage('PLAY_SOUND', …)` from `lib/messaging/bus.ts` and returns the disposer;
    - validates the payload with `isSoundPlayRequest` and ignores an invalid one, logging `warn` with `{ type }` only;
    - calls `player.play`, and logs `error` on an `err` result.
  - `main.ts` only wires: `listenForPlaySound(createDirectSoundPlayer(createWebAudioRenderer(() => new AudioContext())), createLogger('offscreen'))`. No state, no store, no other logic.
  - Tests (`fakeBrowser` + a fake player):
    - a valid `PLAY_SOUND` reaches `player.play` once, with its payload; an invalid payload does not;
    - a failing player is logged and does not throw;
    - after the disposer runs, messages are ignored.
  - `bun run build` emits `offscreen.html`; `bun run build:firefox` does not.

#### M5.T12 — Background offscreen player + `offscreen` permission (Chrome)
* **Objective**: implement the `SoundPlayer` the Chrome background uses: make sure exactly one offscreen document exists, then send it `PLAY_SOUND`.
* **Files**: `lib/sound/offscreen-sound-player.ts` (new), `wxt.config.ts`, `tests/unit/lib/sound/offscreen-sound-player.test.ts` (new).
* **Dependencies**: M5.T10, M5.T11
* **API**:
  - `OffscreenApi { hasDocument(): Promise<boolean>; createDocument(): Promise<void>; send(message: RuntimeMessage): Promise<Result<undefined>> }`: the injected port. `send` has the same signature as the bus's `sendMessage`, which reports a failure as `err` and never rejects.
  - `createOffscreenSoundPlayer(api: OffscreenApi): SoundPlayer`.
  - `createBrowserOffscreenApi(): OffscreenApi`, the only code in the project that touches `browser.offscreen`:
    - `hasDocument`: `browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })` returns at least one context;
    - `createDocument`: `browser.offscreen.createDocument({ url: browser.runtime.getURL('/offscreen.html'), reasons: ['AUDIO_PLAYBACK'], justification: 'Play the focus session start and end sounds' })`;
    - `send`: the bus's `sendMessage`.
* **Acceptance criteria**:
  - `play` validates the request with `isSoundPlayRequest`, makes sure the document exists, then sends one `PLAY_SOUND`.
  - **One document at a time**: `play` calls made while the document is being created share one in-flight creation promise, so `createDocument` runs once. Test: two `play` calls without awaiting in between.
  - When the document already exists, `createDocument` is not called.
  - When `hasDocument` or `createDocument` rejects, `play` resolves `err` and the in-flight promise is cleared, so the next `play` retries. When `send` returns `err`, `play` resolves `err` too.
  - `wxt.config.ts` adds the `offscreen` permission **only for the Chrome build** (`browser !== 'firefox'`), with a comment saying why: Firefox has no `offscreen` API and warns on unknown permissions.
* **Notes**: Chrome closes an `AUDIO_PLAYBACK` document after about 30 s of silence, so the document is re-created on demand and never kept alive.

#### M5.T13 — Platform player selection (offscreen on Chrome, direct on Firefox)
* **Objective**: one factory that returns the right `SoundPlayer` for the background of the current browser.
* **Files**: `lib/sound/platform-sound-player.ts` (new), `tests/unit/lib/sound/platform-sound-player.test.ts` (new).
* **Dependencies**: M5.T4, M5.T10, M5.T12
* **API**:
  - `selectSoundPlayer(environment: { hasOffscreenApi: boolean; createAudioContext?: () => AudioContextLike }, factories = DEFAULT_PLAYER_FACTORIES): SoundPlayer`. `factories` holds `offscreen()`, `direct(createAudioContext)` and `silent()`; it is injectable for tests.
    - `hasOffscreenApi` → the offscreen player (Chrome);
    - otherwise, with `createAudioContext` → the direct player over `createWebAudioRenderer` (Firefox event page);
    - otherwise → the silent player.
  - `createPlatformSoundPlayer(): SoundPlayer` reads the real environment: `typeof browser.offscreen?.createDocument === 'function'` and `typeof AudioContext === 'function'`.
* **Acceptance criteria**:
  - The three branches are tested with injected flags and fake factories, never the real `browser.offscreen`.
  - Detection is by feature, not by `import.meta.env.BROWSER`, so a Chromium-based browser without `offscreen` falls back cleanly.
* **Notes**: Firefox may block autoplay in the background page. Check it once by hand on the Firefox build (start a session and listen). If it is blocked, record it in the changelog's open issues; this task adds no workaround.

#### M5.T14 — Sound cues: start/end decisions and the 60 s lateness guard (pure)
* **Objective**: decide whether a cue plays, and play it, in one place that knows nothing about the store or the browser.
* **Files**: `lib/sound/sound-cues.ts` (new), `tests/unit/lib/sound/sound-cues.test.ts` (new).
* **Dependencies**: M5.T5, M5.T10
* **API**:
  - `END_SOUND_MAX_LATENESS_MS = 60_000`.
  - `shouldPlayEndSound(endsAt: number | null, now: number): boolean` is `true` when `endsAt !== null` and `now - endsAt <= END_SOUND_MAX_LATENESS_MS`. A completion before `endsAt` counts as on time.
  - `createSoundCues({ getPreferences: () => SoundPreferences; player: SoundPlayer; now: () => number; logger: Logger }): { sessionStarted(): void; sessionCompleted(endsAt: number | null): void }`.
* **Acceptance criteria**:
  - Nothing plays when `isSoundAudible(preferences)` is false.
  - `sessionStarted` plays `{ themeId, cue: 'start', volume }`, reading the preferences at call time, not at creation.
  - `sessionCompleted(endsAt)` plays `cue: 'end'` only when `shouldPlayEndSound(endsAt, now())`. Table test: lateness 0, 3 s and 60 s play; 60.001 s, 20 min, 18 h and `endsAt: null` stay silent.
  - Both methods are fire-and-forget (`void`). A player `err` is logged as `warn` with `{ cue }` only, and a rejecting player is caught too; nothing is ever thrown.
  - No `Date.now()`: time comes only from `now`.

#### M5.T15 — Background wiring of the start and end sounds
* **Objective**: play the start sound on a fresh start and the end sound on a natural completion, from the background.
* **Files**: `entrypoints/background.ts`, `tests/integration/background/sound-cues.test.ts` (new).
* **Dependencies**: M5.T6, M5.T13, M5.T14, M3.T3c
* **Acceptance criteria**:
  - `BackgroundDependencies` gains `soundPlayer?: SoundPlayer`, defaulting to `createPlatformSoundPlayer()`. `startBackground` builds `createSoundCues({ getPreferences: () => store.getState().preferences.sound, player, now, logger: log.child('sound') })`.
  - **Start sound**: in `applyMutation`, a `TIMER_STARTED` received while `timer.status === 'idle'` that leaves the timer `running` calls `cues.sessionStarted()` once (`startTimer` sets `running` synchronously). A resume (`paused` → `running`) and a `TIMER_STARTED` while already `running` play nothing.
  - **End sound**:
    - `SessionCompletionDependencies` gains an optional `onCompleted?: (endsAt: number | null) => void`, and the background passes `cues.sessionCompleted`;
    - `handleAlarm` reads `timer.endsAt` **before** `completeTimer()` and calls `onCompleted(endsAt)` after it;
    - both completion paths (the alarm firing and the startup catch-up) go through `handleAlarm`, and its `status !== 'running'` guard limits it to one call per session.
  - Pause, reset, duration changes and blocklist mutations never call the player.
  - Tests (fake player, `FakeAlarmProvider`, injected `now`):
    - a fresh start → one `start` call; a pause then resume → no new call;
    - an on-time alarm → one `end` call;
    - an alarm 2 min late → no `end` call, but the session completes and `SESSION_ENDED` is still sent;
    - a startup catch-up within 60 s → one `end` call;
    - sounds disabled → no calls at all;
    - the theme and the volume come from the store.
* **Notes**: `entrypoints/background.ts` is already over the size guideline. Add only the wiring above: every decision lives in `lib/sound/`.

#### M5.T16 — Settings and sound locale strings (EN/IT)
* **Objective**: add every string the Settings tab needs, in both languages, before any UI uses them.
* **Files**: `locales/en.yml`, `locales/it.yml`, `tests/unit/i18n/settings-locales.test.ts` (new).
* **Dependencies**: M5.T1, M3.T10
* **Acceptance criteria**:
  - Keys and their values:

    | Key | EN | IT |
    |---|---|---|
    | `tabs.settings` (the gear's accessible name) | Settings | Impostazioni |
    | `settings.title` | Settings | Impostazioni |
    | `settings.sound.heading` | Sound | Suono |
    | `settings.sound.enabled` | Play a sound when a session starts and ends | Riproduci un suono all'inizio e alla fine della sessione |
    | `settings.sound.theme` | Sound theme | Tema sonoro |
    | `settings.sound.themes.neon` | Neon | Neon |
    | `settings.sound.themes.synthwave` | Synthwave | Synthwave |
    | `settings.sound.themes.glitch` | Glitch | Glitch |
    | `settings.sound.themes.terminal` | Terminal | Terminale |
    | `settings.sound.preview` | Preview $1 | Ascolta $1 |
    | `settings.sound.volume` | Volume | Volume |
    | `settings.sound.volumeValue` | $1% | $1% |
  - The keys under `settings.sound.themes` match `SoundThemeId` one to one.
  - `bunx wxt prepare` regenerates the key types, and the EN/IT drift test (`tests/unit/i18n/locales.test.ts`) passes.
  - The copy follows `PRODUCT.md` (neutral, minimal).

#### M5.T17 — Settings tab with a gear icon
* **Objective**: add a fifth popup tab, shown as a gear icon, whose panel is an empty Settings section ready for M5.T19.
* **Files**: `store/index.ts` (`PopupTab`), `components/common/PopupTabs.tsx`, `entrypoints/popup/App.tsx`, `tests/unit/components/common/PopupTabs.test.tsx`.
* **Dependencies**: M5.T16, M3.T4
* **Acceptance criteria**:
  - `PopupTab` gains `'settings'`, last in `TAB_ORDER`, with `TAB_LABEL_KEYS.settings = 'tabs.settings'`.
  - The settings tab shows an inline SVG gear instead of text: `aria-hidden="true"`, `currentColor`, about 14 px, with no new dependency and no asset file. Its accessible name is `i18n.t('tabs.settings')`, set through `aria-label`. The text tabs are unchanged.
  - It has the same ARIA and keyboard behaviour as the other tabs: the arrow keys, Home and End reach it, and End selects it.
  - In `App.tsx`, `SECTIONS.settings` renders a `SettingsSection` that holds only the `settings.title` heading; the content arrives in M5.T19.
  - The tab row still fits the fixed 32 rem popup in EN and IT, with no wrapping and no horizontal scroll.
  - Tests:
    - there are five tabs;
    - the gear tab's accessible name is `Settings`, and it contains an SVG and no visible text;
    - selecting it shows the settings panel;
    - ArrowRight from Score reaches Settings;
    - the existing Home/End test now expects Settings as the last tab.
  - The visuals follow `DESIGN.md` (phosphor green, glow only on the active tab).

#### M5.T18 — `use-sound-preview` hook (popup preview playback)
* **Objective**: let the popup preview a theme (its start sound, then its end sound) at a given volume, without any component touching Web Audio.
* **Files**: `components/settings/use-sound-preview.ts` (new), `tests/unit/components/settings/use-sound-preview.test.ts` (new).
* **Dependencies**: M5.T4, M5.T10
* **API**: `useSoundPreview(options?: { createRenderer?: () => SoundRenderer }): { preview(themeId: SoundThemeId, volume: number): void; previewingThemeId: SoundThemeId | null }`.
* **Acceptance criteria**:
  - The renderer (by default `createWebAudioRenderer(() => new AudioContext())`) is created lazily on the first `preview`, which always follows a click, so autoplay is allowed. It is disposed on unmount.
  - `preview` plays the theme's `start` sound, then its `end` sound once the start plan's `durationSec` + 0.15 s has passed, through `createDirectSoundPlayer`.
  - A new `preview` call first runs `stopAll()` and cancels the pending `end`, so previews never overlap. `previewingThemeId` holds the theme while it plays and goes back to `null` when the end finishes or the preview is stopped.
  - Volume 0 plays nothing.
  - Errors are logged and never thrown into React.
  - Tests (fake renderer, `vi.useFakeTimers`):
    - the order is start, then end;
    - a second call cancels the first;
    - unmounting disposes the renderer;
    - no renderer is created before the first call.

#### M5.T19 — `SoundSettings` panel (toggle, theme list, volume slider)
* **Objective**: build the Settings tab content: an on/off toggle, the theme list with preview buttons, and a volume slider.
* **Files**: `components/settings/SoundSettings.tsx` (new), `components/settings/sound-settings.styles.ts` (new, the panel's styles, as `site-list.styles.ts` does for the site list), `tests/unit/components/settings/SoundSettings.test.tsx` (new), `entrypoints/popup/App.tsx` (render `<SoundSettings />` inside `SettingsSection`).
* **Dependencies**: M5.T9, M5.T16, M5.T17, M5.T18
* **Acceptance criteria**:
  - The component reads only `selectSoundEnabled`, `selectSoundThemeId` and `selectSoundVolume`. It writes only through `requestSetSoundPreferences`: never `setSoundPreferences`, never a browser API.
  - **Toggle**: a labelled checkbox (`settings.sound.enabled`); a change sends `{ enabled }`.
  - **Themes**:
    - a `fieldset` with the legend `settings.sound.theme` and one radio per theme, in `SOUND_THEMES` order, labelled `settings.sound.themes.<id>`; selecting one sends `{ themeId }`;
    - each row has a preview button, whose `aria-label` is `settings.sound.preview` filled with the theme name, that calls `preview(themeId, currentSliderValue)`.
  - **Volume**:
    - an `<input type="range" min="0" max="100" step="5">` labelled `settings.sound.volume`, with its value shown through `settings.sound.volumeValue`;
    - while dragging, the value lives in local state. It is sent once, as `{ volume }`, on `pointerup` or `keyup`, and only if it differs from the store value: never one message per `input` event.
  - When sounds are off, the radios, the preview buttons and the slider are `disabled`.
  - The panel is not locked by the timer status: it works while a session runs.
  - Tests (spying on `fakeBrowser.runtime.sendMessage`, like the blocklist lock tests):
    - each control sends exactly the expected mutation;
    - several `input` events followed by `pointerup` send one message;
    - the controls are disabled when sounds are off;
    - the preview button calls the (mocked) hook with the theme and the slider value;
    - the texts are translated.
  - If the component grows past about 150 lines, move the theme row into `components/settings/SoundThemeOption.tsx`. That file then counts as the task's fourth file.

#### M5.T20 — E2E: sound settings and offscreen playback
* **Objective**: prove on the built Chrome extension that the settings persist, and that starting a session opens the offscreen document only when sounds are on.
* **Files**: `tests/e2e/sound.spec.ts` (new).
* **Dependencies**: M5.T15, M5.T19, M0.T4
* **Acceptance criteria**:
  - Each scenario runs in its own context from `launchExtensionContext()` (`tests/e2e/setup.ts`), so no offscreen document or setting is left over from a previous one.
  - **Scenario 1**: open the popup → the gear tab → turn sounds off, pick `Glitch`, change the volume → close and reopen the popup → the same values are shown.
  - **Scenario 2** (sounds on): start a session → within 2 s, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })`, evaluated from an extension page (the popup: it can call it too, and unlike the service worker it cannot be asleep, which would make the "none" case pass for the wrong reason), returns one document.
  - **Scenario 3** (sounds off): start a session → no offscreen document is created.
  - No assertion on audio output, since Playwright cannot hear; the end sound is covered by the M5.T15 integration tests.
  - Run with `bun run build`, then `bun run e2e`; Chromium only (CLAUDE.md §3.2).

### 1.9 Milestone 6 — Security hardening

> **Threat model / out of scope.** The extension is *client-only* (no backend): the user is the operator of the browser itself. This determines what's actually worth defending and what isn't.
>
> **Out of scope (self-pwn).** Anyone who opens DevTools and modifies code, store, or messages in *their own* browser already controls the extension: there is no sensible defense and none will be built. Same for uninstalling, manually modifying built files, or patching the extension. "An attacker can modify my code" is true for any frontend (web, desktop, native binaries) and is not in the threat model: the security model always excludes the operator of the machine.
>
> **In scope.** Any *untrusted* data/code that **crosses** into the extension toward a more privileged context, even with a legitimate operator. The trust boundaries that a backend-less extension does **not** eliminate:
> 1. **Web page → content script** — the page is arbitrary and hostile (DOM, `postMessage`, crafted navigations). A malicious site is not the user.
> 2. **Content script → background (message bus)** — `runtime.onMessage` can receive well-formed messages forged by other code; hence runtime validation of the discriminated union, checking `sender.id === browser.runtime.id`, `tabId` derived from `sender.tab.id` and never from the payload (M6.T1).
> 3. **Untrusted URL/domain → DNR rules / domain checks** — injection via *data* (non-http schemes, the `userinfo` trick `https://facebook.com@evil.com`, IDN/homograph, syntactic characters `*`/`|`/`^`/`||` in `urlFilter`), exactly like a SQL injection (M6.T2, M6.T3).
>
> **Practical consequence.** These hardening measures defend the *untrusted data/code* boundaries, not against the operator. They remain justified as pure **correctness** regardless — avoiding over/under-blocking, double normalizations, crashes from unexpected input — regardless of whether an attacker exists. They are not a speculative security framework: every task maps to a concrete, testable gap.

> This milestone translates into tasks the measures that emerged from a security audit of the architecture (§2 of the audit document, "Part 2 — Could your project expose users to attacks?"). It does not add features: it makes the logic already planned in Milestones 1–2 secure and defensive. The three risks classified as **High** concern the message bus (M1.T6), domain normalization (M1.T2/M2.T21), and DNR rule generation (M2.T6).
>
> **Sequencing note**: these tasks are security prerequisites for the critical logic in §3.4 and should ideally land **before** the tasks that consume the respective modules (M6.T1 before M2.T10/M2.T16 — its `SITE_BLOCKED_ATTEMPT`/`tabId` part landed early, with M2.T8; M6.T2 before M2.T4/M2.T6/M2.T21; M6.T3 before M2.T7). The corresponding M2 cards remain valid; the hardening is additive and does not replace them.

#### M6.T1 — Message bus hardening: runtime validation and sender provenance
* **Objective**: make the message bus (M1.T6) robust against malformed or forged messages — validate every `RuntimeMessage` at runtime with guards (never casts) and never trust `tabId`/identifiers coming from the payload, always deriving them from `sender`.
* **Files**: `lib/messaging/messages.types.ts` (runtime validation guards; removal of `tabId` from the payload), `lib/messaging/bus.ts` (incoming validation + origin check), `entrypoints/background.ts`, `entrypoints/blocked-overlay.content.ts`.
* **Dependencies**: M1.T6
* **Audit references**: risk "🔴 High — Message bus has no runtime validation and trusts caller-supplied tabId" (involves M1.T6, M2.T10, M2.T16).
* **Acceptance criteria**:
  - `onMessage` validates the input with runtime guards on the discriminated union: unknown `type`, missing fields, or wrong types → the message is discarded without exceptions and without mutating the store (never `as RuntimeMessage`).
  - The background rejects messages where `sender.id !== browser.runtime.id` and requires `sender.tab` where the payload presupposes it.
  - `tabId` is no longer read from the payload: variants that need it derive it from `sender.tab.id`. **Already satisfied for `SITE_BLOCKED_ATTEMPT`, whose payload lost `tabId` in M2.T8**; the remaining variants are covered here.
  - Test (integration, `fakeBrowser`): malformed/forged message → no crash, no mutation; `tabId` injected in the payload is ignored; a sender with an id different from `browser.runtime.id` is rejected; an unrecognized `type` is ignored.

#### M6.T2 — Hardening of `lib/url/domain.ts`: scheme restriction, canonicalization, and IDN
> **Superseded by CR1** (see §2.4): the scheme/IDN hardening stays; only the allowlist-precedence part of the criterion is dropped (CR1.T4).
* **Objective**: make domain normalization (M1.T2, "security core of the blocking system", §3.4) robust against bypass and impersonation — accept only `http`/`https` URLs, canonicalize the host, and handle IDN/homograph, with a single canonical form shared by both entry and navigation checks.
* **Files**: `lib/url/domain.ts`, `lib/blocking/normalize-entry.ts` (M2.T21), `entrypoints/background.ts` (navigation check).
* **Dependencies**: M1.T2
* **Audit references**: risk "🔴 High — lib/url/domain.ts is the blocklist/allowlist security core, and it validates too little" (involves M1.T2, M2.T6, M2.T21).
* **Acceptance criteria**:
  - Only `http`/`https`: schemes `ftp://`, `file://`, `javascript:`, `data:` (and any other) → `{ ok: false }`.
  - Canonicalization: trailing dot (`facebook.com.`) and uppercase (`FACEBOOK.COM`) → `facebook.com`; userinfo trick (`https://facebook.com@evil.com`) → the real host `evil.com`, not the userinfo.
  - IDN/homograph: Unicode hosts are converted to ASCII punycode for comparison, so a homograph (e.g. Cyrillic `раypal.com`) doesn't collide with the legitimate Latin domain.
  - Test with a **hostile corpus** (not just happy-path): non-http schemes, trailing dot, uppercase, userinfo, IDN, malformed URL → deterministic and safe outcomes, no exceptions.
  - The canonical form is the same at entry (M2.T4/M2.T21) and at the navigation check (M2.T6): no divergence between the two entry points.

#### M6.T3 — Escaping/validation of `urlFilter` in DNR rule generation
> **Superseded by CR1** (see §2.4): the escaping/validation hardening stays; the "allow/block conflict" case no longer exists (CR1.T4).
* **Objective**: ensure that `declarativeNetRequest` rule generation (M2.T6) uses only canonical domains and never interpolates raw input into `urlFilter`, where `*`, `|`, `^`, and `||` have special semantics.
* **Files**: `lib/blocking/rules.ts`, `lib/blocking/normalize-entry.ts`.
* **Dependencies**: M2.T6
* **Audit references**: risk "🔴 High — DNR rule generation must escape urlFilter" (involves M2.T6).
* **Acceptance criteria**:
  - No raw entry is interpolated into `urlFilter`: only canonical forms `[a-z0-9.-]` are accepted; entries containing `*`, `|`, `^`, `||` are neutralized (escaped) or rejected.
  - An entry with `*` does not produce a wildcard (no over-blocking); a `||` prefix does not unexpectedly alter the anchoring.
  - The "allowlist always wins" precedence is applied in the same generation phase (consistent with M2.T6/M2.T20).
  - Test: entry with `*`/`||` → safe or rejected rule; allow/block conflict → allowlist wins; no real calls to `browser.declarativeNetRequest` (pure module).

---

## 2. Change requests

This section tracks change requests that modify already-planned or already-implemented behavior. The main-task cards in Section 1 remain the historical record; the tasks below define what supersedes them.

### 2.1 Change request CR1 — Remove the allowlist logic

**Goal.** The blocklist alone is sufficient: the user chooses which sites must not be visited during a focus session, and every other site stays available by default. The allowlist is removed as a user-facing and runtime concept.

**Behavioral rule after the change.**
- A domain is blocked **only** when it is in the blocklist and the timer is `running`.
- There is no second list, no cross-list move, no "allowlist wins" rule, and no way to exempt a blocklisted domain.
- Existing persisted data is migrated so the new effective blocklist equals `old blocklist − old allowlist`: a domain that was on both lists stays unblocked, preserving the behavior the user currently observes. Domains present only in the old allowlist are dropped because they were already allowed by default.
- The only remaining reference to `allowlist` may be the one-time legacy migration code and the tests that intentionally exercise legacy payloads; no runtime path may read, write, expose, or enforce an allowlist.

**Sequencing note.** The tasks are ordered so that the UI and protocol stop exposing the allowlist first, then persisted data is migrated, then enforcement stops reading it, then the state model is collapsed — split into the implementation (`CR1.T5a`) and two test-migration tasks of six test files each (`CR1.T5b`, `CR1.T5c`) so each diff stays reviewable. The final task is the verification gate for the whole change request. From CR1.T3 onward the migration must be in place before CR1.T4 changes blocking behavior.

### 2.2 CR1 — Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR1.T1 | Remove the allowlist from the popup UI and locales | — |
| CR1.T2 | Remove the `list` discriminator from mutation messages | CR1.T1 |
| CR1.T3 | Migrate persisted allowlist data to the effective blocklist | CR1.T2 |
| CR1.T4 | Remove the allowlist from blocking enforcement | CR1.T3 |
| CR1.T5a | Collapse the store state and runtime call sites to a single blocklist | CR1.T1, CR1.T2, CR1.T3, CR1.T4 |
| CR1.T5b | Migrate the store and component tests to the single blocklist | CR1.T5a |
| CR1.T5c | Migrate the remaining unit and integration tests and restore the green gate | CR1.T5b |
| CR1.T6 | Cleanup, documentation, regression coverage, and final verification | CR1.T5a, CR1.T5b, CR1.T5c |

### 2.3 CR1 — Task cards

#### CR1.T1 — Remove the allowlist from the popup UI and locales
* **Objective**: remove every user-facing way to view or edit the allowlist, leaving one blocklist UI.
* **Files to create/modify**: `entrypoints/popup/App.tsx`, `components/blocklist/SiteList.tsx`, `locales/en.yml`, `locales/it.yml`, `tests/unit/components/blocklist/SiteList.test.tsx` (and any popup composition test that asserts both lists).
* **Dependencies**: —
* **Acceptance criteria**:
  - `BlocklistSection` renders exactly one `SiteList`, for the blocklist; the `<SiteList list="allowlist" />` mount is gone.
  - `SiteList` no longer accepts or reads a `list` prop and always reads `selectBlocklist`; its add/remove/tag calls explicitly target the blocklist until CR1.T5a removes the parameter from the store API.
  - The `LIST_KEYS` allowlist branch, the `otherEntries` lookup, and the "Moved … from the allowlist" feedback are removed. Duplicate feedback and the "Enter a valid URL" feedback remain unchanged.
  - The i18n keys `blocklist.allowedSites`, `blocklist.allowlistName`, and `blocklist.movedFromList` are removed from **both** `locales/en.yml` and `locales/it.yml`; no key is left unused.
  - Component tests cover: one blocked-sites list, add with normalization, duplicate feedback, invalid-input feedback, remove, and absence of any allowlist label.
* **Notes/decisions**: this task only removes the UI surface. The store still carries an unused `allowlist` field and the mutation protocol still has a `list` discriminator until CR1.T5a; keeping those temporarily lets this task stay compilable and independently reviewable.

#### CR1.T2 — Remove the `list` discriminator from mutation messages
* **Objective**: make every blocklist/tag mutation address the single blocklist, with no protocol-level concept of an allowlist.
* **Files to create/modify**: `lib/messaging/messages.types.ts`, `lib/messaging/apply-mutation.ts`, `store/blocklist.slice.ts` (message construction only), `tests/integration/messaging/mutation-bus.test.ts`.
* **Dependencies**: CR1.T1
* **Acceptance criteria**:
  - The payloads of `BLOCKLIST_ADD_SITE`, `BLOCKLIST_REMOVE_SITE`, `TAG_ASSIGN`, and `TAG_UNASSIGN` no longer contain `list`.
  - `isListName` is deleted; the background mutation handler applies these messages to the blocklist only. Until CR1.T5a removes the parameter, it may call the existing helpers with the literal `'blocklist'`.
  - An old/extra `list` field in a received payload is ignored, never used to select a target collection.
  - `BLOCKLIST_APPLY_PRESET`, `TAG_UPSERT`, `TAG_REMOVE`, and the `MUTATION_TYPES` list keep their current shape.
  - The mutation-bus test covers add/remove/tag/preset against the blocklist and asserts that no message can mutate a second list.
* **Notes/decisions**: old in-flight messages carrying `list` remain harmless because the new handler ignores unknown payload fields rather than branching on them.

#### CR1.T3 — Migrate persisted allowlist data to the effective blocklist
* **Objective**: convert existing persisted state to the new single-list shape without changing the set of domains the user currently experiences as blocked.
* **Files to create/modify**: `lib/blocking/legacy-blocklist.ts` (new: `LegacyBlocklistState`, pure `migrateBlocklistState`), `store/index.ts` (`version: 2`, `migrate`, sanitized `merge`), `tests/unit/lib/blocking/legacy-blocklist.test.ts` (new), `tests/integration/store/store.test.ts`.
* **Dependencies**: CR1.T2
* **Acceptance criteria**:
  - A pure migration helper accepts the legacy shape `{ allowlist, blocklist, customTags }` and returns `{ blocklist, customTags }` where `blocklist` excludes every domain present in `allowlist` (the old "allowlist wins" result).
  - A domain present only in the legacy allowlist is dropped: it was already allowed by default, so it needs no replacement entry.
  - The helper is total: missing/malformed/empty list fields degrade to empty arrays without throwing; already-canonical domains are preserved; no duplicates are introduced.
  - `zustand/persist` is bumped from version 1 to version 2 and runs the migration for version-1 payloads; version-2 payloads pass through unchanged.
  - The store's `merge` no longer reintroduces a legacy `allowlist` field, and a newly persisted payload contains only the new blocklist shape.
  - Tests: legacy payload with a domain in both lists → hydrated state has that domain only in the effective blocklist (i.e. not blocked); allowlist-only domain → absent; version-2 payload → unchanged; malformed legacy payload → defaults, no throw.
* **Notes/decisions**: this task is the only place allowed to read a legacy `allowlist`, and it exists solely to migrate old data. The helper will also be reused by the content-script snapshot parser in CR1.T4, because the content script reads the raw persisted value and does not run zustand's migration.

#### CR1.T4 — Remove the allowlist from blocking enforcement
* **Objective**: make every runtime blocking decision depend only on the blocklist and the timer status.
* **Files to create/modify**: `lib/blocking/rules.ts`, `lib/blocking/apply-rules.ts`, `lib/blocking/is-domain-blocked.ts`, `lib/blocking/store-snapshot.ts`, `entrypoints/background.ts`, `entrypoints/blocked-overlay.content.tsx`, `lib/timer/tab-distraction-tracker.ts` (comment only), plus `tests/unit/lib/blocking/rules.test.ts`, `tests/unit/lib/blocking/apply-rules.test.ts`, `tests/unit/lib/blocking/is-domain-blocked.test.ts`, `tests/unit/lib/blocking/store-snapshot.test.ts`, `tests/integration/background/dnr-rules.test.ts`, `tests/integration/background/navigation-normalization.test.ts`, `tests/integration/content/blocked-overlay.test.ts`.
* **Dependencies**: CR1.T3
* **Acceptance criteria**:
  - `buildDnrRules(blocklist)` takes only the blocklist; the allowed-set construction and the blocklist filter are removed. A blocklisted domain still produces the same `||<domain>^` `sub_frame` rule; an empty blocklist produces `[]`.
  - `isDomainBlocked` accepts only `{ blocklist }` and returns whether the canonical domain is in that list; the allowlist short-circuit is gone.
  - `BlockingRulesSource` and `StoreSnapshot` no longer declare `allowlist`; `selectActiveRules` calls `buildDnrRules(state.blocklist.blocklist)`.
  - `parseStoreSnapshot` accepts both the current shape and the legacy shape, delegating the legacy list to `migrateBlocklistState`, and returns only `timerStatus` + effective `blocklist`.
  - `createDistractionPredicate` and the content-script `evaluate()` pass only the blocklist to `isDomainBlocked`; a non-blocklisted domain never mounts the overlay, and a blocklisted domain still does while `running`.
  - Tests prove the two enforcement layers agree: a blocklisted domain is blocked by both DNR and the overlay, a non-blocklisted domain by neither, a previously allowlisted-but-blocklisted domain is no longer blocked after migration, and behavior outside `running` is unchanged.
* **Notes/decisions**: after this task no runtime allowlist has any effect. The migration helper remains the only legacy read path.

#### CR1.T5a — Collapse the store model and runtime call sites to a single blocklist
* **Objective**: remove the `allowlist` field and the two-list abstraction from the Zustand slice, its pure helpers, actions, selectors, and every runtime call site, so production code models exactly one blocklist.
* **Files to create/modify**: `store/blocklist.slice.ts`, `store/index.ts` (exports), `lib/messaging/apply-mutation.ts` (call sites), `components/blocklist/SiteList.tsx` (action call sites), `components/blocklist/TagEditor.tsx` (action call sites).
* **Dependencies**: CR1.T1, CR1.T2, CR1.T3, CR1.T4
* **Acceptance criteria**:
  - `BlocklistState` is exactly `{ blocklist: ReadonlyArray<BlocklistEntry>; customTags: ReadonlyArray<Tag> }`; `allowlist` and `BlocklistListName` are removed.
  - Store actions become `addSite(site)`, `removeSite(site)`, `assignTag(site, tagId)`, and `unassignTag(site, tagId)`; `applyPreset(presetId)` stays blocklist-only.
  - Pure helpers lose the `list` parameter and are renamed for the single-list world: `addSiteToList` → `addBlocklistSite`, `removeSiteFromList` → `removeBlocklistSite`, `addPresetToList` → `addPresetToBlocklist`; `attachPresetTag`, `assignTagToSite`, and `unassignTagFromSite` keep their behavior without a list argument.
  - `oppositeList`, `resolveListConflicts`, and `selectAllowlist` are deleted; `removeTag` detaches the tag only from blocklist entries; `filterEntriesByTag` is unchanged.
  - `store/index.ts` exports only the new helper/selector names; persisted state and `partialize` use the new two-field shape.
  - `lib/messaging/apply-mutation.ts`, `SiteList`, and `TagEditor` call the new API; the temporary `TARGET_LIST` literal introduced by CR1.T2 is removed, and no runtime code passes a list name to a blocklist action or helper.
  - `bun run build` and `bun run build:firefox` succeed (the production bundle does not include tests). `bun run compile`/`bun run test` may still fail **only** in the test files that use the removed two-list API — CR1.T5b and CR1.T5c close those and restore the green gate; no production module hides a stale call site behind `as`/`@ts-expect-error`.
* **Notes/decisions**: this is the final shape change in production code. The migration from CR1.T3 already writes the new shape, so no additional persistence migration is needed; `merge` keeps the fresh defaults for fields a persisted snapshot predates. The test migration is deliberately split into CR1.T5b and CR1.T5c (six test files each) so each diff stays reviewable; the three tasks land together before CR1.T6.

#### CR1.T5b — Migrate the store and component tests to the single blocklist
* **Objective**: migrate the four store unit tests and the two blocklist component tests from the two-list model to `{ blocklist, customTags }`, replacing the obsolete cross-list/precedence cases with single-list behavior.
* **Files to create/modify**:
  - `tests/unit/store/blocklist-mutations.test.ts`
  - `tests/unit/store/blocklist-preset.test.ts`
  - `tests/unit/store/blocklist-sites.test.ts`
  - `tests/unit/store/blocklist-tags.test.ts`
  - `tests/unit/components/blocklist/SiteList.test.tsx`
  - `tests/unit/components/blocklist/TagEditor.test.tsx`
* **Dependencies**: CR1.T5a
* **Acceptance criteria**:
  - Every typed fixture in these six files constructs `BlocklistState` as `{ blocklist, customTags }`; no test passes a list name to a store action or helper.
  - Store unit tests cover add/remove, duplicate no-op, normalization, preset expansion/dedup/tagging, tag assignment/removal, and `removeTag` detaching the tag only from blocklist entries.
  - The obsolete cross-list move and "allowlist wins" tests in these files are replaced by assertions that no second list exists (e.g. the store state has no `allowlist` field and adding a site never writes one), not silently deleted.
  - Component tests seed the single-list state and assert the new action signatures (`addSite(site)`, `removeSite(site)`, `assignTag(site, tagId)`, `unassignTag(site, tagId)`).
  - The six files pass. `bun run compile`/`bun run lint`/`bun run test` may still fail **only** in the six test files owned by CR1.T5c; `bun run build` and `bun run build:firefox` stay green.
* **Notes/decisions**: this task only touches the store/component layer, so the API change from CR1.T5a is verified where it is consumed first. The integration and remaining unit files follow in CR1.T5c, which restores the full green gate.

#### CR1.T5c — Migrate the remaining unit and integration tests and restore the green gate
* **Objective**: migrate the remaining three unit test files and the three integration test files, then prove the whole verification gate is green.
* **Files to create/modify**:
  - `tests/unit/components/blocklist/PresetPicker.test.tsx`
  - `tests/unit/lib/blocking/is-domain-blocked.test.ts`
  - `tests/unit/lib/timer/tab-distraction-tracker.test.ts` (stale comment)
  - `tests/integration/store/store.test.ts`
  - `tests/integration/messaging/mutation-bus.test.ts`
  - `tests/integration/background/navigation-normalization.test.ts`
* **Dependencies**: CR1.T5b
* **Acceptance criteria**:
  - Every typed fixture in these six files uses the single-list shape; no test passes a list name to a store action or helper.
  - The mutation-bus test proves the payload's legacy `list` field cannot target a second list (no `allowlist` field is written), and the navigation test no longer injects a residual `allowlist` into the store.
  - The residual-allowlist case in `is-domain-blocked.test.ts` is removed (the store can no longer hold that field; legacy data is covered by the migration and snapshot-parser tests), and the `tab-distraction-tracker.test.ts` comment no longer describes allowlist precedence.
  - Integration tests seed/assert the single-list persisted shape.
  - Tests that intentionally exercise legacy payloads keep **raw** version-1 JSON rather than the typed state: `legacy-blocklist.test.ts`, the legacy cases in `store-snapshot.test.ts`, `blocked-overlay.test.ts`, `store.test.ts`, and `dnr-rules.test.ts`.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build`, and `bun run build:firefox` are green; the changelog records the real test counts.
* **Notes/decisions**: this task only touches tests and closes the change-request implementation; the two CR1.T5 test-migration tasks (T5b, T5c) get separate changelog entries from the production change (T5a). Keeping the raw legacy fixtures is deliberate — they are the only tests allowed to mention a legacy `allowlist` field, and they prove the migration still works.

#### CR1.T6 — Cleanup, documentation, regression coverage, and final verification
* **Objective**: remove the remaining non-historical references, document the change, and prove the full suite is green.
* **Files to create/modify**: remaining test fixtures; `README.md`; `.github/copilot-instructions.md`; `.serena/memories/core.md`; `docs/store-analysis.md` (if it still describes allowlist/blocklist precedence); `docs/changelog.md`; `docs/features-analysis/allowlist.md` (mark the analysis as implemented by CR1.T1–T6, including the CR1.T5a/CR1.T5b/CR1.T5c split).
* **Dependencies**: CR1.T5a, CR1.T5b, CR1.T5c
* **Acceptance criteria**:
  - A repository search for `allowlist`, `Allowlist`, `allowList`, `allowedSites`, and `movedFromList` returns only: the legacy migration module, the tests that intentionally exercise legacy payloads (migration, snapshot parser, and the raw version-1 fixtures in store/overlay/background tests), the historical roadmap/changelog text, and the change-request analysis. No runtime code, UI, protocol, locale, README, or project-instruction reference remains.
  - `README.md` describes the feature as a blocklist only (no allowlist, no "allowlist wins").
  - `.github/copilot-instructions.md` and `.serena/memories/core.md` no longer instruct future agents to preserve allowlist precedence or a two-list UI.
  - `docs/changelog.md` records each CR1 task (ID, what changed, files, tests, `Commit: —` until the developer commits) and updates the current-status/test counts.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build`, and `bun run build:firefox` are green; run `bun run e2e` if the existing Playwright suite is available in the environment.
  - The change request is not considered complete until the full verification gate passes and the historical main-task cards that mention the allowlist are explicitly marked as superseded by this section.

### 2.4 CR1 — Superseded acceptance criteria in Section 1

The following main-task criteria are intentionally replaced by CR1. They remain in the document as history, but they must not be used to reintroduce the allowlist:

| Main task | Superseded part | New rule |
|---|---|---|
| M2.T4 | `{ allowlist, blocklist, customTags }` state and allowlist CRUD | Single `{ blocklist, customTags }` state (CR1.T5a) |
| M2.T6 | "allowlist always wins" precedence and allowlist parameter | `buildDnrRules(blocklist)` only (CR1.T4) |
| M2.T8 | Allowlist precedence in the overlay decision | `isDomainBlocked({ blocklist }, domain)` only (CR1.T4) |
| M2.T20 | Allowlist/blocklist mutual exclusion | Task is obsolete: there is no second list (CR1.T5a) |
| M2.T21 | Allowlist precedence during navigation normalization | Navigation matches the blocklist only (CR1.T4) |
| M3.T3 | `SiteList` generic over allowlist/blocklist and move feedback | Single blocklist `SiteList` (CR1.T1) |
| M6.T2 / M6.T3 | References to allowlist precedence in hardening criteria | Keep scheme/IDN/`urlFilter` hardening; drop allowlist precedence (CR1.T4) |

### 2.5 Change request CR2 — Disable blocklist editing when the timer is not idle

**Analysis.** The pre-change map of every write path (UI, store actions, background handler, persistence, i18n, tests) is `docs/features-analysis/blocklist-lock.md`; the decisions below follow its recommendations.

**Goal.** The blocklist is configuration for the *next* session: once a session is in progress, changing it is a way to escape the very block the user asked for. The blocklist (and the tags/presets that shape it) becomes editable **only while the timer is `idle`** — before the first Start and after an explicit Reset.

**Behavioral rule after the change.**
- `BlocklistState` mutations (`addSite`, `removeSite`, `applyPreset`, `createTag`, `deleteTag`, `assignTag`, `unassignTag`) are accepted **only** when `timer.status === 'idle'`. In `running`, `paused` and `completed` they are silent no-ops: no local write, no message, no persist.
- A completed session stays locked until `resetTimer` returns the timer to `idle`; Reset is already enabled in `completed` and does not start a new session.
- Read-only affordances are unaffected: the entries remain visible, the tag filter keeps working, and enforcement (`selectActiveRules`, `isDomainBlocked`) is untouched.
- The lock is enforced in three places — the store actions (so the popup's optimistic copy stays honest), the background mutation handler (so a stale or forged message cannot bypass the UI), and the UI (so the user sees why). A background-only guard would leave the popup displaying an edit that is never persisted.
- No persisted field, no `version` bump, no migration: the lock is derived from the already-persisted `timer.status`.

**Sequencing note.** The store guard lands first (`CR2.T1`), then the authoritative background rejection with the race/startup coverage (`CR2.T2`). The UI is split into three reviewable pieces: the site/preset editors (`CR2.T3a`), the tag editor (`CR2.T3b`) and finally the notice plus locale keys (`CR2.T3c`) — the notice lands last so it never claims a lock the UI does not yet enforce. The documentation/verification gate closes the change request (`CR2.T4`). `CR2.T1` and `CR2.T2` are the security-relevant pair: the UI tasks are a reflection of their decision, never the enforcement itself.

#### 2.5.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR2.T1 | Lock the blocklist at the store layer | — |
| CR2.T2 | Reject blocklist mutations in the background and cover the race/startup windows | CR2.T1 |
| CR2.T3a | Disable the site and preset editors | CR2.T1 |
| CR2.T3b | Disable the tag editor while keeping its filter | CR2.T1 |
| CR2.T3c | Add the lock notice and the locale keys | CR2.T3a, CR2.T3b |
| CR2.T4 | Documentation, changelog, and final verification | CR2.T1, CR2.T2, CR2.T3a, CR2.T3b, CR2.T3c |

#### 2.5.2 Task cards

##### CR2.T1 — Lock the blocklist at the store layer
* **Objective**: make every action that writes `BlocklistState` a no-op unless the timer is `idle`, and expose the pure predicate/selector the UI and the background reuse.
* **Files to create/modify**: `store/blocklist.slice.ts`, `store/index.ts`, `tests/unit/store/blocklist-lock.test.ts` (new).
* **Dependencies**: —
* **Acceptance criteria**:
  - `isBlocklistEditable(status: TimerStatus): boolean` is pure and returns `true` only for `idle`; `selectBlocklistEditable` reads it from the store and both are exported from `store/index.ts`.
  - All seven mutating actions (`applyPreset`, `addSite`, `removeSite`, `createTag`, `deleteTag`, `assignTag`, `unassignTag`) return before any `set(...)` and before `sendMutation(...)` when the status is `running`, `paused` or `completed`: the state reference is unchanged, no subscriber is notified and no message is sent.
  - The shared `applyBlocklistMutation` helper enforces the guard once for the four actions that use it; `applyPreset`, `createTag` and `deleteTag` check it explicitly before their own `set`.
  - In `idle` every action behaves exactly as before, so the existing store unit tests (`blocklist-sites`, `blocklist-preset`, `blocklist-tags`, `blocklist-mutations`) stay green without modification.
  - The pure mutation helpers (`addBlocklistSite`, `addPresetToBlocklist`, `removeBlocklistSite`, `upsertTag`, `removeTag`, `assignTagToSite`, `unassignTagFromSite`) stay status-agnostic: the lock is a policy of the action, not of normalization.
  - Tests: the predicate truth table for the four statuses; for each action a locked case (running, paused, completed → no state change, no mutation) and an `idle` case (applied exactly once).
* **Notes/decisions**: the status check runs before validation, so a locked invalid input and a locked valid input are both silent no-ops (the lock, not the input, is the reason). The popup's actions run against its read-only store, but they still update its in-memory copy optimistically — this guard is what keeps that copy consistent with what the background will accept (CR2.T2).

##### CR2.T2 — Reject blocklist mutations in the background and cover the race/startup windows
* **Objective**: make the background — the single writer — refuse every blocklist/tag mutation unless the timer is `idle`, so a stale or forged message cannot bypass the UI/store guard.
* **Files to create/modify**: `lib/messaging/apply-mutation.ts`, `entrypoints/background.ts` (pass a scoped logger to the handler), `tests/integration/background/blocklist-lock.test.ts` (new), `tests/integration/messaging/mutation-bus.test.ts` (locked cases).
* **Dependencies**: CR2.T1
* **Acceptance criteria**:
  - In `createMutationHandler`, the blocklist/tag branch drops the message when `store.getState().timer.status !== 'idle'`: no `setState`, no `storage.local.set`, and a `debug` log carrying `{ type }` only (never the domain or the payload).
  - Timer commands (`TIMER_STARTED`, `TIMER_PAUSED`, `TIMER_RESET`, `TIMER_SET_DURATION`) are unaffected: the guard applies to the blocklist/tag branch, not in front of the whole handler.
  - Every one of the seven mutation types is covered: while `running`, `paused` and `completed` it is dropped; in `idle` it applies and persists exactly once.
  - Startup window: a background restarted on a persisted `running` session rejects a blocklist mutation received while it reconciles, and accepts it again after a `TIMER_RESET`.
  - Race regression (decision E in `docs/features-analysis/blocklist-lock.md`): a popup whose status is still `idle` adds a site just as the session starts; the background rejects it, and once the `running` transition arrives through `attachStoreSync` the popup's blocklist matches the persisted one. No extra production code beyond CR2.T1/T2 is expected — the transition is itself a storage write that rehydrates the popup — so this is a regression test proving the invariant, not a new mechanism.
  - `bun run test` is green; the pre-existing mutation-bus cases (which run in `idle`) are unchanged.
* **Notes/decisions**: the rejection is silent by design (consistent with invalid payloads) but logged at `debug` so a support report can distinguish "the lock worked" from "the message was lost". Sender provenance is M6.T1's concern; this task only adds the status policy.

##### CR2.T3a — Disable the site and preset editors
* **Objective**: make the two direct blocklist editors reflect the lock — `SiteList` and `PresetPicker` cannot request a mutation outside `idle`, while their content stays readable.
* **Files to create/modify**: `components/blocklist/SiteList.tsx`, `components/blocklist/PresetPicker.tsx`, `tests/unit/components/blocklist/SiteList.test.tsx`, `tests/unit/components/blocklist/PresetPicker.test.tsx`.
* **Dependencies**: CR2.T1
* **Acceptance criteria**:
  - Both components read `selectBlocklistEditable` (granular selector; no computation inside the component) and disable their mutating controls with `disabled`: `SiteList` input + Add button + every per-entry remove button, `PresetPicker` every preset button.
  - While locked, `SiteList` does not render the normalization preview or the add feedback (no stale message for an action that cannot happen); the entries themselves stay rendered, so the list is still readable.
  - In `idle` both components behave exactly as today; the existing add/remove/preset flows and their tests pass unchanged.
  - Tests: with `running`, `paused` and `completed` the controls are disabled and interacting with them changes nothing (no store change, no mutation sent); with `idle` the flows still apply; `beforeEach` resets the timer status to `idle`, since the component tests share the module-level store.
* **Notes/decisions**: no notice and no locale key here — the visible explanation is CR2.T3c, which lands after this task so the UI never claims a lock it does not yet enforce. `disabled` (not `aria-disabled`) keeps the controls unfocusable and unclickable.

##### CR2.T3b — Disable the tag editor while keeping its filter
* **Objective**: tag creation, deletion and assignment are blocked outside `idle`, while filtering the list by tag (a view-only operation) keeps working.
* **Files to create/modify**: `components/blocklist/TagEditor.tsx`, `tests/unit/components/blocklist/TagEditor.test.tsx`.
* **Dependencies**: CR2.T1
* **Acceptance criteria**:
  - `TagEditor` reads `selectBlocklistEditable` and disables the create form (input + Create tag), every tag delete button and every assignment checkbox; the private `TagSiteRow` receives the same decision through a prop or reads the same selector — one source of truth, no duplicated logic.
  - The tag filter chips remain enabled and still narrow `visibleSites` while locked; the filtered list keeps rendering with the checkboxes disabled.
  - In `idle` the existing create/assign/filter/delete flows and their tests pass unchanged.
  - Tests: with `running`, `paused` and `completed` the mutating controls are disabled and clicking them changes nothing (no store change, no mutation); the filter still works in every locked status; `beforeEach` resets the timer status to `idle`.
* **Notes/decisions**: the filter is local view state (`filterTagId`), not a mutation, so it must stay enabled — disabling it would make the locked list harder to inspect. Deleting a tag rewrites `tagIds` on every entry, which is why it is covered by the lock at all.

##### CR2.T3c — Add the lock notice and the locale keys
* **Objective**: explain the lock to the user — one localized notice in the blocklist section, present only outside `idle`, naming Reset as the way out.
* **Files to create/modify**: `entrypoints/popup/App.tsx` (`BlocklistSection`), `locales/en.yml`, `locales/it.yml`, `tests/unit/i18n/i18n.test.tsx`, `tests/integration/popup/app-composition.test.tsx`.
* **Dependencies**: CR2.T3a, CR2.T3b
* **Acceptance criteria**:
  - `BlocklistSection` reads `selectBlocklistEditable` and renders exactly one localized notice when the list is locked (`role="status"`, `aria-live="polite"`); the notice is absent in `idle` and appears/disappears on a status change without a remount.
  - The copy states that the list is locked during a session and that **Reset** unlocks it (not "when the session ends", because `completed` is still locked — decision A).
  - The new key (e.g. `blocklist.locked`) exists in **both** `locales/en.yml` and `locales/it.yml`; the drift test stays green and no string is hardcoded.
  - `tests/unit/i18n/i18n.test.tsx` renders the new key in EN and IT.
  - `tests/integration/popup/app-composition.test.tsx`: start a session from the UI → the Blocklist tab shows the notice and disabled controls; reset → the notice disappears and editing works again; a `completed` session still shows the notice.
* **Notes/decisions**: the notice lives in the section, not in each editor, so there is a single explanation regardless of which component the user is looking at. This task lands last among the UI tasks precisely because its message must never be shown while the controls still work.

##### CR2.T4 — Documentation, changelog, and final verification
* **Objective**: document the lock and its decisions, and prove the full gate is green.
* **Files to create/modify**: `docs/features-analysis/blocklist-lock.md` (mark implemented and record the decisions), `README.md`, `.serena/memories/core.md`, `docs/changelog.md`.
* **Dependencies**: CR2.T1, CR2.T2, CR2.T3a, CR2.T3b, CR2.T3c
* **Acceptance criteria**:
  - The analysis document is marked implemented by CR2.T1–T4 (with the T3a/T3b/T3c UI split) and records the adopted decisions: `idle`-only window (A), all `BlocklistState` mutations including tags (B), three-layer enforcement (C), disabled controls + one notice (D), race covered by the regression test (E), startup window covered by the integration test (F), debug-level rejection log (G).
  - `README.md` states that the blocklist can only be edited before a session starts or after a Reset.
  - `.serena/memories/core.md` records the invariant: the blocklist is editable only in `idle`, enforced in the store and in the background, never by the UI alone.
  - `docs/changelog.md` gets one detail entry per CR2 task (files, tests, decisions), the summary rows, the updated current status and the real test counts; `Commit: —` until the developer commits.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build` and `bun run build:firefox` are green; run `bun run e2e` if the Playwright suite is available.
* **Notes/decisions**: no persistence change, so the changelog has no migration entry. The change request is complete only when the gate is green and the amended criteria in §2.5.3 are reflected in the docs.

#### 2.5.3 Amended acceptance criteria in Section 1

The following main-task criteria are intentionally amended by CR2. They remain in the document as history, but the lock rule above wins:

| Main task | Amended part | New rule |
|---|---|---|
| M1.T10 | the mutation handler applies blocklist/tag mutations at any time | accepted only while `idle`; otherwise dropped without persisting (CR2.T2) |
| M3.T1 | `PresetPicker` applies a preset whenever a button is clicked | buttons disabled outside `idle` (CR2.T3a) |
| M3.T2 | `TagEditor` creates, assigns and deletes tags at any time | mutating controls disabled outside `idle`; the tag filter stays usable (CR2.T3b) |
| M3.T3 | `SiteList` adds and removes sites at any time | add form and remove buttons disabled outside `idle` (CR2.T3a) |
| M3.T4 | the blocklist section is a pure composition of the three editors | it also renders the single lock notice (CR2.T3c) |

### 2.6 Change request CR3 — Completion-based score and tiered population

**Analysis.** The pre-change map (current code, numbers, reachability issue, persistence, UI, tests) is `docs/features-analysis/score-population.md`; the decisions below are the ones agreed there (§10 of that document).

**Goal.** The session score and the population growth both depend on the **percentage of city characters built**, never on a fixed character count: `TOTAL_CHARACTERS_PER_SESSION` (600 today) may grow, and no rule may hard-code 600 or a population number.

**Behavioral rule after the change.**
- `builtCharacters = max(0, focusCharacters − distractionCharacters)`, `completion = builtCharacters / TOTAL_CHARACTERS_PER_SESSION`. Characters are counted from the session duration, not from the rounded `tickMs`: `focusCharacters = min(total, floor(focusedMs × total / durationMs))`, `distractionCharacters = floor(distractedMs × total / durationMs)`, so a perfect session always gives exactly `total` for any total and preset.
- Contiguous half-open bands, shared by the score and the population rate:

  | Completion | Score | Population per character |
  |---|---|---|
  | `< 30%` | `bad` | 5 |
  | `30%` to `< 70%` | `good` | 10 |
  | `70%` to `< 100%` | `great` (new) | 20 |
  | `= 100%` | `excellent` | — (+ bonus) |

- The rate is **marginal**: a character earns the rate of the band it is built in (chosen by the completion *before* it is built, `(k − 1) / total`); crossing a cutoff never changes earlier characters. A distraction takes back the latest character at its band's rate. The population never goes below 0.
- Band cutoffs in characters are `ceil(ratio × total)`.
- At 100% the population gets a bonus of **7% of the population reached** (the maximum before the bonus): `round(0.07 × 6900) = 483`, final `7383` today. It scales with the total and the rates.
- The badge is live: `bad` at the start, `good` at 30%, `great` at 70%, `excellent` only on the final character; it drops back when a distraction removes characters.
- `great` is shown in blue `#4dabf7`, labelled "Great" (EN) / "Ottimo" (IT).
- `distractionRatio`, `setDistractionRatio`, `selectDistractionRatio`, `setPopulation`, `GOOD_MAX_RATIO` and `POPULATION_PER_TICK` are removed; the slice stores `builtCharacters` and derives `population` and `level` from it.

**Sequencing note.** The pure logic comes first (`CR3.T1`, `CR3.T3`) with the `ScoreLevel` type and UI in between (`CR3.T2`) so the `satisfies Record<ScoreLevel, …>` maps never fail to compile. Then the callers move to `builtCharacters` one layer at a time (`CR3.T4` progress accounting, `CR3.T5` slice and persistence, `CR3.T6` background). As in CR1, production tasks may leave `bun run compile` red **only** in the callers/tests owned by a later task; `bun run build` and `bun run build:firefox` stay green throughout. Tests are separate tasks (`CR3.T7`–`CR3.T9`), documentation is separate (`CR3.T10`), and the changelog plus the final gate close the change request (`CR3.T11`). Each task touches at most six files; a smaller model should do one task per run and not read ahead.

#### 2.6.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR3.T1 | Completion bands table and `calculateBuiltCharacters` | — |
| CR3.T2 | `great` level: `ScoreLevel`, badge, history styles and locales | CR3.T1 |
| CR3.T3 | Tiered `calculatePopulation` and band-based `calculateScore` | CR3.T1, CR3.T2 |
| CR3.T4 | Progress accounting emits `builtCharacters` | CR3.T1, CR3.T3 |
| CR3.T5 | Score slice stores `builtCharacters`; persistence rebuilds the score | CR3.T3 |
| CR3.T6 | Background writers use `setBuiltCharacters` | CR3.T4, CR3.T5 |
| CR3.T7 | Tests — pure score logic | CR3.T3 |
| CR3.T8 | Tests — progress accounting, slice and score components | CR3.T4, CR3.T5, CR3.T2 |
| CR3.T9 | Tests — integration (background, messaging, store) | CR3.T6, CR3.T8 |
| CR3.T10 | Documentation — README, instructions, analysis, memory | CR3.T6 |
| CR3.T11 | Changelog and final verification | CR3.T7, CR3.T8, CR3.T9, CR3.T10 |

#### 2.6.2 Task cards

##### CR3.T1 — Completion bands table and `calculateBuiltCharacters`
* **Objective**: create the single data table that drives both the score and the population rate, and the pure function that counts built characters.
* **Files to create/modify**: `lib/score/completion-bands.ts` (new), `lib/score/calculate-built-characters.ts` (new).
* **Dependencies**: —
* **Acceptance criteria**:
  - `completion-bands.ts` exports `COMPLETION_BANDS` (`as const`, ascending): `{ fromRatio: 0, level: 'bad', populationPerCharacter: 5 }`, `{ 0.3, 'good', 10 }`, `{ 0.7, 'great', 20 }`, `{ 1, 'excellent', 0 }`; `COMPLETION_BONUS_SHARE = 0.07` (with a one-line comment: share of the population reached); the type `CompletionLevel = (typeof COMPLETION_BANDS)[number]['level']`.
  - It also exports two pure helpers: `bandCutoffCharacters(fromRatio, total) = ceil(fromRatio × total)` and `calculateCompletion(builtCharacters, total)` → ratio clamped to `[0, 1]` (non-finite or `total ≤ 0` → `0`).
  - `calculate-built-characters.ts` exports `calculateBuiltCharacters(focusedMs, distractedMs, durationMs, total): number` implementing exactly `max(0, min(total, floor(focusedMs × total / durationMs)) − floor(distractedMs × total / durationMs))`; `NaN`, negatives, `±Infinity`, `durationMs ≤ 0` or `total ≤ 0` → `0`; result is always an integer in `[0, total]`.
  - No `Date.now()`, no `Math.random()`, no browser import, no literal `600`: the total is a parameter.
  - Each file is ≤ 200 lines and each function ≤ 40.
* **Notes/decisions**: nothing consumes these files yet, so the task compiles on its own. The tests are CR3.T7.

##### CR3.T2 — `great` level: `ScoreLevel`, badge, history styles and locales
* **Objective**: add the fourth score level everywhere the user sees it.
* **Files to create/modify**: `store/store.types.ts`, `components/score/ScoreBadge.tsx`, `components/score/SessionHistory.tsx`, `locales/en.yml`, `locales/it.yml`.
* **Dependencies**: CR3.T1
* **Acceptance criteria**:
  - `ScoreLevel` (`store/store.types.ts`) is derived from the table: `export type ScoreLevel = CompletionLevel` (imported from `lib/score/completion-bands.ts`), i.e. `'excellent' | 'great' | 'good' | 'bad'`.
  - `ScoreBadge.tsx`: `SCORE_LEVEL_LABEL_KEYS` gains `great: 'score.great'` (the existing `satisfies Record<ScoreLevel, string>` enforces it); the style block gains `.score-badge--great` in blue `#4dabf7`; the comment that says "three variants" is updated.
  - `SessionHistory.tsx` gains `.session-history__score--great` with the same blue `#4dabf7`.
  - `locales/en.yml` gets `score.great: Great` and `locales/it.yml` gets `score.great: Ottimo`, next to the other `score.*` keys.
  - `bun run compile` is green for these files; no other production file needs a change.
* **Notes/decisions**: do not touch the score slice or `calculateScore` here; they still return the three old levels until CR3.T3, which is valid because the union only grew.

##### CR3.T3 — Tiered `calculatePopulation` and band-based `calculateScore`
* **Objective**: rewrite the two pure score functions on top of `COMPLETION_BANDS`.
* **Files to create/modify**: `lib/score/calculate-population.ts`, `lib/score/calculate-score.ts`.
* **Dependencies**: CR3.T1, CR3.T2
* **Acceptance criteria**:
  - `calculatePopulation(builtCharacters: number, total: number): number`: normalize (non-finite or negative → `0`, floor, clamp to `total`; `total` non-finite or `≤ 0` → `0`); for every band below `excellent` add `populationPerCharacter × (characters of builtCharacters inside [cutoff, nextCutoff))`, with `cutoff = bandCutoffCharacters(fromRatio, total)`; when `builtCharacters === total` add `round(COMPLETION_BONUS_SHARE × populationBeforeBonus)`.
  - Reference values for `total = 600`: `0 → 0`, `179 → 895`, `180 → 900`, `181 → 910`, `420 → 3300`, `421 → 3320`, `599 → 6880`, `600 → 7383`. The function is monotonic non-decreasing in `builtCharacters`.
  - `calculateScore(builtCharacters: number, total: number): ScoreLevel` returns the level of the highest band whose cutoff `builtCharacters` reaches; for `total = 600`: `179 → bad`, `180 → good`, `419 → good`, `420 → great`, `599 → great`, `600 → excellent`. `NaN`/negative/invalid `total` → `bad`; above `total` → clamped (`excellent`).
  - `POPULATION_PER_TICK` and `GOOD_MAX_RATIO` are deleted, together with the ratio doc comments; the new doc comments state the band rules and that no number depends on 600.
  - `bun run compile` may fail **only** in the callers of the old signatures (`lib/timer/session-progress.ts`, `store/score.slice.ts`, `entrypoints/background.ts`) and in their tests; they are fixed by CR3.T4–T6 and CR3.T7–T9.
* **Notes/decisions**: the marginal rate means the 180th character earns 5 and the 181st earns 10 (the rate uses the completion before the character is built). The cutoffs use `ceil`, so with `total = 601` the `good` band starts at character 181.

##### CR3.T4 — Progress accounting emits `builtCharacters`
* **Objective**: make the shared accounting step produce the character count instead of a population.
* **Files to create/modify**: `lib/timer/session-progress.ts`, `store/timer.slice.ts` (doc comment only, if it mentions the population).
* **Dependencies**: CR3.T1, CR3.T3
* **Acceptance criteria**:
  - `SessionProgress` replaces `population` with `builtCharacters`, computed by `calculateBuiltCharacters(focusedMs, distractedMs, durationMs, total)` with the **accumulated** values after the step; the options gain `durationMs` (from `timer.durationSeconds × 1000`) next to the existing ones, and `total` is `TOTAL_CHARACTERS_PER_SESSION` passed by the caller or read from `lib/timer/focus-presets.ts`, never a literal.
  - The accounting rules (cap at `endsAt`, pause/resume, reconciliation, `tickMs` for city growth cadence) are unchanged; only the projection changes. `tickMs` is still used by the growth tracker for the city, not for the score.
  - Doc comments that describe the population in `session-progress.ts` and the `advanceProgress` mention in `store/timer.slice.ts:72` are updated.
  - `bun run compile` may fail **only** in `entrypoints/background.ts`, `store/score.slice.ts` and the tests; no `as`/`@ts-expect-error` hides it.
* **Notes/decisions**: a perfect session of every preset must yield exactly `total` here; that is asserted in CR3.T7/T8.

##### CR3.T5 — Score slice stores `builtCharacters`; persistence rebuilds the score
* **Objective**: make `builtCharacters` the single stored source of truth and derive `population` and `level` from it in one place.
* **Files to create/modify**: `store/score.slice.ts`, `store/index.ts`.
* **Dependencies**: CR3.T3
* **Acceptance criteria**:
  - `ScoreState` drops `distractionRatio` and gains `builtCharacters`; `setBuiltCharacters(builtCharacters)` normalizes the input and stores `builtCharacters`, `population = calculatePopulation(builtCharacters, TOTAL_CHARACTERS_PER_SESSION)` and `level = calculateScore(builtCharacters, TOTAL_CHARACTERS_PER_SESSION)`.
  - `setDistractionRatio`, `setPopulation` and `selectDistractionRatio` are removed (including the re-export in `store/index.ts`); `selectPopulation` and `selectScoreLevel` keep their contracts.
  - The initial state is derived from `0` characters: `builtCharacters: 0`, `population: 0`, `level: 'bad'`.
  - In `store/index.ts` the `merge` (≈ lines 256–270) rebuilds `score` from `saved.score.builtCharacters` (default `0`, via the same derivation) and ignores every other saved score field, so a legacy snapshot with `distractionRatio` / a stale `'excellent'` is repaired. No `version` bump and no `migrate`.
  - The slice stays a thin delegation layer: no band logic inside it. Both files stay ≤ 200 lines.
  - `bun run compile` may fail **only** in `entrypoints/background.ts` and the tests.
* **Notes/decisions**: `sessionHistory` is untouched (old entries keep their level and population and age out; no migration). During a running session the startup reconciliation recomputes `builtCharacters` from the persisted timer anyway.

##### CR3.T6 — Background writers use `setBuiltCharacters`
* **Objective**: connect the two background writers (live growth tracker and session completion) to the new action.
* **Files to create/modify**: `entrypoints/background.ts`.
* **Dependencies**: CR3.T4, CR3.T5
* **Acceptance criteria**:
  - The growth tracker (≈ line 210) writes `progress.builtCharacters` with `setBuiltCharacters`; the call to `advanceProgress` passes `durationMs`.
  - Session completion (≈ lines 293–308) computes the final value with `calculateBuiltCharacters(getFocusedMs(), getDistractedMs(), durationMs, TOTAL_CHARACTERS_PER_SESSION)` and calls `setBuiltCharacters`; it no longer calls `calculatePopulation` or `setPopulation`.
  - The `SessionSummary` is built exactly as before, reading `score.level` and `score.population` **after** the final write; `recordSession` and `SESSION_ENDED` are unchanged.
  - The doc comments about the population cadence and the `distractionRatio` open point (≈ lines 103–110 and 270–272) are rewritten to describe `builtCharacters`.
  - `bun run compile` is green for production code (`bun run build` and `bun run build:firefox` succeed); only tests may still fail, fixed by CR3.T7–T9.
* **Notes/decisions**: no other background logic changes. If the file would exceed 200 lines or a function 40, extract the new block into a small helper in the same file rather than growing the existing function.

##### CR3.T7 — Tests — pure score logic
* **Objective**: cover the bands, the character counting, the tiered population and the score with parametric boundary tests.
* **Files to create/modify**: `tests/unit/lib/score/completion-bands.test.ts` (new), `tests/unit/lib/score/calculate-built-characters.test.ts` (new), `tests/unit/lib/score/calculate-score.test.ts` (rewrite), `tests/unit/lib/score/calculate-population.test.ts` (rewrite).
* **Dependencies**: CR3.T3
* **Acceptance criteria**:
  - `completion-bands.test.ts`: the table is ascending, starts at `0`, ends at exactly `1`, and the `excellent` band has rate `0`; `bandCutoffCharacters` for totals 600 (`180/420/600`), 601 (`181/421/601`) and 700 (`210/490/700`); `calculateCompletion` clamps to `[0, 1]` and handles `NaN`.
  - `calculate-built-characters.test.ts`: net count clamped at `0`; capped at `total`; defensive inputs (`NaN`, negatives, `±Infinity`, `durationMs = 0`); **for every focus preset (5, 10, 20, 30, 45, 60, 90, 120 minutes) a perfect session gives exactly `total`**, for 600 and for hypothetical totals 700 and 1000 (this is the guard for the reachability issue).
  - `calculate-score.test.ts`: parametric table at total 600 on `0, 179, 180, 419, 420, 599, 600`; the same boundaries scaled for total 1000 (`299/300/699/700/999/1000`); defensive inputs (`NaN`, negative, `±Infinity`, invalid total).
  - `calculate-population.test.ts`: the reference values of CR3.T3 (`179 → 895` … `600 → 7383`); the bonus appears only at 100% and equals `round(0.07 × populationBeforeBonus)` for another total; marginal rate (no retroactive jump at a cutoff); monotonic; defensive inputs.
  - `bun run test -- tests/unit/lib/score` passes.
* **Notes/decisions**: write the expected numbers as literals taken from this card, not by re-computing them with the production formula, otherwise the test proves nothing.

##### CR3.T8 — Tests — progress accounting, slice and score components
* **Objective**: migrate the unit tests that consume the new `builtCharacters` contract and the `great` level.
* **Files to create/modify**: `tests/unit/lib/timer/session-progress.test.ts`, `tests/unit/store/score-slice.test.ts`, `tests/unit/components/score/ScoreBadge.test.tsx`, `tests/unit/components/score/SessionHistory.test.tsx`, `tests/unit/components/score/PopulationCounter.test.tsx`.
* **Dependencies**: CR3.T2, CR3.T4, CR3.T5
* **Acceptance criteria**:
  - `session-progress.test.ts`: every `population` expectation becomes `builtCharacters`; add a case where `durationMs` is passed and a perfect session ends at exactly `total`.
  - `score-slice.test.ts`: initial state `builtCharacters 0 / population 0 / level 'bad'`; `setBuiltCharacters` derives population and level in every band (`0`, `179`, `180`, `420`, `600`); the `distractionRatio` and `setPopulation` tests are removed; `selectPopulation` and `selectScoreLevel` still work.
  - `ScoreBadge.test.tsx`: four variants including `great`, labels `Excellent / Great / Good / Bad`, and the `.score-badge--great` rule in the style block.
  - `SessionHistory.test.tsx`: the `distractionRatio` fixture (≈ line 55) is replaced by `builtCharacters`; a `great` entry renders with its label and class.
  - `PopulationCounter.test.tsx`: only changes if it uses a removed action; the displayed literals stay valid.
  - `bun run test -- tests/unit/lib/timer tests/unit/store/score-slice.test.ts tests/unit/components/score` passes.
* **Notes/decisions**: if a test file only needs a fixture rename, make just that change; do not rewrite passing assertions.

##### CR3.T9 — Tests — integration (background, messaging, store)
* **Objective**: prove the live bands, the session completion and the legacy rehydration end to end.
* **Files to create/modify**: `tests/integration/background/growth-tick.test.ts`, `tests/integration/background/session-completion.test.ts`, `tests/integration/background/background.test.ts`, `tests/integration/messaging/timer-mutation-bus.test.ts`, `tests/integration/store/store.test.ts`.
* **Dependencies**: CR3.T6, CR3.T8
* **Acceptance criteria**:
  - Population expectations move to the tiered values: only files whose assertions actually fail need edits.
  - `growth-tick.test.ts`: the live level goes `bad → good → great` as ticks cross 30% and 70%, and drops back after a distraction; a distraction in the `great` band removes 20.
  - `session-completion.test.ts`: a perfect session records `excellent` with population `7383`; a shortened session stops in `great` / `good` / `bad` with the matching population; exactly one history entry and one `SESSION_ENDED`.
  - `timer-mutation-bus.test.ts`: the live population still reaches a read-only popup store (≈ line 280), now with a tiered value.
  - `store/store.test.ts`: the default score is `bad`/0; rehydrating a legacy `score` (`distractionRatio`, `level: 'excellent'`, flat `population`) rebuilds it from `builtCharacters` (default `0`) and drops `distractionRatio`.
  - `bun run test` is fully green and `bun run compile` is green (tests included).
* **Notes/decisions**: this task restores the green gate. Re-run the timer/population regression suites (M2.T2, M2.T18, M3.T3c).

##### CR3.T10 — Documentation — README, instructions, analysis, memory
* **Objective**: bring the user-facing and agent-facing documents in line with the new rules.
* **Files to create/modify**: `README.md`, `.github/copilot-instructions.md`, `docs/features-analysis/score-population.md`, `.serena/memories/core.md`.
* **Dependencies**: CR3.T6
* **Acceptance criteria**:
  - `README.md` (score bullet ≈ line 12) describes the four levels, the 30% / 70% / 100% bands, the 5 / 10 / 20 population rates and the 7% completion bonus.
  - `.github/copilot-instructions.md`: the `calculate-score.ts` / `calculate-population.ts` comments in §1.2, the M2.T9 / M2.T17 / M2.T18 rows of §3.3 and §3.4 item 4 mention four levels, completion bands and tiered population instead of the ratio and the flat rate.
  - `docs/features-analysis/score-population.md` is marked **implemented by CR3.T1–T11** (replace "Status: proposed") and its file/line references are left as history.
  - `.serena/memories/core.md` records the invariant: score and population derive from `builtCharacters / TOTAL_CHARACTERS_PER_SESSION`, nothing is hard-coded to 600, and characters are counted from the session duration.
  - No code or test file is touched.
* **Notes/decisions**: `docs/roadmap-en.md` and `docs/changelog.md` are handled by this change request's own sections and CR3.T11.

##### CR3.T11 — Changelog and final verification
* **Objective**: record the change request and prove the full gate is green.
* **Files to create/modify**: `docs/changelog.md`.
* **Dependencies**: CR3.T7, CR3.T8, CR3.T9, CR3.T10
* **Acceptance criteria**:
  - `docs/changelog.md` gets one detail entry per CR3 task (files, tests, decisions) in the standard format, the summary rows, the updated "Current status" with the **real** test counts, and the "exact `distractionRatio` formula" is removed from "Open issues" (resolved by CR3). `Commit: —` until the developer commits.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build` and `bun run build:firefox` are green; run `bun run e2e` if the Playwright suite is available.
  - A search for `distractionRatio`, `setPopulation`, `POPULATION_PER_TICK` and `GOOD_MAX_RATIO` finds no runtime reference (legacy-snapshot test fixtures excepted).
* **Notes/decisions**: no persistence version bump, so there is no migration entry. The change request is complete only when the gate is green and the amended criteria in §2.6.3 are reflected in the docs.

#### 2.6.3 Amended acceptance criteria in Section 1

The following main-task criteria are intentionally amended by CR3. They remain in the document as history, but the completion-based rules above win:

| Main task | Amended part | New rule |
|---|---|---|
| M2.T9 | `calculateScore(distractionRatio)` with ratio thresholds and three levels | `calculateScore(builtCharacters, total)` on the completion bands, four levels (CR3.T3) |
| M2.T17 | `ScoreBadge` with three variants | four variants including `great` (CR3.T2) |
| M2.T18 | population is a flat `+5` per focus tick, max 3000 | tiered per-character rate by completion band plus a 7% completion bonus, max 7383 today (CR3.T3) |
| M3.T3c | completion recomputes the population from ticks | completion recomputes `builtCharacters` from the duration (CR3.T6) |
| §4 open point (ratio formula) | exact `distractionRatio` formula to be defined | resolved: the ratio path is removed, score derives from `builtCharacters` (CR3.T5) |

### 2.7 Change request CR4 — Presets as toggles and saved custom presets

**Origin.** The UI critique of 2026-11-09 (`docs/ui/ui-review-tasks.md`, UI.T2/UI.T3; snapshot `.impeccable/critique/2026-11-09T16-33-10Z__entrypoints-popup.md`). Developer decisions: presets become toggles; custom tags become saved presets.

**Analysis.** Written by `CR4.T1` in `docs/features-analysis/saved-presets.md` (write/read paths, entry-source shape, persisted applied set, v3 migration, message set, lock matrix, test impact). Its decisions bind CR4.T2–CR4.T6; where they refine the rules below, the analysis wins.

**Goal.** Today `applyPreset` is a one-shot insert with no state and no undo, and custom tags affect nothing: no blocking code reads `tagIds` or `customTags` (only `lib/blocking/store-snapshot.ts` validates them and `lib/blocking/legacy-blocklist.ts` migrates them). After the change a preset — built-in (Social, Video, News) or saved by the user — is a **toggle** over the single blocklist, and user-created tags no longer exist as a separate concept.

**Behavioral rule after the change.**
- Each `BlocklistEntry` records **where it came from**: its sources are any of `manual` and one or more preset ids. Today's `tagIds` cannot tell a manual entry from a preset-only one once a tag is removed, so explicit source tracking replaces `tagIds` (decided in CR4.T1: `manual: boolean` + `presetIds: string[]` per entry, a persisted `appliedPresetIds`, and `userPresets` replacing `customTags`).
- A preset is **applied** when it is in the applied set; applying it adds its domains with that preset as a source; un-applying it removes the preset as a source and deletes only entries left with no source. A domain added manually or by another applied preset survives.
- Removing a single entry (×) removes it whatever its sources; the presets that contributed it stay applied but no longer cover that domain until re-applied.
- **Saved presets**: the user can create a preset (named, from the current list or empty and filled later), rename it, delete it (with confirmation or undo), and toggle it exactly like a built-in one. Built-in presets stay data in `lib/blocking/presets.ts` (Open/Closed, §1.1); user presets are persisted data with the same `Preset` shape, not new branching logic.
- The standalone tag editor (create/assign/filter tags) is removed from the popup; the list shows each entry's sources as chips.
- Enforcement is unchanged: `buildDnrRules` and `isDomainBlocked` read domains only, never sources.
- Persistence `version` goes from 2 to 3 with a migration: `customTags` become user presets whose domains are the entries carrying that tag; preset `tagIds` map to preset sources; an entry with no tag becomes `manual`. Known limit (accepted, recorded): an entry that was both typed manually and tagged in v2 migrates without the `manual` source.
- The CR2 lock still applies: every preset/blocklist mutation is `idle`-only, except the add-direction cases CR5 opens up.

**Sequencing note.** Analysis first (`CR4.T1`). Pure logic with its tests (`CR4.T2`, red/green §3.1), then the store and the v3 migration (`CR4.T3`), then messages and the background handler (`CR4.T4`), then the UI (`CR4.T5`, coordinated with UI.T1's single-list layout — UI.T1 lands first), then docs and the gate (`CR4.T6`). Each task touches at most six files.

#### 2.7.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR4.T1 | Analysis: preset sources, toggles, saved presets, v3 migration | — |
| CR4.T2 | Pure preset-toggle and source logic in `lib/blocking/` | CR4.T1 |
| CR4.T3 | Store model, slice actions and persistence v3 migration | CR4.T2 |
| CR4.T4 | Preset mutation messages and background handler | CR4.T3 |
| CR4.T5 | Popup: preset toggles, saved-preset management, tag editor removed | CR4.T4, UI.T1 |
| CR4.T6 | Documentation, changelog and final verification | CR4.T1–CR4.T5 |

#### 2.7.2 Task cards

##### CR4.T1 — Analysis: preset sources, toggles, saved presets, v3 migration
* **Objective**: write `docs/features-analysis/saved-presets.md` mapping the current preset/tag paths and recording the decisions the later tasks implement.
* **Files to create/modify**: `docs/features-analysis/saved-presets.md` (new).
* **Dependencies**: —
* **Acceptance criteria**:
  - Maps every write and read path of `applyPreset`, `createTag`, `deleteTag`, `assignTag`, `unassignTag`, `tagIds` and `customTags` (store, `lib/messaging/apply-mutation.ts`, `messages.types.ts`, persistence, components, locales, tests).
  - Decides the entry source shape (replacing `tagIds`), the applied-presets representation (derived vs persisted), the user-preset storage key and id scheme, and the v2→v3 migration including the accepted limit above.
  - Decides the message set replacing `BLOCKLIST_APPLY_PRESET` and `TAG_*` (e.g. `PRESET_TOGGLE`, `PRESET_SAVE`, `PRESET_RENAME`, `PRESET_DELETE`) and how the CR2 lock and CR5 add-only window apply to each.
  - Lists the tests that change and the ones that must stay untouched (enforcement: `rules.ts`, `is-domain-blocked.ts`).
* **Notes/decisions**: no production code in this task.

##### CR4.T2 — Pure preset-toggle and source logic in `lib/blocking/`
* **Objective**: pure, browser-free functions that toggle a preset over the blocklist and maintain entry sources.
* **Files to create/modify**: `lib/blocking/preset-toggle.types.ts`, `lib/blocking/preset-toggle.ts`, `lib/blocking/saved-presets.ts` (all new), `tests/unit/lib/blocking/preset-toggle.test.ts` and `saved-presets.test.ts` (new). The new model gets its own types so `store/store.types.ts` stays untouched and the tree stays green; CR4.T3 aligns the store types with them.
* **Dependencies**: CR4.T1
* **Acceptance criteria**:
  - Tests written first: apply adds missing domains and the source; un-apply removes only entries with no remaining source; a manual entry and an entry shared by two applied presets survive un-apply; re-apply is idempotent; domains are canonicalized through `getRegistrableDomain` (DRY).
  - Functions are pure (no `Date.now()`, no browser APIs), have explicit return types and return new arrays.
  - Existing enforcement tests stay green untouched.

##### CR4.T3 — Store model, slice actions and persistence v3 migration
* **Objective**: move `BlocklistState` to entry sources, applied presets and user presets; migrate persisted v2 data.
* **Files to create/modify**: `store/store.types.ts` (`BlocklistEntry`, `Preset` without `tag`, `BlocklistState`), `store/blocklist.slice.ts` (actions and selectors only), `lib/blocking/blocklist-state.ts` (new, v3 sanitizer), `lib/messaging/messages.types.ts` and `lib/messaging/apply-mutation.ts` (message types and the four preset cases, needed for the tree to compile; boundary hardening and lock tests stay in CR4.T4), `components/blocklist/PresetPicker.tsx`, `SiteList.tsx`, `entry-sources.ts` and the deletion of `TagEditor.tsx` (the minimum for the tree to compile: toggle with `aria-pressed`, chips from `presetIds`; the rest of the UI stays in CR4.T5), the tag keys in the locales, `lib/blocking/blocklist-sites.ts` (new, site helpers moved out of the slice), `store/index.ts`, `lib/blocking/legacy-blocklist.ts`, `lib/blocking/migrate-presets.ts` (new), `lib/blocking/store-snapshot.ts`, `tests/unit/store/blocklist-preset.test.ts`, `tests/unit/store/blocklist-migration-v3.test.ts` (new). Existing test fixtures move from `tagIds: []` to `manual: true, presetIds: []` through a shared helper.
* **Dependencies**: CR4.T2
* **Acceptance criteria**:
  - Actions `togglePreset`, `savePreset`, `renamePreset`, `deletePreset` replace `applyPreset` and the tag actions; granular selectors expose applied state and per-preset counts.
  - CR2 lock preserved: all of them are no-ops outside `idle` (except what CR5 opens).
  - `version: 3`; the migration turns v2 `customTags`/`tagIds` into user presets and sources as decided in CR4.T1, with fixtures for v1 and v2 snapshots.
  - Snapshot validation rejects malformed v3 data with a `Result`, never a throw (§1.4).

##### CR4.T4 — Preset mutation messages and background handler
* **Objective**: replace `BLOCKLIST_APPLY_PRESET` and `TAG_*` with the preset message set; the background stays the single writer.
* **Files to create/modify**: `lib/messaging/blocklist-payload.ts` (new, runtime shape check), `lib/messaging/apply-mutation.ts`, `lib/messaging/mutation-sender.ts` (comment only), `tests/unit/lib/messaging/blocklist-payload.test.ts` (new), `tests/integration/messaging/mutation-bus.test.ts`, `tests/integration/background/blocklist-lock.test.ts`. The message types themselves landed in CR4.T3.
* **Dependencies**: CR4.T3
* **Acceptance criteria**:
  - Discriminated-union messages, validated at the boundary; unknown or malformed payloads are dropped and logged at `debug` without the payload.
  - The lock cases from CR2.T2 are re-expressed for the new types; DNR rules still follow the blocklist through `syncRules`.

##### CR4.T5 — Popup: preset toggles, saved-preset management, tag editor removed
* **Objective**: the UI side of UI.T2/UI.T3 on top of UI.T1's single list.
* **Files to create/modify**: `components/blocklist/PresetPicker.tsx`, `PresetToggle.tsx`, `SavedPresetControls.tsx`, `SavedPresetRow.tsx`, `PresetNameForm.tsx`, `preset-picker.styles.ts` (new, split for the 200-line rule), `lib/blocking/saved-presets.ts` (`validatePresetName`), `entrypoints/popup/App.tsx` (comment), `locales/en.yml`, `locales/it.yml` (component tests updated alongside). `SiteList` already shows source chips since CR4.T3.
* **Dependencies**: CR4.T4, UI.T1
* **Acceptance criteria**:
  - Preset buttons expose `aria-pressed`, show applied state and count, and are dimmed when locked; their domains are inspectable before applying.
  - User presets appear next to built-in ones and can be saved, renamed and deleted (confirmation or undo).
  - List rows show source chips; no tag editor or checkbox grid remains.
  - All strings localized in EN and IT; the i18n drift test stays green.

##### CR4.T6 — Documentation, changelog and final verification
* **Objective**: record the change and prove the gate.
* **Files to create/modify**: `docs/features-analysis/saved-presets.md` (mark implemented), `README.md`, `DESIGN.md` (chips section if the source chip adds a pattern), `.serena/memories/core.md`, `docs/changelog.md`.
* **Dependencies**: CR4.T1–CR4.T5
* **Acceptance criteria**:
  - Changelog entry per CR4 task with the v3 migration entry; `Commit: —` until committed.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build`, `bun run build:firefox` green; `bun run e2e` if available.

#### 2.7.3 Amended acceptance criteria in Section 1

| Main task | Amended part | New rule |
|---|---|---|
| M2.T5 | a preset expands into entries tagged with its tag | a preset is toggled; entries record it as a source (CR4.T2/T3) |
| M3.T1 | `PresetPicker` applies a preset once | presets toggle and show applied state and count (CR4.T5) |
| M3.T2 | `TagEditor` creates, assigns, filters and deletes custom tags | removed in CR4.T3; replaced by saved user presets (management UI in CR4.T5) |
| CR2.T1/T2/T3b | lock covers `createTag`/`deleteTag`/`assignTag`/`unassignTag` | lock covers the preset actions/messages instead (CR4.T3/T4) |

### 2.8 Change request CR5 — Allow adding sites during a session

**Origin.** The UI critique of 2026-11-09 (UI.T4) and the developer's decision: a forgotten site must not cost the whole city through Reset.

**Goal.** CR2 locks the blocklist outside `idle` because loosening it mid-session is an escape from the block. **Tightening** it is not, so adds become allowed during a session; removals stay locked.

**Behavioral rule after the change.**
- In `running` and `paused`, **add-direction** mutations are accepted: `addSite`, and toggling a preset **on** (CR4). Everything that loosens or reshapes the list stays `idle`-only: `removeSite`, toggling a preset **off**, saving/renaming/deleting a user preset.
- `completed` stays fully locked until Reset (CR2 decision A unchanged): the session is over, so tightening has no effect.
- A new pure predicate `isBlocklistAddAllowed(status)` (`idle`, `running`, `paused`) sits next to `isBlocklistEditable(status)` (`idle` only); the three enforcement layers of CR2 (store, background, UI) each use the right one.
- A site added during `running` is enforced immediately: `syncRules` already re-runs on every store change, and the overlay content script already re-evaluates on store updates, so an already-open tab on that domain shows the overlay. Being on that tab from then on counts as distraction under the existing malus rules — no retroactive malus for time before the add.
- No persisted field and no version bump: the window is derived from `timer.status`.

**Sequencing note.** Store first (`CR5.T1`), then the authoritative background (`CR5.T2`), then the UI and copy (`CR5.T3`), then docs (`CR5.T4`). The preset-on part depends on CR4's toggle; if CR5 lands before CR4, it covers `addSite` only and CR4.T3/T4 extend the add window to `togglePreset` on.

#### 2.8.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR5.T1 | `isBlocklistAddAllowed` and the add-only window in the store | — (preset-on part: CR4.T3) |
| CR5.T2 | Background accepts add-direction mutations mid-session | CR5.T1 |
| CR5.T3 | Popup: add field enabled mid-session, removals locked, new notice copy | CR5.T2, UI.T1 |
| CR5.T4 | Documentation, changelog and final verification | CR5.T1–CR5.T3 |

#### 2.8.2 Task cards

##### CR5.T1 — `isBlocklistAddAllowed` and the add-only window in the store
* **Objective**: let add-direction actions through in `running`/`paused` while keeping every other mutation `idle`-only.
* **Files to create/modify**: `store/blocklist-lock.ts` (new: both predicates, so the slice stays under 200 lines), `store/blocklist.slice.ts`, `store/index.ts`, `tests/unit/store/blocklist-lock.test.ts`.
* **Dependencies**: — (preset-on part: CR4.T3)
* **Acceptance criteria**:
  - `isBlocklistAddAllowed(status: TimerStatus): boolean` is pure, `true` for `idle`, `running`, `paused`; `selectBlocklistAddAllowed` is exported.
  - Truth-table tests per action and status: `addSite` applies in `idle`/`running`/`paused`, is a no-op in `completed`; `removeSite` (and preset-off / preset management after CR4) stay no-ops outside `idle`.
  - Existing `idle` tests stay green unmodified.

##### CR5.T2 — Background accepts add-direction mutations mid-session
* **Objective**: the background, as single writer, applies the same window so a forged remove is still rejected.
* **Files to create/modify**: `lib/messaging/apply-mutation.ts`, `lib/messaging/blocklist-payload.ts` (`isAddDirectionMutation`), `entrypoints/background.ts` (credit the stretch and re-read the tabs around a mid-session add), `tests/unit/lib/messaging/blocklist-payload.test.ts`, `tests/integration/messaging/mutation-bus.test.ts`, `tests/integration/background/blocklist-lock.test.ts`, `tests/integration/background/dnr-rules.test.ts`, `tests/integration/background/malus.test.ts`.
* **Dependencies**: CR5.T1
* **Acceptance criteria**:
  - `BLOCKLIST_ADD_SITE` (and preset-on after CR4) is accepted in `running`/`paused` and persisted once; removals and preset management are still dropped with the `debug` log of CR2.T2.
  - A site added while `running` produces a DNR rule immediately; after Reset the rules are cleared as before.
  - Malus: time on the newly blocked domain counts only from the add onward.

##### CR5.T3 — Popup: add field enabled mid-session, removals locked, new notice copy
* **Objective**: reflect the add-only window in the blocklist UI.
* **Files to create/modify**: `components/blocklist/SiteList.tsx`, `components/blocklist/PresetPicker.tsx`, `components/blocklist/PresetToggle.tsx` (per-toggle disabled rule), `entrypoints/popup/App.tsx`, `locales/en.yml`, `locales/it.yml`, `tests/integration/popup/app-composition.test.tsx`, `tests/unit/i18n/i18n.test.tsx` (component tests updated alongside).
* **Dependencies**: CR5.T2, UI.T1
* **Acceptance criteria**:
  - In `running`/`paused` the add field, Add button (and unapplied presets after CR4) are enabled; × buttons and applied-preset toggles are disabled; in `completed` everything is disabled.
  - The notice copy states that sites can be added during a session and that removing needs Reset; `completed` keeps the Reset wording. Neutral voice (PRODUCT.md). Keys in EN and IT.

##### CR5.T4 — Documentation, changelog and final verification
* **Objective**: record the amendment to CR2 and prove the gate.
* **Files to create/modify**: `docs/features-analysis/blocklist-lock.md` (amendment note), `README.md`, `.serena/memories/core.md`, `docs/changelog.md`.
* **Dependencies**: CR5.T1–CR5.T3
* **Acceptance criteria**:
  - README: sites can be added during a session; removing or editing presets needs the timer idle (before Start or after Reset).
  - Serena memory invariant updated: adds allowed in `idle`/`running`/`paused`, everything else `idle`-only, enforced in store and background.
  - Changelog entries per task; gate green as in CR4.T6.

#### 2.8.3 Amended acceptance criteria in Section 2

| Task | Amended part | New rule |
|---|---|---|
| CR2.T1 | every blocklist action is a no-op outside `idle` | add-direction actions also apply in `running`/`paused` (CR5.T1) |
| CR2.T2 | the background drops every blocklist mutation outside `idle` | add-direction mutations accepted in `running`/`paused` (CR5.T2) |
| CR2.T3a | `SiteList` input and Add disabled outside `idle` | enabled in `running`/`paused`; × still disabled (CR5.T3) |
| CR2.T3c | notice says the list is locked and Reset unlocks it | during a session it says sites can be added and removal needs Reset (CR5.T3) |

### 2.9 Change request CR6 — Three.js city with a new shape every session

**Origin.** The city-tab exploration of 2026-11-10/11 (sketches A, B, B′, C, D in the private artifact "City Render Options"). Developer decision: adopt sketch **D** — a three.js city with the terminal/neon look (black floor, phosphor-green grid and rain, site-colored edges and windows, bloom, CRT pass) — and give the city more room. The city must look different every session: layout, building sizes and colors change at random, while staying stable within one session. Second decision (2026-11-11): the escalating malus of M4.T1 moves into the score (option A), so the city and the score always show the same loss.

**Goal.** Today the city is a 60 × 20 character grid (`components/city/city.types.ts`) filled one character per tick by `lib/city/growth-engine.ts` and stored in `city.layers`; the malus erases characters from those layers (`lib/score/apply-malus.ts`) with an escalating cost that never reaches the score. After the change the city is a **plan** generated from the session seed — lots, buildings, floors, colors, props — and what is on screen is **derived** from the plan and the session's `builtCharacters`. It is drawn with three.js in the popup's City tab, with an ASCII fallback when WebGL is unavailable.

**Behavioral rule after the change.**
- **One plan per session, different every session.** `generateCityPlan(seed)` is pure and seeded (§1.4: the PRNG is injected, never `Math.random()`). The seed comes from the session id, which is already random per session. The same seed always gives the same plan, so the city survives service-worker and popup restarts without storing geometry.
- **Variation is data-driven (Open/Closed, §1.1).** Each session picks at random:
  - a road layout from a set of layouts (data), with random offsets;
  - lot footprints (1×1, 2×1, 1×2, 2×2 merged lots);
  - a building archetype per lot from an archetype list (data: tower, slab, stepped setbacks, twin, spire, low block), with random height inside the archetype's range and 1–3 landmark towers placed at random;
  - a neon palette from a palette list (data) plus a small per-session hue shift, assigned so that neighbors never share a color;
  - prop placement (lamps, signs, beacons) and generated tower names for the labels.
  The environment stays fixed so the popup keeps its identity: black floor, phosphor-green grid, rain and HUD text (`#7dfba0`, DESIGN.md).
- **Growth is derived, not stored.** Each plan lists its floors in build order (shuffled building order, each building bottom-up). The visible part is `builtCharacters / TOTAL_CHARACTERS_PER_SESSION × plan.totalFloors`: the whole part is the number of complete floors, the remainder is a partly paid floor.
- **The malus damages the city through the score (option A).** The M4.T1 escalation (1 character per distraction tick, then 2, then 3 as the stay lengthens) moves into `builtCharacters`, so the score, the tiers, the population and the city all lose the same amount. In the city, the newest floors disappear first, with a glitch-out animation; when focus resumes the city grows again from where it is.
- **Every lost character is visible.** A floor is worth several characters (2–3 for a 200–300-floor plan), so a partly paid top floor is drawn in a **damaged** state (cracked, flickering red edges) instead of waiting for a whole floor to vanish.
- **Rendering stays light** (decisions from the exploration):
  - three.js is loaded only when the City tab opens (a separate chunk); the Timer tab never loads it;
  - render on demand: a frame is drawn only when the visible floors change, the camera moves or the view resizes; the ambient layer (rain, cars, window flicker, beacons) runs at most 30 fps and stops when the view is hidden;
  - instanced meshes: all floor bodies in one draw call, all window bands in another; edges in one line mesh rebuilt only when the count changes;
  - pixel ratio capped at 1.5, `powerPreference: 'low-power'`, no MSAA, bloom at reduced resolution;
  - everything disposed when the view unmounts; context loss falls back to the ASCII view;
  - `prefers-reduced-motion`: no ambient layer, no drop or removal animation, no auto-rotate.
- **Fallback and accessibility.** Without WebGL2 (or after a lost context) the City tab shows an ASCII skyline derived from the same plan. Both views carry a text summary for screen readers (buildings, floors built of total, tallest building), updated at milestones, not on every floor.
- The background stays the single writer and never touches three.js: it keeps advancing session progress; it no longer grows or erases layers.
- Persistence `version` goes from 3 to 4: `city.layers` and `city.buildings` are dropped; the city keeps only what the plan needs (session id, plus any palette override decided in CR6.T1).
- **Documentation is part of every task.** CR6 changes the paradigm — from an ASCII grid filled one character per tick to a seeded plan drawn in 3D — so a task is done only when every **living** document that describes the part it changes describes the new model. CR6.T1 inventories those documents; each card below names the ones it owns in a **Docs** criterion; CR6.T13 checks that no living document still presents the old model as current. **Historical** records (changelog entries, closed issues, past plans and analyses) are not rewritten: they get a one-line "Superseded by CR6 (§2.9)" note where they describe the old city as current. Each task also adds its own changelog entry through the `changelog` skill (CLAUDE.md §4).

**Sequencing note.** Analysis first (`CR6.T1`). Pure plan, colors and derivation with their tests (`CR6.T2a`, `CR6.T2b`, `CR6.T3`, `CR6.T4`, red/green §3.1). Then the store (`CR6.T5a`) and the background with the score change (`CR6.T5b`); in parallel the renderer core (`CR6.T6a`, `CR6.T6b`) and its ambient layer (`CR6.T7`). Then the popup view (`CR6.T8a`) and its fallback (`CR6.T8b`), removal of the ASCII engine (`CR6.T9a`) and of its documentation (`CR6.T9b`), export (`CR6.T10`), the optional full-city page (`CR6.T11`), performance verification (`CR6.T12`) and the final documentation consistency pass (`CR6.T13`). Documentation is not deferred to the end: each task updates the documents that describe what it changes. Each task touches at most about six production files. UI.T11's empty-city hint and UI.T12 land after CR6.T8a (see `docs/ui/ui-review-tasks.md`). The UI.T8 decision not to fix the 492 px City canvas overflow is superseded: the new view fills the tab width.

#### 2.9.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| CR6.T1 | Analysis: city plan model, derivation, renderer, budgets, migration, docs inventory | — |
| CR6.T2a | Plan generator, part 1: seeded road layouts and lots | CR6.T1 |
| CR6.T2b | Plan generator, part 2: archetypes, heights, landmarks, build order, names | CR6.T2a |
| CR6.T3 | Session palettes and color assignment | CR6.T2b |
| CR6.T4 | Visible-floor derivation, damaged top floor and pure scene data | CR6.T2b, CR6.T3 |
| CR6.T5a | Store and persistence v4: derived city instead of layers | CR6.T4 |
| CR6.T5b | Background and score: progress-only growth tick, escalating malus in `builtCharacters` | CR6.T5a |
| CR6.T6a | Add three.js; renderer lifecycle and pure render scheduler | CR6.T4 |
| CR6.T6b | City meshes from scene data, bloom and CRT pass | CR6.T6a |
| CR6.T7 | Ambient layer, floor animations and damaged-floor effect | CR6.T6b |
| CR6.T8a | Popup City tab: lazy 3D view and accessible summary | CR6.T5b, CR6.T7 |
| CR6.T8b | ASCII fallback from the plan, switch on missing or lost WebGL | CR6.T8a |
| CR6.T9a | Remove the ASCII growth engine, its components and tests | CR6.T8b |
| CR6.T9b | Retire the old model in the documentation | CR6.T9a |
| CR6.T10 | Export the city image from the 3D view | CR6.T8b |
| CR6.T11 | *(Optional)* Full-city extension page | CR6.T8a |
| CR6.T12 | Performance verification and e2e | CR6.T8b, CR6.T10 |
| CR6.T13 | Documentation consistency pass and final verification | CR6.T1–CR6.T12 |

#### 2.9.2 Task cards

##### CR6.T1 — Analysis: city plan model, derivation, renderer, budgets, migration, docs inventory
* **Status**: done (2026-11-11) — `docs/features-analysis/city-3d.md`. Two decisions amend later cards (CR6.T4, CR6.T5b); two open points are listed in its §11.
* **Objective**: write `docs/features-analysis/city-3d.md` mapping the current city paths and recording the decisions the later tasks implement.
* **Files to create/modify**: `docs/features-analysis/city-3d.md` (new).
* **Dependencies**: —
* **Acceptance criteria**:
  - Maps every write and read path of `city.layers`, `city.buildings`, `city.themeId`, `growCityByTicks`, `applyMalus`/`applyMalusToCity`, `malusForDistractionTicks`, `MALUS_APPLIED`, `seedFromSession`, `getBuildingColor`, `selectThemeId`, `buildCityImage` and `calculateBuiltCharacters` (store, background growth and malus ticks, overlay feedback, components, export, persistence, tests, docs).
  - Decides the `CityPlan` shape (lots, buildings, floors in build order, props, names), the seed source and its entropy (confirms `generateSessionId` is random per session), and the variation sets (road layouts, footprints, archetypes, palettes, hue shift range) with their limits so a plan always fits the frame and its total floors stay within fixed bounds.
  - Specifies the option A malus: how the escalation schedule (`MALUS_ESCALATION_SCHEDULE`) enters `calculateBuiltCharacters` (which distraction time it counts, from the "proceed" baseline as today), what `MALUS_APPLIED` reports once there are no layers, and the effect on the CR3 bands (expected: harsher scores for long stays; recorded with an example).
  - Specifies the visible-floor formula and the damaged top floor (when a floor counts as damaged, how it is shown).
  - Decides the v3→v4 migration (fields dropped, an in-progress session at upgrade keeps its score and gets its plan from its session id).
  - Decides the three.js version and import paths (`three` and `three/addons`), the module split under `components/city/three/`, the fallback (ASCII skyline from the plan), the export method and the test strategy (no WebGL in happy-dom: pure scene data in `lib/`, renderer mocked in component tests, real rendering in Playwright).
  - Sets the performance budgets CR6.T12 checks: three.js chunk size (target ≤ 180 KB gzipped), first City frame after opening the tab (target ≤ 200 ms on the reference machine), 0 renders per second when nothing changes and motion is reduced, ambient layer ≤ 30 fps, draw calls for the city ≤ 12.
  - Lists the modules, components and tests to delete in CR6.T9a.
  - **Documentation inventory**: every document that describes the current city, each classified as *living* (updated, with the CR6 task that owns it) or *historical* (banner note only). At least: `CLAUDE.md` (overview stack line, §1.1 KISS/DRY rows, §1.3 persisted city state, §1.4 pure-function and dependency examples, the "two clocks" technical note), `DESIGN.md`, `PRODUCT.md`, `README.md`, `docs/project-structure.md`, `docs/testing-matrix.md`, `docs/features-analysis/score-population.md`, `docs/store-analysis.md`, `docs/ui/ui-review-tasks.md`, the Section 1 cards of this roadmap listed in §2.9.3, `.serena/memories/core.md` and `tech_stack.md`, the JSDoc of code that stays; historical: `docs/timer-duration-plan.md`, `docs/Increase-poppu-screen-size.md`, `docs/issue/I002-scattered-city-draw.md`, `docs/issue/I009-malus-already-open-blocked-tab.md`, past changelog entries.
  - A short **reference description of the new model** (plan from seed, floors derived from `builtCharacters`, malus through the score, 3D view with ASCII fallback, fixed green environment with session palettes) that the other documents reuse, so they all say the same thing.
* **Notes/decisions**: no production code in this task. Adding `three` is an approved exception to the minimal-dependency rule (§1.4), recorded here.

##### CR6.T2a — Plan generator, part 1: seeded road layouts and lots
* **Status**: done (2026-11-11). Built `GroundPlan` with four layouts; lot bounds measured as 30–48 (not 24–40), which CR6.T2b follows with a re-derived total-floors bound (`city-3d.md` §3).
* **Objective**: the first half of `generateCityPlan(seed, options)`: the ground plan — roads and lots — that differs from session to session.
* **Files to create/modify**: `lib/city/plan/city-plan.types.ts`, `lib/city/plan/generate-city-plan.ts` (entry point), `lib/city/plan/plan-lots.ts` (road placement, lot merging), `lib/city/plan/road-layouts.ts` (data), `tests/unit/lib/city/plan/plan-lots.test.ts` (all new).
* **Dependencies**: CR6.T1
* **Acceptance criteria**:
  - Tests written first. Same seed → deep-equal ground plan; the PRNG is injected (§1.4).
  - Invariants hold for 1,000 seeds: every lot off the roads, no overlapping footprints, every road connected, the plan inside the frame.
  - Variation is measurable: over 100 seeds, the layouts, road offsets and footprint mixes are not all equal (the test asserts a minimum number of distinct values for each).
  - Adding a road layout is an array edit, never a change to the generator.
  - Files ≤ 200 lines, functions ≤ 40 lines, explicit return types.
  - **Docs**: `docs/features-analysis/city-3d.md` (ground-plan section updated to what was built), `docs/testing-matrix.md` (CR6.T2a row: seeds, invariants, variation checks).

##### CR6.T2b — Plan generator, part 2: archetypes, heights, landmarks, build order, names
* **Status**: done (2026-11-11). Total floors re-derived as 200–300; two helper files were added (`fit-total-floors.ts`, `plan-props.ts`) to keep files under 200 lines; colors stay with CR6.T3.
* **Objective**: complete the plan: a building on every lot, its floors in build order, landmarks, props and tower names.
* **Files to create/modify**: `lib/city/plan/plan-buildings.ts` (archetype choice, heights, landmarks, props), `lib/city/plan/build-order.ts` (shuffled building order, each bottom-up), `lib/city/plan/building-archetypes.ts` (data), `lib/city/plan/tower-names.ts` (data), `lib/city/plan/generate-city-plan.ts` (wiring), `tests/unit/lib/city/plan/generate-city-plan.test.ts` (new).
* **Dependencies**: CR6.T2a
* **Acceptance criteria**:
  - Same seed → deep-equal plan.
  - Invariants hold for 1,000 seeds: every height inside its archetype range and the frame, total floors inside the bounds set in CR6.T1, at least one landmark tower, the build order lists every floor exactly once and never a floor before the one below it.
  - Variation is measurable: over 100 seeds, archetype mixes, height profiles and landmark positions are not all equal.
  - Adding an archetype or a name is an array edit.
  - **Docs**: `city-3d.md` buildings section, `docs/testing-matrix.md` (CR6.T2b row).

##### CR6.T3 — Session palettes and color assignment
* **Status**: done (2026-11-11). The minimum luminance CR6.T1 left open is set here as a 4.5:1 contrast ratio on the floor; two helper files were added (`color-math.ts`, `environment-colors.ts`).
* **Objective**: give each session a random neon palette and assign colors to buildings, windows and props.
* **Files to create/modify**: `lib/city/plan/city-palettes.ts` (data: at least 5 palettes), `lib/city/plan/assign-colors.ts`, `lib/city/plan/generate-city-plan.ts` (call site), `tests/unit/lib/city/plan/assign-colors.test.ts` (new); docs below.
* **Dependencies**: CR6.T2b
* **Acceptance criteria**:
  - The palette and the hue shift come from the seed; same seed → same colors.
  - No two adjacent buildings share a color; every building color stays readable against the black floor (minimum luminance set in CR6.T1).
  - Environment colors (floor, grid, rain, HUD) are constants, not part of the palette.
  - The domain-hash coloring (`getBuildingColor`) is no longer used by the city; its removal is CR6.T9a.
  - **Docs**: `DESIGN.md` (color section and front-matter tokens: the fixed environment colors, and session palettes as the one sanctioned exception to the single-accent rule), `city-3d.md` palette section, `docs/testing-matrix.md` row.

##### CR6.T4 — Visible-floor derivation, damaged top floor and pure scene data
* **Status**: done (2026-11-11). Scene data is a static `createScenePlan` plus a per-update `createSceneFrame`; `calculateFocusCharacters` was extracted from `lib/score/calculate-built-characters.ts` without a behavior change; `box-geometry.ts` was added.
* **Objective**: turn a plan and the session progress into what the renderer draws, without any WebGL.
* **Files to create/modify**: `lib/city/plan/visible-floors.ts` (complete floors and the damaged fraction), `lib/city/plan/scene-data.ts` (instance transforms, window colors, edge segments, label anchors as typed arrays, the damaged-floor marker), `lib/city/plan/plan-summary.ts` (text summary for screen readers), their unit tests (new).
* **Dependencies**: CR6.T2b, CR6.T3
* **Acceptance criteria**:
  - `visibleFloors(plan, builtCharacters, total, lostCharacters)` returns `{ complete, partialFraction, damaged }` per the CR6.T1 formula (`city-3d.md` §4): nothing at 0, every floor complete at `total`, monotonic, invalid input → nothing.
  - Lowering `builtCharacters` removes the newest floors first. The partly paid top floor is *under construction* while no character has been lost and **damaged** once `lostCharacters > 0` (`max(0, focusCharacters − built)`, derived from the `timer` accumulators), so a loss of a single character always changes the output and a growing city never flashes red.
  - `sceneData` output for a fixed seed matches a snapshot; instance and edge counts equal the visible floors.
  - Pure: no `Date.now()`, no browser or three.js imports.
  - **Docs**: `city-3d.md` derivation section, `docs/testing-matrix.md` row.

##### CR6.T5a — Store and persistence v4: derived city instead of layers
* **Status**: done (2026-11-11). Expand/contract: the persisted city is `{ sessionId }` and the plan/floor selectors exist, but the ASCII `layers`/`buildings`/`themeId` stay in memory (unpersisted) so the background and its tests keep working until CR6.T5b/T9a; the popup's old City view is blank until CR6.T8a.
* **Objective**: the store holds only what the plan needs.
* **Files to create/modify**: `store/city.slice.ts` (state reduced to the session id and any CR6.T1 field; memoized `selectCityPlan`, `selectVisibleFloors`), `store/store.types.ts`, `store/index.ts` (version 4 and migration), `lib/city/migrate-city.ts` (new), tests for the slice and the migration.
* **Dependencies**: CR6.T4
* **Acceptance criteria**:
  - `resetCityForNewSession` still runs only on `idle → running`, never on resume; a new session gets a new plan.
  - Version 4: v3 snapshots migrate with `city.layers`/`city.buildings` dropped; malformed data is rejected with a `Result`, never a throw (§1.4); fixtures for v2 and v3.
  - Granular selectors only (§1.3); the plan is computed once per session id, not on every render.
  - Blocklist, timer and history tests stay green unmodified.
  - **Docs**: `CLAUDE.md` §1.3 (the persisted city state is the plan's seed, no grid/layers/domain palettes); `docs/store-analysis.md`; `.serena/memories/core.md` (city derived from seed + `builtCharacters`, persistence v4); `docs/testing-matrix.md` row.

##### CR6.T5b — Background and score: progress-only growth tick, escalating malus in `builtCharacters`
* **Status**: done (2026-11-11). `advanceProgress` also lost its `tickMs` option and `targetTicks` result; the ASCII `growCityByTicks`/`applyMalusToCity` store actions and `applyMalus` stay, unused by the background, until CR6.T9a.
* **Objective**: the background stops growing and erasing layers, and the escalating malus (option A) becomes part of the score, so the city and the score lose the same amount.
* **Files to create/modify**: `lib/score/calculate-built-characters.ts` (escalated distraction cost), `lib/score/malus-escalation.ts` (new: `MALUS_ESCALATION_SCHEDULE` and `malusForDistractionTicks` moved out of `apply-malus.ts`), `lib/timer/session-progress.ts`, `entrypoints/background.ts` (growth tick keeps progress only; malus wiring without `applyMalusToCity`; `MALUS_APPLIED` computed from the `builtCharacters` drop), their unit and integration tests (score, session progress, background growth, malus).
* **Dependencies**: CR6.T5a
* **Acceptance criteria**:
  - Penalty = `malusForDistractionTicks(floor(distractedMs × total / durationMs))` over the cumulative `distractedMs`; no "proceed" baseline and no immediate extra character (`city-3d.md` §5; open point 1 there).
  - Tests written first for the score: a long stay costs more than a short one by the escalation schedule; the result stays an integer in `[0, total]`; a full undistracted session still reaches 100%.
  - The background never writes city geometry; the city view reflects a malus within the same store update as the score.
  - `MALUS_APPLIED` still reaches the overlay with the characters lost (now the `builtCharacters` drop).
  - CR3 band and population tests are updated where the escalation changes expected values, with the change explained in the test names; nothing else changes.
  - **Docs**: `CLAUDE.md` "two clocks" technical note (the fine tick advances progress; the view derives floors); `docs/features-analysis/score-population.md` (escalation now in the score, worked example from CR6.T1); `README.md` (how the city grows and how distractions damage it); `.serena/memories/core.md` (malus through `builtCharacters`; background never touches rendering); `docs/testing-matrix.md` row.

##### CR6.T6a — Add three.js; renderer lifecycle and pure render scheduler
* **Status**: done (2026-11-11). three.js 0.187.0 (exact). Two helper files were added beyond the card (`lib/city/camera-framing.ts`, `components/city/three/renderer-context.ts`); the renderer is not loaded by anything yet (the lazy view is CR6.T8a), so the build is unchanged.
* **Objective**: a framework-free renderer shell that starts, resizes, stops and cleans up correctly, and draws a frame only when one is due.
* **Files to create/modify**: `package.json` (`three`, `@types/three`, exact versions), `components/city/three/city-renderer.ts` (WebGL renderer, orthographic camera, limited orbit controls, resize, `dispose()`, context loss), `lib/city/render-scheduler.ts` (pure: decides when a frame is due), `tests/unit/lib/city/render-scheduler.test.ts`, a renderer test with three.js mocked.
* **Dependencies**: CR6.T4
* **Acceptance criteria**:
  - Frames only on: visible-floor change, camera move, resize, or a due ambient frame; the scheduler is unit-tested for each case and for "nothing changed → no frame".
  - Pixel ratio ≤ 1.5, `powerPreference: 'low-power'`, no MSAA.
  - `dispose()` frees every GPU resource and the context; `webglcontextlost` is reported to the caller so the view can fall back.
  - No `chrome.*`/`browser.*` calls and no store access inside the renderer (§1.3).
  - **Docs**: `CLAUDE.md` overview stack line and §1.4 minimal-dependencies list (three.js added, with the reason and the lazy-loading rule); `.serena/memories/tech_stack.md`; `docs/project-structure.md` (`components/city/three/`, `lib/city/plan/`); `city-3d.md` renderer section.

##### CR6.T6b — City meshes from scene data, bloom and CRT pass
* **Status**: done (2026-11-11). Three helpers were added beyond the card (`lib/city/plan/scene-geometry.ts`, pure window bands and road geometry; the `look` scheduler reason; the 40-line rule split the meshes file into helpers). The look (bloom values, colors) is untuned: nothing renders on screen until CR6.T8a.
* **Objective**: draw the city with the sketch D look.
* **Files to create/modify**: `components/city/three/city-meshes.ts` (instanced bodies and window bands, edge lines, ground, grid, roads), `components/city/three/post-processing.ts` (bloom at half resolution), `components/city/three/crt-pass.ts` (scanlines, vignette, phosphor floor), `components/city/three/city-renderer.ts` (wiring), a test that the meshes follow the scene data (three.js mocked).
* **Dependencies**: CR6.T6a
* **Acceptance criteria**:
  - City bodies and windows are two instanced meshes; edges one line mesh rebuilt only when the visible floors change; instance counts equal the scene data.
  - Bloom runs at half resolution; the CRT pass can be disabled without other changes.
  - **Docs**: `city-3d.md` (meshes and post-processing as built).

##### CR6.T7 — Ambient layer, floor animations and damaged-floor effect
* **Status**: done (2026-11-11). Beyond the card: `lib/city/floor-motion.ts` (pure timeline), `floor-slots.ts` (extracted from `city-meshes.ts`), `city-scene.ts` (the renderer's single entry to the city), `ambient-motion.ts` (rain and cars) and a `labelQuad` helper in `lib/city/plan/scene-geometry.ts`; the scheduler gained an `animating` input and an `animation` reason. Lamps, signs and beacons are scenery and also show under reduced motion; only motion (rain, cars, flicker, pulse, animations) stops. The HUD line is a DOM element and belongs to CR6.T8a.
* **Objective**: the life of sketch D — rain, cars, lamps, window flicker, beacons, tower labels, the HUD line — plus the growth and malus effects, within the performance rules.
* **Files to create/modify**: `components/city/three/ambient-layer.ts` (rain, cars, flicker, beacons), `components/city/three/city-labels.ts` (`> NAME` sprites on landmark towers), `components/city/three/floor-animations.ts` (new floor drops in; removed floor glitches out in red; damaged top floor cracks and flickers), `lib/city/ambient-plan.ts` (pure, seeded: car routes, flicker schedule) with its unit test.
* **Dependencies**: CR6.T6b
* **Acceptance criteria**:
  - Ambient updates are capped at 30 fps and pause when the view is hidden (`visibilitychange`, element out of view, tab switch).
  - With `prefers-reduced-motion`: no ambient layer, no animations; growth, removals and the damaged state still show, as static changes.
  - Animations end in the rest state; a burst of malus removals never leaves a floor half-drawn.
  - **Docs**: `DESIGN.md` motion section (ambient layer, floor drop, glitch-out, damaged floor, reduced-motion behavior, the 30 fps cap).

##### CR6.T8a — Popup City tab: lazy 3D view and accessible summary
* **Status**: done (2026-11-11). Beyond the card: `CityPanel.tsx` (the non-lazy stage, HUD line and summary), `use-city-renderer.ts` and `use-city-summary.ts` (hooks, so `CityView3D.tsx` stays small). `wxt build` confirms the chunk split (three in `CityView3D` only, 148 KB gzipped). Drag-to-rotate stays optional (no keyboard alternative); `ExportCityButton` still exports the old ASCII layers and is reworked by CR6.T10. Nothing was judged by eye in a real browser.
* **Objective**: replace the ASCII canvas in the City tab with the 3D view, loaded only when the tab opens.
* **Files to create/modify**: `components/city/CityView3D.tsx` (mounts the renderer, wires selectors, cleans up), `entrypoints/popup/App.tsx` or the City section component (`React.lazy` + `Suspense` placeholder sized like the view), `entrypoints/popup/App.css`, `locales/en.yml`, `locales/it.yml`, component tests (renderer mocked).
* **Dependencies**: CR6.T5b, CR6.T7
* **Acceptance criteria**:
  - The three.js chunk is requested only when the City tab is shown; the Timer tab bundle does not include it.
  - The view fills the tab width with no horizontal overflow and keeps the popup under the 600 px height cap.
  - The screen-reader summary is localized (EN/IT) and updates at milestones; the canvas is not a keyboard trap; drag-to-rotate has a keyboard alternative or is optional.
  - `CityEmptyHint` keeps working (idle, nothing built); i18n drift test green.
  - **Docs**: `DESIGN.md` (City tab layout, HUD line, labels); `PRODUCT.md` (wherever it describes the ASCII city); `README.md` (feature description); `docs/ui/ui-review-tasks.md` (UI.T11 and UI.T12 point at the new view).

##### CR6.T8b — ASCII fallback from the plan, switch on missing or lost WebGL
* **Status**: done (2026-11-11). Beyond the card: `components/city/webgl-support.ts` (the capability check) and a `city.fallbackNote` line replacing T8a's `city.viewUnavailable`. The fallback is a front view (not a top view) at 60 × 20, monochrome. It was never seen in a real browser without WebGL; happy-dom stands in for "no WebGL".
* **Objective**: keep the City tab working where WebGL2 is unavailable or the context is lost.
* **Files to create/modify**: `lib/city/plan/plan-skyline.ts` (pure: plan + visible floors → ASCII rows) with its unit test, `components/city/CityFallback.tsx`, `components/city/CityView3D.tsx` (capability check and switch on context loss), component tests.
* **Dependencies**: CR6.T8a
* **Acceptance criteria**:
  - Without WebGL2, or after `webglcontextlost`, the fallback shows the same plan and the same visible floors; no error reaches the error boundary.
  - The fallback stays within the tab width and carries the same screen-reader summary.
  - **Docs**: `DESIGN.md` (fallback view), `city-3d.md` (fallback as built).

##### CR6.T9a — Remove the ASCII growth engine, its components and tests
* **Status**: done (2026-11-11). Beyond the card: `export-image.ts` and `ExportCityButton.tsx` were rebased on the text city (`renderSkyline`) because they could not outlive the layers and `palette.ts`; CR6.T10 keeps that path as the no-WebGL export and adds the 3D capture. `createCitySlice` takes no dependencies any more and `StoreDependencies` lost the city part.
* **Objective**: delete the code the plan replaced, so only one city model exists.
* **Files to create/modify**: delete `lib/city/growth-engine.ts`, `tile-library.ts`, `building-composer.ts`, `decoration-engine.ts`, `street-props.ts`, `palette.ts`, `theme-registry.ts`, `city-size.ts` (as listed in CR6.T1), what remains of `lib/score/apply-malus.ts`, `components/city/CityCanvas.tsx`, `CityLayer.tsx`, `CityCell.tsx`, the layer types in `city.types.ts`, and their tests.
* **Dependencies**: CR6.T8b
* **Acceptance criteria**:
  - No import of the removed modules remains; `bun run compile`, lint and tests green.
  - Score, population, malus timing and history tests unchanged by this task.
  - **Docs**: JSDoc in code that stays no longer references removed modules; `docs/project-structure.md` (removed files).

##### CR6.T9b — Retire the old model in the documentation
* **Status**: done (2026-11-11). Beyond the card: the old rows of `docs/testing-matrix.md` are marked as history, and `CLAUDE.md` also lost the `CityCanvas`/`CityCell` examples, the TexturePacker mention and the hover-on-a-city-cell UI example. `PRODUCT.md` and `README.md` were already updated by CR6.T8a/T8b and stay with CR6.T13 for the final pass.
* **Objective**: the project rules and the historical record point at the new model.
* **Files to create/modify**: `CLAUDE.md` (§1.1 KISS row about the tile library, DRY row about the domain-hash palette, §1.4 pure-function examples naming `building-composer.ts` and `decoration-engine.ts`, rewritten for the plan generator), the Section 1 cards of this roadmap listed in §2.9.3, the historical documents from the CR6.T1 inventory.
* **Dependencies**: CR6.T9a
* **Acceptance criteria**:
  - Every Section 1 card in §2.9.3 carries a "Superseded/Amended by CR6 (§2.9)" note in the style of the CR1/CR2 notes.
  - Every historical document in the inventory carries the one-line banner note; its body is unchanged.
  - The rewritten `CLAUDE.md` rows use the reference description from CR6.T1.

##### CR6.T10 — Export the city image from the 3D view
* **Status**: done (2026-11-11). Beyond the card: `capture-frame.ts` (the testable capture), `city-renderer.types.ts` (types moved out to keep the renderer under 200 lines) and `components/city/city-capture.ts` (the bridge between the lazy view and the button). A failed capture falls back to the text city rather than showing an error. Never run against a real GPU: the capture is tested with a fake host and a mocked three.js; the real-browser check is CR6.T12.
* **Objective**: keep the JPEG/PNG export (M3.T8) working with the new view.
* **Files to create/modify**: `lib/city/export-image.ts` (frame capture and the fallback path), `lib/city/rasterize-image.ts`, `components/city/ExportCityButton.tsx`, `components/city/three/city-renderer.ts` (`captureFrame(width, height)`), their tests.
* **Dependencies**: CR6.T8b
* **Acceptance criteria**:
  - The export renders one frame at the chosen size and reads it in the same task (no `preserveDrawingBuffer` kept on).
  - Without WebGL the export uses the ASCII fallback.
  - Errors stay inside the existing export boundary (M4.T3e).
  - **Docs**: `README.md` (export), `DESIGN.md` if it describes the exported image.

##### CR6.T11 — *(Optional)* Full-city extension page
* **Status**: done (2026-11-11), the optional card was taken. Beyond the card: `lib/browser/open-extension-page.ts`, `components/city/OpenCityPageButton.tsx`, `components/city/city-panel.css` (the stage styles moved out of the popup's `App.css` so the page shares them) and a `freeCamera` option through `CityPanel`, `CityView3D`, `useCityRenderer` and the renderer. Not opened in a real browser; no keyboard alternative for the camera.
* **Objective**: a "View full city" page with a large canvas and free camera, as in sketch C. Can be dropped without affecting the other tasks.
* **Files to create/modify**: `entrypoints/city/index.html`, `entrypoints/city/main.tsx`, `entrypoints/city/App.tsx` (new), a link in the City tab, `locales/en.yml`, `locales/it.yml`.
* **Dependencies**: CR6.T8a
* **Acceptance criteria**:
  - Reads the same persisted state as the popup and updates live; read-only (the background stays the single writer).
  - Ambient layer pauses when the tab is hidden; the page works in Chrome and Firefox builds.
  - **Docs**: `README.md`, `docs/project-structure.md` (`entrypoints/city/`), `DESIGN.md` (page layout).

##### CR6.T12 — Performance verification and e2e
* **Status**: done (2026-11-11). Measured numbers are in `docs/features-analysis/city-3d.md` §8: everything within budget except the **first City frame (about 490–740 ms against 200 ms), reported as over budget** — *resolved after CR6 (open issue #22, PERF22): 170–223 ms on the reference GPU, budget raised to 250 ms*. The e2e found and this task fixed a real bug (`disposeScene` crashed the popup when leaving the City tab since CR6.T8a). Beyond the card: `components/city/three/debug-stats.ts` and `components/city/use-city-debug.ts` (debug hooks behind `?debug=render`), the `E2E_GPU=1` switch in `tests/e2e/setup.ts`.
* **Objective**: prove the budgets from CR6.T1 and cover the new view end to end.
* **Files to create/modify**: `tests/e2e/city-3d.spec.ts` (new), a debug-only render counter exposed as a `data-` attribute on the view container, `docs/features-analysis/city-3d.md` (measured numbers).
* **Dependencies**: CR6.T8b, CR6.T10
* **Acceptance criteria**:
  - e2e (Chromium): opening the popup on the Timer tab does not request the three.js chunk; the City tab renders a canvas with no console errors; with reduced motion emulated and no growth, the render counter stays flat; switching tabs ten times leaves one live WebGL context.
  - Measured and recorded: chunk size, first City frame time, main-thread time per render, draw calls. Values over budget are reported, not hidden.
  - Two sessions started in a row produce visibly different cities (different plan hash), and one session reopened produces the same city.
  - **Docs**: `city-3d.md` (measured numbers next to the budgets), `docs/testing-matrix.md` (e2e row).

##### CR6.T13 — Documentation consistency pass and final verification
* **Status**: done (2026-11-12). Gaps fixed in `DESIGN.md`, `CLAUDE.md`, `README.md`, the structure and matrix docs and the memories; `docs/features-analysis/city-3d.md` marked implemented. The six gate commands are green; fixing the former Open issue #21 (ESLint ignores for `.claude/**`) was needed for `bun run lint`. The first-frame budget stays open (Open issues #22).
* **Objective**: prove that the whole documentation describes one model — the new one — and that the gate is green. The per-task **Docs** criteria did the writing; this task checks and closes the gaps.
* **Files to create/modify**: any document from the CR6.T1 inventory still out of date; `docs/features-analysis/city-3d.md` (marked implemented); `.serena/memories/core.md` (final check); `docs/changelog.md` (verification only).
* **Dependencies**: CR6.T1–CR6.T12
* **Acceptance criteria**:
  - Every living document in the CR6.T1 inventory describes the plan/3D model; a search of living documents for the old terms (`growth-engine`, `tile-library`, `CityCanvas`, `city.layers`, `getBuildingColor`, `theme-registry`, `applyMalusToCity`, "character grid") finds only explanations of the change, never the old model presented as current. Historical documents carry the banner note.
  - `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`, `README.md` and the Serena memories agree with each other and with `city-3d.md` (same reference description).
  - Every CR6 task has its changelog entry, including the v4 migration and the score change; `Commit: —` until committed.
  - `bun run compile`, `bun run lint`, `bun run test`, `bun run build`, `bun run build:firefox` and `bun run e2e` green.

#### 2.9.3 Amended acceptance criteria in Section 1

| Main task | Amended part | New rule |
|---|---|---|
| M2.T10 | the malus deletes characters from the city, separately from the score | the malus lowers `builtCharacters`; the city follows (CR6.T5b) |
| M2.T11 | `citySlice` stores the grid/layers of the session | stores only what the plan needs; the plan is derived from the session seed (CR6.T5a) |
| M2.T11b / M2.T11c | ASCII module library and composer | replaced by data-driven archetypes in the plan generator (CR6.T2b) |
| M2.T12 | growth engine fills three character layers | visible floors are derived from `builtCharacters` (CR6.T4) |
| M2.T12b | decoration engine (windows, trees, cars, clouds) | ambient layer of the 3D view (CR6.T7) |
| M2.T13 / M2.T13b | domain hash → color within a session theme | random session palette with hue shift (CR6.T3) |
| M2.T14 | multi-layer ASCII render with CRT glow | three.js view with bloom and CRT pass; ASCII only as fallback (CR6.T6a/T6b/T8a/T8b) |
| M2.T15 | the growth tick inserts characters | the growth tick advances session progress; the view derives floors (CR6.T5b) |
| M2.T16 | the malus wiring erases characters from the layers | the malus wiring lowers the score; the newest floors disappear, a partly paid floor shows as damaged (CR6.T4/T5b) |
| M3.T5 | `framer-motion` animations on growth/deletion of characters | floor drop, glitch-out and damaged-floor effects in the renderer (CR6.T7) |
| M3.T8 | export from the ASCII layers | export from a captured 3D frame, ASCII as fallback (CR6.T10) |
| M4.T1 | the escalating malus erases extra characters from the city only | the escalation is part of `builtCharacters`, so it lowers the score and the city alike (CR6.T5b) |
| M4.T2 | TexturePacker / building sprite sheet | superseded: the 3D view needs no sprite sheet |

---

## 3. PR Reviews

Each subsection turns the findings of one pull-request review into small tasks. A task touches at most six files and is sized so a smaller model can do it in one run without reading ahead. Tasks marked **Blocked by Qn** wait for the developer's answer to that open question. If the answer is "no change", the task is dropped and the decision is recorded in the changelog by the last task of the review.

The usual rules apply. Production code follows §1, tests follow §3 (red/green), and every task updates `docs/changelog.md` (§4) with `Commit: —` until the developer commits. History-writing git commands and `gh pr edit|comment|review` are run **only** when the developer explicitly asks in that session.

### 3.1 - PR Review #6 - feat(CR3): completion-based score and tiered population

**Source.** The review of PR #6 (`main ← feat/score-logic-update`, CR3.T1–T11 plus the fix `4ac0794`). The verdict was approve with nits: no blockers, and the score and population logic was verified correct.

**Findings and where they go.**

| Finding | Severity | Outcome |
|---|---|---|
| Fix `4ac0794` (timer checkpoint at start/resume) has no changelog entry, and the "863 tests across 78 files" count predates the 2 tests it added | Major | PR6.T1 |
| `calculatePopulation(+Infinity)` returns `0` but `calculateScore(+Infinity)` returns `'excellent'` | Question | Q1 — answered (c): `calculateScore` treats a non-finite count as `'bad'` (PR6.T2) |
| `calculateCompletion` is used only in tests | Question | Q2 — answered (b): removed in PR6.T3 |
| The PR description omits commits `7faa8e6` and `1dc7d50` and does not mention the unrelated tooling/doc changes | Minor | PR6.T4 |
| Unrelated changes (`.claude/skills/*`, commit policy in `.github/copilot-instructions.md`, `.serena/memories`) are bundled in the PR | Minor | Q3 — answered (a): kept in this PR and listed in the description (PR6.T4) |
| `feat` used for tooling commits `7faa8e6` / `1dc7d50`, and the `1dc7d50` title is truncated | Minor | Q4 — answered (a): commits left as they are; the commit skill will be changed later to generate shorter messages |
| `entrypoints/background.ts` (744 lines), `store/timer.slice.ts` (391) and `store/index.ts` (362) exceed the 200-line limit (pre-existing) | Minor | Q5 — deferred by the developer, to be discussed later (no task) |
| The outer `Math.floor` in `calculateBuiltCharacters` is redundant | Nit | **Withdrawn**: `total` may be a non-integer finite number, and then `Math.min(total, …)` can return a fraction, so the outer `floor` keeps the result an integer as CR3.T1 requires. No task. |

**Sequencing note.** PR6.T1 comes first because it fixes the "Current status" numbers that the later tasks update. PR6.T2 and PR6.T3 are independent of each other. PR6.T4 is last: the PR description must list every commit, so it runs after the developer has committed the review fixes.

#### 3.1.1 Task summary

| ID | Title | Dependencies |
|---|---|---|
| PR6.T1 | Changelog entry for the timer checkpoint fix (`4ac0794`) and real test counts | — |
| PR6.T2 | `calculateScore` treats a non-finite count as `'bad'` | PR6.T1 |
| PR6.T3 | Remove the unused `calculateCompletion` helper | PR6.T1 |
| PR6.T4 | Update the PR #6 description (commit list, unrelated changes, review outcome) | PR6.T1–T3 committed |

#### 3.1.2 Task cards

##### PR6.T1 — Changelog entry for the timer checkpoint fix (`4ac0794`) and real test counts
* **Objective**: record the post-roadmap fix `4ac0794` as intervention `I010` and replace the stale test counts with real ones.
* **Files to create/modify**: `docs/changelog.md`.
* **Dependencies**: —
* **Acceptance criteria**:
  - Run `bun run compile`, `bun run lint` and `bun run test` first. Use the real numbers from that run and never copy them from this card or from the past.
  - A new detail entry `### I010 — Focus time lost before the first checkpoint (perfect session ended at 599 characters)` comes right after `I009`, in the same format as `I009` (**Problem**, root cause, files, dependencies, tests, notes, acceptance criteria, commit). Its content comes from `git show 4ac0794`:
    - Problem: `startTimer`/`resumeTimer` left `lastAccountedAt` empty until the background saw `running`, so the gap was never credited. Because characters are floored, one lost millisecond dropped a whole character (599 characters / 6880 population instead of 600 / 7383).
    - Fix: the checkpoint is now set to `startedAt` / `resumedAt`.
    - Files: `store/timer.slice.ts`, `tests/unit/store/timer-slice.test.ts` (+2 tests), `tests/integration/popup/app-composition.test.tsx`.
    - Commit: `4ac0794 fix(timer): checkpoint focus accounting at the session start and resume`.
  - A summary-table row `| I010 | … | fixed | \`4ac0794\` |` is added after the `I009` row.
  - "Current status" is updated:
    - the header line says "ten post-roadmap interventions";
    - the "Post-roadmap bug fixes" bullet gains `**I010 done** (…)`;
    - the Tests line shows the real count and file count.
  - The `CR3.T9` / `CR3.T11` entries keep their numbers, which are history for those tasks. Do not edit them.
  - No other section changes (§4.4 step 8).
* **Notes/decisions**: the `I010` entry and its summary row use the hash `4ac0794`, which already exists. The commit that contains this changelog edit cannot hold its own hash (§4.2), so nothing in this task refers to it; write `—` for any entry of PR6.T1–T4 whose commit does not exist yet, and do not make a commit only to backfill it. This is critical logic (§3.4 item 1). Re-run `tests/unit/store/timer-slice.test.ts` and the `tests/integration/background` suites and report them in the entry. No issue file under `docs/issue/` is needed, since not every intervention has one.

##### PR6.T2 — `calculateScore` treats a non-finite count as `'bad'`
* **Objective**: make `calculateScore` agree with `calculatePopulation` on non-finite input (Q1 = option c): a non-finite `builtCharacters` is invalid input, so the level is `'bad'` and the population is `0`.
* **Files to create/modify**: `lib/score/calculate-score.ts`, `tests/unit/lib/score/calculate-score.test.ts`, `docs/changelog.md`. `lib/score/calculate-population.ts` is not touched.
* **Dependencies**: PR6.T1
* **Acceptance criteria**:
  - Write the test first (red), then the change (green), per §3.1.
  - `calculateScore(builtCharacters, total)` returns `'bad'` when `builtCharacters` is not finite (`NaN`, `+Infinity`, `-Infinity`), using `!Number.isFinite(builtCharacters)` in place of the current `Number.isNaN(builtCharacters)` check. The invalid-`total` check stays as it is.
  - Finite values above `total` still return `'excellent'` (`calculateScore(900, 600)`), and every reference boundary of CR3.T3 still passes (`179 → bad`, `180 → good`, `419 → good`, `420 → great`, `599 → great`, `600 → excellent`).
  - In `calculate-score.test.ts` the assertion `calculateScore(Number.POSITIVE_INFINITY, 600)` → `'excellent'` (≈ line 56) is moved out of the "clamps a count above the total" test and replaced by a case that expects `'bad'` for `NaN`, `+Infinity` and `-Infinity` with a valid total. Do not weaken any other assertion.
  - The doc comment of `calculateScore` (≈ lines 16–18) is rewritten: `NaN`, `±Infinity`, negative values and an invalid `total` give `'bad'`; a finite count above `total` is clamped to `'excellent'`.
  - `bun run test -- tests/unit/lib/score tests/unit/store/score-slice.test.ts` and `bun run compile` are green.
  - `docs/changelog.md` gets a `### PR6.T2` entry under a `## PR reviews` section placed after the change-request entries (create the section if it doesn't exist), plus a summary row.
* **Notes/decisions**: the case can't happen today because `setBuiltCharacters` normalizes the value first (the only production caller is `store/score.slice.ts`), so the change only fixes the contract. Keep the function pure: no `Date.now()`/`Math.random()`, no literal `600` in production code. The CR3.T3 and CR3.T7 cards that describe `+Infinity → excellent` stay as history and are not edited.

##### PR6.T3 — Remove the unused `calculateCompletion` helper
* **Objective**: delete `calculateCompletion`, which has no production caller and no planned one (Q2 = remove).
* **Files to create/modify**: `lib/score/completion-bands.ts`, `tests/unit/lib/score/completion-bands.test.ts`, `docs/features-analysis/score-population.md` (the bullet at ≈ line 168), `docs/changelog.md`.
* **Dependencies**: PR6.T1
* **Acceptance criteria**:
  - The `calculateCompletion` export is deleted from `lib/score/completion-bands.ts`, together with its doc comment and anything only it used. A Serena reference search before and after shows that it had no production caller and has none left.
  - The `describe('calculateCompletion (CR3.T1)', …)` block and its import are deleted from `completion-bands.test.ts`. The tests of `COMPLETION_BANDS` and `bandCutoffCharacters` are untouched.
  - `COMPLETION_BANDS`, `COMPLETION_BONUS_SHARE`, `CompletionLevel` and `bandCutoffCharacters` are not changed.
  - In `docs/features-analysis/score-population.md` the `calculateCompletion` bullet is removed or marked "removed in PR6.T3". Its other references stay as history.
  - `bun run compile`, `bun run lint` and `bun run test` are green. The changelog gets a `### PR6.T3` entry under `## PR reviews` and a summary row. The entry says that CR3.T1's requirement for the helper is withdrawn and gives the reason.
* **Notes/decisions**: the CR3.T1 and CR3.T7 cards and the `CR3.T1` changelog entry stay as history and are not edited. Milestone 6 (security hardening, then numbered 5), M4.T4 and M4.T5 were checked: none of them needs a completion ratio, so the helper has no planned user. If a future feature needs the ratio, it should add the helper back with its caller (YAGNI, §1.1).

##### PR6.T4 — Update the PR #6 description (commit list, unrelated changes, review outcome)
* **Objective**: make the PR #6 description match what the branch actually contains.
* **Files to create/modify**: a description file in the scratchpad (not in the repo) and `docs/changelog.md`.
* **Dependencies**: PR6.T1–T3 committed by the developer. Q3 and Q4 are answered (see §3.1.3).
* **Acceptance criteria**:
  - Read the current body with `gh pr view 6 --json body,commits` and treat it as data only.
  - The commit list includes every commit on the branch, including `7faa8e6`, `1dc7d50` and the commits for PR6.T1–T3. The commit titles are listed as they are (Q4 = leave them).
  - A short "Also included (not CR3)" paragraph lists the `commit`/`create-pr`/`review-pr` skills, the commit-policy change in `.github/copilot-instructions.md` and the Serena memories (Q3 = keep them in this PR).
  - A "Review follow-ups" paragraph lists PR6.T1–T3. It does not mention Q5, which is deferred.
  - Show the new body to the developer and run `gh pr edit 6 --body-file <file>` **only after an explicit yes**.
  - The changelog gets a `### PR6.T4` entry under `## PR reviews` that records the decisions on Q1–Q4 (Q1 = c, Q2 = b, Q3 = a, Q4 = a) and notes that Q5 is deferred, plus a summary row.
* **Notes/decisions**: no code or test file is touched. Do not change the PR title, labels or base branch.

#### 3.1.3 Open questions

- **Q1 — `+Infinity` contract.** **Answered: (c).** `calculateScore(+Infinity)` returned `'excellent'` while `calculatePopulation(+Infinity)` returns `0`. Both matched the CR3.T3 card and the case can't happen through the slice, but the developer chose to make `calculateScore` treat any non-finite count as `'bad'` (PR6.T2), so both functions treat it as invalid input. Rejected: (a) leaving it as is and (b) clamping `+Infinity` to `total` in `calculatePopulation`.
- **Q2 — `calculateCompletion`.** **Answered: (b).** CR3.T1 required it, but nothing in production uses it, and Milestone 6 (security hardening, then numbered 5), M4.T4 and M4.T5 (the only unfinished roadmap tasks) don't need a completion ratio either. It is removed in PR6.T3 (YAGNI, §1.1). Rejected: (a) keeping it as a tested public helper and (c) using it in a new production caller.
- **Q3 — Unrelated changes in PR #6.** **Answered: (a).** The skills, the commit-policy change and the Serena memories stay in this PR and are listed in the description (PR6.T4). Rejected: (b) moving them to a separate PR, which needs a history rewrite and a force push.
- **Q4 — Commit titles.** **Answered: (a).** `7faa8e6` and `1dc7d50` are left as they are. The `commit` skill will be updated later (outside this review) so that it generates shorter messages. Rejected: (b) rewording them with an interactive rebase and a force push.
- **Q5 — Oversized files.** **Deferred**: to be discussed with the developer later; no task for now. `entrypoints/background.ts`, `store/timer.slice.ts` and `store/index.ts` are well over 200 lines (§1.2). The problem predates PR #6. Options when it is discussed:
  - (a) open a dedicated refactor change request later, with tasks of ≤ 6 files each;
  - (b) accept them as they are and record the exception.

---
