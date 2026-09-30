# Project Overview — Focus Timer (BuildIt)

> Productivity browser extension: focus timer with ASCII city-builder city, allowlist/blocklist with malus, scoring system.
> Stack: React, WXT, Zustand (`persist`), `declarativeNetRequest`, `browser.alarms`, `framer-motion`, Content Scripts + Shadow DOM, `tldts`, `@wxt-dev/i18n` (EN/IT internationalization based on `browser.i18n`).
> Default package manager: **bun** (all installation, script execution, and dependency management commands use bun, not npm/pnpm/yarn).

---

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
| **DRY** | Domain normalization logic (via `tldts`) is centralized in a single function (`getRegistrableDomain(url)`), used by the allowlist/blocklist matcher, the DNR rule generator, and the palette hash alike — never duplicated. |
| **KISS** | The city growth engine composes buildings from a finite number of predefined ASCII modules (bases, floors, tops — see `tile-library.ts`) selected procedurally, not algorithmically generated character-by-character from scratch: variety comes from combining modules, not from a complex procedural engine. Optimization with TexturePacker/sprite sheets remains deferred (see Milestone 4) and must not complicate the ASCII MVP. |
| **YAGNI** | No plugin system for third-party presets is built from the start, nor multi-device sync: none of this is in the source document. Only what is explicitly requested is implemented; any future extension should be proposed as a new task, not anticipated in the current code. **Exception**: multi-language support (i18n) is explicitly required from the start (EN default, IT), and must be implemented with the official WXT module `@wxt-dev/i18n`, choosing the language **automatically from the browser's language** (IT only if the browser is set to Italian, otherwise EN) — no manual selector — and in a way that makes adding new languages trivial (see M3.T9). |

> **Operative note - roadmap file**: the tasks mentioned in this document are defined in `docs/roadmap-en.md`. The roadmap contains the development plan of the project: it defines the milestones, tasks, and acceptance criteria. The agent doesn't need to read the roadmap alongside this document, it will only read it when the user requests it.

> **Operative note - context**: the agent must read only the relevant files for the task at hand, not the entire codebase. The roadmap and the changelog are the only two documents that are always read in full, because they contain the global context of the project.

> **Technical note — two distinct clocks.** The document requires that city characters be inserted one at a time every 2 seconds, while `browser.alarms` (used for timer persistence, see M1.T5) has a minimum tick of 60 seconds due to a platform constraint. The two mechanisms **must not be confused**: `browser.alarms` remains the sole source of truth for persisting the countdown across service worker restarts; the 2s character-insertion tick is instead a fine-grained timer (`setInterval`/`requestAnimationFrame`-based) that lives on the popup/background side only while the context is active, and is deterministically recalculated (number of characters due = elapsed focus time ÷ 2s) every time the context wakes up, exactly as already planned for the second-by-second countdown in Section 1.4.

### 1.2 Code organization

Folder structure consistent with a WXT project (explicit entrypoints + shared code isolated from them):

