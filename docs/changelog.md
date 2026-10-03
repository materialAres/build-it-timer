---
name: Changelog Rule
description: Rules for updating the changelog
---

# Changelog — Timer Focus (BuildIt)

> Log of completed activities, by task from `docs/roadmap-en.md`.
> Updated to: **M2.T7** (Milestone 2 in progress).
> Sources of truth: `docs/roadmap-en.md`, `package.json`, `git log`.

## Current status

- Milestone 0 (setup) — **completed**
- Milestone 1 (base infrastructure) — **completed**: M1.T1 … M1.T10 all done.
- Milestone 2 (core features) — **in progress**: M2.T1 … M2.T7 done; M2.T8 … M2.T21 remaining.
- Tests: `bun run test` → **187 passing tests** across 22 files (unit + integration + component).
- Type-check: `bun run compile` (`tsc --noEmit`) → **clean**.
- Lint: `bun run lint` → **clean**.
- Builds: `bun run build` (Chrome) and `bun run build:firefox` (Firefox) → **both succeed**.

## Completed tasks summary

| ID | Title | Status | Commit |
|---|---|---|---|
| M0.T1 | WXT + React + TS project scaffolding | completed | `c3eebdc` |
| M0.T2 | Linting/formatting configuration and strict tsconfig | completed | `27d6b1e` |
| M0.T3 | Test runner setup (vitest + wxt/testing + happy-dom + Testing Library) | completed | `27d6b1e` |
| M0.T4 | Playwright setup for e2e (Chromium) | completed | `73f5c3a` |
| M0.T5 | Folder structure and initial barrel files | completed | `0b32002` |
| M1.T1 | Shared domain type definitions | completed | `c1fa995` |
| M1.T2 | `lib/url/domain.ts` module (`tldts` wrapper) | completed | `c1fa995` |
| M1.T3 | Storage adapter for `persist` on `browser.storage.local` | completed | `5793128` |
| M1.T4 | Zustand store — skeleton + slice combination | completed | — (to be committed) |
| M1.T5 | `browser.alarms` adapter (`AlarmProvider`) | completed | — (to be committed) |
| M1.T6 | Typed message bus background↔content↔popup | completed | — (to be committed) |
| M1.T7 | Background entrypoint — orchestrator skeleton | completed | — (to be committed) |
| M1.T8 | Cross-context store synchronization (`browser.storage.onChanged`) | completed | — (to be committed) |
| M1.T9 | Single-writer ownership: read-only stores for non-writer contexts | completed | — (to be committed) |
| M1.T10 | Cross-context mutation path (popup → background) | completed | — (to be committed) |
| M2.T1 | `timerSlice` — timer state and actions | completed | — (to be committed) |
| M2.T2 | Timer persistence/restore logic via alarms | completed | — (to be committed) |
| M2.T3 | `TimerDisplay` + `TimerControls` (UI) | completed | — (to be committed) |
| M2.T4 | `blocklistSlice` — allowlist/blocklist state | completed | — (to be committed) |
| M2.T5 | Predefined presets (data) | completed | — (to be committed) |
| M2.T6 | `declarativeNetRequest` rule generator | completed | — (to be committed) |
| M2.T7 | Applying DNR rules from the background, active only in-session | completed | — (to be committed) |

---

## Milestone 0 — Project setup

### M0.T1 — WXT + React + TS project scaffolding
- Initialized WXT project (React + TypeScript template), multi-browser manifest v3.
- Base files/entrypoints: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/background.ts` (stub), `entrypoints/popup/{index.html,main.tsx,App.tsx,App.css,style.css}`, `entrypoints/content.ts`, `public/` (icons + `wxt.svg`).
- Initial dependencies: `react` `^19.2.4`, `react-dom` `^19.2.4`; dev: `wxt`, `@wxt-dev/module-react`, `typescript`.

### M0.T2 — Linting/formatting configuration and strict tsconfig
- Added `eslint.config.js` (flat config with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`), `.prettierrc`, `.prettierignore`.
- `tsconfig.json` extends `.wxt/tsconfig.json` with `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true` (+ `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`).
- ⚠️ **Known issue** (see the Open Issues section): the `lint` script is currently broken at config-load time — `tseslint.defineConfig` is `undefined` in the installed version of `typescript-eslint`.
- **Resolved (lint fix)**: `tseslint.defineConfig` was replaced with `tseslint.config` — the function actually exported by the installed `typescript-eslint` 8.70.0 (`defineConfig` does not exist there). This surfaced six latent lint errors in the existing code, all fixed: `no-confusing-void-expression` in `entrypoints/popup/App.tsx`, `no-non-null-assertion` in `entrypoints/popup/main.tsx`, `no-unnecessary-condition` in `lib/url/domain.ts`, `no-unnecessary-type-arguments` in `store/index.ts`, and `require-await` in `tests/helpers/fake-alarm-adapter.ts`. `bun run lint` is now clean, and the M0.T2 acceptance criterion is re-verified: a deliberately introduced explicit `any` fails the lint, and removing it makes the lint pass.

