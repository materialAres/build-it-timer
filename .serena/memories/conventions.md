# Conventions

## Naming & layout
- Files: `kebab-case.ts` for logic, `PascalCase.tsx` for components, `*.slice.ts` for Zustand slices, `*.types.ts` for type-only modules, `*.content.ts(x)` for content scripts.
- camelCase identifiers; booleans `is/has/should*`; pure state computations `compute*/calculate*`.
- Soft limits: file ≤ 200 lines, function ≤ 40 lines (tests excluded).
- Use the `@/` alias; type-only imports required (`verbatimModuleSyntax` + `consistent-type-imports`).
- Prettier: single quotes, semicolons, trailing commas, 80 cols, 2 spaces, LF.

## TypeScript / ESLint
- Explicit return types on exported functions; no `any` (narrow `unknown`); no `console` outside `utils/logger.ts`; no empty catch; exhaustive switches over discriminated unions.
- Untrusted boundaries (URL input, storage reads, runtime messages) validate and return `Result` (`utils/result.ts` `ok/err`), or ignore a no-op mutation — never throw into the main flow.

## State & architecture
- Slices are factories `createXSlice(dependencies): StateCreator<AppState, [], [], XSlice>`, composed in `store/index.ts`; dependencies (`now`, `random`, `alarmProvider`, `growthEngine`, `selectThemeId`, `sendMutation`, grid size) are injected there.
- Granular selectors live in `store/index.ts` (`selectTimerStatus`, …); components select narrow fields, never the whole slice.
- React components never call browser APIs and never compute domain logic; they invoke store actions. Mutations are background-only; the popup uses `request*` actions that emit mutations.
- Domain logic lives in `lib/` and takes time/randomness as arguments.
- Comments explain only *why*; cite roadmap/issue IDs (`M1.T9`, `I001`, `CI-2`) when encoding a decision.

## Tests
- Mirror source paths: `tests/unit/lib/<area>/<file>.test.ts`, `tests/unit/components/<area>/<Component>.test.tsx`, `tests/integration/<area>/...`, `tests/e2e/*.spec.ts`.
- `tests/setup.ts` mocks `framer-motion` as a passthrough, installs a shared fake `declarativeNetRequest` ruleset, and loads the real YAML i18n backend; `fakeBrowser` namespaces throw unless faked.
- Reusable fakes: `tests/helpers/fake-alarm-adapter`, `fake-rule-applier`, `fake-tab-event-source`, `fake-declarative-net-request`, `i18n`.
- TDD (red → green → refactor), especially for pure `lib/` functions; never assert animation timing — assert the settled state.

## i18n
- All user-visible copy goes through `i18n.t(...)`; add the key to **both** `locales/en.yml` and `locales/it.yml` (`tests/unit/i18n/locales.test.ts` enforces no drift).

## Docs & process
- Read `docs/roadmap-en.md` and `docs/changelog.md` in full for project context; task cards define acceptance criteria.
- Never run git write commands (commit/push/tag/merge/rebase/reset); leave changes for the human to review and commit.
- One changelog entry per completed task (what/API, files, deps, tests + counts, decisions, acceptance status); keep status marker and test counts truthful; commit column stays `—` until the human commits.