```
timer-focus/
├── entrypoints/
│   ├── background.ts            # orchestrator: alarms, DNR, messages
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── content/
│       └── blocked-overlay.content.ts   # content script, mounts Shadow DOM
├── components/                  # pure, reusable React components
│   ├── city/
│   │   ├── CityCanvas.tsx       # composes the three layers (background/middleground/foreground)
│   │   ├── CityLayer.tsx        # a single layer positioned absolute/overlay
│   │   ├── CityCell.tsx
│   │   ├── ThemeProvider.tsx    # applies the current session's color theme/biome
│   │   ├── ExportCityButton.tsx # export grid as JPEG/PNG
│   │   └── city.types.ts
│   ├── timer/
│   │   ├── TimerControls.tsx
│   │   └── TimerDisplay.tsx     # hh:mm:ss format
│   ├── blocklist/
│   │   ├── PresetPicker.tsx
│   │   ├── TagEditor.tsx
│   │   └── SiteList.tsx
│   ├── score/
│   │   ├── ScoreBadge.tsx
│   │   ├── PopulationCounter.tsx
│   │   └── SessionHistory.tsx   # last 5 sessions
│   └── common/                  # shared buttons, modals, etc.
├── store/
│   ├── index.ts                 # combines the slices, applies the persist middleware
│   ├── timer.slice.ts
│   ├── city.slice.ts
│   ├── blocklist.slice.ts
│   ├── score.slice.ts
│   ├── session-history.slice.ts # history of the last 5 sessions
│   └── store.types.ts
├── lib/                         # pure domain logic, no direct browser dependencies
│   ├── url/
│   │   └── domain.ts            # wrapper around tldts
│   ├── blocking/
│   │   ├── rules.ts             # generates declarativeNetRequest rules
│   │   └── presets.ts           # preset data (Social, Video, etc.)
│   ├── city/
│   │   ├── tile-library.ts      # library of composable ASCII modules (bases, floors, tops)
│   │   ├── building-composer.ts # composes a building from modules based on unlocked time/minutes
│   │   ├── growth-engine.ts     # computes the state of the three layers from elapsed time
│   │   ├── decoration-engine.ts # procedural details (lit windows, trees, cars, clouds)
│   │   ├── theme-registry.ts    # color themes/biomes available per session
│   │   ├── palette.ts           # domain hash → deterministic color (within the active theme)
│   │   └── export-image.ts      # city canvas/DOM serialization → JPEG/PNG
│   ├── score/
│   │   ├── calculate-score.ts   # Excellent/Good/Bad — exact formula: open point, see §4
│   │   ├── calculate-population.ts # +5 per house, +15 per building floor
│   │   └── apply-malus.ts       # character-by-character deletion of the affected building
│   └── timer/
│       └── alarm-adapter.ts     # interface + implementation for browser.alarms
├── assets/
│   └── ascii/                   # static ASCII frames/modules (bases, floors, tops, decorations)
├── locales/                     # @wxt-dev/i18n translation files (en.yml default, it.yml), see M3.T9
│   ├── en.yml
│   └── it.yml
├── utils/                       # generic, stateless helpers, no domain logic
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── wxt.config.ts
├── tsconfig.json
└── package.json
```

Conventions:

* **File naming**: `kebab-case.ts` for logic modules, `PascalCase.tsx` for React components, `.slice.ts` suffix for Zustand slices, `.types.ts` suffix for type-only files, `.content.ts` suffix for content scripts.
* **Function/variable naming**: `camelCase`; boolean functions prefixed with `is`/`has`/`should` (e.g. `isDomainBlocked`); pure functions that compute a new state prefixed with `compute`/`calculate` (e.g. `calculateScore`, `computeCityGrowth`).
* **Recommended maximum size**: file ≤ 200 lines (tests excluded), function ≤ 40 lines. Exceeding these limits is a signal that the module/function has more than one responsibility and should be broken down (see principle S).
* **React components**: one component per file, at most one level of unexported private sub-components in the same file if purely presentational (e.g. a single `<CityCell>` cell rendered by `<CityCanvas>` still goes in its own file if it exceeds ~30 lines).
* **Strict TypeScript**: `strict: true` mandatory in `tsconfig.json`. Explicit `any` is forbidden (use `unknown` + narrowing). Every exported function has explicit return types. Messages exchanged between background/content/popup are typed with discriminated unions (e.g. `type RuntimeMessage = { type: 'TIMER_TICK'; payload: ... } | { type: 'SITE_BLOCKED'; payload: ... }`), never `any`/free-form objects.

### 1.3 State management (Zustand)

* **Persisted store** (`persist` middleware, `browser.storage.local` backend via a custom adapter): everything that must survive a browser restart and represents "historical" data or user configuration —
  * the city state **of the current, in-progress session** (grid/layers, buildings, palettes assigned to domains, active theme) — needed to survive a service worker restart during a still-active session; it is instead reset and regenerated from scratch when a new focus session starts (one city per session, see Section 2);
  * allowlist/blocklist configuration, custom presets and their tags;
  * history of the last 5 completed sessions (score and, if applicable, city screenshot/reference — see M2.T18);
  * user preferences (e.g. Good/Bad thresholds if made configurable).
* **Volatile store** (not persisted, reset on every service worker/popup startup): everything that is derived or transient —
  * the fine-grained "in progress" timer (current seconds not yet rounded to the 60s tick — still needs to be reconciled with `browser.alarms`, which is the source of truth for actual countdown persistence, see §3.4, and with the 2s character-insertion tick, see the technical note at the start of Section 1);
  * UI state (active tab in the popup, open modals, hover on a city cell);
  * temporary flags (e.g. "currently showing the malus alert").
