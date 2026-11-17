# Project structure (target layout)

> Reference file. Read on demand when creating or moving files; not loaded automatically.

Folder structure consistent with a WXT project (explicit entrypoints + shared code isolated from them):

```
timer-focus/
├── entrypoints/
│   ├── background.ts            # orchestrator: alarms, DNR, messages
│   ├── city/                    # CR6.T11: the full-city page (`city.html`), read-only, free camera
│   │   ├── index.html
│   │   ├── main.tsx             # attaches the store sync, mounts App in the ErrorBoundary
│   │   ├── App.tsx              # title, hint and `<CityPanel full />`
│   │   └── style.css            # page layout; the stage styles are `components/city/city-panel.css`
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── content/
│       └── blocked-overlay.content.ts   # content script, mounts Shadow DOM
├── components/                  # pure, reusable React components
│   ├── city/
│   │   ├── three/               # the 3D view's renderer shell (CR6): lifecycle, camera, meshes; no store, no browser APIs
│   │   │   ├── city-renderer.ts    # create / resize / invalidate / dispose, draws only when the scheduler says
│   │   │   ├── renderer-context.ts # WebGL renderer, orthographic camera, limited orbit controls
│   │   │   ├── capture-frame.ts    # CR6.T10: one frame at a size as an image, view restored (testable host)
│   │   │   ├── city-renderer.types.ts # CityRenderer, CityRendererOptions, FrameSource
│   │   │   ├── city-scene.ts       # the whole city for the renderer: meshes + animations + ambient layer + labels (CR6.T7)
│   │   │   ├── city-meshes.ts      # ground, grid, roads, instanced floors and windows, edge lines (CR6.T6b)
│   │   │   ├── floor-slots.ts      # draws one floor slot: resting, partly paid, shifted, glitching (CR6.T7)
│   │   │   ├── floor-animations.ts # a new floor drops in, a removed one glitches out, damaged floor flickers (CR6.T7)
│   │   │   ├── ambient-layer.ts    # lamps, beacons, window flicker, rain, cars and the neon signs as four draw calls (CR6.T7)
│   │   │   ├── neon-signs.ts       # vertical neon signs: one mesh of flat glowing strips, whole-sign buzz (post-CR6)
│   │   │   ├── ambient-motion.ts   # the rain and cars meshes (CR6.T7)
│   │   │   ├── city-labels.ts      # `> NAME` tags on landmark towers, one texture, one mesh (CR6.T7)
│   │   │   └── post-processing.ts / crt-pass.ts  # half-size bloom and the switchable CRT pass (CR6.T6b)
│   │   ├── OpenCityPageButton.tsx # CR6.T11: "View full city" opens `/city.html` in a new tab
│   │   ├── city-panel.css       # the City stage, HUD, fallback and button styles (popup and full page)
│   │   ├── CityPanel.tsx        # CR6.T8a: the City tab's stage, HUD line and screen-reader summary; lazy-loads CityView3D
│   │   ├── CityView3D.tsx       # CR6.T8a: mounts the renderer and wires the selectors (the lazy three.js chunk)
│   │   ├── city-capture.ts      # CR6.T10: bridge from the lazy 3D view to the export button
│   │   ├── CityFallback.tsx     # CR6.T8b: the plan as text where WebGL2 is missing or lost
│   │   ├── webgl-support.ts     # CR6.T8b, #22: `probeWebGl2()` (the context the renderer reuses) and `afterFirstPaint()`
│   │   ├── use-city-view.ts     # #22: loading line, WebGL2 check after the first paint, plain dynamic import of CityView3D
│   │   ├── use-city-renderer.ts # CR6.T8a: renderer lifecycle (size, visibility, reduced motion, dispose)
│   │   ├── use-city-summary.ts  # CR6.T8a: live summary for the HUD, milestone summary for screen readers
│   │   └── ExportCityButton.tsx # export the city as JPEG/PNG (the text city until CR6.T10 adds the 3D capture)
│   ├── timer/
│   │   ├── TimerControls.tsx
│   │   ├── TimerDisplay.tsx     # hh:mm:ss format (the clock inside the drum)
│   │   ├── DurationDrum.tsx     # duration picker while idle, the clock in a session (UI.T9)
│   │   ├── DrumRow.tsx / DrumRuler.tsx
│   │   ├── use-drum-gesture.ts / use-drum-wheel.ts / use-drum-commit.ts
│   │   └── duration-drum.styles.ts
│   ├── blocklist/
│   │   ├── PresetPicker.tsx     # built-in and saved presets as toggles (CR4)
│   │   ├── SiteList.tsx         # the single blocked-sites list
│   │   ├── SiteEntry.tsx        # one row: domain, source chips, remove
│   │   └── site-list.styles.ts
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
│   ├── browser/
│   │   └── open-extension-page.ts # CR6.T11: opens one of the extension's own pages in a new tab (injectable API, `Result`)
│   ├── blocking/
│   │   ├── rules.ts             # generates declarativeNetRequest rules
│   │   └── presets.ts           # preset data (Social, Video, etc.)
│   ├── city/
│   │   ├── plan/                # CR6: the seeded city plan, pure (roads, lots, buildings, floors, colors, scene data)
│   │   ├── render-scheduler.ts  # CR6: when a frame is due (pure)
│   │   ├── camera-framing.ts    # CR6: fixed isometric framing and orbit limits (pure)
│   │   ├── plan/plan-skyline.ts # CR6.T8b: plan + visible floors → ASCII rows (the fallback), in `plan/`
│   │   ├── ambient-plan.ts      # CR6.T7: seeded car routes, flicker schedule, rain; time → position/level (pure)
│   │   ├── floor-motion.ts      # CR6.T7: timeline of the floor animations (drop, glitch, crack), ends at rest (pure)
│   │   ├── migrate-city.ts      # CR6: persist v1–v3 city → `{ sessionId }`
│   │   ├── export-image.ts      # 3D frame capture or text city rows → SVG → JPEG/PNG
│   │   └── rasterize-image.ts   # SVG → canvas → data URL
│   ├── score/
│   │   ├── calculate-score.ts   # Excellent/Great/Good/Bad from the completion bands (CR3)
│   │   ├── calculate-population.ts # tiered rate per character by completion band + 7% completion bonus (CR3)
│   │   └── malus-escalation.ts  # the escalating malus schedule (M4.T1, moved into the score by CR6.T5b)
│   └── timer/
│       ├── alarm-adapter.ts     # interface + implementation for browser.alarms
│       └── duration-drum.ts     # pure index/motion math of the Duration Drum (UI.T9)
├── assets/                      # static images (the city is drawn from code, no sprites or ASCII modules)
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
