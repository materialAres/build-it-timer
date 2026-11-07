# Project Overview — Focus Timer (BuildIt)

> Productivity browser extension: focus timer with ASCII city-builder city, blocklist with malus, scoring system.
> Stack: React, WXT, Zustand (`persist`), `declarativeNetRequest`, `browser.alarms`, `framer-motion`, Content Scripts + Shadow DOM, `tldts`, `@wxt-dev/i18n` (EN/IT internationalization based on `browser.i18n`).
> Default package manager: **bun** (all installation, script execution, and dependency management commands use bun, not npm/pnpm/yarn).

---

## 0. Important introductory note
Before any coding task, call Serena’s initial_instructions. For any question about a symbol (function, class, variable): where it is defined, where it is used, what calls it, use Serena’s symbol and reference tools, even when the name is known and a single grep would seem faster. Use grep or text search only for non-code content (docs, changelogs, comments, config strings) or when Serena returns nothing. Use Serena for editing code symbols and for project memory. Consult project memory at the start of every task, and at the end update it.

## 1. Foreword — Code quality standards

This section defines the binding rules for all code written in the project, regardless of who (or which AI) writes it. Every task in Section 2 must comply with them: they are an implicit prerequisite of every acceptance criterion.

### 1.1 Design principles

| Principle | Concrete application in the project |
|---|---|
| **S — Single Responsibility** | Each module has only one reason to change. Example: URL parsing logic (`tldts`) lives in `lib/url/domain.ts` and knows nothing about `declarativeNetRequest`; the module that generates DNR rules (`lib/blocking/rules.ts`) knows nothing about React. A component like `CityCanvas.tsx` handles only rendering, not score calculation. |
| **O — Open/Closed** | Blocklist presets (Social, Video, etc.) are defined as data (an array of `Preset` objects), not as hardcoded `if/else`: adding a new preset doesn't require modifying the preset-application logic, only adding an element to the list. Same approach for "palettes per building tier": the hash→color function is generic and accepts a palette as a parameter, it doesn't have colors hardwired in. |
| **L — Liskov Substitution** | "Adapter" interfaces (e.g. `AlarmProvider`, `StorageAdapter`) must be replaceable by a fake/mock in tests without changing the caller's expected behavior. E.g. in tests, a `FakeAlarmProvider` that advances time manually must honor the same contract (`schedule`, `clear`, `onFire`) as the real provider based on `browser.alarms`. |
| **I — Interface Segregation** | No "big" interfaces: the Zustand store is split into slices (`timerSlice`, `citySlice`, `blocklistSlice`, `scoreSlice`), each with its own typed interface, so a component that only reads the timer doesn't depend (type-wise) on the city slice. |
| **D — Dependency Inversion** | "Core" modules (score calculation, malus calculation, city growth engine) never directly import browser APIs (`browser.alarms`, `browser.storage`, `declarativeNetRequest`). They depend on abstract interfaces injected from the outside (background script / popup), to remain testable in Node/happy-dom without heavy browser mocks. |
| **Separation of Concerns** | Three separate "worlds" communicating only via the persisted store and typed messages: (1) **background** — timer, alarms, DNR rules, score/malus calculation; (2) **content script** — only the alert overlay on a blocked site, no business logic; (3) **popup/UI** — presentation only (ASCII city, timer controls, preset management), reads state but doesn't compute it. |
| **DRY** | Domain normalization logic (via `tldts`) is centralized in a single function (`getRegistrableDomain(url)`), used by the blocklist matcher, the DNR rule generator, and the palette hash alike — never duplicated. |
| **KISS** | The city growth engine composes buildings from a finite number of predefined ASCII modules (bases, floors, tops — see `tile-library.ts`) selected procedurally, not algorithmically generated character-by-character from scratch: variety comes from combining modules, not from a complex procedural engine. Optimization with TexturePacker/sprite sheets remains deferred (see Milestone 4) and must not complicate the ASCII MVP. |
| **YAGNI** | No plugin system for third-party presets is built from the start, nor multi-device sync: none of this is in the source document. Only what is explicitly requested is implemented; any future extension should be proposed as a new task, not anticipated in the current code. **Exception**: multi-language support (i18n) is explicitly required from the start (EN default, IT), and must be implemented with the official WXT module `@wxt-dev/i18n`, choosing the language **automatically from the browser's language** (IT only if the browser is set to Italian, otherwise EN) — no manual selector — and in a way that makes adding new languages trivial (see M3.T9). |