* **Coupling rule**: React components never call chrome.*/browser.* APIs directly and **never** contain computation logic (score, growth, blocklist matching). A component reads state via dedicated Zustand selectors (e.g. useTimerStore(selectRemainingSeconds)) and **only invokes** actions exposed by the store (e.g. useTimerStore.getState().pauseTimer()); the action internally delegates to a pure function in lib/ and/or sends a message to the background. This decouples the UI from the implementation and makes slices testable without mounting components.
* Each slice exposes granular selectors (not a single selector returning the whole slice) to minimize unnecessary re-renders in a context where animations (framer-motion) are already expensive.

### 1.4 Quality and maintainability

* **Error handling**: every function that crosses an "untrusted" boundary (URL parsing, storage reads, response to a runtime message) validates its input and returns an explicit `Result`-like value (e.g. `{ ok: true, value } | { ok: false, error }`) instead of throwing unhandled exceptions in the main flow; genuine exceptions (bugs, impossible states) may still propagate but must be caught at a known boundary (top level of the background, React error boundary in the popup) and logged consistently, never silenced with empty `catch {}`.
* **Pure functions wherever possible**: all logic in `lib/` (growth engine, score calculation, blocklist matching, palette hash) is pure: same input → same output, no side effects, no non-injected dependency on `Date.now()` (the current time must be passed as a parameter, never read internally) — this is what makes it possible to test in isolation without mocking the browser. The same applies to randomness: `building-composer.ts` and `decoration-engine.ts` never call `Math.random()` internally, but receive a seeded pseudo-random generator as a parameter (e.g. a seed derived from the session id), so the same session always produces the same city in tests, while session-to-session variety is still guaranteed in production.
* **Comments**: only where the *why* is not obvious from the code (e.g. "the minimum tick is 60s due to a `browser.alarms` platform limit, so the UI countdown between two ticks is estimated via `Date.now()` on the popup side and reconciled at the next alarm"). Comments that repeat what the code already says are forbidden.
* **Minimal external dependencies**: only those already listed in the source document's tech stack (`wxt`, `zustand`, `framer-motion`, `tldts`, TexturePacker as an offline external tool, the testing libraries). Before adding new ones while implementing a task, verify that a solution doesn't already exist in the stack or can't be written in a few pure lines.
* **Version control — the agent never commits**: the agent **never** runs `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, or other commands that write to the repository history (it may only use git in **read-only** mode: `git status`/`log`/`diff`/`show`/`rev-parse`). All changes (code, tests, changelog) are left **uncommitted**, ready for review and commit by the human developer; in the changelog, the hash is reported only for already-existing commits, otherwise `—`/`to be committed`.

---

## 4. Updating the changelog

> Process document for AI agents. Describes **when** and **how** to update `docs/changelog.md` every time a task from `docs/roadmap-en.md` is completed.

### 4.1 General rule (mandatory)

Every time you complete a roadmap task (Milestone 0–4), **before declaring the task done** you must update `docs/changelog.md`. The changelog is an integral part of a task's Definition of Done: a task without an entry in the changelog is to be considered not done.

This also applies to partial tasks: if you only complete part of a task, update the entry with the actual status (e.g. `partial`) and note what remains.

### 4.2 Version control — the agent NEVER commits or pushes

- The agent **never runs** `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, `git reset`, or any other command that writes to the repository history, whether directly or via indirect tools/aliases/scripts.
- The agent may use git **read-only** (`git status`, `git log`, `git diff`, `git show`, `git rev-parse`) to gather information (e.g. the hash of an already-existing commit).
- All changes (code, tests, changelog) are left **uncommitted**: it is always the human developer who reviews and commits.
- As a result, the changelog's `Commit` column **cannot** be filled in by the agent at task time: the developer fills it in after committing. Until the commit exists, the agent writes `—` (or `to be committed`) and **never makes up a hash**.

### 4.3 When to update

Update the changelog **immediately after** verifying the task's acceptance criteria, in the same context/work session in which you prepare the implementation (the changes remain **uncommitted**, see the "Version control" section):

- after the task's tests pass (`bun run test`);
- after the type-check is clean (`bun run compile`);
- after confirming the acceptance criteria listed in the task card.

Don't put off the update for "later": write the entry while you still remember exactly what you did, which files you touched, and which criteria you covered.

