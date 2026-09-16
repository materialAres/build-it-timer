# Changelog — Timer Focus (BuildIt)

> Registro delle attività completate, per task della `docs/roadmap.md`.
> Aggiornato a: **M1.T3** (fine Milestone 1 in corso).
> Fonti di verità: `docs/roadmap.md`, `package.json`, `git log`.

## Stato attuale

- Milestone 0 (setup) — **completata**
- Milestone 1 (infrastruttura di base) — **in corso**: M1.T1, M1.T2, M1.T3 completati; M1.T4–M1.T7 da fare.
- Test: `bun run test` → **23 test verdi** su 5 file (unit + integrazione + placeholder component).
- Type-check: `bun run compile` (`tsc --noEmit`) → **pulito**.

## Riepilogo task completati

| ID | Titolo | Stato | Commit |
|---|---|---|---|
| M0.T1 | Scaffolding progetto WXT + React + TS | completato | `c3eebdc` |
| M0.T2 | Configurazione linting/formatting e tsconfig strict | completato (con issue nota) | `27d6b1e` |
| M0.T3 | Setup test runner (vitest + wxt/testing + happy-dom + Testing Library) | completato | `27d6b1e` |
| M0.T4 | Setup Playwright per e2e (Chromium) | completato | `73f5c3a` |
| M0.T5 | Struttura cartelle e barrel file iniziali | completato | `0b32002` |
| M1.T1 | Definizione tipi di dominio condivisi | completato | `c1fa995` |
| M1.T2 | Modulo `lib/url/domain.ts` (wrapper `tldts`) | completato | `c1fa995` |
| M1.T3 | Adapter storage per `persist` su `browser.storage.local` | completato | `5793128` |

---

## Milestone 0 — Setup progetto

### M0.T1 — Scaffolding progetto WXT + React + TS
- Inizializzato progetto WXT (template React + TypeScript), manifest v3 multi-browser.
- File/entrypoint di base: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/background.ts` (stub), `entrypoints/popup/{index.html,main.tsx,App.tsx,App.css,style.css}`, `entrypoints/content.ts`, `public/` (icone + `wxt.svg`).
- Dipendenze iniziali: `react` `^19.2.4`, `react-dom` `^19.2.4`; dev: `wxt`, `@wxt-dev/module-react`, `typescript`.

### M0.T2 — Configurazione linting/formatting e tsconfig strict
- Aggiunti `eslint.config.js` (flat config con `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`), `.prettierrc`, `.prettierignore`.
- `tsconfig.json` estende `.wxt/tsconfig.json` con `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true` (+ `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`).
- ⚠️ **Issue nota** (vedi sezione Issue aperte): lo script `lint` è attualmente rotto a livello di load della config — `tseslint.defineConfig` è `undefined` nella versione installata di `typescript-eslint`.

### M0.T3 — Setup test runner (vitest + wxt/testing + happy-dom + Testing Library)
- `vitest.config.ts` con plugin `WxtVitest()`, ambiente `happy-dom`, `tests/setup.ts`, alias `@` → root, coverage `v8`.
- `tests/setup.ts` importa `@testing-library/jest-dom/vitest`.
- Test placeholder: `tests/unit/placeholder.test.ts` (logica pura), `tests/unit/react-placeholder.test.tsx` (componente React in happy-dom), `tests/integration/fake-browser.test.ts` (mock `fakeBrowser.storage.local`).
- Dipendenze dev: `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

