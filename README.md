# Build-it! Timer Focus

A browser extension which (hopefully) helps you stay focused on your work: the more you focus, the more your ASCII art city grows!

## How it works

Start a focus session and every 2 seconds of undistracted work grows your city by one ASCII character, spread across three parallax layers (background, middleground, foreground). Give in to a distraction and the malus runs the growth engine in reverse, removing characters one at a time.

* **Timer** — start / pause / reset a countdown session. Remaining time is persisted and reconciled with the browser alarm clock, so it survives a service-worker restart.
* **Blocklist & allowlist** — block distracting sites during a session only. The allowlist always wins, and there is no blocking outside a focus session.
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
bun run build            # Chrome (MV3)
bun run build:firefox    # Firefox
bun run zip              # package for the Chrome Web Store
bun run zip:firefox      # package for Firefox Add-ons
```

`wxt dev` reuses the Chromium bundled with Playwright; set `CHROME_PATH` to override it.

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
* **Milestone 2 — core features:** in progress — timer slice and persistence, timer UI, blocklist slice, presets, DNR rule generation and in-session application are done; city/score/overlay work remains.

Run `bun run test`, `bun run compile`, `bun run lint` and **both** builds (`bun run build` and `bun run build:firefox`) before considering a task complete. See `docs/changelog.md` for the detailed, per-task status.

## Documentation

* [`docs/roadmap-en.md`](docs/roadmap-en.md) — development plan, milestones and acceptance criteria.
* [`docs/changelog.md`](docs/changelog.md) — completed tasks, decisions and open issues.
* [`docs/store-analysis.md`](docs/store-analysis.md) — review of the Zustand store architecture.