### 4.4 How to update (step-by-step procedure)

1. **Read the current state** of `docs/changelog.md` and the task card in `docs/roadmap-en.md` (§2).
2. **Fill in/correct the "Commit" column**: if the developer has already committed the task, you may read the existing hash in read-only mode (`git log --oneline -1`, `git rev-parse --short HEAD`) and insert it. If the task hasn't been committed yet (the normal case, since the agent never commits: see "Version control"), write `—` / `to be committed` and do not make up any hash.
3. **Update the "Current status" section**:
   - move the "Updated to: **<task ID>**" marker;
   - update the milestone status (completed / in progress, with the list of tasks done and those remaining);
   - update the **test counts** (`bun run test` → N passing tests across M files) and the type-check status;
   - if you touched the number of test files or the total test count, the numbers must reflect reality: don't copy them from the past.
4. **Add a row to the "Completed tasks summary" table** with: `ID`, `Title` (from the roadmap), `Status`, `Commit`.
5. **Add the task's detail entry** in the correct milestone section, following the standard format (below).
6. **Update the "Dependencies added" table** if the task introduced new runtime or dev dependencies (with the exact version from `package.json`/`bun.lock`).
7. **Update "Open issues and points to clarify"**: add newly discovered issues; remove ones resolved by this task. If the task resolves an existing issue, move it out of the list and mention its resolution in the task's entry.
8. **Don't touch** sections unrelated to the task (avoid noise in the diff).

### 4.5 Detail entry format (mandatory)

For each completed task, add a sub-section (`###`) in the milestone's group, using this schema:

```markdown
### <ID> — <Title from the roadmap>
- <What was implemented, in terms of concrete API/behavior, not mere intentions.>
- Files created/modified: `<path>` (with a brief description if not obvious from the name).
- Dependencies added: `<package>` `<version>` (reason) — or "none".
- Tests: `<test path>` (N tests, <unit|integration|component>) — cases covered, briefly.
- Relevant notes/decisions: (e.g. deferred open point, design choice, behavior for an edge case).
- Acceptance criteria: <verified / partial — explain what's missing>.
```

### 4.6 Content rules

