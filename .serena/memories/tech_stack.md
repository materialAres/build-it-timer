# Tech stack

- Language: TypeScript 5.9 — `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`; `tsconfig.json` extends the generated `./.wxt/tsconfig.json` (`@/` → repo root).
- Extension: WXT 0.21 with `@wxt-dev/module-react` and `@wxt-dev/i18n/module`; Manifest V3 forced for **both** Chrome and Firefox (`manifestVersion: 3`).
- UI: React 19 + React DOM; animations via `framer-motion` 14 (replaced by passthroughs in tests).
- State: Zustand 5 with `persist`; backend is `browser.storage.local` through a custom adapter (`store/storage-adapter.ts`).
- Domain parsing: `tldts` 7, centralized in `lib/url/domain.ts`.
- Package manager/runtime: **Bun** (`bun.lock`); never npm/pnpm/yarn. `postinstall` runs `wxt prepare`.
- Unit/component/integration: Vitest 5 + `happy-dom` + Testing Library + `wxt/testing` (`fakeBrowser`); config in `vitest.config.ts`.
- E2E: Playwright 1.63 (Chromium); config in `playwright.config.ts`.
- Lint/format: ESLint 9 flat config with `typescript-eslint` `strictTypeChecked`, `eslint-plugin-react`, `eslint-plugin-react-hooks`; Prettier 3.
- i18n: `@wxt-dev/i18n` compiles `locales/<lang>.yml` to `_locales/.../messages.json`; language auto-detected from the browser, EN default/fallback, IT bundled; the shared `i18n` instance is auto-imported from `#i18n`.
- Runtime browser APIs: `storage`, `alarms`, `declarativeNetRequest`, `tabs`, `runtime` messaging; host permission `<all_urls>`.
- Build outputs: `.output/chrome-mv3`, `.output/firefox-mv3`; zip scripts package for the stores.
- Dev browser: `wxt dev` reuses Playwright's bundled Chromium; `CHROME_PATH` overrides it.
- Repowise indexes the repo and provides output distillation (`.repowise/`, `AGENTS.md`).