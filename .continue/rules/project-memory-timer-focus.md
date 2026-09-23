# Project Memory — Timer Focus (BuildIt)

> Quick reference for AI agents: technology stack, dependency versions, and project conventions.
> Source of truth: `docs/roadmap-en.md` and `package.json`. In case of discrepancy, `package.json` prevails.

## Project description

Productivity browser extension: focus timer with an ASCII city-builder city, allowlist/blocklist with malus, and a scoring system (Excellent/Good/Bad). Manifest v3, multi-browser (Chrome and Firefox).

## Package manager

- **bun** — ALWAYS use bun (not npm/pnpm/yarn) for installation, running scripts, and dependency management.

## Main stack (runtime)

| Technology | Use in the project |
|---|---|
| **React** `^19.2.4` | popup UI, components in `components/` |
| **react-dom** `^19.2.4` | popup rendering |
| **WXT** `^0.21.3` (dev) | browser extension framework: entrypoints, multi-browser build, `wxt.config.ts` |
| **@wxt-dev/module-react** `^1.1.5` (dev) | React integration in the WXT build |
| **Zustand** | store with `persist` middleware (to be added if missing), slices in `store/*.slice.ts` |
| **declarativeNetRequest** (browser API) | site blocking during a focus session |
| **browser.alarms** (browser API) | timer persistence across service worker restarts (minimum tick 60s) |
| **tldts** | domain parsing/normalization (`lib/url/domain.ts`) — to be added if missing |
| **framer-motion** | building growth/destruction animations (M3.T5) — to be added if missing |

## Runtime dependencies (`dependencies`)

- `react` `^19.2.4`
- `react-dom` `^19.2.4`

## Development dependencies (`devDependencies`)

| Package | Version | Role |
|---|---|---|
| `wxt` | `^0.21.3` | extension build framework |
| `@wxt-dev/module-react` | `^1.1.5` | React module for WXT |
| `typescript` | `^5.9.3` | TS compiler (`strict: true` mandatory) |
| `vitest` | `^5.0.1` | test runner (unit/component/integration) |
| `@vitest/coverage-v8` | `^5.0.1` | coverage |
| `happy-dom` | `^20.14.5` | DOM environment for component tests |
| `@testing-library/react` | `^16.3.3` | React component testing |
| `@testing-library/user-event` | `^14.6.7` | user interaction simulation |
| `@testing-library/jest-dom` | `^7.0.1` | DOM matchers (configured in `tests/setup.ts`) |
| `@playwright/test` | — | e2e tests on Chromium (to be added to the setup, roadmap M0.T4) |
| `eslint` | `^9.0.0` | linting |
| `@eslint/js` | `^9.0.0` | ESLint flat config |
| `typescript-eslint` | `^8.0.0` | TS rules for ESLint |
| `eslint-plugin-react` | `^7.35.0` | React rules |
| `eslint-plugin-react-hooks` | `^5.0.0` | React hooks rules |
| `prettier` | `^3.3.0` | formatting |
| `web-ext` | `^10.5.0` | Firefox extension tooling |

## npm scripts (always run with `bun run <script>`)

- `dev` / `dev:firefox` — development with WXT
- `build` / `build:firefox` — production build (Chrome / Firefox)
- `zip` / `zip:firefox` — packaging
- `compile` — type-check (`tsc --noEmit`)
- `test` / `test:watch` / `test:coverage` — vitest
- `lint` / `lint:fix` — ESLint
- `format` / `format:check` — Prettier
- `postinstall` — `wxt prepare`

## Binding conventions (from `docs/roadmap-en.md` §1)

- Strict TypeScript: `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`. Explicit `any` is forbidden.
- Files ≤ 200 lines, functions ≤ 40 lines. Naming: `kebab-case.ts` for logic modules, `PascalCase.tsx` for components, `.slice.ts` for Zustand slices, `.types.ts` for types.
- React components never call `browser.*`/`chrome.*` APIs directly and contain no calculation logic: they read via Zustand selectors and invoke store actions.
- Logic in `lib/` is pure: no internal `Date.now()` or `Math.random()` (time and seeded RNG passed as parameters), no direct browser dependencies (Dependency Inversion — injected adapters: `AlarmProvider`, `StorageAdapter`).
- Messages between background/content/popup: typed discriminated union (`RuntimeMessage`), never free-form objects.
- Error handling: explicit `Result`-like pattern (`{ ok, value/error }`) at untrusted boundaries; never empty `catch {}`.
- TDD testing (red/green/refactor) for every task with non-declarative logic; vitest for unit/integration (`wxt/testing` + `fakeBrowser`), Testing Library for components, Playwright (Chromium only) for e2e.
- Folder structure: `entrypoints/` (background, popup, content), `components/`, `store/`, `lib/`, `assets/ascii/`, `utils/`, `tests/` — full detail in `docs/roadmap-en.md` §1.2.
- Critical logic that must never break (mandatory regression testing): timer persistence via alarms (M1.T5, M2.T1–T2), tldts parsing (M1.T2), DNR rules (M2.T6–T7), score/malus (M2.T9–T10), palette determinism (M2.T13).
- Documented open points (roadmap §4): exact `distractionRatio` formula, behavior beyond grid capacity — do not anticipate implementations that haven't been requested (YAGNI).
