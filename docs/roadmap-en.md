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
| M3.T4 | Popup `App.tsx` — full UI composition | 3 | M2.T3, M2.T14, M2.T17, M2.T18, M2.T19, M3.T1–M3.T3 |
| M3.T5 | `framer-motion` animations on building growth/deletion | 3 | M2.T14 |
| M3.T6 | Multi-browser persistence: Firefox/Chrome build verification | 3 | M3.T4 |
| M3.T7 | `SessionHistory` (5-session history UI) | 3 | M2.T19 |
| M3.T8 | `ExportCityButton` — export city as JPEG/PNG at end of focus | 3 | M2.T14 |
| M3.T9 | Internationalization (i18n) — WXT `@wxt-dev/i18n` module setup (EN default) | 3 | M3.T4 |
| M3.T10 | IT translation (language auto-detected from browser) | 3 | M3.T9 |
| M4.T1 | *(Nice to have)* Malus proportional to time spent on the blocked site | 4 | M2.T10 |
| M4.T2 | *(Nice to have)* TexturePacker / building sprite sheet integration | 4 | M2.T14 |
| M4.T3 | Error hardening and centralized logging | 4 | M3.T4 |
| M4.T4 | Popup accessibility polish | 4 | M3.T4 |
| M4.T5 | Full multi-scenario e2e suite | 4 | M3.T6 |
| M5.T1 | Message bus hardening: runtime validation + sender provenance | 5 | M1.T6 |
| M5.T2 | `lib/url/domain.ts` hardening: scheme restriction + canonicalization + IDN | 5 | M1.T2 |
| M5.T3 | Escaping/validation of `urlFilter` in DNR rule generation | 5 | M2.T6 |

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
  - `SessionSummary` includes at least `score`, `population`, `endedAt`; it is the type the last-5-sessions history (M2.T19) is based on.
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
* **Objective**: let a read-only context (the popup) change persisted state by sending typed mutation messages that the background applies to its single writable store, with the change propagating back to the popup through M1.T8 — completing the CI-1 fix so the single-writer rule does not break the popup's ability to edit configuration.
* **Files**: `lib/messaging/messages.types.ts` (add mutation variants to `RuntimeMessage`, e.g. `BLOCKLIST_ADD_SITE` / `BLOCKLIST_REMOVE_SITE` / `BLOCKLIST_APPLY_PRESET` / `TAG_UPSERT` / `TAG_REMOVE`), `lib/messaging/bus.ts` (M1.T6; typed send helper), `entrypoints/background.ts` (a mutation handler that applies the change to the writable store and persists it), `store/blocklist.slice.ts` (pure mutation helpers shared by both sides), `tests/integration/messaging/mutation-bus.test.ts`.
* **Dependencies**: M1.T6, M1.T9.
* **Acceptance criteria**:
  - Sending a mutation message (at least one, e.g. `BLOCKLIST_ADD_SITE`) from a popup-like context results in the background store being updated and persisted exactly once (integration test with `fakeBrowser`).
  - After the background persists, the popup's read-only store converges to the new value via the M1.T8 sync bridge, with no manual rehydrate call in the test.
  - Invalid/unknown payloads are ignored without throwing and without mutating the store (forward-compatible with M5.T1 hardening).
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
* **Follow-ups**: overlay strings are hardcoded in EN here and moved to `i18n.t(...)` in M3.T9; the `tabId` field was removed from the `SITE_BLOCKED_ATTEMPT` payload with this task (its M5.T1 removal landed early).

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
* **Objective**: slice with `{ layers: { background: CityGrid, middleground: CityGrid, foreground: CityGrid }, buildings: Record<domain, BuildingMeta>, themeId, sessionId }`.
* **Files**: `store/city.slice.ts`
* **Dependencies**: M1.T4
* **Acceptance criteria**:
  - The initial state consists of the three "empty" layers of configurable dimensions.
  - The slice exposes a `resetCityForNewSession(sessionId, themeId)` action that fully resets the three layers and assigns a new theme: it must be invoked by `startTimer()` (M2.T1) so that every focus session always starts from a brand-new city, never from the previous session's.
  - The slice exposes `growCity(delta)`, `applyMalusToCity(ticks)` actions that delegate to the growth engine (M2.T12) and to `apply-malus.ts` (M2.T10) respectively, without computing anything internally.