> **Operative note - roadmap and changelog**: tasks are defined in `docs/roadmap-en.md` and progress is recorded in `docs/changelog.md`. Do **not** read them automatically. Read them only when the user asks, or when working on or closing a roadmap task (ID like `M2.T9`). Even then read only what is needed: grep the task ID and read just that card in the roadmap; for the changelog use the `changelog` skill, which reads only the sections it edits. Each card is a `#### <ID> — <Title>` heading with a one-line `**Dependencies**` field: read the cards of those dependencies (one level only, and only their `**Files**` and `**Acceptance criteria**`) just when the task consumes something they produce (a type, interface, message shape or store field). For dependencies already done, prefer their changelog entry or the code (Serena) over the planned card. For ad-hoc work (questions, reviews, refactors) never open them; use Serena memory for project context.

> **Operative note - context**: read only the files relevant to the task, not the entire codebase. Reference files, read on demand and never in full: `docs/project-structure.md` (target folder layout), `docs/testing-matrix.md` (per-task edge cases and critical-logic priority: grep your task ID).

> **Technical note — two distinct clocks.** The document requires that city characters be inserted one at a time every 2 seconds, while `browser.alarms` (used for timer persistence, see M1.T5) has a minimum tick of 60 seconds due to a platform constraint. The two mechanisms **must not be confused**: `browser.alarms` remains the sole source of truth for persisting the countdown across service worker restarts; the 2s character-insertion tick is instead a fine-grained timer (`setInterval`/`requestAnimationFrame`-based) that lives on the popup/background side only while the context is active, and is deterministically recalculated (number of characters due = elapsed focus time ÷ 2s) every time the context wakes up, exactly as already planned for the second-by-second countdown in Section 1.4.

### 1.2 Code organization

Target folder layout (WXT: explicit entrypoints + shared code isolated from them): see `docs/project-structure.md`, read it only when creating or moving files.

Conventions:

* **File naming**: `kebab-case.ts` for logic modules, `PascalCase.tsx` for React components, `.slice.ts` suffix for Zustand slices, `.types.ts` suffix for type-only files, `.content.ts` suffix for content scripts.
* **Function/variable naming**: `camelCase`; boolean functions prefixed with `is`/`has`/`should` (e.g. `isDomainBlocked`); pure functions that compute a new state prefixed with `compute`/`calculate` (e.g. `calculateScore`, `computeCityGrowth`).
* **Recommended maximum size**: file ≤ 200 lines (tests excluded), function ≤ 40 lines. Exceeding these limits is a signal that the module/function has more than one responsibility and should be broken down (see principle S).
* **React components**: one component per file, at most one level of unexported private sub-components in the same file if purely presentational (e.g. a single `<CityCell>` cell rendered by `<CityCanvas>` still goes in its own file if it exceeds ~30 lines).
* **Strict TypeScript**: `strict: true` mandatory in `tsconfig.json`. Explicit `any` is forbidden (use `unknown` + narrowing). Every exported function has explicit return types. Messages exchanged between background/content/popup are typed with discriminated unions (e.g. `type RuntimeMessage = { type: 'TIMER_TICK'; payload: ... } | { type: 'SITE_BLOCKED'; payload: ... }`), never `any`/free-form objects.

### 1.3 State management (Zustand)

