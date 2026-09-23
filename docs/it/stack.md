# Memoria di progetto — Timer Focus (BuildIt)

> Riferimento rapido per agenti AI: stack tecnologico, versioni delle dipendenze e convenzioni del progetto.
> Fonte di verità: `docs/roadmap-en.md` e `package.json`. In caso di discordanza, fa fede il `package.json`.

## Descrizione del progetto

Estensione browser per la produttività: timer di focus con città ASCII city-builder, allowlist/blocklist con malus, sistema di score (Excellent/Good/Bad). Manifest v3, multi-browser (Chrome e Firefox).

## Package manager

- **bun** — usare SEMPRE bun (non npm/pnpm/yarn) per installazione, esecuzione script e gestione dipendenze.

## Stack principale (runtime)

| Tecnologia | Uso nel progetto |
|---|---|
| **React** `^19.2.4` | UI del popup, componenti in `components/` |
| **react-dom** `^19.2.4` | rendering popup |
| **WXT** `^0.21.3` (dev) | framework per estensioni browser: entrypoints, build multi-browser, `wxt.config.ts` |
| **@wxt-dev/module-react** `^1.1.5` (dev) | integrazione React nel build WXT |
| **Zustand** | store con middleware `persist` (da aggiungere se assente), slice in `store/*.slice.ts` |
| **declarativeNetRequest** (API browser) | blocco siti durante sessione di focus |
| **browser.alarms** (API browser) | persistenza del timer attraverso i riavvii del service worker (tick minimo 60s) |
| **tldts** | parsing/normalizzazione domini (`lib/url/domain.ts`) — da aggiungere se assente |
| **framer-motion** | animazioni crescita/distruzione edifici (M3.T5) — da aggiungere se assente |

## Dipendenze runtime (`dependencies`)

- `react` `^19.2.4`
- `react-dom` `^19.2.4`

## Dipendenze di sviluppo (`devDependencies`)

| Package | Versione | Ruolo |
|---|---|---|
| `wxt` | `^0.21.3` | framework build estensioni |
| `@wxt-dev/module-react` | `^1.1.5` | modulo React per WXT |
| `typescript` | `^5.9.3` | compilatore TS (`strict: true` obbligatorio) |
| `vitest` | `^5.0.1` | test runner (unit/component/integration) |
| `@vitest/coverage-v8` | `^5.0.1` | coverage |
| `happy-dom` | `^20.14.5` | ambiente DOM per test component |
| `@testing-library/react` | `^16.3.3` | test componenti React |
| `@testing-library/user-event` | `^14.6.7` | simulazione interazioni utente |
| `@testing-library/jest-dom` | `^7.0.1` | matcher DOM (configurato in `tests/setup.ts`) |
| `@playwright/test` | — | test e2e su Chromium (da aggiungere al setup, roadmap M0.T4) |
| `eslint` | `^9.0.0` | linting |
| `@eslint/js` | `^9.0.0` | config ESLint flat |
| `typescript-eslint` | `^8.0.0` | regole TS per ESLint |
| `eslint-plugin-react` | `^7.35.0` | regole React |
| `eslint-plugin-react-hooks` | `^5.0.0` | regole React hooks |
| `prettier` | `^3.3.0` | formatting |
| `web-ext` | `^10.5.0` | tooling estensioni Firefox |

## Script npm (eseguire sempre con `bun run <script>`)

- `dev` / `dev:firefox` — sviluppo con WXT
- `build` / `build:firefox` — build produzione (Chrome / Firefox)
- `zip` / `zip:firefox` — pacchettizzazione
- `compile` — type-check (`tsc --noEmit`)
- `test` / `test:watch` / `test:coverage` — vitest
- `lint` / `lint:fix` — ESLint
- `format` / `format:check` — Prettier
- `postinstall` — `wxt prepare`

## Convenzioni vincolanti (da `docs/roadmap.md` §1)

- TypeScript rigoroso: `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`. Vietato `any` esplicito.
- File ≤ 200 righe, funzioni ≤ 40 righe. Naming: `kebab-case.ts` per moduli logici, `PascalCase.tsx` per componenti, `.slice.ts` per slice Zustand, `.types.ts` per tipi.
- I componenti React non chiamano mai API `browser.*`/`chrome.*` direttamente e non contengono logica di calcolo: leggono via selector Zustand e invocano azioni dello store.
- La logica in `lib/` è pura: niente `Date.now()` o `Math.random()` interni (tempo e RNG seedato passati come parametro), niente dipendenze browser dirette (Dependency Inversion — adapter iniettati: `AlarmProvider`, `StorageAdapter`).
- Messaggi tra background/content/popup: union discriminata tipizzata (`RuntimeMessage`), mai oggetti liberi.
- Error handling: `Result`-like esplicito (`{ ok, value/error }`) ai confini non fidati; mai `catch {}` vuoti.
- Testing TDD (red/green/refactor) per ogni task con logica non dichiarativa; vitest per unit/integration (`wxt/testing` + `fakeBrowser`), Testing Library per componenti, Playwright (solo Chromium) per e2e.
- Struttura cartelle: `entrypoints/` (background, popup, content), `components/`, `store/`, `lib/`, `assets/ascii/`, `utils/`, `tests/` — dettaglio completo in `docs/roadmap.md` §1.2.
- Logiche critiche da non mai rompere (regressione obbligatoria): persistenza timer via alarms (M1.T5, M2.T1–T2), parsing tldts (M1.T2), regole DNR (M2.T6–T7), score/malus (M2.T9–T10), determinismo palette (M2.T13).
- Open points documentati (roadmap §4): formula esatta di `distractionRatio`, comportamento oltre capienza griglia — non anticipare implementazioni non richieste (YAGNI).