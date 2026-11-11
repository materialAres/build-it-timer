# Build-it! Timer Focus

A browser extension which (hopefully) helps you stay focused on your work: the more you focus, the more your neon 3D city grows!

## How it works

Start a focus session and every stretch of undistracted work (one 600th of the session) builds one character of progress; the city shows that progress as floors rising in the order of a plan generated for the session. Time on a blocked site takes characters back, and the longer you stay the more each moment costs: the first five moments cost one character each, then two, then three. The score, the population and the city all lose the same amount, and a damaged top floor shows the loss at once.

* **Timer** — start / pause / reset a countdown session. Remaining time is persisted and reconciled with the browser alarm clock, so it survives a service-worker restart.
* **Blocklist** — block distracting sites during a session only; everything else stays allowed, and there is no blocking outside a focus session. Sites can be added at any time before the session ends, including while it is running or paused; removing a site or editing presets needs the timer to be idle (before Start or after Reset).
* **Presets** — each built-in preset (Social, Video, …) is a toggle over the one list: switching it on adds its sites, switching it off removes only the sites nothing else asked for (a site you added by hand, or one from another active preset, stays). A preset can be switched on during a session but only off when the timer is idle. The current list can be saved as a named preset (up to 24 characters), renamed or deleted; deleting a preset never unblocks its sites.
* **Declarative Net Request** — blocked domains are translated into `declarativeNetRequest` rules that are applied exclusively while a session is `running`.
* **Score** — based on the percentage of the city built (focus characters minus the escalating distraction cost, never below 0; 60 s on a blocked site in a 30-minute session costs 44 characters): `bad` below 30%, `good` from 30%, `great` from 70%, `excellent` only at 100%. The badge updates live and drops back if distraction removes characters.
* **Population** — each character earns a rate by completion band (5 below 30%, 10 from 30%, 20 from 70%), and finishing the whole city adds a bonus of 7% of the population reached.
* **3D city** — a new city every session from a seed (streets, buildings, palette), drawn with three.js in the City tab only (a separate lazy chunk, about 148 KB gzipped) with rain, cars and tower names. It grows floor by floor from your focus, a distraction takes floors back and damages the top one, `prefers-reduced-motion` turns the motion off, and the view keeps a text summary for screen readers. Once a session is completed you can export the city as a 1600 × 900 PNG or JPEG: a frame of the 3D view as you left the camera (without the HUD line), or the text city on a black floor where WebGL is unavailable. "View full city" in the City tab opens the whole city in its own tab (`city.html`) on a large canvas with a free camera (turn all the way round, zoom, pan); it is read-only and follows the session live, and its ambient layer pauses while the tab is hidden.

## Tech stack

