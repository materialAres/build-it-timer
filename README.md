# Build-it! Timer Focus

A browser extension which (hopefully) helps you stay focused on your work: the more you focus, the more your ASCII art city grows!

## How it works

Start a focus session and every 2 seconds of undistracted work grows your city by one ASCII character, spread across three parallax layers (background, middleground, foreground). Give in to a distraction and the malus runs the growth engine in reverse, removing characters one at a time.

* **Timer** — start / pause / reset a countdown session. Remaining time is persisted and reconciled with the browser alarm clock, so it survives a service-worker restart.
* **Blocklist** — block distracting sites during a session only; everything else stays allowed, and there is no blocking outside a focus session.
* **Declarative Net Request** — blocked domains are translated into `declarativeNetRequest` rules that are applied exclusively while a session is `running`.
* **Score** — `excellent` (0% distraction), `good` (≤ 30%) or `bad` (> 30%), recalculated from distraction time relative to elapsed focus time.
* **ASCII city** — deterministic, seeded growth composed from a library of ASCII building modules, with a per-domain colour palette.

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
bun run e2e           # Playwright end-to-end suite
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

Run `bun run test`, `bun run compile`, `bun run lint` and **both** builds (`bun run build` and `bun run build:firefox`) before considering a task complete. See `docs/changelog.md` for the detailed, per-task status.

## Documentation

* [`docs/roadmap-en.md`](docs/roadmap-en.md) — development plan, milestones and acceptance criteria.
* [`docs/changelog.md`](docs/changelog.md) — completed tasks, decisions and open issues.
* [`docs/store-analysis.md`](docs/store-analysis.md) — review of the Zustand store architecture.