#### M2.T11b — `lib/city/tile-library.ts` — library of composable ASCII modules
* **Objective**: static, typed dataset of reusable ASCII modules, all of compatible width (e.g. multiples of a configurable base width): bases/foundations, floor sections (office, residential, glass-front), top elements (antennas, domes, helipads).
* **Files**: `lib/city/tile-library.ts`
* **Dependencies**: M1.T1
* **Acceptance criteria**:
  - Each module explicitly declares its own width in characters; a test verifies that all modules in the same category (e.g. all "floor sections") have mutually compatible widths, which prevents misalignment when modules are stacked vertically.
  - At least 2 variants per category (base, floor, top) are present, to allow different combinations from the MVP onward.
  - Data only, no selection logic here (Open/Closed principle, Section 1.1) — selection is the job of `building-composer.ts` (M2.T11c).

#### M2.T11c — `lib/city/building-composer.ts` — building composition from modules based on minutes
* **Objective**: pure function `composeBuilding(minutesFocused: number, rng: SeededRandom): Building` that progressively unlocks modules via minute thresholds (e.g. minute 5 → base, minute 10 → first floor, minute 20 → additional floor, minute 25 → top element), choosing the specific variant of each module pseudo-randomly via the seeded generator received as a parameter (see Section 1.4).
* **Files**: `lib/city/building-composer.ts`
* **Dependencies**: M2.T11b
* **Acceptance criteria**:
  - Unlock thresholds are defined as configurable data (an ordered array `{ minuteThreshold, moduleCategory }`), not hardwired `if/else` — consistent with the Open/Closed principle.
  - Same `minutesFocused` + same seed → same building, always (determinism for tests).
  - An "unbuilt" building (minutes = 0) is representable and distinct from a building with only the base.

#### M2.T12 — `lib/city/growth-engine.ts` — growth across 3 layers, capped at full grid
* **Objective**: pure engine that, given the current state of the three layers and an "elapsed focus time", computes the new state: every 2 seconds of undistracted focus, one character (from a module composed by `building-composer.ts`, M2.T11c) is inserted into a cell, distributing growth across the three layers (background with small buildings/stars, middleground with the main skyscrapers, foreground with street/cars/trees).
* **Files**: `lib/city/growth-engine.ts`
* **Dependencies**: M2.T11, M2.T11c, M2.T1
* **Acceptance criteria**:
  - Same state + same time delta + same seed → same result (determinism, no internal `Date.now()`, no non-injected `Math.random()`).
  - Test over at least 3 consecutive growth steps (each 2s) verifying that one character is inserted at a time, not in blocks.
  - **Behavior at a full grid**: when all three layers are completely occupied, further growth ticks **no longer modify the grid** (no error, no extension beyond the configured dimensions) — the function returns the same unchanged city state. Score and population (M2.T9, M2.T18), which are calculated elsewhere based on elapsed time and not on the grid state, continue instead to evolve normally even beyond this point: the cap is purely visual/rendering-related, not a cap on session progress.

#### M2.T12b — `lib/city/decoration-engine.ts` — procedural details
* **Objective**: pure function `decorate(cityState, rng: SeededRandom): CityState` that, while keeping the already-composed building structure intact, randomizes fine details: lit/unlit windows (occasionally replacing `[ ]` with `[*]`/`[#]`/`[░]`), background/foreground decorative elements (trees, streetlights, cars, clouds).
* **Files**: `lib/city/decoration-engine.ts`
* **Dependencies**: M2.T12
* **Acceptance criteria**:
  - Never alters a building's load-bearing structure (bases/floors/tops remain those composed by `building-composer.ts`), only overlay details.
  - Same state + same seed → same decorated result (determinism for tests).
  - Distinct and decoupled from the growth engine: decoration is a subsequent, optional step, disableable without breaking structural growth (Separation of Concerns principle).