* **Persisted store** (`persist` middleware, `browser.storage.local` backend via a custom adapter): everything that must survive a browser restart and represents "historical" data or user configuration —
  * the city state **of the current, in-progress session** (grid/layers, buildings, palettes assigned to domains, active theme) — needed to survive a service worker restart during a still-active session; it is instead reset and regenerated from scratch when a new focus session starts (one city per session, see Section 2);
  * blocklist configuration, custom presets and their tags;
  * history of the last 5 completed sessions (score and, if applicable, city screenshot/reference — see M2.T19);
  * user preferences (e.g. Good/Bad thresholds if made configurable).
* **Volatile store** (not persisted, reset on every service worker/popup startup): everything that is derived or transient —
  * the fine-grained "in progress" timer (current seconds not yet rounded to the 60s tick — still needs to be reconciled with `browser.alarms`, which is the source of truth for actual countdown persistence, see §3.4, and with the 2s character-insertion tick, see the technical note at the start of Section 1);
  * UI state (active tab in the popup — consumed by the M3.T4 tab bar — open modals, hover on a city cell);
  * temporary flags. Note: the malus alert is **not** popup state — it is the content-script overlay in Shadow DOM (M2.T8), so the `ui.malusAlertVisible` flag created in M1.T4 is dead code and is dropped in M3.T4.
* **Coupling rule**: React components never call chrome.*/browser.* APIs directly and **never** contain computation logic (score, growth, blocklist matching). A component reads state via dedicated Zustand selectors (e.g. useTimerStore(selectRemainingSeconds)) and **only invokes** actions exposed by the store (e.g. useTimerStore.getState().pauseTimer()); the action internally delegates to a pure function in lib/ and/or sends a message to the background. This decouples the UI from the implementation and makes slices testable without mounting components.
* Each slice exposes granular selectors (not a single selector returning the whole slice) to minimize unnecessary re-renders in a context where animations (framer-motion) are already expensive.

### 1.4 Quality and maintainability

* **Error handling**: every function that crosses an "untrusted" boundary (URL parsing, storage reads, response to a runtime message) validates its input and returns an explicit `Result`-like value (e.g. `{ ok: true, value } | { ok: false, error }`) instead of throwing unhandled exceptions in the main flow; genuine exceptions (bugs, impossible states) may still propagate but must be caught at a known boundary (top level of the background, React error boundary in the popup) and logged consistently, never silenced with empty `catch {}`.
* **Pure functions wherever possible**: all logic in `lib/` (growth engine, score calculation, blocklist matching, palette hash) is pure: same input → same output, no side effects, no non-injected dependency on `Date.now()` (the current time must be passed as a parameter, never read internally) — this is what makes it possible to test in isolation without mocking the browser. The same applies to randomness: `building-composer.ts` and `decoration-engine.ts` never call `Math.random()` internally, but receive a seeded pseudo-random generator as a parameter (e.g. a seed derived from the session id), so the same session always produces the same city in tests, while session-to-session variety is still guaranteed in production.
* **Comments**: only where the *why* is not obvious from the code (e.g. "the minimum tick is 60s due to a `browser.alarms` platform limit, so the UI countdown between two ticks is estimated via `Date.now()` on the popup side and reconciled at the next alarm"). Comments that repeat what the code already says are forbidden.
* **Minimal external dependencies**: only those already listed in the source document's tech stack (`wxt`, `zustand`, `framer-motion`, `tldts`, TexturePacker as an offline external tool, the testing libraries). Before adding new ones while implementing a task, verify that a solution doesn't already exist in the stack or can't be written in a few pure lines.
* **Version control — commit only via the `commit` skill**: the agent may create commits **only** by using the project skill `.claude/skills/commit/SKILL.md` (English Conventional Commits message, no references to Claude/AI, sensitive-data scan, explicit confirmation when on `main`), and only when the user asks for a commit. Direct `git commit` outside the skill, and `git push`, `git tag`, `git merge`, `git rebase`, `git reset` or any other history-writing command, remain **forbidden** unless the user explicitly asks (push) — otherwise use git in **read-only** mode (`git status`/`log`/`diff`/`show`/`rev-parse`). In the changelog, the hash is reported only for already-existing commits, otherwise `—`/`to be committed`.

