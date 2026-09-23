---
name: Changelog Rule
description: Rules for updating the changelog
---

# Changelog — Timer Focus (BuildIt)

> Log of completed activities, by task from `docs/roadmap-en.md`.
> Updated to: **M1.T4** (Milestone 1 in progress).
> Sources of truth: `docs/roadmap-en.md`, `package.json`, `git log`.

## Current status

- Milestone 0 (setup) — **completed**
- Milestone 1 (base infrastructure) — **in progress**: M1.T1, M1.T2, M1.T3, M1.T4 completed; M1.T5–M1.T7 to do.
- Tests: `bun run test` → **29 passing tests** across 6 files (unit + integration + component placeholder).
- Type-check: `bun run compile` (`tsc --noEmit`) → **clean**.

## Completed tasks summary

| ID | Title | Status | Commit |
|---|---|---|---|
| M0.T1 | WXT + React + TS project scaffolding | completed | `c3eebdc` |
| M0.T2 | Linting/formatting configuration and strict tsconfig | completed (with known issue) | `27d6b1e` |
| M0.T3 | Test runner setup (vitest + wxt/testing + happy-dom + Testing Library) | completed | `27d6b1e` |
| M0.T4 | Playwright setup for e2e (Chromium) | completed | `73f5c3a` |
| M0.T5 | Folder structure and initial barrel files | completed | `0b32002` |
| M1.T1 | Shared domain type definitions | completed | `c1fa995` |
| M1.T2 | `lib/url/domain.ts` module (`tldts` wrapper) | completed | `c1fa995` |
| M1.T3 | Storage adapter for `persist` on `browser.storage.local` | completed | `5793128` |
| M1.T4 | Zustand store — skeleton + slice combination | completed | — (to be committed) |

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

1. **Broken lint (M0.T2)** — `bun run lint` fails before analyzing any files: `TypeError: Function.prototype.apply was called on undefined` in `eslint.config.js` line 6, because `tseslint.defineConfig` doesn't exist in the installed version of `typescript-eslint` (`config` exists, `defineConfig` doesn't). Proposed fix: replace `tseslint.defineConfig(...)` with `tseslint.config(...)` (or update `typescript-eslint`). Not yet resolved as it's out of scope for the current tasks.
2. **Roadmap §4 open point** not to be anticipated (YAGNI): exact `distractionRatio` formula; behavior beyond grid capacity.
3. **`framer-motion`** not yet installed (will be needed from M3.T5).

---

## How to re-run the checks

```bash
bun run test        # vitest (unit + integration + component)
bun run compile     # tsc --noEmit
bun run lint        # ⚠️ currently broken (see Issue #1)
bun run build       # Chrome build (WXT)
bun run build:firefox
```
