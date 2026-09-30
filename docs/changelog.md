---
name: Changelog Rule
description: Rules for updating the changelog
---

# Changelog — Timer Focus (BuildIt)

> Log of completed activities, by task from `docs/roadmap-en.md`.
> Updated to: **M1.T7** (Milestone 1 in progress).
> Sources of truth: `docs/roadmap-en.md`, `package.json`, `git log`.

## Current status

- Milestone 0 (setup) — **completed**
- Milestone 1 (base infrastructure) — **in progress**: M1.T1, M1.T2, M1.T3, M1.T4, M1.T5, M1.T6, M1.T7 completed; M1.T8 to do.
- Tests: `bun run test` → **63 passing tests** across 10 files (unit + integration + component placeholder).
- Type-check: `bun run compile` (`tsc --noEmit`) → **clean**.
- Lint: `bun run lint` → **clean**.

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

---

## How to re-run the checks

```bash
bun run test        # vitest (unit + integration + component)
bun run compile     # tsc --noEmit
bun run lint        # clean (M0.T2 issue resolved)
bun run build       # Chrome build (WXT)
bun run build:firefox
```