#### M2.T13 — `lib/city/palette.ts` (domain hash → color)
* **Objective**: deterministic pure function `getBuildingColor(domain: string): string` that always assigns the same color to the same domain, drawing from a defined palette (blue/orange/green/yellow).
* **Files**: `lib/city/palette.ts`
* **Dependencies**: M1.T2
* **Acceptance criteria**:
  - Same normalized domain → same color, always (test with repeated calls).
  - Reasonably uniform distribution over a sample of N test domains (no gross bias toward a single color) — verifiable with a simple, non-rigorous statistical test.

#### M2.T14 — `CityCanvas` + `CityCell` (ASCII render + CRT glow)
* **Objective**: React components that render the city grid as monospace `<pre>`/`<span>` with green CRT `text-shadow`, applying colors from `palette.ts`.
* **Files**: `components/city/CityCanvas.tsx`, `components/city/CityCell.tsx`
* **Dependencies**: M2.T12, M2.T13
* **Acceptance criteria**:
  - The component receives `CityGrid` as a prop (no direct store reads inside `CityCell`, only in `CityCanvas` — Separation of Concerns principle).
  - CSS applies `text-shadow: 0 0 4px currentColor` as per the document.
  - A snapshot/rendering test verifies that a `destroyed` cell no longer shows the building's character/color.

#### M2.T15 — Linking growth-engine ↔ timer tick
* **Objective**: every timer tick (M2.T1/M2.T2) invokes `growCity` on the city store with the elapsed, distraction-free time delta.
* **Files**: `entrypoints/background.ts` (extension)
* **Dependencies**: M2.T12, M2.T2
* **Acceptance criteria**:
  - A tick with `status === 'running'` and no violation during the period → the city grows by the expected delta.
  - Integration test: a sequence of simulated ticks produces a grid consistent with the growth engine's expected output.

#### M2.T16 — Linking malus ↔ building destruction
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

#### M2.T20 — Allowlist/blocklist mutual-exclusion validation
* **Objective**: prevent the same canonical domain from ending up in both allowlist and blocklist simultaneously, and explicitly establish the resolution rule for when the conflict exists anyway (import, preset, pre-existing state).
* **Files**: `store/blocklist.slice.ts`, `components/blocklist/SiteList.tsx` (UI feedback).
* **Dependencies**: M2.T4
* **Acceptance criteria**:
  - Adding to the blocklist a domain already present in the allowlist (or vice versa) does not create a double entry: the UI offers to move it or shows explicit feedback. The comparison is performed on already-normalized domains (M1.T2/M2.T4).
  - **Precedence order (design decision)**: in case of a residual conflict, the **allowlist always wins** over the blocklist — no domain present in the allowlist is ever blocked (consistent with M2.T6).

#### M2.T21 — Defensive normalization of blocklist input (entry + navigation check)
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
* **Objective**: component that lists the presets (M2.T5) and allows applying them to the blocklist all at once.
* **Files**: `components/blocklist/PresetPicker.tsx`
* **Dependencies**: M2.T5, M2.T4
* **Acceptance criteria**:
  - Selecting "Social" adds all the preset's domains to the blocklist in a single store action (not N separate actions causing N re-renders/persists).

#### M3.T2 — `TagEditor` — custom categories via tags
* **Objective**: UI to create/assign custom tags to a group of sites, to build custom presets.
* **Files**: `components/blocklist/TagEditor.tsx`
* **Dependencies**: M2.T4
* **Acceptance criteria**:
  - Creating a tag and assigning it to ≥2 sites; filtering the site list by that tag shows only those.