- **Write what was actually done**, verifiable from the code and the tests. Don't make up files, functions, tests, or commits that don't exist: if in doubt, check with `git show`/`git diff` and the real files.
- **No redundant detail**: don't paste entire files; describe the public API and the relevant behavior.
- **Precise references**: use the real file paths and the real commit hashes.
- **Truthful numbers**: test counts, dependency versions, and lint/type-check status must be the actual ones at the time of the update.
- **Respect the document's language**: the changelog is in **English**.
- **Style**: concise, bullet lists, tables where already present. Stay consistent with the existing formatting (don't reformat untouched sections).
- **One task = one entry**: don't merge multiple tasks into a single entry, and don't split one task across multiple entries.

### 4.7 Distinction between "completed" and "nice-to-have"

- If the task is marked *(Nice to have)* in the roadmap, indicate this in the entry (e.g. `status: completed (nice-to-have)`).
- If the task was **skipped** or **deferred**, don't add it to the completed-tasks table: note the deferral (and the reason) in "Open issues and points to clarify" or in a status note.

### 4.8 Final verification of the update

> Remember: the agent **never commits** (see "Version control"). This checklist should be run before concluding the task and leaving the changes ready for human review.

Before concluding the task, check that:

- [ ] exactly one detail entry exists for the task just completed;
- [ ] the summary table contains the task's row; the `Commit` column shows a real hash only if the commit already exists, otherwise `—` / `to be committed`;
- [ ] "Current status" and the counts (test / type-check) reflect reality;
- [ ] new dependencies are listed with the exact version;
- [ ] resolved issues have been removed and new ones added;
- [ ] no unrelated section has been altered.

If any of these points is not satisfied, the changelog update is incomplete.

### 4.9 Minimal update example

For the completion of a hypothetical `M1.T4`:

1. table row: `| M1.T4 | Zustand store — skeleton + slice combination | completed | — (to be committed) |` (the real hash is added by the developer after the commit)
2. detail entry:

```markdown
### M1.T4 — Zustand store — skeleton + slice combination
- `store/index.ts` combines the slices (stubs) with the `persist` middleware, using `browserStorage` (M1.T3); `partialize` excludes volatile fields (fine-grained timer, UI state, temporary flags).
- Files created/modified: `store/index.ts`, `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`.
- Dependencies added: none.
- Tests: `tests/unit/store/store.test.ts` (N tests, unit+integration) — persisted field survives "restart"; volatile field resets to default.
- Notes: exports a single `useAppStore` hook + granular per-slice selectors.
- Acceptance criteria: verified.
```

3. update to "Current status" (test count, "Updated to: M1.T4" marker).

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
| M2.T4 (`blocklistSlice`) | Unit | vitest | Adding a domain already present in the allowlist while adding it to the blocklist (or vice versa); removing a nonexistent domain. |
| M2.T5 (presets data) | Unit | vitest | Data structure validation (every preset has at least one domain, non-empty tag). |
| M2.T6 (DNR rules) | Unit | vitest | Empty blocklist → no rules; the same domain duplicated in the blocklist → a single rule; allow/block conflict on the same domain → allowlist wins (acceptance criterion). |
| M2.T21 (input normalization) | Unit + Integration | vitest (+ `wxt/testing`) | "Bare" public suffix (`co.uk`, `com`) rejected with "Enter a valid URL"; same input → same canonical form from entry and from navigation check; malformed URL during check does not crash and does not incorrectly block. |
| M2.T7 (apply DNR rules) | Integration | vitest + `wxt/testing` | Blocklist changes while `status !== 'running'` → no call to `updateDynamicRules` (or agreed-upon behavior, see §4). |
| M2.T8 (overlay content script) | Component (for `BlockedOverlay.tsx`) + Integration (for the content script) | Testing Library, vitest + `wxt/testing` | Overlay mounted twice on the same page (idempotence); message sent to the background when the background doesn't respond (timeout). |
| M2.T9 (calculate score) | Unit | vitest | Values exactly on the boundaries (0, 0.2, 0.5, 1.0); values out of range [0,1] (defensive input). |
| M2.T10 (apply malus) | Unit | vitest | Malus applied when the city is already "empty" (no building to destroy: behavior must be explicit, not a crash). |
| M2.T11 (`citySlice`) | Unit | vitest | `destroyBuilding` on out-of-grid coordinates. |
| M2.T12 (growth engine) | Unit | vitest | Zero time delta (no-op); very large delta (beyond grid capacity: behavior to be clarified, see §4); grid already completely full. |
| M2.T13 (palette) | Unit | vitest | Empty domain string; domain with Unicode characters (IDN). |
| M2.T14 (CityCanvas/CityCell) | Component | Testing Library | Empty grid (no buildings); grid with all cells `destroyed`. |
| M2.T15 (growth ↔ tick) | Integration | vitest + `wxt/testing` | A tick occurring while `status === 'paused'` (must not make the city grow). |
| M2.T16 (malus ↔ destruction) | Integration | vitest + `wxt/testing` | Two malus events in close succession (no double application unless intentional). |
| M2.T17 (ScoreBadge) | Component | Testing Library | State transition from `excellent` to `bad` between two consecutive renders. |
| M3.T1 (PresetPicker) | Component | Testing Library | Applying two presets with overlapping domains (no resulting duplicate, reuses the M2.T4 logic). |
| M3.T2 (TagEditor) | Component | Testing Library | Tag with a duplicate name (case-insensitive?); removing a tag still assigned to sites. |
| M3.T3 (SiteList) | Component | Testing Library | Empty/whitespace input; input that `tldts` cannot parse or a "bare" public suffix (`co.uk`) → "Enter a valid URL" message (visible error feedback). |
| M3.T4 (App.tsx) | Integration (component-level) | Testing Library | Full flow: open popup → apply preset → start timer → simulate tick → verify that both the timer and the city update in the same render tree. |
| M3.T5 (animations) | Component | Testing Library (with `framer-motion` mocked/disabled if needed for determinism) | No assertions on real animation timings in unit/component tests (fragile); only that the final state is correct. |
| M3.T9 (i18n setup `@wxt-dev/i18n`) | Component (+ Integration) | Testing Library, vitest + `wxt/testing` | A component using `i18n.t(key)` renders the expected EN string; with the browser locale forced to IT it renders the IT string. |
| M3.T10 (IT translation, auto from browser) | Component + Unit (drift detection) | Testing Library, vitest | All EN keys have an IT counterpart (comparing the `en.yml`/`it.yml` trees, fails if an IT key is missing); no manual selector nor persisted preference present. |
| M3.T6 (multi-browser) | Manual + preparation for M4.T5 | — | — |
| M3.T7 (mobile layout) | Component (snapshot/viewport) | Testing Library with forced viewport, or manual verification | — |
| M4.T1 (proportional malus) | Unit | vitest | Monotonic property tested with several increasing time values (simple property-based test or case table). |
| M4.T2 (TexturePacker) | Component (manual visual regression) | — | — |
| M4.T3 (logging) | Unit + Integration | vitest | An error thrown at a known point is actually logged (spy on the logger) and does not propagate up to crash the listener. |
| M4.T4 (accessibility) | Component (a11y) | Testing Library + possibly `jest-axe` (to be evaluated whether to add it, see Section 1.4 on minimal dependencies) | — |
| M4.T5 (e2e) | E2E | Playwright | The three scenarios listed in the task's acceptance criterion, plus a fourth regression scenario: Firefox build with the same timer scenario (if Playwright + Firefox is available, otherwise Chromium only per the document's constraint). |
| M5.T1 (message bus hardening) | Integration | vitest + `wxt/testing` | Malformed/forged message (unknown type, missing fields, wrong types) → no crash and no mutation; `tabId` in the payload ignored and derived from `sender.tab.id`; sender with `id !== browser.runtime.id` rejected. |
| M5.T2 (domain hardening) | Unit + Integration | vitest | Non-http schemes (`ftp://`, `file://`, `javascript:`, `data:`) → `{ ok: false }`; trailing dot and uppercase canonicalized; userinfo trick (`https://facebook.com@evil.com`) → real host; IDN/homograph → punycode; hostile corpus with no exceptions. |
| M5.T3 (DNR urlFilter) | Unit | vitest | Entry with `*` does not become a wildcard (no over-blocking); `||` prefix does not alter the anchoring; non-canonical entry rejected/neutralized; allow/block conflict → allowlist wins. |