### M0.T4 — Setup Playwright per e2e (Chromium)
- `playwright.config.ts` + `tests/e2e/setup.ts` (avvio context Chromium persistente con l'estensione buildata da `.output/chrome-mv3`) + `tests/e2e/popup.spec.ts` (test placeholder).
- Dipendenza dev: `@playwright/test`.

### M0.T5 — Struttura cartelle e barrel file iniziali
- Creata la struttura cartelle di roadmap §1.2 con `.gitkeep`: `components/{city,timer,blocklist,score,common}`, `store/`, `lib/{url,blocking,city,score,timer,messaging}`, `assets/ascii/`, `utils/`, `tests/{unit,integration,e2e}`.
- Path alias coerenti con roadmap: `@`, `@/*`, `~`, `~/*` (da `.wxt/tsconfig.json`).

---

## Milestone 1 — Infrastruttura di base

### M1.T1 — Definizione tipi di dominio condivisi
- `store/store.types.ts`: `TimerStatus`, `ScoreLevel`, `TimerState`, `FormattedDuration`, `Domain`, `Tag`, `BlocklistEntry`, `Preset`, `SessionSummary`.
- `components/city/city.types.ts`: `CityLayerName`, `CityGridData`, `BuildingModuleCategory`, `CityCell`, `CityGrid`, `CityLayers`, `BuildingModule`, `Theme`, `ComposedBuilding`, `SeededRandom`.
- `lib/messaging/messages.types.ts`: `RuntimeMessage` come union discriminata su `type` con le varianti `TIMER_TICK`, `TIMER_STARTED`, `TIMER_PAUSED`, `SITE_BLOCKED_ATTEMPT`, `MALUS_APPLIED`, `SESSION_ENDED`.
- `utils/result.ts`: tipo `Result<T>` (`Success<T> | Failure`) con helper `ok(value)` / `err(error)`.
- Nessun uso di `any`; type-check pulito.

### M1.T2 — Modulo `lib/url/domain.ts` (wrapper `tldts`)
- Funzione pura `getRegistrableDomain(url: string): Result<string>` basata su `tldts` (`parse` + `getDomain`).
- Normalizza i sottodomini al dominio registrabile (`m.facebook.com` → `facebook.com`), gestisce http/https, URL senza protocollo, porte esplicite e ccSLD (`facebook.co.uk`).
- Input non valido (stringa vuota/whitespace, URL malformato, IP) → `{ ok: false, error }`, nessuna eccezione lanciata (boundary non fidato).
- Dipendenza runtime aggiunta: `tldts` `^7.4.13`.
- Test: `tests/unit/lib/url/domain.test.ts` (11 test, unit) — sottodomini multipli, protocolli, URL senza protocollo, porte, ccSLD, stringa vuota/whitespace, URL malformato, IP.

### M1.T3 — Adapter storage per `persist` su `browser.storage.local`
- `store/storage-adapter.ts`: `createBrowserStorage(): StateStorage<Promise<void>>` (tipo da `zustand/middleware`) con `getItem`/`setItem`/`removeItem` asincroni su `browser.storage.local` (via `import { browser } from 'wxt/browser'`, così in test risolve a `fakeBrowser`).
- Espone anche l'istanza condivisa `browserStorage`.
- Valori non-stringa trattati come assenti (`null`) invece di lanciare, per non rompere la rehydration.
- Dipendenza runtime aggiunta: `zustand` `5.0.15` (richiesta dal tipo `StateStorage` e per l'imminente M1.T4).
- Test: `tests/integration/store/storage-adapter.test.ts` (9 test, integrazione con `fakeBrowser`) — chiave inesistente, round-trip set/get, overwrite, remove, remove su chiave assente, valore grande (~500k caratteri), valore non-stringa, riavvio simulato (nuova istanza), istanza condivisa.

---

## Dipendenze aggiunte nel corso dei task

| Package | Versione | Introdotta in | Motivo |
|---|---|---|---|
| `react` / `react-dom` | `^19.2.4` | M0.T1 | UI popup |
| `tldts` | `^7.4.13` | M1.T2 | parsing/normalizzazione domini |
| `zustand` | `5.0.15` | M1.T3 | store + middleware `persist` |

Dev: `wxt`, `@wxt-dev/module-react`, `typescript`, `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/{react,user-event,jest-dom}`, `@playwright/test`, `eslint`/`@eslint/js`/`typescript-eslint`/`eslint-plugin-react`/`eslint-plugin-react-hooks`, `prettier`, `web-ext`.

---

## Issue aperte e punti da chiarire

1. **Lint rotto (M0.T2)** — `bun run lint` fallisce prima di analizzare i file: `TypeError: Function.prototype.apply was called on undefined` in `eslint.config.js` riga 6, perché `tseslint.defineConfig` non esiste nella versione installata di `typescript-eslint` (`config` esiste, `defineConfig` no). Fix proposto: sostituire `tseslint.defineConfig(...)` con `tseslint.config(...)` (o aggiornare `typescript-eslint`). Non ancora risolto perché fuori dallo scope dei task correnti.
2. **Open point di roadmap §4** da non anticipare (YAGNI): formula esatta di `distractionRatio`; comportamento oltre la capienza della griglia.
3. **`framer-motion`** non ancora installato (servirà da M3.T5).

---

## Come rieseguire le verifiche

```bash
bun run test        # vitest (unit + integration + component)
bun run compile     # tsc --noEmit
bun run lint        # ⚠️ attualmente rotto (vedi Issue #1)
bun run build       # build Chrome (WXT)
bun run build:firefox
```
