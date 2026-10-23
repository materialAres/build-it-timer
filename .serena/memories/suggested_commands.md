# Suggested commands

All from the repo root, via Bun:
- `bun install` — install deps (runs `wxt prepare`, regenerating `.wxt/`).
- `bun run dev` / `bun run dev:firefox` — WXT dev server with the extension loaded.
- `bun run build` / `bun run build:firefox` — production MV3 bundles under `.output/`.
- `bun run zip` / `bun run zip:firefox` — store packages.
- `bun run test` — Vitest run (unit + integration + component).
- `bun run test:watch` — watch mode.
- `bun run test:coverage` — coverage (v8).
- `bun run e2e` — Playwright Chromium suite (needs `bunx playwright install chromium` once).
- `bun run compile` — `tsc --noEmit`.
- `bun run lint` / `bun run lint:fix`.
- `bun run format` / `bun run format:check`.

Notes:
- `wxt` needs a Chromium binary; `wxt.config.ts` resolves Playwright's bundled one, and an explicit `CHROME_PATH` takes precedence.
- Manual load: Chrome `chrome://extensions` → Load unpacked → `.output/chrome-mv3`; Firefox `about:debugging#/runtime/this-firefox` → Temporary Add-on → `.output/firefox-mv3/manifest.json`.
- Prefer `repowise distill <cmd>` for noisy commands (tests, builds, git, searches); recover omitted lines with `repowise expand <ref>`.
- Serena memory hygiene: `serena memories check`.