#### M3.T3 — `SiteList` — site CRUD in allow/blocklist
* **Objective**: manual management UI (add/remove a single domain), with real-time normalization via `tldts` in the input.
* **Files**: `components/blocklist/SiteList.tsx`
* **Dependencies**: M2.T4, M1.T2, M2.T20, M2.T21
* **Acceptance criteria**:
  - Entering a full URL (`https://m.facebook.com/something`) results in a single normalized `facebook.com` entry.
  - Attempting to add an already-present domain does not create a duplicate (explicit UI feedback).
  - If the input is not a valid registrable domain — for example a "bare" public suffix (`co.uk`, `com`, `github.io`) or a malformed URL — the error message **"Enter a valid URL"** appears and the entry is not added (no exception, see M2.T21 and M1.T2).
  - The **allowlist > blocklist** precedence (M2.T6, M2.T20) is respected in the feedback too: adding to the allowlist a domain already in the blocklist (or vice versa) never creates a double entry.

#### M3.T4 — Popup `App.tsx` — full UI composition
* **Objective**: compose all components (timer, city, score, blocklist) in the main popup, with routing/tabs if needed.
* **Files**: `entrypoints/popup/App.tsx`
* **Dependencies**: M2.T3, M2.T14, M2.T17, M3.T1, M3.T2, M3.T3
* **Acceptance criteria**:
  - All sections are reachable and functional from a single entry point.
  - End-to-end integration test at the component level (not a real browser): starting a timer from the UI updates both `TimerDisplay` and (indirectly) the city state after a simulated tick.

#### M3.T5 — `framer-motion` animations on building growth/destruction
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
* **Objective**: extend `apply-malus.ts` (M2.T10) so that the malus grows as a function of time spent on the blocked site, not just the single event.
* **Files**: `lib/score/apply-malus.ts` (extension)
* **Dependencies**: M2.T10
* **Acceptance criteria**:
  - All else being equal, more time spent on the blocked site produces a greater or equal malus, never a smaller one (monotonic property tested).

#### M4.T2 — *(Nice to have)* TexturePacker / building sprite sheet integration
* **Objective**: replace (or complement) pure ASCII rendering with optimized sprites generated via TexturePacker to reduce rendering calls, while keeping the deterministic palette from M2.T13.
* **Files**: `assets/ascii/` (or a new `assets/sprites/` folder), update to `CityCell.tsx`.
* **Dependencies**: M2.T14
* **Acceptance criteria**:
  - No visual regression compared to the base ASCII behavior (ASCII remains the fallback/default if the sprite is unavailable).

#### M4.T3 — Error hardening and centralized logging
* **Objective**: introduce a centralized logger (levels, context) used at the boundaries defined in Section 1.4, replacing any scattered `console.log` calls.
* **Files**: `utils/logger.ts`, refactor of the boundary points in `entrypoints/background.ts`, React error boundary in the popup.
* **Dependencies**: M3.T4
* **Acceptance criteria**:
  - No empty `catch {}` remains in the codebase (verifiable via a dedicated lint rule or manual search).
  - A simulated error in the background is logged with context (not silenced) and does not crash the whole service worker.

#### M4.T4 — Popup accessibility polish
* **Objective**: a pass on color contrast (particularly the CRT glow effect), keyboard focus, and ARIA labels on timer/blocklist controls.
* **Files**: components in `components/` involved.
* **Dependencies**: M3.T7
* **Acceptance criteria**:
  - All interactive controls reachable via keyboard (sensible tab order).
  - No interactive element without an accessible label.

#### M4.T5 — Full multi-scenario e2e suite
* **Objective**: cover with Playwright the main end-to-end scenarios: start timer → city growth, attempt to access a blocked site → overlay → malus, apply preset → verify effective blocking.
* **Files**: `tests/e2e/*.spec.ts`
* **Dependencies**: M3.T6
* **Acceptance criteria**:
  - Each of the three scenarios above has at least one green e2e test on Chromium.

### 1.8 Milestone 5 — Security hardening