---

## 4. Updating the changelog

On completing a roadmap task, before declaring it done, use the `changelog` skill (`.claude/skills/changelog/SKILL.md`). A task without a changelog entry is not done. The skill holds the full procedure, entry format and final checklist. Commits follow the rule in §1.4 (only via the `commit` skill, on the user's request).

---

## 3. Testing strategy (TDD)

### 3.1 General rule — red/green/refactor cycle

For every task in Milestones 1–4 that produces non-purely-declarative logic (thus excluding scaffolding-only tasks like M0.T1, M0.T5), the workflow is:

1. **Red** — write the test that describes the expected behavior of the acceptance criterion, verify that it fails (or doesn't compile, if the module doesn't exist yet).
2. **Green** — write the minimum code needed to make the test pass.
3. **Refactor** — polish the code (naming, function extraction, applying the principles of Section 1.1) while keeping the tests green.

This applies particularly strictly to everything living in `lib/` (pure functions): having no browser dependencies, there's no excuse for writing the implementation before the test. For purely presentational React components (e.g. `TimerDisplay`), it's acceptable to first write a minimal rendering test ("the component mounts and shows the expected text") and then iterate.

### 3.2 Tools by test type

| Type | Tool | Scope |
|---|---|---|
| Unit | `vitest` | Pure functions in `lib/`, individual Zustand slices in isolation (store instantiated ad-hoc in the test, not the whole app). |
| Component | `vitest` + `happy-dom` + `@testing-library/react` + `@testing-library/user-event` | Individual React components: rendering, user interaction, assertions on text/attributes/calls to mocked store actions. |
| Integration | `vitest` + `wxt/testing` (`fakeBrowser`) | Interaction between multiple modules with mocked browser APIs: background + store + alarm provider + DNR; content script + message bus. |
| E2E | `@playwright/test` (Chromium only) | Complete user scenarios with the real extension loaded in a real browser: starting the timer, overlay on a blocked site, applying a preset. |

Note: `@testing-library/jest-dom` extends `vitest`/`expect` matchers for readable DOM assertions (e.g. `toBeInTheDocument`, `toHaveTextContent`) and must be configured in `tests/setup.ts` (M0.T3).

### 3.3 / 3.4 Test mapping and critical-logic priority

Per-task edge cases (3.3) and the priority order for critical logic (3.4) live in `docs/testing-matrix.md`. Grep the row for your task ID; read 3.4 only when touching timer persistence, URL parsing, blocking, score/malus or palette code, and re-run those tests when a module they depend on changes.

---

<!-- REPOWISE_DISTILL:START — Do not edit below this line. Auto-generated by Repowise. -->
### Output Distillation

- Prefer `repowise distill <cmd>` for noisy commands — test runs, builds, `git status`/`log`/`diff`, searches, file listings. It runs the command unchanged (exit code preserved) and prints a compact, errors-first rendering; every error line survives.
- Output may contain a marker like `[repowise#a1b2c3d4e5f6: 230 lines omitted (~6.1k tokens); restore: repowise expand a1b2c3d4e5f6]`. The omitted content is fully preserved — run `repowise expand <ref>` to retrieve it, or `repowise expand <ref> -q <regex>` for just the matching lines.
- Never re-run a command to see omitted output; expand the marker instead.
- For structure-level questions about a large indexed file ("what's in here", "which function handles X"), `get_context(["path"], include=["skeleton"])` returns the file with bodies elided — every signature plus the bodies of the most central symbols — at a fraction of the cost of a full Read.
<!-- REPOWISE_DISTILL:END -->
