# 1 -- Design Principles

| Principle | Concrete application in the project |
|---|---|
| **S — Single Responsibility** | Every module has a single reason to change. Example: URL parsing logic (`tldts`) lives in `lib/url/domain.ts` and knows nothing about `declarativeNetRequest`; the module that generates DNR rules (`lib/blocking/rules.ts`) knows nothing about React. A component like `CityCanvas.tsx` is only responsible for rendering, not for computing the score. |
| **O — Open/Closed** | Blocklist presets (Social, Video, etc.) are defined as data (an array of `Preset` objects), not hardcoded `if/else`: adding a new preset doesn't require modifying the preset-application logic, only adding an element to the list. Same approach for the "palettes by building tier": the hash→color function is generic and accepts a palette as a parameter, with no colors wired in. |
| **L — Liskov Substitution** | "Adapter" interfaces (e.g. `AlarmProvider`, `StorageAdapter`) must be substitutable with a fake/mock in tests without changing the caller's expected behavior. E.g. in tests, a `FakeAlarmProvider` that advances time manually must honor the same contract (`schedule`, `clear`, `onFire`) as the real provider based on `browser.alarms`. |
| **I — Interface Segregation** | No "big" interfaces: the Zustand store is split into slices (`timerSlice`, `citySlice`, `blocklistSlice`, `scoreSlice`), each with its own typed interface, so a component that only reads the timer has no (type-level) dependency on the city slice. |
| **D — Dependency Inversion** | "Core" modules (score calculation, malus calculation, city growth engine) never import browser APIs directly (`browser.alarms`, `browser.storage`, `declarativeNetRequest`). They depend on abstract interfaces injected from the outside (background script / popup), so they stay testable in Node/happy-dom without heavy browser mocks. |
| **Separation of Concerns** | Three separate "worlds" that communicate only through the persisted store and typed messages: (1) **background** — timer, alarms, DNR rules, score/malus calculation; (2) **content script** — only the blocked-site alert overlay, no business logic; (3) **popup/UI** — presentation only (ASCII city, timer controls, preset management), reads state but never computes it. |
| **DRY** | Domain normalization logic (via `tldts`) is centralized in a single function (`getRegistrableDomain(url)`), used by the allowlist/blocklist matcher, the DNR rule generator, and the palette hash alike — never duplicated. |
| **KISS** | The city growth engine composes buildings from a finite set of predefined ASCII modules (bases, floors, roofs — see `tile-library.ts`) selected procedurally, rather than generating them algorithmically character-by-character from scratch: variety comes from combining modules, not from a complex procedural engine. Optimization with TexturePacker/sprite sheets remains deferred (see Milestone 4) and must not complicate the ASCII MVP. |
| **YAGNI** | No third-party preset plugin system, no multi-language support, no multi-device sync are built up front: none of this is in the source document. Only what's explicitly requested gets implemented; any future extension should be proposed as a new task, not anticipated in the current code. |

> **Technical note — two distinct clocks.** The document requires that city characters be inserted one at a time every 2 seconds, while `browser.alarms` (used for timer persistence, see M1.T5) has a minimum tick of 60 seconds due to platform constraints. The two mechanisms **must not be confused**: `browser.alarms` remains the single source of truth for countdown persistence across service worker restarts; the character-insertion tick every 2s is instead a fine-grained timer (`setInterval`/`requestAnimationFrame`-based) that lives on the popup/background side only while the context is active, and is recalculated deterministically (characters due = elapsed focus time ÷ 2s) every time the context wakes up — exactly as already planned for the second-by-second countdown in Section 1.4.

# 2 -- Code Organization

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
│   │   ├── tile-library.ts      # library of composable ASCII modules (bases, floors, roofs)
│   │   ├── building-composer.ts # composes a building from modules based on time/minutes unlocked
│   │   ├── growth-engine.ts     # computes the state of the three layers from elapsed time
│   │   ├── decoration-engine.ts # procedural details (lit windows, trees, cars, clouds)
│   │   ├── theme-registry.ts    # color themes/biomes available per session
│   │   ├── palette.ts           # domain hash → deterministic color (within the active theme)
│   │   └── export-image.ts      # canvas/DOM city serialization → JPEG/PNG
│   ├── score/
│   │   ├── calculate-score.ts   # Excellent/Good/Bad — exact formula: open point, see §4
│   │   ├── calculate-population.ts # +5 per house, +15 per building floor
│   │   └── apply-malus.ts       # character-by-character deletion of the affected building
│   └── timer/
│       └── alarm-adapter.ts     # interface + implementation for browser.alarms
├── assets/
│   └── ascii/                   # static ASCII frames/modules (bases, floors, roofs, decorations)
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
* **Recommended maximum size**: file ≤ 200 lines (excluding tests), function ≤ 40 lines. Exceeding these limits is a signal that the module/function has more than one responsibility and should be broken down (see the S principle).
* **React components**: one component per file, at most one level of private, non-exported sub-components in the same file if purely presentational (e.g. a single `<CityCell>` cell rendered by `<CityCanvas>` still goes in its own file if it exceeds ~30 lines).
* **Strict TypeScript**: `strict: true` mandatory in `tsconfig.json`. Explicit `any` is forbidden (use `unknown` + narrowing). Every exported function has explicit return types. Messages exchanged between background/content/popup are typed with discriminated unions (e.g. `type RuntimeMessage = { type: 'TIMER_TICK'; payload: ... } | { type: 'SITE_BLOCKED'; payload: ... }`), never `any`/free-form objects.