| Area | Choice |
|---|---|
| Language | TypeScript 5 (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |
| UI | React 19 |
| Extension framework | [WXT](https://wxt.dev) 0.21 (`@wxt-dev/module-react`), Manifest V3 |
| State | Zustand 5 with the `persist` middleware over `browser.storage.local` |
| Domain parsing | `tldts` |
| Unit / component tests | Vitest 5, Testing Library, `happy-dom`, `wxt/testing` (`fakeBrowser`) |
| E2E tests | Playwright (Chromium) |
| Lint / format | ESLint 9 (flat config) + Prettier 3 |
| Package manager | [Bun](https://bun.sh) |

## Project structure

```
entrypoints/        Extension entrypoints (background, content, popup)
  background.ts     Service-worker orchestrator (store, alarms, messages, DNR)
  content.ts        Content script
  popup/            React popup UI
components/         React components (city, timer, blocklist, score, common)
store/              Zustand store, slices, storage adapter, cross-context sync
lib/                Browser-free domain logic
  url/              Domain normalization (tldts)
  blocking/         Presets, DNR rule generation and application
  city/             Growth/composition engines (planned)
  score/            Score and malus logic (planned)
  timer/            Alarm adapter, timer restore, session ids
  messaging/        Typed message bus and message types
utils/              Pure helpers (duration formatting, Result type)
tests/              unit/ · integration/ · e2e/ · helpers/
docs/               Development plan, changelog, store analysis
```

## Getting started

Requirements: [Bun](https://bun.sh) and, for end-to-end tests, Playwright's Chromium (`bunx playwright install chromium`).

```bash
bun install          # install dependencies (runs `wxt prepare`)

# Development
bun run dev          # WXT dev server (Chrome)
bun run dev:firefox  # WXT dev server (Firefox)

# Build & package
bun run build            # Chrome (MV3) -> .output/chrome-mv3
bun run build:firefox    # Firefox (MV3) -> .output/firefox-mv3
bun run zip              # package for the Chrome Web Store
bun run zip:firefox      # package for Firefox Add-ons
```

`wxt dev` reuses the Chromium bundled with Playwright; set `CHROME_PATH` to override it.

### Multi-browser builds

Both targets are built as **Manifest V3** so the blocklist engine behaves identically everywhere: WXT defaults Firefox to MV2, but `declarativeNetRequest` is MV3-only on Firefox, so `manifestVersion: 3` is forced in `wxt.config.ts`. WXT then emits a `background.scripts` event page for Firefox (Firefox has no service-worker background) and a `service_worker` for Chrome. The generated manifests differ only in the background form and in the Firefox-only `browser_specific_settings` block (add-on id, `strict_min_version: "113.0"`, no data collection).

An **empty, enabled static DNR ruleset** (`public/rules/empty-rule-set.json`) is declared for both targets: Firefox ≤ 132 can silently drop dynamic DNR rules after a restart unless at least one static ruleset is present (Mozilla bug 1921353), so this keeps in-session blocking alive across restarts.

To verify manually: load `.output/chrome-mv3` via `chrome://extensions` → "Load unpacked", or `.output/firefox-mv3` via `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…". A full automated regression on Firefox is covered by Milestone 4 (M4.T5).

## Checks

```bash
bun run test          # unit + integration + component tests (Vitest)
bun run test:watch    # watch mode
bun run test:coverage # with coverage
bun run build && bun run e2e   # Playwright end-to-end suite on the built extension (E2E_GPU=1 for the real GPU)
bun run compile       # tsc --noEmit
bun run lint          # ESLint
bun run format        # Prettier (write)
```

## Status

The project is developed task-by-task from `docs/roadmap-en.md`. As of the last changelog entry:

* **Milestone 0 — setup:** completed.
* **Milestone 1 — core infrastructure:** completed (shared types, domain normalization, storage adapter, store + cross-context sync, single-writer ownership, message bus, background orchestrator, popup → background mutation path).
* **Milestone 2 — core features:** completed (timer slice and persistence, timer UI, blocklist slice, presets, DNR rule generation and in-session application, overlay, score and malus, city growth, session history).
* **Milestone 3 — secondary features:** completed (popup shell and tabs, animations, session history UI, city export, i18n EN/IT).
* **Milestone 4 — polish:** in progress (proportional malus and logging done; TexturePacker skipped; accessibility and end-to-end tests remaining).
* **Change request CR1 — single blocklist:** completed (the blocklist is the only site list across the UI, protocol, persisted data, enforcement and tests; version-1 payloads are migrated on read).
* **Change request CR2 — blocklist lock:** completed (the blocklist is editable only while the timer is `idle`; enforced in the store and the background handler, reflected by the disabled editors and the lock notice).
* **Change request CR5 — adding during a session:** completed (adding a site or switching a preset on is also allowed while `running`/`paused`, in the store, the background and the popup; removals and preset management stay idle-only, and a site added mid-session counts as distraction only from the add).

* **Change request CR4 — preset toggles:** completed (presets are toggles over the single list, saved presets replace custom tags, the persisted blocklist is migrated to version 3 on read).

Run `bun run test`, `bun run compile`, `bun run lint` and **both** builds (`bun run build` and `bun run build:firefox`) before considering a task complete. See `docs/changelog.md` for the detailed, per-task status.

## Documentation

* [`docs/roadmap-en.md`](docs/roadmap-en.md) — development plan, milestones and acceptance criteria.
* [`docs/changelog.md`](docs/changelog.md) — completed tasks, decisions and open issues.
* [`docs/store-analysis.md`](docs/store-analysis.md) — review of the Zustand store architecture.