> **Threat model / out of scope.** The extension is *client-only* (no backend): the user is the operator of the browser itself. This determines what's actually worth defending and what isn't.
>
> **Out of scope (self-pwn).** Anyone who opens DevTools and modifies code, store, or messages in *their own* browser already controls the extension: there is no sensible defense and none will be built. Same for uninstalling, manually modifying built files, or patching the extension. "An attacker can modify my code" is true for any frontend (web, desktop, native binaries) and is not in the threat model: the security model always excludes the operator of the machine.
>
> **In scope.** Any *untrusted* data/code that **crosses** into the extension toward a more privileged context, even with a legitimate operator. The trust boundaries that a backend-less extension does **not** eliminate:
> 1. **Web page → content script** — the page is arbitrary and hostile (DOM, `postMessage`, crafted navigations). A malicious site is not the user.
> 2. **Content script → background (message bus)** — `runtime.onMessage` can receive well-formed messages forged by other code; hence runtime validation of the discriminated union, checking `sender.id === browser.runtime.id`, `tabId` derived from `sender.tab.id` and never from the payload (M5.T1).
> 3. **Untrusted URL/domain → DNR rules / domain checks** — injection via *data* (non-http schemes, the `userinfo` trick `https://facebook.com@evil.com`, IDN/homograph, syntactic characters `*`/`|`/`^`/`||` in `urlFilter`), exactly like a SQL injection (M5.T2, M5.T3).
>
> **Practical consequence.** These hardening measures defend the *untrusted data/code* boundaries, not against the operator. They remain justified as pure **correctness** regardless — avoiding over/under-blocking, double normalizations, crashes from unexpected input — regardless of whether an attacker exists. They are not a speculative security framework: every task maps to a concrete, testable gap.

> This milestone translates into tasks the measures that emerged from a security audit of the architecture (§2 of the audit document, "Part 2 — Could your project expose users to attacks?"). It does not add features: it makes the logic already planned in Milestones 1–2 secure and defensive. The three risks classified as **High** concern the message bus (M1.T6), domain normalization (M1.T2/M2.T21), and DNR rule generation (M2.T6).
>
> **Sequencing note**: these tasks are security prerequisites for the critical logic in §3.4 and should ideally land **before** the tasks that consume the respective modules (M5.T1 before M2.T10/M2.T16 — its `SITE_BLOCKED_ATTEMPT`/`tabId` part landed early, with M2.T8; M5.T2 before M2.T4/M2.T6/M2.T21; M5.T3 before M2.T7). The corresponding M2 cards remain valid; the hardening is additive and does not replace them.

#### M5.T1 — Message bus hardening: runtime validation and sender provenance
* **Objective**: make the message bus (M1.T6) robust against malformed or forged messages — validate every `RuntimeMessage` at runtime with guards (never casts) and never trust `tabId`/identifiers coming from the payload, always deriving them from `sender`.
* **Files**: `lib/messaging/messages.types.ts` (runtime validation guards; removal of `tabId` from the payload), `lib/messaging/bus.ts` (incoming validation + origin check), `entrypoints/background.ts`, `entrypoints/blocked-overlay.content.ts`.
* **Dependencies**: M1.T6
* **Audit references**: risk "🔴 High — Message bus has no runtime validation and trusts caller-supplied tabId" (involves M1.T6, M2.T10, M2.T16).
* **Acceptance criteria**:
  - `onMessage` validates the input with runtime guards on the discriminated union: unknown `type`, missing fields, or wrong types → the message is discarded without exceptions and without mutating the store (never `as RuntimeMessage`).
  - The background rejects messages where `sender.id !== browser.runtime.id` and requires `sender.tab` where the payload presupposes it.
  - `tabId` is no longer read from the payload: variants that need it derive it from `sender.tab.id`. **Already satisfied for `SITE_BLOCKED_ATTEMPT`, whose payload lost `tabId` in M2.T8**; the remaining variants are covered here.
  - Test (integration, `fakeBrowser`): malformed/forged message → no crash, no mutation; `tabId` injected in the payload is ignored; a sender with an id different from `browser.runtime.id` is rejected; an unrecognized `type` is ignored.

#### M5.T2 — Hardening of `lib/url/domain.ts`: scheme restriction, canonicalization, and IDN
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

#### M5.T3 — Escaping/validation of `urlFilter` in DNR rule generation
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