### M0.T3 — Test runner setup (vitest + wxt/testing + happy-dom + Testing Library)
- `vitest.config.ts` with the `WxtVitest()` plugin, `happy-dom` environment, `tests/setup.ts`, `@` → root alias, `v8` coverage.
- `tests/setup.ts` imports `@testing-library/jest-dom/vitest`.
- Placeholder tests: `tests/unit/placeholder.test.ts` (pure logic), `tests/unit/react-placeholder.test.tsx` (React component in happy-dom), `tests/integration/fake-browser.test.ts` (`fakeBrowser.storage.local` mock).
- Dev dependencies: `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

### M0.T4 — Playwright setup for e2e (Chromium)
- `playwright.config.ts` + `tests/e2e/setup.ts` (launches a persistent Chromium context with the extension built from `.output/chrome-mv3`) + `tests/e2e/popup.spec.ts` (placeholder test).
- Dev dependency: `@playwright/test`.

### M0.T5 — Folder structure and initial barrel files
- Created the roadmap §1.2 folder structure with `.gitkeep`: `components/{city,timer,blocklist,score,common}`, `store/`, `lib/{url,blocking,city,score,timer,messaging}`, `assets/ascii/`, `utils/`, `tests/{unit,integration,e2e}`.
- Path aliases consistent with the roadmap: `@`, `@/*`, `~`, `~/*` (from `.wxt/tsconfig.json`).

---

## Milestone 1 — Base infrastructure

### M1.T1 — Shared domain type definitions
- `store/store.types.ts`: `TimerStatus`, `ScoreLevel`, `TimerState`, `FormattedDuration`, `Domain`, `Tag`, `BlocklistEntry`, `Preset`, `SessionSummary`.
- `components/city/city.types.ts`: `CityLayerName`, `CityGridData`, `BuildingModuleCategory`, `CityCell`, `CityGrid`, `CityLayers`, `BuildingModule`, `Theme`, `ComposedBuilding`, `SeededRandom`.
- `lib/messaging/messages.types.ts`: `RuntimeMessage` as a discriminated union on `type` with the variants `TIMER_TICK`, `TIMER_STARTED`, `TIMER_PAUSED`, `SITE_BLOCKED_ATTEMPT`, `MALUS_APPLIED`, `SESSION_ENDED`.
- `utils/result.ts`: `Result<T>` type (`Success<T> | Failure`) with helpers `ok(value)` / `err(error)`.
- No use of `any`; clean type-check.

### M1.T2 — `lib/url/domain.ts` module (`tldts` wrapper)
- Pure function `getRegistrableDomain(url: string): Result<string>` based on `tldts` (`parse` + `getDomain`).
- Normalizes subdomains to the registrable domain (`m.facebook.com` → `facebook.com`), handles http/https, protocol-less URLs, explicit ports, and ccSLDs (`facebook.co.uk`).
- Invalid input (empty/whitespace string, malformed URL, IP) → `{ ok: false, error }`, no exception thrown (untrusted boundary).
- Runtime dependency added: `tldts` `^7.4.13`.
- Tests: `tests/unit/lib/url/domain.test.ts` (11 tests, unit) — multiple subdomains, protocols, protocol-less URLs, ports, ccSLDs, empty/whitespace string, malformed URL, IP.

### M1.T3 — Storage adapter for `persist` on `browser.storage.local`
- `store/storage-adapter.ts`: `createBrowserStorage(): StateStorage<Promise<void>>` (type from `zustand/middleware`) with async `getItem`/`setItem`/`removeItem` on `browser.storage.local` (via `import { browser } from 'wxt/browser'`, so it resolves to `fakeBrowser` in tests).
- Also exposes the shared `browserStorage` instance.
- Non-string values are treated as absent (`null`) instead of throwing, so as not to break rehydration.
- Runtime dependency added: `zustand` `5.0.15` (required by the `StateStorage` type and for the upcoming M1.T4).
- Tests: `tests/integration/store/storage-adapter.test.ts` (9 tests, integration with `fakeBrowser`) — non-existent key, set/get round-trip, overwrite, remove, remove on absent key, large value (~500k characters), non-string value, simulated restart (new instance), shared instance.

### M1.T4 — Zustand store — skeleton + slice combination
- `store/index.ts` combines the stub slices (`timer`, `city`, `blocklist`, `score`) into a single `AppState` and applies the `persist` middleware with the M1.T3 `browserStorage` adapter (`createJSONStorage`), keyed by `STORE_NAME = 'timer-focus-store'`, `version: 1`.
- Volatile state isolated in a dedicated `UiSlice` (`activeTab`, `liveRemainingSeconds`, `malusAlertVisible`) per roadmap §1.3; `partialize` persists only `timer`/`city`/`blocklist`/`score` and drops `ui` (`PersistedState = Omit<AppState, keyof UiSlice>`).
- Exports a single `useAppStore` hook plus granular per-slice selectors (`selectTimerStatus`, `selectRemainingSeconds`, `selectSessionId`, `selectCityLayers`, `selectAllowlist`, `selectBlocklist`, `selectCustomTags`, `selectScoreLevel`, `selectDistractionRatio`, `selectActiveTab`, …). `createAppStore(storage?)` allows injecting a storage for tests.
- Stub slices: `store/timer.slice.ts` (`idle`, 25 min default, null `sessionStartedAt`/`sessionId`), `store/city.slice.ts` (three empty 40×12 layers + `themeId`/`sessionId`), `store/blocklist.slice.ts` (empty allowlist/blocklist/customTags), `store/score.slice.ts` (`excellent`, ratio 0). No actions yet (deferred to M2).
- Files created/modified: `store/index.ts`, `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`, `tests/integration/store/store.test.ts`.
- Dependencies added: none (`zustand` already introduced in M1.T3).
- Tests: `tests/integration/store/store.test.ts` (6 tests, integration with `fakeBrowser`) — default state of every slice; `partialize` keeps the persisted slices and drops `ui`; a persisted field (custom tag) survives a simulated "restart" (new store instance on the same fake storage); a volatile field resets to its default after "restart"; the persisted payload is written under the store key without `ui`; granular selectors return the expected values.
- Notes: the persisted/volatile split is enforced at the type level (`PersistedState`) and verified in the payload test, so a future volatile field cannot leak into storage by accident.
- Acceptance criteria: verified.

### M1.T5 — `browser.alarms` adapter (`AlarmProvider`)
- `lib/timer/alarm-adapter.ts` defines the `AlarmProvider` port — `schedule(name, whenMs)`, `clear(name)`, `onFire(listener)` — plus `createBrowserAlarmProvider(now = Date.now)`, the real implementation backed by `browser.alarms` (`alarms.create({ when })`, `alarms.clear`, `alarms.onAlarm` add/remove listener via a single shared handler). `onFire` returns an unsubscribe function; the underlying `browser.alarms.onAlarm` listener is attached only while at least one subscriber is registered.
- `whenMs` is the **absolute** epoch time of the one-shot alarm. `clampAlarmWhen(whenMs, nowMs) = Math.max(whenMs, nowMs + ALARM_MIN_TICK_MS)` enforces the **60s minimum tick** platform constraint (documented with a why-comment): a request for a shorter interval, or a time already in the past, is pushed forward to `now + 60s`.
- `ALARM_MIN_TICK_MS = 60_000` is exported; `now` is injectable for deterministic testing of the clamp without touching the wall clock.
- `tests/helpers/fake-alarm-adapter.ts` provides `FakeAlarmProvider` (test double for principle L), reusing the same `clampAlarmWhen` helper so it honors the identical contract. It owns a controllable clock (`advanceBy(ms)` / `fireDue()`) and deterministically fires due alarms in FIFO order with the fired name; places it under `tests/` keeps it out of the production bundle.
- Files created/modified: `lib/timer/alarm-adapter.ts`, `tests/helpers/fake-alarm-adapter.ts`, `tests/unit/lib/timer/fake-alarm-adapter.test.ts`, `tests/integration/timer/alarm-adapter.test.ts`.
- Dependencies added: none (`browser.alarms` is a platform API; no new package).
- Tests: `tests/unit/lib/timer/fake-alarm-adapter.test.ts` (11 tests, unit) — fires on reaching the scheduled time, does not fire early, clamps a short interval and a past time to 60s, keeps a far-future time unchanged, clears (and clears a missing alarm as a no-op), unsubscribe stops notifications, multiple alarms fire in deterministic order, rejects advancing the clock backwards, lists scheduled alarms. `tests/integration/timer/alarm-adapter.test.ts` (7 tests, integration with `fakeBrowser`) — schedules an alarm at the requested absolute time, clamps a short interval and a past time to 60s (injected `now`, asserted on `alarms.get`), clears a scheduled alarm, clears a missing alarm as a no-op, notifies subscribers with the fired name, and stops after unsubscribe.
- Notes: per principle D, `browser.alarms` is imported in exactly one place — `lib/timer/alarm-adapter.ts`; verified via `grep` that no other module under `lib/`, `store/`, `components/` or `entrypoints/` imports it. The 60s tick documented here is the countdown/persistence clock, distinct from the later 2s city-growth tick (roadmap §1 technical note).
- Acceptance criteria: verified.

### M1.T6 — Typed message bus background↔content↔popup
- `lib/messaging/bus.ts` — thin typed wrapper over `browser.runtime.sendMessage` / `browser.runtime.onMessage`, built on the `RuntimeMessage` discriminated union (M1.T1):
  - `sendMessage(message: RuntimeMessage): Promise<Result<undefined>>` — accepts only valid union variants at the type level; returns a `Result` (via `utils/result.ts`) because sending crosses an untrusted boundary and a browser with no listener rejects the send (expected failure mode, not a bug, §1.4).
  - `onMessage<T extends MessageType>(type, handler): () => void` — subscribes to a single `type`; the handler receives the full variant so `message.payload` is narrowed to that type's payload. Returns an unsubscribe function.
  - Exported helper types `MessageType`, `MessageOf<T>` (`Extract<RuntimeMessage, { type: T }>`), `MessageHandler<T>`.
  - A minimal structural guard (`typeof === 'object'` + `type` string equality) prevents foreign/unknown messages from reaching a typed handler; full runtime validation and sender provenance are explicitly deferred to M5.T1 (additive hardening).
- Files created/modified: `lib/messaging/bus.ts`, `tests/integration/messaging/bus.test.ts`.
- Dependencies added: none (`browser.runtime` is a platform API; reuses the existing `Result` helper).
- Tests: `tests/integration/messaging/bus.test.ts` (10 tests, integration with `fakeBrowser`) — typed payload delivered to the matching listener; payload narrowed to the registered type; a listener for another type is not invoked; multiple listeners for the same `type` all fire; unrecognized `type` ignored without throwing (and without invoking handlers); non-object message ignored; no listener → `{ ok: false }`; unsubscribe stops notifications; async handler awaited; compile-time assertion that `sendMessage` rejects an invalid variant (`@ts-expect-error`, enforced by `bun run compile`) plus `expectTypeOf` on the payload shape and return type.
- Relevant notes/decisions: the bus is deliberately transport-only — no business logic, no store access, no DNR. `sendMessage` uses `browser.runtime.sendMessage` (broadcast to the extension's listeners); targeted delivery to a content script (`tabs.sendMessage`) is not needed by the M1.T6 acceptance criteria and is left to the task that requires it (M2.T8). The `Result` return value is an addition beyond the literal acceptance criteria, aligned with §1.4 (untrusted-boundary error handling) and with the M1.T10 mutation path that will consume it.
- Acceptance criteria: verified — (1) `sendMessage` accepts only valid `RuntimeMessage` variants, enforced at the type level by a `@ts-expect-error` compile assertion; (2) a listener registered with `onMessage('SITE_BLOCKED_ATTEMPT', handler)` receives the typed payload in a `fakeBrowser` test.

### M1.T7 — Background entrypoint — orchestrator skeleton
- `entrypoints/background.ts` is now a wiring-only orchestrator instead of the WXT stub:
  - `MESSAGE_TYPES` — the six `RuntimeMessage` variants from M1.T1 (`TIMER_TICK`, `TIMER_STARTED`, `TIMER_PAUSED`, `SITE_BLOCKED_ATTEMPT`, `MALUS_APPLIED`, `SESSION_ENDED`), typed as `as const satisfies ReadonlyArray<MessageType>` so a new union variant is a compile error until it is wired.
  - `startBackground(dependencies?)` — creates the background's writable store (`createAppStore()`, M1.T4) and the real alarm provider (`createBrowserAlarmProvider()`, M1.T5), then registers one `onMessage(type, handler)` listener per message type (M1.T6) plus a single `alarmProvider.onFire(...)` subscription. Returns a `BackgroundHandle` (`store`, `alarmProvider`, `dispose()`).
  - `BackgroundDependencies` (`store`, `alarmProvider`, `now`) makes the store, the alarm provider, and the clock injectable, so the orchestrator is testable without touching the real browser APIs (principle D/L).
  - `dispose()` detaches every registered listener (message + alarm), keeping tests isolated.
  - The default export calls `startBackground()` inside `defineBackground`, so the real service worker starts the same wiring.
- No business logic: each listener is a shared placeholder (`handlePlaceholder`) whose concrete behavior is owned by M2 (M2.T2 timer restore, M2.T7 DNR, M2.T15 growth, M2.T16 malus). The alarm provider is instantiated now so the background owns a single instance for the whole session.
- Files created/modified: `entrypoints/background.ts`, `tests/integration/background/background.test.ts`.
- Dependencies added: none.
- Tests: `tests/integration/background/background.test.ts` (6 tests, integration with `fakeBrowser`) — starts without errors and exposes the wired store/alarm provider; registers exactly one `runtime.onMessage` listener per `RuntimeMessage` type (spy on `addListener`, asserted against `MESSAGE_TYPES.length`); registers an alarm listener on the injected provider (spy on `onFire`); every M1.T1 message is accepted without throwing; the injected store is reused instead of a new one; `dispose()` detaches all listeners (a subsequent `sendMessage` reports `{ ok: false }`).
- Relevant notes/decisions: the orchestrator is exported as a named function (not only as the `defineBackground` default export) so it can be invoked directly in tests; `defineBackground` is a WXT auto-import available in the test environment via the `WxtVitest` plugin. Cross-context store synchronization (M1.T8) and single-writer ownership (M1.T9) are deliberately **not** attached here yet — they are the next tasks and will extend this same entrypoint.
- Acceptance criteria: verified — (1) the background starts without errors in a `wxt/testing` test; (2) the listeners for the M1.T1 messages are registered, verified via a spy on `browser.runtime.onMessage.addListener`.

### M1.T8 — Cross-context store synchronization via `browser.storage.onChanged`
- `store/sync-storage.ts` — new `attachStoreSync(store): () => void` helper (the "diverge" half of CI-1): it subscribes to `browser.storage.onChanged` and, when `area === 'local'` and the changed keys include `STORE_NAME`, calls `store.persist.rehydrate()`.
  - `SyncableStore` is declared structurally (`{ persist: { rehydrate() } }`) instead of importing `AppStore`, so the helper does not depend on the concrete store shape and creates no runtime import cycle with `store/index.ts` (principle D).
  - No write echo/loop: `zustand/persist` rehydrates through the raw store `set`, not the persisting wrapper, so handling an external change never writes back to storage.
  - Returns an unsubscribe function that detaches the `onChanged` listener.
- `store/index.ts` re-exports `attachStoreSync` (and the `SyncableStore` type), so a context only needs `@/store` to both create and sync its store.
- `entrypoints/background.ts` attaches the sync to the background's writable store inside `startBackground`, with the disposer pushed onto the existing `disposers` list (so `dispose()` detaches it too).
- `entrypoints/popup/main.tsx` attaches the sync to the popup's shared `useAppStore` at bootstrap, so an open popup converges on writes made by the background.
- Files created/modified: `store/sync-storage.ts`, `store/index.ts`, `entrypoints/background.ts`, `entrypoints/popup/main.tsx`, `tests/integration/store/sync-storage.test.ts`, `tests/integration/background/background.test.ts`.
- Dependencies added: none.
- Tests: `tests/integration/store/sync-storage.test.ts` (6 tests, integration with `fakeBrowser`) — an external write to the store key rehydrates the in-memory store (context A writes `storage.local`, context B's store reflects it); the store object is not recreated; no echo/loop (spy: `storage.local.set` is called exactly once — the test's own write — during rehydration); unrelated keys are ignored; the unsubscribe function stops syncing; the helper is exported from the store barrel. `tests/integration/background/background.test.ts` (+1 test) — `startBackground` wires the sync, so an external write converges the background store.
- Relevant notes/decisions: this supersedes the "hydrate once" default of `zustand/persist`. It synchronizes *state between contexts*, not time: the `browser.alarms` 60s tick (M1.T5) and the 2s UI tick remain separate clocks (§1 technical note). The persisted payload is written by `createJSONStorage`, i.e. as `JSON.stringify({ state, version })`; the test serializes the same shape. `STORE_NAME` is imported by `sync-storage.ts` from `./index` — this is a type-level-safe cycle because `STORE_NAME` is only read inside the listener, after both modules have evaluated.
- Acceptance criteria: verified.

> **Note on `docs/store-analysis.md` CI-1.** The roadmap's M1.T8/M1.T9/M1.T10 were added after that analysis document was written; its "Roadmap coverage map" therefore still reports CI-1 as "not covered by any scheduled task". The mechanism it recommends (an `onChanged` → `rehydrate` listener) is exactly what M1.T8 implements.

### M1.T9 — Single-writer ownership: read-only stores for non-writer contexts
- `store/storage-adapter.ts` — new `createReadOnlyStorage(inner = browserStorage): BrowserStateStorage`: `getItem` reads through unchanged, while `setItem`/`removeItem` are no-ops that resolve without writing. Writes are deliberately silent rather than throwing: a non-owner context may legitimately call `setState` for its own volatile `ui` state, and that must neither crash the context nor be persisted on top of the owner's copy.
- `store/index.ts`:
  - `createAppStore` now takes a `CreateAppStoreOptions` object (`{ storage?, readOnly? }`) instead of a bare storage argument; `readOnly: true` wraps the (injected or default) storage in `createReadOnlyStorage`.
  - `useAppStore` — the popup-facing instance — is now created with `{ readOnly: true }`, replacing the old comment claiming it was a "single shared hook used by the popup and the background" (which assumed shared memory that does not exist across extension contexts).
  - The ownership rule is documented with a why-comment plus a table: the background owns `timer`/`city`/`score`; `blocklist` configuration is changed only through M1.T10; `ui` is per-context and never persisted.
- `entrypoints/background.ts` — the background keeps the writable instance (`createAppStore()`), documented as the single writer.
- Files created/modified: `store/storage-adapter.ts`, `store/index.ts`, `entrypoints/background.ts`, `tests/integration/store/read-only-store.test.ts`.
- Dependencies added: none.
- Tests: `tests/integration/store/read-only-store.test.ts` (10 tests, integration with `fakeBrowser`) — `setState` on a read-only store never calls `storage.local.set` (spy) while still updating in-memory state; a read-only store still hydrates from storage; it still converges on external writes via `attachStoreSync` (M1.T8); a writable store persists exactly as before; the popup-facing `useAppStore` is read-only (its `ui` change applies in memory but is not persisted); `createReadOnlyStorage` reads through, makes writes/removals no-ops, and never throws; `partialize` still excludes the volatile `ui` slice under read-only ownership.
- Relevant notes/decisions: the read-only wrapper suppresses persistence only — it does not stop in-memory updates, which is what keeps a non-owner context usable for volatile UI state. No `AppStore`/store call sites needed migration: `createAppStore()` with no arguments keeps the previous behaviour. This completes the "clobber" half of CI-1; M1.T8 already handled the "diverge" half, and M1.T10 restores the popup's ability to edit configuration through the background.
- Acceptance criteria: verified.

### M1.T10 — Cross-context mutation path: popup mutations routed to the background
- `lib/messaging/messages.types.ts` — five mutation variants added to `RuntimeMessage` (all in the `payload`, discriminated on `type`): `BLOCKLIST_ADD_SITE` / `BLOCKLIST_REMOVE_SITE` (`{ list: 'allowlist' | 'blocklist'; site: string }`), `BLOCKLIST_APPLY_PRESET` (`{ presetId }`), `TAG_UPSERT` (`Tag`), `TAG_REMOVE` (`{ tagId }`). Also exports `MutationMessage` (`Extract<RuntimeMessage, { type: 'BLOCKLIST_*' | 'TAG_*' }>`) and the runtime list `MUTATION_TYPES` (`as const satisfies ReadonlyArray<MutationMessage['type']>`), so a new mutation variant is a compile error until it is wired.
- `store/blocklist.slice.ts` — pure mutation helpers shared by both sides: `addSiteToList`, `removeSiteFromList`, `upsertTag`, `removeTag` (which also detaches the tag from every entry, so no dangling `tagIds` survive). They return the *same* reference on a no-op, which the background uses to skip persisting. Also exports the `BlocklistState` / `BlocklistListName` types. No store or browser dependency (principle D), so they are unit-testable in isolation.
- `entrypoints/background.ts` — `applyMutation(state, message)` maps a mutation to a new state with runtime guards (`isListName`, `isTag`, string checks): a malformed or unknown payload returns the same state. `handleMutation(store)` applies it to the writable store only when the state actually changed (`next === current` → no `setState`, hence no persist). `startBackground` registers one listener per `MUTATION_TYPES` entry.
- `store/storage-adapter.ts` — `BrowserStateStorage` now carries a `SELF_WRITE` self-write tracker (symbol-keyed, so the storage API is not widened): `createBrowserStorage` records what this context last wrote, `createReadOnlyStorage` reports nothing as a self-write.
- `store/sync-storage.ts` — `attachStoreSync` **skips self-writes** by consulting that tracker. This fixes a real race found while implementing this task: because the background is the single writer (M1.T9), its own write triggered an `onChanged`, whose asynchronous rehydrate could land *after* a newer in-memory mutation and resurrect the older value (observed as a lost `TAG_REMOVE` / `BLOCKLIST_REMOVE_SITE`).
- `store/index.ts` — `buildStore` exposes the raw adapter as `store.rawStorage` (via `Object.assign`), because `persist.getOptions().storage` only yields the `createJSONStorage` JSON wrapper; re-exports the new helpers and types.
- Files created/modified: `lib/messaging/messages.types.ts`, `store/blocklist.slice.ts`, `store/storage-adapter.ts`, `store/sync-storage.ts`, `store/index.ts`, `entrypoints/background.ts`, `tests/unit/store/blocklist-mutations.test.ts`, `tests/integration/messaging/mutation-bus.test.ts`, `tests/integration/background/background.test.ts`.
- Dependencies added: none.
- Tests: `tests/unit/store/blocklist-mutations.test.ts` (9 tests, unit) — add to the addressed list only, add to the allowlist, no duplicate, remove, remove non-existent, tag upsert (new + update in place), tag removal detaching it from sites, purity (input not mutated). `tests/integration/messaging/mutation-bus.test.ts` (8 tests, integration with `fakeBrowser`) — `BLOCKLIST_ADD_SITE` updates the background store and persists exactly once (spy + read-back of the stored payload); a read-only popup store converges via the M1.T8 bridge with no manual rehydrate; `TAG_UPSERT`/`TAG_REMOVE`; `BLOCKLIST_REMOVE_SITE`; an invalid payload is ignored without throwing, mutating, or persisting; an unknown `type` is ignored; `BLOCKLIST_APPLY_PRESET` is an accepted no-op until M2.T5; a duplicate add does not duplicate. `tests/integration/background/background.test.ts` — the listener-count assertion now expects `MESSAGE_TYPES.length + MUTATION_TYPES.length`.
- Relevant notes/decisions: this task owns **transport + background application only**. Normalization (M2.T4/M2.T21), dedup/allowlist precedence (M2.T20), preset expansion (M2.T5) and the DNR side-effect (M2.T7) are explicitly left to those tasks — the helpers therefore store the site string as-is, which is safe because nothing consumes it yet. `BLOCKLIST_APPLY_PRESET` is deliberately accepted-but-inert rather than unimplemented, so the popup can adopt the protocol without a later breaking change.
- Acceptance criteria: verified — (1) a mutation message from a popup-like context updates and persists the background store exactly once; (2) the read-only popup store converges through the M1.T8 sync bridge with no manual rehydrate in the test; (3) invalid/unknown payloads are ignored without throwing or mutating (forward-compatible with M5.T1); (4) the mutation helpers are pure, so normalization stays on the background side.

---

## Milestone 2 — Core features

### M2.T1 — `timerSlice` — timer state and actions
- `store/timer.slice.ts` — the slice now owns the countdown: `startTimer()`, `pauseTimer()`, `resetTimer()` on top of `{ status, remainingSeconds, sessionStartedAt, sessionId }`. `remainingSeconds` stays the single source of truth (no hour/minute/second fields); the UI derives them in M2.T3.
  - `startTimer()` from `idle` stamps `sessionStartedAt`, mints a fresh `sessionId` and schedules the alarm at the absolute due time `startedAt + remainingSeconds * 1000`; from `paused` it resumes the *same* session and re-arms the alarm from `now` (the 60s platform minimum is applied by the provider, not here); while `running` it is an idempotent no-op, so the alarm's due time can never drift from the countdown it represents.
  - `pauseTimer()` only acts on a `running` timer (`idle`/`paused` are safe no-ops) and cancels the pending alarm; `resetTimer()` returns to the initial idle state and cancels the previous session's alarm.
  - `TimerDependencies` (`alarmProvider`, `now`, `random`) are injected: the slice imports no `browser.*` API and never reads the wall clock or `Math.random()` internally (principle D, §1.4), so it is unit-testable with `FakeAlarmProvider` and a fixed clock.
- `lib/timer/session.ts` (new) — pure `generateSessionId(now, random)` (`<epochMs>-<entropy>`, sortable and unique within the same millisecond) and `timerAlarmName(sessionId)` (`timer:<sessionId>`), the single place the alarm-name convention lives so the background (M2.T2) can tell a live session's alarm from a leftover one.
- `store/index.ts` — `createAppStore` accepts `dependencies?: Partial<StoreDependencies>` (defaults: real `createBrowserAlarmProvider()`, `Date.now`, `Math.random`) and threads them into `createTimerSlice`; `PersistedState` is now declared explicitly (`timer`/`city`/`blocklist`/`score` data only) because the slices finally carry action functions that must never reach storage. Re-exports `DEFAULT_FOCUS_SECONDS` and the `TimerDependencies` type.
- `entrypoints/background.ts` — the alarm provider is created **before** the store and injected into it, so the slice schedules on the very instance `startBackground` subscribes to (two providers would mean the alarm fires into a void).
- Files created/modified: `store/timer.slice.ts`, `lib/timer/session.ts` (new), `store/index.ts`, `entrypoints/background.ts`, `tests/unit/store/timer-slice.test.ts` (new).
- Dependencies added: none.
- Tests: `tests/unit/store/timer-slice.test.ts` (13 tests, unit with `FakeAlarmProvider`) — initial idle state; `startTimer` → `running` + `sessionStartedAt` + one alarm named after the session and due at start + duration; idempotence while `running` (state identity, still a single alarm); resume from `paused` keeps the same `sessionId`/`sessionStartedAt` and re-arms from `now`; `startTimer` after `resetTimer` opens a new unique session; `pauseTimer` clears the alarm; `pauseTimer` while `idle` and while `paused` are no-ops that do not call `clear`; `resetTimer` restores the initial state and drops the alarm; delegation is proven by spying on `browser.alarms.create`/`clear` and asserting they are never called; plus `generateSessionId` determinism/difference and `timerAlarmName` namespacing.
- Relevant notes/decisions: `startTimer()` while already `running` is defined as **idempotent** (roadmap §3.3 left the choice open) rather than an error, because the popup may legitimately re-trigger it; `remainingSeconds` is deliberately left untouched by the three actions — only `resetTimer` restores the default — since ticking it down is the background's job in M2.T2. Calling `resetCityForNewSession` from `startTimer()` (roadmap M2.T11) is deferred: that action does not exist yet.
- Acceptance criteria: verified — (1) the actions are pure with respect to the store (no `browser.alarms` inside the slice: a spy proves `create`/`clear` are never called, all scheduling goes through the injected `AlarmProvider`); (2) `startTimer()` sets `status` to `running`, generates a new unique `sessionId` and calls `AlarmProvider.schedule`.

### M2.T1 (fix) — Missing `storage`/`alarms` manifest permissions (blank popup)
- **Symptom**: with `bun run dev:firefox` the popup rendered blank even though `App.tsx` still had the placeholder UI.
- **Root cause**: `wxt.config.ts` never declared `permissions`, and WXT does **not** infer permissions from the APIs a module imports. The generated manifest therefore had no `storage` entry, so `browser.storage` was `undefined` in the popup and `attachStoreSync(useAppStore)` (M1.T8, called at the top of `entrypoints/popup/main.tsx`) threw `TypeError: can't access property "onChanged", (intermediate value).storage is undefined` **before** `ReactDOM.createRoot(...).render(...)` ran — hence a blank popup. The same gap would have broken the background's `createBrowserAlarmProvider` (`browser.alarms` undefined) once M2.T2 starts scheduling.
- **Fix**: `wxt.config.ts` now declares `manifest.permissions: ['storage', 'alarms']` (with a why-comment). Verified in the dev output: the `[Unhandled error]` line is gone and the generated manifest lists both permissions.
- Files modified: `wxt.config.ts`.
- Dependencies added: none.
- Tests: none (config-only change; the existing 109 tests, type-check, lint and both builds remain green).
- Relevant notes/decisions: this was a latent bug from M1.T3/M1.T8 that only surfaced at runtime in a real browser — the vitest suite uses `fakeBrowser`, which provides `browser.storage` regardless of the manifest, so it could not catch it. `tabs`/`declarativeNetRequest` permissions are intentionally **not** added yet: they belong to the tasks that consume them (M2.T7/M2.T10).
- Acceptance criteria: verified — the popup renders the placeholder UI under `bun run dev:firefox`.

### M2.T2 — Timer persistence/restore logic via alarms
- `lib/timer/restore-timer.ts` (new) — pure `restoreTimer(timer, { alarmProvider, now })` returning `{ timer, changed }`. Only a `running` timer is reconciled: the remaining time is recomputed from the **still-pending alarm** (`Math.max(0, Math.round((dueAt - now()) / 1000))`) rather than trusted from the stale persisted value, because the countdown kept running in wall-clock terms while the worker was asleep. `idle`/`paused` are returned untouched (same reference, `changed: false`).
  - **Inconsistency handling (explicit, not silent)**: a `running` timer with no pending alarm — or with a `null` session id, which makes the alarm name underivable — is reverted to `paused`, so the user restarts deliberately instead of seeing a countdown with no backing alarm.
  - Returns the *same* state reference when nothing changed, so the caller can skip the write (same identity-check pattern as M1.T10).
- `lib/timer/alarm-adapter.ts` — `AlarmProvider` gains `getScheduledTime(name): Promise<number | undefined>` (the restore logic needs to read the pending alarm's due time, which the port previously could not express). Real implementation reads `browser.alarms.get(name)?.scheduledTime`; `FakeAlarmProvider` (`tests/helpers/fake-alarm-adapter.ts`) implements it from its in-memory map.
- `entrypoints/background.ts` — `startBackground` now performs the startup reconciliation: it awaits `store.persist.rehydrate()` (the persisted timer must be in memory first, otherwise the reconciliation would see the default idle state), runs `restoreTimer`, and writes the result back only when `changed`. The work is exposed as `BackgroundHandle.ready: Promise<void>` so tests can await it deterministically; the promise is `.catch`-guarded (logged with context) so a failure cannot become an unhandled rejection that kills the service worker (§1.4; centralized logging replaces this in M4.T3).
- Files created/modified: `lib/timer/restore-timer.ts` (new), `lib/timer/alarm-adapter.ts`, `tests/helpers/fake-alarm-adapter.ts`, `entrypoints/background.ts`, `tests/unit/lib/timer/restore-timer.test.ts` (new), `tests/integration/background/background.test.ts`.
- Dependencies added: none.
- Tests: `tests/unit/lib/timer/restore-timer.test.ts` (7 tests, unit with `FakeAlarmProvider`) — idle/paused untouched (identity + `changed: false`); recompute from the pending alarm after a restart (1500s persisted, 300s elapsed → 1200s); no change when the recomputed value already matches (identity); clamp to zero when the alarm is already due; revert to `paused` when running with no pending alarm; revert to `paused` when the session id is missing. `tests/integration/background/background.test.ts` (+3 tests, integration with `fakeBrowser`) — a persisted `running` timer resumes from the surviving alarm after a simulated restart (new background instance, same fake storage); a `running` timer with no alarm is reverted to `paused`; an idle timer is left untouched.
- Relevant notes/decisions: the alarm is the source of truth for *when the session ends*, the persisted store for *what the session is* — the two are reconciled at startup rather than one being trusted blindly. `getScheduledTime` was added to the port instead of reaching into `browser.alarms` from `restore-timer.ts`, preserving principle D (the module stays browser-free and unit-testable). The `ready` promise is an addition beyond the literal acceptance criteria, needed to make the async startup observable in tests without arbitrary waits.
- Acceptance criteria: verified — (1) simulating a restart (new background instance, same fake storage) with a `running` timer resumes the countdown from a consistent value (not zero, not duplicated); (2) a `running` timer with no pending alarm is detected as an inconsistency and reverted to `paused` (explicit behavior, not silent).

### M2.T3 — `TimerDisplay` + `TimerControls` (UI)
- `utils/format-duration.ts` (new) — pure `formatDuration(totalSeconds): string` rendering `hh:mm:ss`. The function is **total**: non-finite input (`NaN`, `±Infinity`, and the `null`/`undefined` that can slip in from untyped callers) renders as `00:00:00` instead of leaking `NaN:NaN:NaN` into the UI (`Number.isFinite` guard — `Math.max`/`Math.floor` alone let `NaN` through). Fractional seconds are truncated and negative values clamped to zero, so a transient out-of-range value can never render as `-1:-1:-1`. This is the only place that turns the store's `remainingSeconds` into the hour/minute/second representation (the store keeps no separate h/m/s fields, per M2.T1).
- `components/timer/TimerDisplay.tsx` (new) — presentational countdown: reads `remainingSeconds` via `useAppStore(selectRemainingSeconds)` and renders `formatDuration(...)` inside an `<output aria-label="Time remaining">`. No timer logic of its own.
- `components/timer/TimerControls.tsx` (new) — Start / Pause / Reset buttons. Each `onClick` invokes a store action through `useAppStore.getState()` (never local logic, never `browser.*`). Buttons are disabled according to `status` so the UI cannot request a transition the slice would treat as a no-op (Start disabled while running; Pause disabled unless running; Reset disabled while idle).
- Files created/modified: `utils/format-duration.ts` (new), `components/timer/TimerDisplay.tsx` (new), `components/timer/TimerControls.tsx` (new), `tests/unit/utils/format-duration.test.ts` (new), `tests/unit/components/timer/TimerControls.test.tsx` (new).
- Dependencies added: none.
- Tests: `tests/unit/utils/format-duration.test.ts` (9 tests, unit) — zero, seconds with zero-padded minutes/hours, a full 25-minute session, exactly one hour, values beyond one hour, fractional truncation, negative clamp, non-finite (`NaN`/`±Infinity`) → `00:00:00`, `null`/`undefined` → `00:00:00`. `tests/unit/components/timer/TimerControls.test.tsx` (8 tests, component with Testing Library + `user-event`) — `TimerDisplay` renders `00:01:05` / `00:00:00` / `01:01:01`; clicking Start/Pause/Reset invokes the corresponding store action (spy on `useAppStore.getState()`); the disabled-state matrix for idle and running.
- Relevant notes/decisions: the components read the store through the popup-facing `useAppStore` (read-only, M1.T9) — they only *read* state and *invoke* actions, consistent with the coupling rule in §1.3. The action spies are installed on `useAppStore.getState()` (the same object the component calls through), so the assertion is on the real call path rather than a mocked module. `unbound-method` lint forced calling the actions via `useAppStore.getState().startTimer()` instead of destructuring them (destructuring detaches the method from its object).
- Acceptance criteria: verified — (1) `TimerDisplay` renders `remainingSeconds` formatted as `hh:mm:ss` via the separate pure `formatDuration` function, tested in isolation; (2) clicking Start invokes the store action, not local logic; (3) the Testing Library test renders, clicks, and asserts on the action call via a spy on the store.

### M2.T4 — `blocklistSlice` — allowlist/blocklist state
- `store/blocklist.slice.ts` — `addSiteToList` and `removeSiteFromList` now normalize every site through `getRegistrableDomain` (M1.T2) before touching the state, so only the canonical registrable form (`eTLD+1`, subdomains removed) is ever stored. This is the untrusted-input boundary: the raw string is never saved as-is.
  - **Rejection**: a malformed URL or a "bare" public suffix (`co.uk`, `com`) makes `getRegistrableDomain` return `{ ok: false }`; the helper then returns the **same state reference** (no mutation, no throw). The background's identity check (M1.T10) turns that into "no persist", and the UI can surface "Enter a valid URL" (M2.T21/M3.T3).
  - **Dedup**: because both `https://www.facebook.com` and `https://m.facebook.com/foo` normalize to `facebook.com`, adding them produces a single entry — the acceptance criterion's "no duplicates" falls out of normalization rather than a separate check.
  - `removeSiteFromList` normalizes too, so removing by a full URL (`https://m.facebook.com/x`) removes the canonical `facebook.com` entry instead of silently matching nothing; an invalid input is a no-op (same reference).
  - `upsertTag`/`removeTag` are unchanged (they already covered the tag CRUD acceptance criterion).
- Files created/modified: `store/blocklist.slice.ts`, `tests/unit/store/blocklist-mutations.test.ts`, `tests/integration/messaging/mutation-bus.test.ts`.
- Dependencies added: none (`tldts` was already a runtime dependency from M1.T2).
- Tests: `tests/unit/store/blocklist-mutations.test.ts` (17 tests, unit) — the 9 M1.T10 cases plus 8 new M2.T4 cases: full URL → registrable domain; subdomain variants collapse to one entry; ccSLD (`facebook.co.uk`) kept intact; bare public suffix (`co.uk`, `com`) rejected with the same reference; malformed URL rejected without throwing; empty/whitespace rejected; removal by full URL removes the canonical entry; invalid removal input is a no-op. `tests/integration/messaging/mutation-bus.test.ts` (+2 tests, integration with `fakeBrowser`) — a raw URL sent from the popup is normalized before being stored; an invalid site (`co.uk`) is rejected without persisting.
- Relevant notes/decisions: normalization lives in the pure helpers (not in the background handler), so both the popup-requested path and any future direct caller share the exact same rule (DRY). The helpers stay pure and browser-free (principle D). Allowlist/blocklist mutual exclusion (M2.T20) and the DNR side-effect (M2.T7) remain owned by those tasks — this task only guarantees the canonical form. The Chrome/Firefox bundle grew (~273 kB → ~701 kB) because `tldts` is now reachable from the background through the slice; acceptable for a local extension and revisitable if it matters.
- Acceptance criteria: verified — (1) adding a site normalizes via `getRegistrableDomain` before saving (no `facebook.com`/`www.facebook.com` duplicates); (2) untrusted input always goes through `getRegistrableDomain`, invalid input is rejected with the same reference and no exception; (3) entries are kept only in canonical form; (4) CRUD actions covered by unit tests (add/remove/update tag).

### M2.T5 — Predefined presets (data)
- `lib/blocking/presets.ts` (new) — static `PRESETS: ReadonlyArray<Preset>` with three ready-made presets: **Social** (`instagram.com`, `facebook.com`, `x.com`, `tiktok.com`), **Video** (`youtube.com`, `netflix.com`, `twitch.tv`, `vimeo.com`) and **News** (`reddit.com`, `ycombinator.com`, `cnn.com`). Plus `getPresetById(id): Preset | undefined`.
  - Data only — no application logic (Open/Closed, §1.1): adding a preset is adding an array element, never touching the code that applies (M3.T1) or expands (background) presets.
  - Every domain is stored already in canonical registrable form (`eTLD+1`, subdomains removed — the M1.T2 decision), so applying a preset needs no second normalization pass and can never introduce a `www.`/`m.` duplicate.
- `store/store.types.ts` — `Preset` gains a required `tag: Tag` field (the roadmap's "associated tag"). The type was defined in M1.T1 but not yet consumed anywhere, so extending it is non-breaking; the tag is what the preset expansion will attach to each domain so a preset's sites can be filtered like any other tagged entry (M3.T2).
- Files created/modified: `lib/blocking/presets.ts` (new), `store/store.types.ts`, `tests/unit/lib/blocking/presets.test.ts` (new).
- Dependencies added: none.
- Tests: `tests/unit/lib/blocking/presets.test.ts` (8 tests, unit) — the Social preset exists with the expected domains; a Video preset exists; unknown id → `undefined`; every preset has a non-empty id/name/tag; every preset has ≥1 domain; preset ids are unique; every domain is already canonical (re-normalizing it is a no-op); no duplicate domain within a preset.
- Relevant notes/decisions: the roadmap names only the Social preset explicitly and the source document is not in the repo, so Video/News are reasonable additions that keep the dataset useful without inventing a large catalogue (YAGNI). The canonical-form test caught a real mistake during development: `news.ycombinator.com` normalizes to `ycombinator.com` (subdomains are removed), so the entry was corrected to `ycombinator.com` — exactly the class of bug the test exists to prevent. The `tag` field was added to `Preset` rather than left out, because the roadmap explicitly requires "a domain list and associated tag".
- Acceptance criteria: verified — (1) the Social preset with `instagram.com`/`facebook.com`/`x.com`/`tiktok.com` is present; (2) the data conforms to the `Preset` type with no application logic (data only).

### M2.T6 — `declarativeNetRequest` rule generator
- `lib/blocking/rules.ts` (new) — pure `buildDnrRules(blocklist, allowlist): DnrRule[]` that translates the allow/block state into valid DNR rules. Each blocklisted domain becomes `{ id, action: { type: 'block' }, condition: { urlFilter: '||<domain>^', resourceTypes: ['main_frame', 'sub_frame'] } }`.
  - **Precedence (design decision)**: the **allowlist always wins**. A domain present in both lists is not blocked — its block rule is *omitted* (the allowlist is turned into a `Set` and used to filter the blocklist) rather than cancelled by a higher-priority `allow` rule. This satisfies the acceptance criterion with a minimal rule set and no reliance on DNR priority semantics. It deviates from the roadmap's literal wording ("the allowlist rule has higher priority"), which is recorded here as the deliberate choice.
  - **`urlFilter`**: `||<domain>^` — the `||` domain anchor matches the domain and its subdomains, `^` is the separator that also matches the end of the URL. Entries are assumed already canonical (M2.T4); escaping/validation of `*`/`|`/`^` is M5.T3's job.
  - **`resourceTypes`**: `main_frame` + `sub_frame` (top-level navigation and embedded frames). Sub-resources are intentionally not blocked so a blocked page fails cleanly instead of half-loading.
  - **Purity**: no `browser.declarativeNetRequest` call and no I/O; the rule type is a type-only alias of `Browser.declarativeNetRequest.Rule` (from `wxt/browser`), so the module is testable without a browser. Applying the rules is M2.T7.
  - **Determinism**: ids are sequential from 1 in input order; the blocklist is de-duplicated defensively (a duplicate domain yields a single rule).
- Files created/modified: `lib/blocking/rules.ts` (new), `tests/unit/lib/blocking/rules.test.ts` (new).
- Dependencies added: none.
- Tests: `tests/unit/lib/blocking/rules.test.ts` (10 tests, unit) — empty blocklist → `[]`; one domain → one block rule with the expected `urlFilter`/`resourceTypes`; the `||…^` anchoring; a duplicated blocklist domain → a single rule; **a domain in both lists → not blocked (first-class case)**; only the non-allowlisted domain is blocked when one of two is allowlisted; an allowlist-only domain → no rule; unique sequential ids; determinism (same input → deep-equal output); inputs are not mutated.
- Relevant notes/decisions: the module is pure and browser-free (principle D), so it runs in the plain vitest environment with no `fakeBrowser`. The `declarativeNetRequest` manifest permission is **not** added here — it belongs to M2.T7, which is the task that actually calls `updateDynamicRules` (see Open issues).
- Acceptance criteria: verified — (1) a blocklisted domain generates a correct blocking rule with a normalized `urlFilter`; (2) the allowlist always wins, tested as a first-class case; (3) no real `browser.declarativeNetRequest` calls (pure module).

### M2.T7 — Applying DNR rules from the background, active only in-session
- `lib/blocking/apply-rules.ts` (new) — three pieces:
  - `selectActiveRules(state)`: the rules that must be active for a given state. **Blocking is on exclusively while `status === 'running'`**; `idle`/`paused` yield `[]`, so outside a focus session navigation is always free. Delegates rule construction to `buildDnrRules` (M2.T6), so the allowlist-wins precedence is inherited rather than reimplemented.
  - `RuleApplier` port + `createBrowserRuleApplier()`: `replaceRules(rules)` reads the **live** dynamic ruleset with `getDynamicRules()` and calls `updateDynamicRules({ removeRuleIds, addRules })`. The live ruleset is read back on every update instead of trusting an in-memory "what we added" list, because dynamic rules survive both a service worker restart and a browser restart — after a cold start the browser is the only record of what is active. Empty `removeRuleIds`/`addRules` arrays are omitted (a no-op update stays a no-op).
  - `createBlockingRulesSync(applier)`: `sync(state)` recomputes the rules from state, compares a signature (`id` + `urlFilter` per rule) against what it last applied and **skips the browser call when nothing changed** — a timer tick or an unrelated mutation must not rewrite the ruleset. `appliedSignature` starts as `null` (not as "empty rule set"), so the first sync of a cold start always writes, which is what clears leftovers from a previous session. Updates are **serialized** through a promise chain, because the popup's mutation path and a timer transition can trigger two syncs in the same tick and an interleaved pair could otherwise land out of order; a failed update is not cached as applied, so the next sync retries it.
- `entrypoints/background.ts` — the sync is wired as a **store subscription** (`store.subscribe(syncRules)`) rather than patched at each call site: the browser's ruleset is a projection of the store, so "the blocklist/allowlist changed" and "the timer transitioned" are the same trigger (any state change), and idempotence makes subscribing to all of them safe. Failures are caught at this boundary and logged with context (`[background] DNR rule sync failed`), so a failing rule update cannot kill the service worker. The startup reconciliation (M2.T2) now `await`s a final `sync` after the timer is restored and exposed through `BackgroundHandle.ready`, so "ready" also means "the dynamic ruleset reflects the restored state" (a session that did not survive the restart must not leave the previous session's blocking rules active). `BackgroundDependencies` gains an injectable `ruleApplier`.
- `wxt.config.ts` — `declarativeNetRequest` added to `manifest.permissions` (WXT does not infer permissions from the APIs a module imports). Verified in both generated manifests (Chrome MV3 + Firefox MV2). The permission is available in Firefox from 113 and Chrome from 84.
- Files created/modified: `lib/blocking/apply-rules.ts` (new), `entrypoints/background.ts`, `wxt.config.ts`, `tests/helpers/fake-rule-applier.ts` (new), `tests/unit/lib/blocking/apply-rules.test.ts` (new), `tests/integration/background/dnr-rules.test.ts` (new).
- Dependencies added: none.
- Tests: `tests/unit/lib/blocking/apply-rules.test.ts` (14 tests, unit with `FakeRuleApplier`) — `selectActiveRules`: no rules while `idle`/`paused`, the blocklist rules while `running`, allowlist-wins while running. `createBlockingRulesSync`: applies on the first sync while running; **removes every rule on `running → paused`** and on `running → idle`; reapplies on `paused → running`; reapplies when the blocklist changes mid-session; skips the browser call when the resulting rules are unchanged; writes on the first sync even when there is nothing to block (cold-start cleanup); serializes concurrent syncs so the last state wins; retries a failed update instead of caching it as applied. `tests/integration/background/dnr-rules.test.ts` (9 tests, integration with `fakeBrowser`) — `fakeBrowser` declares `declarativeNetRequest` but does not implement it (`MockNotImplementedError`), so the dynamic ruleset is modelled in the test and the **production** `createBrowserRuleApplier` runs against `browser.declarativeNetRequest`: starting a session + adding a site while `running` applies the expected rule (`addRules[0].condition.urlFilter === '||facebook.com^'`); pausing removes it (`removeRuleIds: [1]`, no `addRules`) leaving the live ruleset empty; navigation stays free outside a session (every update is removal-only); resuming reapplies; a blocklist change while running updates the live set; a cold start with a non-running timer clears the previous session's rules; a **running** session that survives a restart (persisted store + surviving alarm) keeps its rules; the injected applier is used instead of the browser API; a failing rule update is logged and leaves the store usable (`status` still becomes `running`); a state change that leaves the rules unchanged (idle blocklist edit, volatile `ui` change) does not call the browser.
- Relevant notes/decisions: the rule set is derived from state, never mutated incrementally — this is what makes "removal on pause" and "reapplication on resume" the same code path as "blocklist changed". The subscription is on the whole store rather than on a selector, so no slice selector had to be widened for this task; the signature check absorbs the extra notifications. `BackgroundHandle.ready` was already the project's mechanism for making the async startup observable (M2.T2), and reusing it avoids arbitrary waits in tests.
- Acceptance criteria: verified — (1) blocking rules are active exclusively during `status === 'running'`: `running → paused/idle` removes the dynamic rules via `updateDynamicRules`'s `removeRuleIds`, the transition to `running` reapplies them, and outside a focus session every update is removal-only; (2) with `fakeBrowser`, changing the blocklist during `running` triggers a call with the expected rules, and a transition to `paused` triggers a rule-removal call.

---

## Dependencies added over the course of the tasks

| Package | Version | Introduced in | Reason |
|---|---|---|---|
| `react` / `react-dom` | `^19.2.4` | M0.T1 | popup UI |
| `tldts` | `^7.4.13` | M1.T2 | domain parsing/normalization |
| `zustand` | `5.0.15` | M1.T3 | store + `persist` middleware |

Dev: `wxt`, `@wxt-dev/module-react`, `typescript`, `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/{react,user-event,jest-dom}`, `@playwright/test`, `eslint`/`@eslint/js`/`typescript-eslint`/`eslint-plugin-react`/`eslint-plugin-react-hooks`, `prettier`, `web-ext`.

---

## Open issues and points to clarify

1. **Roadmap §4 open point** not to be anticipated (YAGNI): exact `distractionRatio` formula; behavior beyond grid capacity.
2. **`framer-motion`** not yet installed (will be needed from M3.T5).
3. **`store-analysis.md` note (M2.T1)** — the analysis predicted that adding action functions to a slice would break `PersistedState = Omit<AppState, keyof UiSlice>`; the type is now declared explicitly (`store/index.ts`), so a future action cannot leak into storage.
4. **Manifest permissions are not auto-detected by WXT** — they must be declared in `wxt.config.ts` (`storage`/`alarms` added in the M2.T1 fix, `declarativeNetRequest` in M2.T7). The `tabs` permission still needs to be added by M2.T10. The vitest suite cannot catch a missing permission because `fakeBrowser` provides the APIs regardless of the manifest; only a real-browser run (dev/e2e) can.
5. **`urlFilter` escaping (M5.T3)** — `buildDnrRules` (M2.T6) interpolates the domain into `urlFilter` as-is, trusting the canonical form produced by M2.T4. A domain containing `*`/`|`/`^`/`||` would be interpreted as DNR syntax; M5.T3 adds the escaping/validation. Tracked as a follow-up, not a defect of M2.T6 (entries are canonical by construction).
6. **Timer commands from the popup are not routed to the background yet (found during M2.T7)** — the popup's `useAppStore` is read-only (M1.T9), so `TimerControls` (M2.T3) calling `startTimer()`/`pauseTimer()`/`resetTimer()` mutates only the popup's in-memory state and schedules an alarm on the popup's own provider; the background — which is what owns the timer, the alarms and the DNR rules (M2.T7) — never learns about it. The mutation-message mechanism that fixes this already exists (M1.T10, `MutationMessage` + `applyMutation`), but no task explicitly assigns the timer transition to it: M1.T10 covers the blocklist/tag variants only, and the `TIMER_STARTED`/`TIMER_PAUSED` variants from M1.T1 are declared but not handled. This does **not** invalidate M2.T7 (whose acceptance criteria are met in the background), but it must be closed before the M3.T4 acceptance criterion ("starting a timer from the UI updates `TimerDisplay` and the city state after a simulated tick") can pass end-to-end.

---

## How to re-run the checks

**Important**: execute `bun run build` for Firefox as well as for Chrome

```bash
bun run test          # vitest (unit + integration + component)
bun run compile       # tsc --noEmit
bun run lint          # clean (M0.T2 issue resolved)
bun run build:firefox # Firefox build (WXT)
bun run build         # Chrome build (WXT)
```
