# Project structure (target layout)

> Reference file. Read on demand when creating or moving files; not loaded automatically.

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
│   │   ├── calculate-score.ts   # Excellent/Great/Good/Bad from the completion bands (CR3)
│   │   ├── calculate-population.ts # tiered rate per character by completion band + 7% completion bonus (CR3)
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