### 3.4 Priority on critical logic

In absolute priority order (to be tested most thoroughly, with the most edge cases, and never left without coverage even under time pressure):

1. **Timer persistence via `browser.alarms`** (M1.T5, M2.T1, M2.T2) — this is the logic with the largest surface for "silent" bugs (a timer that resets to zero, duplicates, or doesn't resume after a service worker restart). Highest priority because a bug here breaks the user's trust in the entire "focus session" concept.
2. **URL parsing with `tldts`** (M1.T2) — this is the security/correctness foundation of the entire blocking system: a bug here can let through sites that should be blocked (or, conversely, block legitimate sites). It must be tested against a broad, heterogeneous set of real URLs, not just the "happy" cases.
3. **Site blocking logic** (M2.T6, M2.T7, M2.T21) — directly dependent on the previous point; the allowlist/blocklist conflict must be tested explicitly as a first-class case, not as a marginal edge case, with a fixed resolution rule: **the allowlist always wins** (M2.T6, M2.T20). Defensive input normalization (entry + navigation check, M2.T21) must also be treated as critical logic.
4. **Score and malus calculation** (M2.T9, M2.T10, M4.T1) — this is the heart of the "gamification" and of the user's sense of fairness: the boundaries between Excellent/Good/Bad must be exact and covered by parametric tests on all threshold values.
5. **Determinism of the building palette** (M2.T13) — lower priority than the previous ones (a "wrong" color doesn't break functionality), but determinism must still be guaranteed with repetition tests, because it's an explicit requirement of the source document ("the same building always has the same color").

These five points must also be re-verified (regression) every time a module they depend on is touched, even if the task being completed is nominally a different one (e.g. modifying `growth-engine.ts` for M4.T1 requires re-running the M2.T12 tests as well).

In addition to these, with **cross-cutting** priority, is **security hardening** (M5.T1–M5.T3): runtime validation of messages and sender provenance (`sender`), scheme restriction + canonicalization in `lib/url/domain.ts`, escaping of `urlFilter` in DNR generation. These are security prerequisites for critical logic items 1–3 and must be verified with a **hostile input corpus** (not just the happy path). These measures are additive with respect to tasks M1.T2/M1.T6/M2.T6 and do not modify their acceptance criteria.

---
