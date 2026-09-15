# Piano di Sviluppo — Timer Focus (BuildIt)

> Estensione browser per la produttività: timer di focus con città ASCII city-builder, allowlist/blocklist con malus, sistema di score.
> Stack: React, WXT, Zustand (`persist`), `declarativeNetRequest`, `browser.alarms`, `framer-motion`, Content Scripts + Shadow DOM, `tldts`.

---

## Indice

1. [Premessa — Standard di qualità del codice](#1-premessa--standard-di-qualità-del-codice)
   1.1 [Principi di design](#11-principi-di-design)
   1.2 [Organizzazione del codice](#12-organizzazione-del-codice)
   1.3 [Gestione dello stato (Zustand)](#13-gestione-dello-stato-zustand)
   1.4 [Qualità e manutenibilità](#14-qualità-e-manutenibilità)
2. [Scomposizione del lavoro in task](#2-scomposizione-del-lavoro-in-task)
   2.1 [Legenda e struttura task](#21-legenda-e-struttura-task)
   2.2 [Tabella riepilogativa](#22-tabella-riepilogativa)
   2.3 [Milestone 0 — Setup progetto](#milestone-0--setup-progetto)
   2.4 [Milestone 1 — Infrastruttura di base](#milestone-1--infrastruttura-di-base)
   2.5 [Milestone 2 — Funzionalità core](#milestone-2--funzionalità-core)
   2.6 [Milestone 3 — Funzionalità secondarie](#milestone-3--funzionalità-secondarie)
   2.7 [Milestone 4 — Rifiniture e Nice-to-have](#milestone-4--rifiniture-e-nice-to-have)
3. [Strategia di testing (TDD)](#3-strategia-di-testing-tdd)
   3.1 [Regola generale — ciclo red/green/refactor](#31-regola-generale--ciclo-redgreenrefactor)
   3.2 [Strumenti per tipo di test](#32-strumenti-per-tipo-di-test)
   3.3 [Mappatura test/task](#33-mappatura-testtask)
   3.4 [Priorità sulle logiche critiche](#34-priorità-sulle-logiche-critiche)
4. [Punti da chiarire](#4-punti-da-chiarire)

---

## 1. Premessa — Standard di qualità del codice

Questa sezione definisce le regole vincolanti per tutto il codice scritto nel progetto, a prescindere da chi (o quale IA) lo scriva. Ogni task nella Sezione 2 deve rispettarle: sono un prerequisito implicito di ogni criterio di accettazione.

### 1.1 Principi di design

| Principio | Applicazione concreta nel progetto |
|---|---|
| **S — Single Responsibility** | Ogni modulo ha una sola ragione per cambiare. Esempio: la logica di parsing URL (`tldts`) vive in `lib/url/domain.ts` e non sa nulla di `declarativeNetRequest`; il modulo che genera le regole DNR (`lib/blocking/rules.ts`) non sa nulla di React. Un componente come `CityCanvas.tsx` si occupa solo di rendering, non di calcolare lo score. |
| **O — Open/Closed** | I preset di blocklist (Social, Video, ecc.) sono definiti come dati (array di oggetti `Preset`), non come `if/else` hardcoded: aggiungere un nuovo preset non richiede modificare la logica di applicazione dei preset, solo aggiungere un elemento alla lista. Stesso approccio per le "palette per fascia di edificio": la funzione di hash→colore è generica e accetta una palette come parametro, non ha i colori cablati. |
| **L — Liskov Substitution** | Le interfacce degli "adapter" (es. `AlarmProvider`, `StorageAdapter`) devono poter essere sostituite da una fake/mock in test senza cambiare il comportamento atteso del chiamante. Es. in test, un `FakeAlarmProvider` che avanza il tempo manualmente deve rispettare lo stesso contratto (`schedule`, `clear`, `onFire`) del provider reale basato su `browser.alarms`. |
| **I — Interface Segregation** | Niente interfacce "big": lo store Zustand va diviso in slice (`timerSlice`, `citySlice`, `blocklistSlice`, `scoreSlice`) ciascuna con la propria interfaccia tipizzata, così un componente che legge solo il timer non dipende (in termini di tipi) dallo slice della città. |
| **D — Dependency Inversion** | I moduli "core" (calcolo score, calcolo malus, city growth engine) non importano mai direttamente API browser (`browser.alarms`, `browser.storage`, `declarativeNetRequest`). Dipendono da interfacce astratte iniettate dall'esterno (background script / popup), per restare testabili in Node/happy-dom senza mock pesanti del browser. |
| **Separation of Concerns** | Tre "mondi" separati e comunicanti solo tramite lo store persistito e messaggi tipizzati: (1) **background** — timer, alarms, DNR rules, calcolo score/malus; (2) **content script** — solo overlay di alert su sito bloccato, nessuna logica di business; (3) **popup/UI** — solo presentazione (città ASCII, controlli timer, gestione preset), legge lo stato ma non lo calcola. |
| **DRY** | La logica di normalizzazione dominio (via `tldts`) è centralizzata in una sola funzione (`getRegistrableDomain(url)`), usata sia dal matcher allowlist/blocklist sia dal generatore di regole DNR sia dalla palette hash — mai duplicata. |
| **KISS** | Il motore di crescita città compone gli edifici da un numero finito di moduli ASCII predefiniti (basi, piani, cime — vedi `tile-library.ts`) selezionati proceduralmente, non generati algoritmicamente carattere per carattere da zero: la varietà nasce dalla combinazione dei moduli, non da un motore procedurale complesso. L'ottimizzazione con TexturePacker/sprite sheet resta rimandata (vedi Milestone 4) e non deve complicare l'MVP ASCII. |
| **YAGNI** | Non si costruisce fin da subito un sistema di plugin per preset di terze parti, né supporto multi-lingua, né sync multi-dispositivo: nulla di tutto ciò è nel documento sorgente. Si implementa solo ciò che è esplicitamente richiesto; ogni estensione futura va proposta come nuovo task, non anticipata nel codice attuale. |

> **Nota tecnica — due orologi distinti.** Il documento richiede che i caratteri della città vengano inseriti uno alla volta ogni 2 secondi, mentre `browser.alarms` (usato per la persistenza del timer, vedi M1.T5) ha un tick minimo di 60 secondi per vincolo di piattaforma. I due meccanismi **non vanno confusi**: `browser.alarms` resta l'unica fonte di verità per la persistenza del countdown attraverso i riavvii del service worker; il tick di inserimento carattere ogni 2s è invece un timer a grana fine (`setInterval`/`requestAnimationFrame`-based) che vive lato popup/background solo mentre il contesto è attivo e viene ricalcolato in modo deterministico (numero di caratteri dovuti = tempo di focus trascorso ÷ 2s) ogni volta che il contesto si risveglia, esattamente come già previsto per il countdown secondo-per-secondo in Sezione 1.4.

### 1.2 Organizzazione del codice

Struttura cartelle coerente con un progetto WXT (entrypoints espliciti + codice condiviso isolato da essi):

```
timer-focus/
├── entrypoints/
│   ├── background.ts            # orchestratore: alarms, DNR, messaggi
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── content/
│       └── blocked-overlay.content.ts   # content script, monta Shadow DOM
├── components/                  # componenti React puri, riusabili
│   ├── city/
│   │   ├── CityCanvas.tsx       # compone i tre layer (background/middleground/foreground)
│   │   ├── CityLayer.tsx        # un singolo layer posizionato in absolute/overlay
│   │   ├── CityCell.tsx
│   │   ├── ThemeProvider.tsx    # applica il tema cromatico/bioma della sessione corrente
│   │   ├── ExportCityButton.tsx # export griglia come JPEG/PNG
│   │   └── city.types.ts
│   ├── timer/
│   │   ├── TimerControls.tsx
│   │   └── TimerDisplay.tsx     # formato hh:mm:ss
│   ├── blocklist/
│   │   ├── PresetPicker.tsx
│   │   ├── TagEditor.tsx
│   │   └── SiteList.tsx
│   ├── score/
│   │   ├── ScoreBadge.tsx
│   │   ├── PopulationCounter.tsx
│   │   └── SessionHistory.tsx   # ultime 5 sessioni
│   └── common/                  # bottoni, modali, ecc. condivisi
├── store/
│   ├── index.ts                 # combina gli slice, applica middleware persist
│   ├── timer.slice.ts
│   ├── city.slice.ts
│   ├── blocklist.slice.ts
│   ├── score.slice.ts
│   ├── session-history.slice.ts # storico ultime 5 sessioni
│   └── store.types.ts
├── lib/                         # logica di dominio pura, no dipendenze browser dirette
│   ├── url/
│   │   └── domain.ts            # wrapper su tldts
│   ├── blocking/
│   │   ├── rules.ts             # genera regole declarativeNetRequest
│   │   └── presets.ts           # dati preset (Social, Video, ecc.)
│   ├── city/
│   │   ├── tile-library.ts      # libreria di moduli ASCII componibili (basi, piani, cime)
│   │   ├── building-composer.ts # compone un edificio da moduli in base al tempo/minuti sbloccati
│   │   ├── growth-engine.ts     # calcolo stato dei tre layer da tempo trascorso
│   │   ├── decoration-engine.ts # dettagli procedurali (finestre accese, alberi, auto, nuvole)
│   │   ├── theme-registry.ts    # temi cromatici/biomi disponibili per sessione
│   │   ├── palette.ts           # hash dominio → colore deterministico (entro il tema attivo)
│   │   └── export-image.ts      # serializzazione canvas/DOM città → JPEG/PNG
│   ├── score/
│   │   ├── calculate-score.ts   # Excellent/Good/Bad — formula esatta: open point, vedi §4
│   │   ├── calculate-population.ts # +5 per casa, +15 per piano di palazzo
│   │   └── apply-malus.ts       # cancellazione carattere per carattere dell'edificio colpito
│   └── timer/
│       └── alarm-adapter.ts     # interfaccia + implementazione browser.alarms
├── assets/
│   └── ascii/                   # frame/moduli ASCII statici (basi, piani, cime, decorazioni)
├── utils/                       # helper generici, stateless, senza logica di dominio
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── wxt.config.ts
├── tsconfig.json
└── package.json
```

Convenzioni:

* **Naming file**: `kebab-case.ts` per moduli logici, `PascalCase.tsx` per componenti React, suffisso `.slice.ts` per gli slice Zustand, suffisso `.types.ts` per file di soli tipi, suffisso `.content.ts` per content script.
* **Naming funzioni/variabili**: `camelCase`; funzioni booleane con prefisso `is`/`has`/`should` (es. `isDomainBlocked`); funzioni pure che calcolano un nuovo stato con prefisso `compute`/`calculate` (es. `calculateScore`, `computeCityGrowth`).
* **Dimensione massima consigliata**: file ≤ 200 righe (esclusi test), funzione ≤ 40 righe. Superare questi limiti è un segnale che il modulo/funzione ha più di una responsabilità e va scomposto (vedi principio S).
* **Componenti React**: un componente per file, massimo un livello di sotto-componenti privati non esportati nello stesso file se puramente di presentazione (es. una singola cella `<CityCell>` renderizzata da `<CityCanvas>` va comunque nel proprio file se supera ~30 righe).
* **TypeScript rigoroso**: `strict: true` obbligatorio in `tsconfig.json`. Vietato `any` esplicito (usare `unknown` + narrowing). Ogni funzione esportata ha tipi di ritorno espliciti. I messaggi scambiati tra background/content/popup sono tipizzati con union discriminate (es. `type RuntimeMessage = { type: 'TIMER_TICK'; payload: ... } | { type: 'SITE_BLOCKED'; payload: ... }`), mai `any`/oggetti liberi.

### 1.3 Gestione dello stato (Zustand)

* **Store persistito** (middleware `persist`, backend `browser.storage.local` tramite adapter custom): tutto ciò che deve sopravvivere al riavvio del browser e rappresenta dati "storici" o configurazione dell'utente —
  * stato della città **della sessione corrente, in corso** (griglia/layer, edifici, palette assegnate ai domini, tema attivo) — necessario per sopravvivere al riavvio del service worker durante una sessione ancora attiva; viene invece azzerato e rigenerato da zero all'avvio di una nuova sessione di focus (una città per sessione, vedi Sezione 2);
  * configurazione allowlist/blocklist, preset personalizzati e relativi tag;
  * storico delle ultime 5 sessioni concluse (score e, se applicabile, screenshot/riferimento città — vedi M2.T18);
  * preferenze utente (es. soglie Good/Bad se rese configurabili).
* **Store volatile** (non persistito, reset a ogni avvio del service worker/popup): tutto ciò che è derivato o transitorio —
  * timer "in corso" a grana fine (i secondi correnti non ancora arrotondati al tick di 60s — va comunque riconciliato con `browser.alarms`, che è la fonte di verità per la persistenza reale del countdown, vedi §3.4, e con il tick di 2s per l'inserimento caratteri, vedi nota tecnica in apertura di Sezione 1);
  * stato UI (tab attiva nel popup, modali aperte, hover su una cella della città);
  * flag temporanei (es. "sto mostrando l'alert di malus adesso").
* **Regola di accoppiamento**: i componenti React **non chiamano mai** `chrome.*`/`browser.*` API direttamente e **non contengono mai** logica di calcolo (score, growth, matching blocklist). Un componente legge lo stato tramite selector Zustand dedicati (es. `useTimerStore(selectRemainingSeconds)`) e invoca solo azioni esposte dallo store (es. `useTimerStore.getState().pauseTimer()`); l'azione internamente delega alla funzione pura in `lib/` e/o manda un messaggio al background. Questo disaccoppia UI da implementazione e rende gli slice testabili senza montare componenti.
* Ogni slice espone selector granulari (non un unico selettore che ritorna l'intero slice) per minimizzare i re-render inutili in un contesto dove le animazioni (`framer-motion`) sono già costose.

### 1.4 Qualità e manutenibilità

* **Gestione errori**: ogni funzione che attraversa un confine "non fidato" (parsing URL, lettura storage, risposta a un messaggio runtime) valida l'input e ritorna un `Result`-like esplicito (es. `{ ok: true, value } | { ok: false, error }`) invece di lanciare eccezioni non gestite nel flusso principale; le eccezioni vere (bug, stato impossibile) possono comunque propagare ma vanno intercettate a un boundary noto (top-level del background, error boundary React nel popup) e loggate in modo consistente, mai silenziate con `catch {}` vuoti.
* **Funzioni pure ove possibile**: tutta la logica in `lib/` (growth engine, calcolo score, matching blocklist, palette hash) è pura: stesso input → stesso output, nessun side-effect, nessuna dipendenza da `Date.now()` non iniettata (il tempo corrente va passato come parametro, mai letto internamente) — questo è ciò che rende possibile testare in isolamento senza mockare il browser. Lo stesso vale per la casualità: `building-composer.ts` e `decoration-engine.ts` non chiamano mai `Math.random()` internamente, ma ricevono un generatore pseudo-casuale seedato come parametro (es. seed derivato dall'id sessione), così la stessa sessione produce sempre la stessa città in test e la varietà da sessione a sessione resta comunque garantita in produzione.
* **Commenti**: solo dove il *perché* non è ovvio dal codice (es. "il tick minimo è 60s per limite di `browser.alarms`, quindi il countdown UI tra due tick è stimato via `Date.now()` lato popup e riconciliato al prossimo alarm"). Vietati commenti che ripetono ciò che il codice già dice.
* **Dipendenze esterne minime**: solo quelle già elencate nel tech stack del documento sorgente (`wxt`, `zustand`, `framer-motion`, `tldts`, TexturePacker come tool esterno offline, le librerie di test). Prima di aggiungerne di nuove durante l'implementazione di un task, va verificato che non esista già una soluzione nello stack o scrivibile in poche righe pure.

---

## 2. Scomposizione del lavoro in task

### 2.1 Legenda e struttura task

Ogni task è scheda a sé stante, con questo formato fisso:

* **ID** — identificativo univoco `M<milestone>.T<numero>`.
* **Titolo**
* **Obiettivo** — cosa deve fare il task, in una frase.
* **File da creare/modificare**
* **Dipendenze** — ID di altri task che devono essere completati prima.
* **Criteri di accettazione** — condizioni verificabili, spuntabili.
* **Nice to have** — marcato esplicitamente quando il task copre una feature opzionale del documento sorgente.

### 2.2 Tabella riepilogativa

| ID | Titolo | Milestone | Dipendenze |
|---|---|---|---|
| M0.T1 | Scaffolding progetto WXT + React + TS | 0 | — |
| M0.T2 | Configurazione linting/formatting e tsconfig strict | 0 | M0.T1 |
| M0.T3 | Setup test runner (vitest + wxt/testing + happy-dom + Testing Library) | 0 | M0.T1 |
| M0.T4 | Setup Playwright per e2e (Chromium) | 0 | M0.T1 |
| M0.T5 | Struttura cartelle e barrel file iniziali | 0 | M0.T1 |
| M1.T1 | Definizione tipi di dominio condivisi | 1 | M0.T5 |
| M1.T2 | Modulo `lib/url/domain.ts` (wrapper `tldts`) | 1 | M1.T1 |
| M1.T3 | Adapter storage per `persist` su `browser.storage.local` | 1 | M1.T1 |
| M1.T4 | Store Zustand — scheletro + combinazione slice | 1 | M1.T3 |
| M1.T5 | Adapter `browser.alarms` (`AlarmProvider`) | 1 | M1.T1 |
| M1.T6 | Bus messaggi tipizzato background↔content↔popup | 1 | M1.T1 |
| M1.T7 | Entrypoint background — scheletro orchestratore | 1 | M1.T4, M1.T5, M1.T6 |
| M2.T1 | `timerSlice` — stato e azioni timer | 2 | M1.T4, M1.T5 |
| M2.T2 | Logica persistenza/ripristino timer via alarms | 2 | M2.T1, M1.T7 |
| M2.T3 | `TimerDisplay` + `TimerControls` (UI) | 2 | M2.T1 |
| M2.T4 | `blocklistSlice` — stato allowlist/blocklist | 2 | M1.T4, M1.T2 |
| M2.T5 | Preset predefiniti (dati) | 2 | M2.T4 |
| M2.T6 | Generatore regole `declarativeNetRequest` | 2 | M1.T2, M2.T4 |
| M2.T7 | Applicazione regole DNR dal background, attive solo in sessione | 2 | M2.T6, M1.T7 |
| M2.T8 | Content script overlay alert (Shadow DOM) | 2 | M1.T6, M2.T4 |
| M2.T9 | `scoreSlice` + `lib/score/calculate-score.ts` (soglie Excellent/Good/Bad) | 2 | M1.T4 |
| M2.T10 | `lib/score/apply-malus.ts` — cancellazione progressiva carattere per carattere | 2 | M2.T9, M2.T8 |
| M2.T11 | `citySlice` — stato griglia/layer città, nuova ad ogni sessione | 2 | M1.T4 |
| M2.T11b | `lib/city/tile-library.ts` — libreria moduli ASCII componibili | 2 | M1.T1 |
| M2.T11c | `lib/city/building-composer.ts` — composizione edificio da moduli in base ai minuti | 2 | M2.T11b |
| M2.T12 | `lib/city/growth-engine.ts` — crescita su 3 layer, cap a griglia piena | 2 | M2.T11, M2.T11c, M2.T1 |
| M2.T12b | `lib/city/decoration-engine.ts` — dettagli procedurali (finestre, alberi, auto, nuvole) | 2 | M2.T12 |
| M2.T13 | `lib/city/palette.ts` (hash dominio → colore, entro tema attivo) | 2 | M1.T2 |
| M2.T13b | `lib/city/theme-registry.ts` — temi cromatici/biomi per sessione | 2 | M1.T1 |
| M2.T14 | `CityCanvas` + `CityLayer` + `CityCell` (render ASCII multi-layer + glow CRT) | 2 | M2.T12, M2.T13, M2.T13b |
| M2.T15 | Collegamento growth-engine ↔ tick inserimento carattere (2s) | 2 | M2.T12, M2.T2 |
| M2.T16 | Collegamento malus ↔ cancellazione progressiva edificio | 2 | M2.T10, M2.T12 |
| M2.T17 | `ScoreBadge` (UI Excellent/Good/Bad) | 2 | M2.T9 |
| M2.T18 | `PopulationCounter` + `lib/score/calculate-population.ts` | 2 | M2.T11c |
| M2.T19 | `session-history.slice.ts` — storico ultime 5 sessioni | 2 | M2.T9 |
| M2.T20 | Validazione mutua esclusione allowlist/blocklist | 2 | M2.T4 |
| M3.T1 | `PresetPicker` (UI selezione preset) | 3 | M2.T5, M2.T4 |
| M3.T2 | `TagEditor` — categorie custom via tag | 3 | M2.T4 |
| M3.T3 | `SiteList` — CRUD siti in allow/blocklist | 3 | M2.T4, M1.T2, M2.T20 |
| M3.T4 | Popup `App.tsx` — composizione UI completa | 3 | M2.T3, M2.T14, M2.T17, M2.T18, M2.T19, M3.T1–M3.T3 |
| M3.T5 | Animazioni `framer-motion` su crescita/cancellazione edifici | 3 | M2.T14 |
| M3.T6 | Persistenza multi-browser: verifica Firefox/Chrome build | 3 | M3.T4 |
| M3.T7 | `SessionHistory` (UI storico 5 sessioni) | 3 | M2.T19 |
| M3.T8 | `ExportCityButton` — export città come JPEG/PNG a fine focus | 3 | M2.T14 |
| M4.T1 | *(Nice to have)* Malus proporzionale al tempo sul sito bloccato | 4 | M2.T10 |
| M4.T2 | *(Nice to have)* Integrazione TexturePacker / sprite sheet edifici | 4 | M2.T14 |
| M4.T3 | Hardening errori e logging centralizzato | 4 | M3.T4 |
| M4.T4 | Rifinitura accessibilità popup | 4 | M3.T4 |
| M4.T5 | Suite e2e completa multi-scenario | 4 | M3.T6 |

### 2.3 Milestone 0 — Setup progetto

#### M0.T1 — Scaffolding progetto WXT + React + TS
* **Obiettivo**: inizializzare il progetto con `wxt` template React + TypeScript, targetizzando manifest v3 multi-browser.
* **File**: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/background.ts` (stub), `entrypoints/popup/` (stub).
* **Dipendenze**: —
* **Criteri di accettazione**:
  - `pnpm dev` (o `npm run dev`) avvia WXT senza errori e produce un'estensione caricabile in Chrome.
  - `wxt build -b firefox` completa senza errori.
  - Popup stub si apre e mostra un testo placeholder.

#### M0.T2 — Configurazione linting/formatting e tsconfig strict
* **Obiettivo**: impostare ESLint + Prettier (o Biome) e `tsconfig.json` con `strict: true`, coerenti con le regole della Sezione 1.2.
* **File**: `.eslintrc.*` (o `biome.json`), `.prettierrc`, `tsconfig.json`.
* **Dipendenze**: M0.T1
* **Criteri di accettazione**:
  - `tsconfig.json` ha `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`.
  - Lint script fallisce su un `any` esplicito introdotto di prova, poi passa dopo rimozione.

#### M0.T3 — Setup test runner (vitest + wxt/testing + happy-dom + Testing Library)
* **Obiettivo**: configurare `vitest` con l'integrazione ufficiale `wxt/testing`, ambiente `happy-dom`, e le librerie di testing React.
* **File**: `vitest.config.ts`, `tests/setup.ts`.
* **Dipendenze**: M0.T1
* **Criteri di accettazione**:
  - Un test placeholder (`1 + 1 === 2`) gira con `vitest run`.
  - Un test placeholder che monta un componente React banale con `@testing-library/react` passa in ambiente `happy-dom`.
  - I mock delle API `browser.*` forniti da `wxt/testing` sono disponibili e funzionanti in un test di prova (es. `fakeBrowser.storage.local`).

#### M0.T4 — Setup Playwright per e2e (Chromium)
* **Obiettivo**: configurare `@playwright/test` per e2e su Chromium con estensione caricata.
* **File**: `playwright.config.ts`, `tests/e2e/setup.ts`.
* **Dipendenze**: M0.T1
* **Criteri di accettazione**:
  - Un test e2e placeholder carica l'estensione buildata in un contesto Chromium persistente e verifica che il popup si apra.

#### M0.T5 — Struttura cartelle e barrel file iniziali
* **Obiettivo**: creare la struttura cartelle definita in Sezione 1.2 con file indice/barrel dove utile, cartelle vuote con `.gitkeep` dove non ancora popolate.
* **File**: intera struttura `components/`, `store/`, `lib/`, `utils/`, `assets/ascii/`, `tests/{unit,integration,e2e}`.
* **Dipendenze**: M0.T1
* **Criteri di accettazione**:
  - La struttura cartelle corrisponde esattamente a quella in Sezione 1.2.
  - `tsconfig.json` include path alias coerenti (es. `@/lib/*`, `@/store/*`, `@/components/*`).

### 2.4 Milestone 1 — Infrastruttura di base

#### M1.T1 — Definizione tipi di dominio condivisi
* **Obiettivo**: definire in `lib/`/`store/` i tipi TypeScript condivisi: `Domain`, `BlocklistEntry`, `Preset`, `Tag`, `CityCell`, `CityLayer` (`'background'|'middleground'|'foreground'`), `CityGrid` (le tre griglie/layer), `BuildingModule` (base/piano/cima), `Theme` (palette cromatica/bioma), `ScoreLevel`, `SessionSummary` (per lo storico), `TimerState` (con `hours`/`minutes`/`seconds`), `RuntimeMessage` (union discriminata).
* **File**: `store/store.types.ts`, `components/city/city.types.ts`, un file `lib/messages.types.ts` per `RuntimeMessage`.
* **Dipendenze**: M0.T5
* **Criteri di accettazione**:
  - Nessun tipo usa `any`.
  - `RuntimeMessage` è una union discriminata su campo `type`, con almeno le varianti: `TIMER_TICK`, `TIMER_STARTED`, `TIMER_PAUSED`, `SITE_BLOCKED_ATTEMPT`, `MALUS_APPLIED`, `SESSION_ENDED`.
  - `SessionSummary` include almeno `score`, `population`, `endedAt`; è il tipo su cui si basa lo storico delle ultime 5 sessioni (M2.T19).
  - I tipi compilano (`tsc --noEmit`) senza errori.

#### M1.T2 — Modulo `lib/url/domain.ts` (wrapper `tldts`)
* **Obiettivo**: funzione pura `getRegistrableDomain(url: string): Result<string>` che usa `tldts` per estrarre il dominio registrabile normalizzato (es. `m.facebook.com` → `facebook.com`).
* **File**: `lib/url/domain.ts`
* **Dipendenze**: M1.T1
* **Criteri di accettazione**:
  - Per `https://m.facebook.com/foo`, `https://www.facebook.com`, `https://facebook.com` → stesso risultato `facebook.com`.
  - Per URL malformato → ritorna variante `{ ok: false, error }`, non lancia eccezione.
  - Gestisce correttamente domini con ccSLD (es. `facebook.co.uk` se applicabile) grazie a `tldts`.

#### M1.T3 — Adapter storage per `persist` su `browser.storage.local`
* **Obiettivo**: implementare uno storage adapter compatibile con l'interfaccia richiesta dal middleware `persist` di Zustand, che scriva su `browser.storage.local` invece che su `localStorage` (non disponibile/adeguato in service worker).
* **File**: `store/storage-adapter.ts`
* **Dipendenze**: M1.T1
* **Criteri di accettazione**:
  - Implementa `getItem`, `setItem`, `removeItem` in forma asincrona compatibile con `persist`.
  - In test con `fakeBrowser` di `wxt/testing`, uno `setItem` seguito da `getItem` ritorna il valore scritto.

#### M1.T4 — Store Zustand — scheletro + combinazione slice
* **Obiettivo**: creare `store/index.ts` che combina gli slice (ancora vuoti/stub) con `persist`, separando esplicitamente chiavi persistite da chiavi volatili (`partialize`).
* **File**: `store/index.ts`, stub `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`.
* **Dipendenze**: M1.T3
* **Criteri di accettazione**:
  - Lo store esporta un hook unico `useAppStore` più selector dedicati per slice.
  - `partialize` esclude esplicitamente i campi volatili definiti in Sezione 1.3.
  - Test: modificare un campo persistito, "riavviare" lo store (nuova istanza puntando allo stesso storage fake) e verificare che il valore sia recuperato; un campo volatile invece torna al default.

#### M1.T5 — Adapter `browser.alarms` (`AlarmProvider`)
* **Obiettivo**: interfaccia astratta `AlarmProvider { schedule(name, whenMs), clear(name), onFire(cb) }` con implementazione reale su `browser.alarms` e una `FakeAlarmProvider` per i test (vedi principio L, Sezione 1.1).
* **File**: `lib/timer/alarm-adapter.ts`, `lib/timer/fake-alarm-adapter.ts` (in `tests/` o accanto, da decidere in fase di scaffolding — collocarlo comunque fuori dal bundle di produzione).
* **Dipendenze**: M1.T1
* **Criteri di accettazione**:
  - L'implementazione reale rispetta il vincolo di tick minimo 60s (documentato con commento, vedi Sezione 1.4).
  - `FakeAlarmProvider` permette di "avanzare il tempo" manualmente nei test e invoca `onFire` in modo deterministico.
  - Nessun modulo in `lib/` fuori da questo file importa `browser.alarms` direttamente.

#### M1.T6 — Bus messaggi tipizzato background↔content↔popup
* **Obiettivo**: wrapper tipizzato sopra `browser.runtime.sendMessage`/`onMessage` che usa `RuntimeMessage` (M1.T1) per garantire type-safety sui messaggi.
* **File**: `lib/messaging/bus.ts`
* **Dipendenze**: M1.T1
* **Criteri di accettazione**:
  - `sendMessage` accetta solo varianti valide di `RuntimeMessage` (verificato a livello di tipo, non solo runtime).
  - Un listener registrato con `onMessage('SITE_BLOCKED_ATTEMPT', handler)` riceve correttamente il payload tipizzato in un test con `fakeBrowser`.

#### M1.T7 — Entrypoint background — scheletro orchestratore
* **Obiettivo**: `entrypoints/background.ts` inizializza store, alarm provider, message bus e registra i listener principali (ancora senza logica di business completa, solo wiring).
* **File**: `entrypoints/background.ts`
* **Dipendenze**: M1.T4, M1.T5, M1.T6
* **Criteri di accettazione**:
  - Il background si avvia senza errori in un test con `wxt/testing`.
  - I listener per i messaggi definiti in M1.T1 sono registrati (verificabile tramite spy).

### 2.5 Milestone 2 — Funzionalità core

#### M2.T1 — `timerSlice` — stato e azioni timer
* **Obiettivo**: slice con stato `{ status: 'idle'|'running'|'paused', remainingSeconds, sessionStartedAt, sessionId }` e azioni `startTimer`, `pauseTimer`, `resetTimer`. `remainingSeconds` è la fonte di verità interna; la UI deriva ore/minuti/secondi da questo valore (vedi M2.T3), non li mantiene come campi separati nello store.
* **File**: `store/timer.slice.ts`
* **Dipendenze**: M1.T4, M1.T5
* **Criteri di accettazione**:
  - Le azioni sono pure rispetto allo store (nessuna chiamata diretta a `browser.alarms` dentro lo slice: delega a `AlarmProvider` iniettato, vedi Sezione 1.3).
  - Test: `startTimer()` porta `status` a `running`, genera un nuovo `sessionId` univoco e chiama `AlarmProvider.schedule`.

#### M2.T2 — Logica persistenza/ripristino timer via alarms
* **Obiettivo**: al riavvio del service worker, il background ricostruisce lo stato del timer corrente leggendo dallo store persistito + eventuale alarm ancora pendente.
* **File**: `entrypoints/background.ts` (estensione), `lib/timer/restore-timer.ts`
* **Dipendenze**: M2.T1, M1.T7
* **Criteri di accettazione**:
  - Simulando un "riavvio" (nuova istanza background, stesso storage fake) con timer `running`, il countdown riprende da un valore coerente (non da zero, non duplicato).
  - Se non c'è nessun alarm pendente ma lo stato persistito dice `running`, il sistema lo rileva come inconsistenza e lo riporta a `paused` (comportamento esplicito, non silenzioso).

#### M2.T3 — `TimerDisplay` + `TimerControls` (UI)
* **Obiettivo**: componenti presentazionali per mostrare il countdown e i controlli start/pause/reset, collegati allo store via selector.
* **File**: `components/timer/TimerDisplay.tsx`, `components/timer/TimerControls.tsx`
* **Dipendenze**: M2.T1
* **Criteri di accettazione**:
  - `TimerDisplay` renderizza `remainingSeconds` formattato `hh:mm:ss` (funzione pura di formattazione separata, es. `utils/format-duration.ts`, testabile in isolamento).
  - Click su "Start" in `TimerControls` invoca l'azione dello store, non logica locale.
  - Test con Testing Library: render, click, assert su chiamata azione (via spy sullo store).

#### M2.T4 — `blocklistSlice` — stato allowlist/blocklist
* **Obiettivo**: slice con `{ allowlist: BlocklistEntry[], blocklist: BlocklistEntry[], customTags: Tag[] }` e azioni CRUD.
* **File**: `store/blocklist.slice.ts`
* **Dipendenze**: M1.T4, M1.T2
* **Criteri di accettazione**:
  - Aggiungere un sito normalizza il dominio tramite `getRegistrableDomain` prima di salvarlo (niente duplicati tipo `facebook.com` e `www.facebook.com`).
  - Azioni CRUD coperte da test unitari (add/remove/update tag).

#### M2.T5 — Preset predefiniti (dati)
* **Obiettivo**: dataset statico dei preset pronti (Social, Video, ecc.) come da documento, ciascuno con lista domini e tag associato.
* **File**: `lib/blocking/presets.ts`
* **Dipendenze**: M2.T4
* **Criteri di accettazione**:
  - Almeno il preset "Social" (instagram.com, facebook.com, x.com/twitter.com, tiktok.com) è presente.
  - Struttura dati conforme al tipo `Preset` (Sezione M1.T1) — nessuna logica di applicazione qui, solo dati (principio Open/Closed, Sezione 1.1).

#### M2.T6 — Generatore regole `declarativeNetRequest`
* **Obiettivo**: funzione pura `buildDnrRules(blocklist: BlocklistEntry[], allowlist: BlocklistEntry[]): DeclarativeNetRequestRule[]` che traduce lo stato in regole DNR valide.
* **File**: `lib/blocking/rules.ts`
* **Dipendenze**: M1.T2, M2.T4
* **Criteri di accettazione**:
  - Un dominio in blocklist genera una regola di blocco corretta (`urlFilter` normalizzato).
  - Un dominio presente sia in allowlist sia in blocklist → allowlist vince esplicitamente (regola con priorità maggiore), comportamento testato esplicitamente.
  - Nessuna chiamata reale a `browser.declarativeNetRequest` in questo modulo (puro, testabile senza browser).

#### M2.T7 — Applicazione regole DNR dal background
* **Obiettivo**: il background chiama `browser.declarativeNetRequest.updateDynamicRules` con l'output di `buildDnrRules`, ogni volta che blocklist/allowlist cambiano o che il timer passa a `running`/`idle`.
* **File**: `entrypoints/background.ts` (estensione), `lib/blocking/apply-rules.ts`
* **Dipendenze**: M2.T6, M1.T7
* **Criteri di accettazione**:
  - Le regole di blocco sono attive **esclusivamente** durante `status === 'running'`: alla transizione `running → paused/idle` le regole dinamiche vengono rimosse (`updateDynamicRules` con `removeRuleIds`), e alla transizione verso `running` vengono riapplicate. Fuori da una sessione di focus la navigazione è sempre libera, senza eccezioni.
  - Test con `fakeBrowser`: cambiare la blocklist durante `running` triggera una chiamata a `updateDynamicRules` con le regole attese; una transizione a `paused` triggera una chiamata di rimozione regole.

#### M2.T8 — Content script overlay alert (Shadow DOM)
* **Obiettivo**: content script che, su tentativo di accesso a sito bloccato, monta un overlay in Shadow DOM con messaggio di alert e scelta "torna indietro" / "prosegui comunque".
* **File**: `entrypoints/content/blocked-overlay.content.ts`, `components/common/BlockedOverlay.tsx`
* **Dipendenze**: M1.T6, M2.T4
* **Criteri di accettazione**:
  - L'overlay è isolato in Shadow DOM (stili della pagina host non lo alterano, verificabile in test/e2e).
  - Scelta "prosegui comunque" invia un messaggio `SITE_BLOCKED_ATTEMPT` (o simile) al background tramite il bus di M1.T6.
  - Scelta "torna indietro" chiude l'overlay senza inviare messaggi di malus.

#### M2.T9 — `scoreSlice` + `lib/score/calculate-score.ts`
* **Obiettivo**: funzione pura `calculateScore(distractionRatio: number): 'excellent'|'good'|'bad'` secondo le soglie aggiornate — Excellent (0%), Good (≤30%), Bad (>30%) — più slice che ne mantiene lo stato per la sessione corrente. `distractionRatio` è calcolato sul tempo di distrazione rispetto al tempo di focus **effettivamente trascorso fino al momento della verifica** (non sulla durata pianificata della sessione), quindi il valore è ricalcolato ad ogni verifica e può cambiare nel corso della sessione.
* **File**: `lib/score/calculate-score.ts`, `store/score.slice.ts`
* **Dipendenze**: M1.T4
* **Criteri di accettazione**:
  - `calculateScore(0)` → `'excellent'`.
  - `calculateScore(0.3)` → `'good'`, `calculateScore(0.31)` → `'bad'` (nessuna fascia intermedia: due soglie, tre livelli, senza zone grigie).
  - Tutti i valori limite (0, 0.3, 0.31, 1.0) coperti da test parametrici.
  - **Nota**: la formula esatta con cui `distractionRatio` viene derivato dai singoli eventi di distrazione (durata, numero di eventi, peso di ciascuno) resta un **open point**, da definire in una revisione successiva del piano — vedi Sezione 4. Questo task implementa la sola funzione di soglia (`ratio → livello`), che è stabile indipendentemente da come il ratio viene calcolato a monte.

#### M2.T10 — `lib/score/apply-malus.ts` — cancellazione progressiva carattere per carattere
* **Obiettivo**: quando arriva il messaggio `SITE_BLOCKED_ATTEMPT` (da M2.T8) con scelta "prosegui", il background applica il malus come **inverso della crescita**: finché l'utente resta sul sito bloccato (o ne mantiene una tab aperta, vedi sotto), i caratteri dell'edificio colpito vengono rimossi uno alla volta con la stessa cadenza di 2s usata per la costruzione (M2.T15), anziché essere distrutti in blocco.
* **File**: `lib/score/apply-malus.ts`
* **Dipendenze**: M2.T9, M2.T8
* **Criteri di accettazione**:
  - Funzione pura `applyMalus(cityState, ticksOfDistraction) → newCityState` che rimuove un carattere per ogni tick di 2s trascorso in stato di distrazione, simmetrica a `growth-engine.ts` (vedi M2.T12) ma in direzione opposta.
  - Se l'edificio raggiunge zero caratteri, resta nello stato "cella vuota" (non genera un errore né uno stato intermedio indefinito).
  - **Rilevamento della distrazione in presenza di più tab aperte**: l'implementazione tenta come prima scelta di applicare il malus per il solo fatto che una tab su un sito bloccato sia aperta, **indipendentemente dal fatto che sia la tab attiva** (basandosi sugli eventi `tabs.onUpdated`/`tabs.onRemoved` disponibili al background, cumulando il tempo di distrazione su tutte le tab bloccate aperte contemporaneamente). Se in fase di implementazione questo approccio risultasse non realizzabile in modo affidabile (per limiti delle API disponibili), il fallback esplicito è applicare il malus solo quando la tab bloccata è quella **attiva** (`tabs.onActivated` + `windows.onFocusChanged`). La scelta effettiva va documentata con un commento nel codice (vedi Sezione 1.4 sui commenti "perché") e riportata nel changelog del task.
  - Funzione pura e testabile senza browser; il rilevamento multi-tab (che richiede API browser) vive separatamente in un adapter dedicato (`lib/timer/tab-distraction-tracker.ts` o simile), mai mescolato con `apply-malus.ts`.

#### M2.T11 — `citySlice` — stato griglia/layer città, nuova ad ogni sessione
* **Obiettivo**: slice con `{ layers: { background: CityGrid, middleground: CityGrid, foreground: CityGrid }, buildings: Record<domain, BuildingMeta>, themeId, sessionId }`.
* **File**: `store/city.slice.ts`
* **Dipendenze**: M1.T4
* **Criteri di accettazione**:
  - Stato iniziale è composto dai tre layer "vuoti" di dimensioni configurabili.
  - Slice espone un'azione `resetCityForNewSession(sessionId, themeId)` che azzera completamente i tre layer e assegna un nuovo tema: va invocata da `startTimer()` (M2.T1) così che ogni sessione di focus parta sempre da una città nuova, mai da quella della sessione precedente.
  - Slice espone azioni `growCity(delta)`, `applyMalusToCity(ticks)` che delegano rispettivamente al growth engine (M2.T12) e a `apply-malus.ts` (M2.T10), non calcolano internamente.

#### M2.T11b — `lib/city/tile-library.ts` — libreria moduli ASCII componibili
* **Obiettivo**: dataset statico e tipizzato dei moduli ASCII riusabili, tutti a larghezza compatibile (es. multipli di una larghezza base configurabile): basi/fondamenta, sezioni di piano (ufficio, residenziale, vetrate), elementi sulla cima (antenne, cupole, eliporti).
* **File**: `lib/city/tile-library.ts`
* **Dipendenze**: M1.T1
* **Criteri di accettazione**:
  - Ogni modulo dichiara esplicitamente la propria larghezza in caratteri; un test verifica che tutti i moduli della stessa categoria (es. tutte le "sezioni di piano") abbiano larghezza compatibile tra loro, cosa che previene disallineamenti quando i moduli vengono impilati verticalmente.
  - Almeno 2 varianti per categoria (base, piano, cima) sono presenti, per permettere combinazioni diverse fin dall'MVP.
  - Solo dati, nessuna logica di selezione qui (principio Open/Closed, Sezione 1.1) — la selezione è compito di `building-composer.ts` (M2.T11c).

#### M2.T11c — `lib/city/building-composer.ts` — composizione edificio da moduli in base ai minuti
* **Obiettivo**: funzione pura `composeBuilding(minutesFocused: number, rng: SeededRandom): Building` che sblocca progressivamente moduli via soglie di minuti (es. minuto 5 → base, minuto 10 → primo piano, minuto 20 → piano aggiuntivo, minuto 25 → elemento in cima), scegliendo la variante specifica di ciascun modulo in modo pseudo-casuale mediante il generatore seedato ricevuto come parametro (vedi Sezione 1.4).
* **File**: `lib/city/building-composer.ts`
* **Dipendenze**: M2.T11b
* **Criteri di accettazione**:
  - Le soglie di sblocco sono definite come dati configurabili (array ordinato `{ minuteThreshold, moduleCategory }`), non `if/else` cablati — coerente col principio Open/Closed.
  - Stesso `minutesFocused` + stesso seed → stesso edificio, sempre (determinismo per i test).
  - Un edificio "smontato" (minuti = 0) è rappresentabile e distinto da un edificio con solo la base.

#### M2.T12 — `lib/city/growth-engine.ts` — crescita su 3 layer, cap a griglia piena
* **Obiettivo**: motore puro che, dato lo stato dei tre layer correnti e un "tempo di focus trascorso", calcola il nuovo stato: ogni 2 secondi di focus senza distrazioni viene inserito un carattere (di un modulo composto da `building-composer.ts`, M2.T11c) in una cella, distribuendo la crescita tra i tre layer (background con edifici piccoli/stelle, middleground con i grattacieli principali, foreground con strada/auto/alberi).
* **File**: `lib/city/growth-engine.ts`
* **Dipendenze**: M2.T11, M2.T11c, M2.T1
* **Criteri di accettazione**:
  - Stesso stato + stesso delta di tempo + stesso seed → stesso risultato (determinismo, no `Date.now()` interno, no `Math.random()` non iniettato).
  - Test su almeno 3 step di crescita consecutivi (ognuno di 2s) che verificano l'inserimento di un carattere alla volta, non a blocchi.
  - **Comportamento a griglia piena**: quando tutti e tre i layer risultano completamente occupati, ulteriori tick di crescita **non modificano più la griglia** (nessun errore, nessuna estensione oltre le dimensioni configurate) — la funzione ritorna lo stesso stato città invariato. Lo score e la popolazione (M2.T9, M2.T18), che sono calcolati altrove sulla base del tempo trascorso e non sullo stato della griglia, continuano invece a evolvere normalmente anche oltre questo punto: il cap è puramente visivo/di rendering, non un cap sul progresso della sessione.

#### M2.T12b — `lib/city/decoration-engine.ts` — dettagli procedurali
* **Obiettivo**: funzione pura `decorate(cityState, rng: SeededRandom): CityState` che, mantenendo intatta la struttura degli edifici già composta, randomizza dettagli di dettaglio: finestre accese/spente (sostituendo occasionalmente `[ ]` con `[*]`/`[#]`/`[░]`), elementi di contorno nel layer foreground/background (alberi, lampioni, auto, nuvole).
* **File**: `lib/city/decoration-engine.ts`
* **Dipendenze**: M2.T12
* **Criteri di accettazione**:
  - Non altera mai la struttura portante di un edificio (basi/piani/cime restano quelli composti da `building-composer.ts`), solo dettagli sovrapponibili.
  - Stesso stato + stesso seed → stesso risultato decorato (determinismo per i test).
  - Distinto e disaccoppiato dal growth engine: la decorazione è un passaggio successivo e opzionale, disattivabile senza rompere la crescita strutturale (principio Separation of Concerns).

#### M2.T13 — `lib/city/palette.ts` (hash dominio → colore)
* **Obiettivo**: funzione pura `getBuildingColor(domain: string): string` deterministica, che assegna sempre lo stesso colore allo stesso dominio, pescando da una palette definita (blu/arancione/verde/giallo).
* **File**: `lib/city/palette.ts`
* **Dipendenze**: M1.T2
* **Criteri di accettazione**:
  - Stesso dominio normalizzato → stesso colore, sempre (test con ripetizione della chiamata).
  - Distribuzione ragionevolmente uniforme su un campione di N domini di test (nessun bias grossolano verso un solo colore) — verificabile con un test statistico semplice, non rigoroso.

#### M2.T14 — `CityCanvas` + `CityCell` (render ASCII + glow CRT)
* **Obiettivo**: componenti React che renderizzano la griglia città come `<pre>`/`<span>` monospace con `text-shadow` verde CRT, applicando i colori da `palette.ts`.
* **File**: `components/city/CityCanvas.tsx`, `components/city/CityCell.tsx`
* **Dipendenze**: M2.T12, M2.T13
* **Criteri di accettazione**:
  - Il componente riceve `CityGrid` come prop (no lettura diretta dello store dentro `CityCell`, solo in `CityCanvas` — principio Separation of Concerns).
  - CSS applica `text-shadow: 0 0 4px currentColor` come da documento.
  - Snapshot/rendering test verifica che una cella `destroyed` non mostri più il carattere/colore dell'edificio.

#### M2.T15 — Collegamento growth-engine ↔ timer tick
* **Obiettivo**: ogni tick del timer (M2.T1/M2.T2) invoca `growCity` sullo store città con il delta di tempo trascorso senza distrazioni.
* **File**: `entrypoints/background.ts` (estensione)
* **Dipendenze**: M2.T12, M2.T2
* **Criteri di accettazione**:
  - Un tick con `status === 'running'` e nessuna violazione nel periodo → la città cresce del delta atteso.
  - Test di integrazione: sequenza di tick simulati produce una griglia coerente con l'output atteso del growth engine.

#### M2.T16 — Collegamento malus ↔ distruzione edifici
* **Obiettivo**: l'evento di malus (M2.T10) applica `destroyBuilding` sullo stato città reale nello store, non solo sul modello isolato.
* **File**: `entrypoints/background.ts` (estensione)
* **Dipendenze**: M2.T10, M2.T12
* **Criteri di accettazione**:
  - Test di integrazione: simulare `SITE_BLOCKED_ATTEMPT` con scelta "prosegui" → lo store città riflette la distruzione entro lo stesso ciclo di aggiornamento.

#### M2.T17 — `ScoreBadge` (UI Excellent/Good/Bad)
* **Obiettivo**: componente che mostra il livello di score corrente con stile distintivo per ciascun livello.
* **File**: `components/score/ScoreBadge.tsx`
* **Dipendenze**: M2.T9
* **Criteri di accettazione**:
  - Rende correttamente le tre varianti in base al valore dello store (test con i tre stati forzati).

### 2.6 Milestone 3 — Funzionalità secondarie

#### M3.T1 — `PresetPicker` (UI selezione preset)
* **Obiettivo**: componente che elenca i preset (M2.T5) e permette di applicarli in un colpo solo alla blocklist.
* **File**: `components/blocklist/PresetPicker.tsx`
* **Dipendenze**: M2.T5, M2.T4
* **Criteri di accettazione**:
  - Selezionare "Social" aggiunge tutti i domini del preset alla blocklist in un'unica azione di store (no N azioni separate che causano N re-render/persist).

#### M3.T2 — `TagEditor` — categorie custom via tag
* **Obiettivo**: UI per creare/assegnare tag custom a un gruppo di siti, per costruire preset personalizzati.
* **File**: `components/blocklist/TagEditor.tsx`
* **Dipendenze**: M2.T4
* **Criteri di accettazione**:
  - Creare un tag e assegnarlo a ≥2 siti; filtrare la lista siti per quel tag mostra solo quelli.

#### M3.T3 — `SiteList` — CRUD siti in allow/blocklist
* **Obiettivo**: UI di gestione manuale (aggiungi/rimuovi singolo dominio), con normalizzazione via `tldts` in tempo reale nell'input.
* **File**: `components/blocklist/SiteList.tsx`
* **Dipendenze**: M2.T4, M1.T2
* **Criteri di accettazione**:
  - Inserire un URL completo (`https://m.facebook.com/qualcosa`) risulta in un'unica entry normalizzata `facebook.com`.
  - Tentare di aggiungere un dominio già presente non crea un duplicato (feedback UI esplicito).

#### M3.T4 — Popup `App.tsx` — composizione UI completa
* **Obiettivo**: comporre tutti i componenti (timer, città, score, blocklist) nel popup principale, con routing/tab se necessario.
* **File**: `entrypoints/popup/App.tsx`
* **Dipendenze**: M2.T3, M2.T14, M2.T17, M3.T1, M3.T2, M3.T3
* **Criteri di accettazione**:
  - Tutte le sezioni sono raggiungibili e funzionanti da un unico punto di ingresso.
  - Test di integrazione end-to-end a livello di componente (non browser reale): avviare un timer dalla UI aggiorna sia `TimerDisplay` sia (indirettamente) lo stato città dopo un tick simulato.

#### M3.T5 — Animazioni `framer-motion` su crescita/distruzione edifici
* **Obiettivo**: transizioni animate quando una cella passa `growing→building` o viene distrutta.
* **File**: `components/city/CityCell.tsx` (estensione)
* **Dipendenze**: M2.T14
* **Criteri di accettazione**:
  - Le transizioni non bloccano il render in test (mock/disable di `framer-motion` nei test se necessario per stabilità).
  - Nessuna regressione ai test di M2.T14.

#### M3.T6 — Persistenza multi-browser: verifica Firefox/Chrome build
* **Obiettivo**: validare che manifest, `declarativeNetRequest`, `browser.alarms` e Shadow DOM overlay funzionino identicamente su entrambi i target di build WXT.
* **File**: eventuali adeguamenti in `wxt.config.ts`, note in `README.md`.
* **Dipendenze**: M3.T4
* **Criteri di accettazione**:
  - `wxt build -b chrome` e `wxt build -b firefox` producono estensioni funzionanti (verificato almeno manualmente per il primo giro, poi coperto da M4.T5).

### 2.7 Milestone 4 — Rifiniture e Nice-to-have

#### M4.T1 — *(Nice to have)* Malus proporzionale al tempo sul sito bloccato
* **Obiettivo**: estendere `apply-malus.ts` (M2.T10) affinché il malus cresca in funzione del tempo speso sul sito bloccato, non solo del singolo evento.
* **File**: `lib/score/apply-malus.ts` (estensione)
* **Dipendenze**: M2.T10
* **Criteri di accettazione**:
  - A parità di altre condizioni, un tempo maggiore sul sito bloccato produce un malus maggiore o uguale, mai minore (proprietà monotona testata).

#### M4.T2 — *(Nice to have)* Integrazione TexturePacker / sprite sheet edifici
* **Obiettivo**: sostituire (o affiancare) il render ASCII puro con sprite ottimizzate generate via TexturePacker per ridurre le chiamate di rendering, mantenendo la palette deterministica di M2.T13.
* **File**: `assets/ascii/` (o nuova cartella `assets/sprites/`), aggiornamento `CityCell.tsx`.
* **Dipendenze**: M2.T14
* **Criteri di accettazione**:
  - Nessuna regressione visiva rispetto al comportamento ASCII base (l'ASCII resta il fallback/default se lo sprite non è disponibile).

#### M4.T3 — Hardening errori e logging centralizzato
* **Obiettivo**: introdurre un logger centralizzato (livelli, contesto) usato ai boundary definiti in Sezione 1.4, sostituendo eventuali `console.log` sparsi.
* **File**: `utils/logger.ts`, refactor dei punti di boundary in `entrypoints/background.ts`, error boundary React nel popup.
* **Dipendenze**: M3.T4
* **Criteri di accettazione**:
  - Nessun `catch {}` vuoto rimasto nel codebase (verificabile con una regola lint dedicata o ricerca manuale).
  - Un errore simulato nel background viene loggato con contesto (non silenziato) e non crasha l'intero service worker.

#### M4.T4 — Rifinitura accessibilità popup
* **Obiettivo**: passaggio di controllo su contrasto colori (in particolare l'effetto glow CRT), focus keyboard, etichette ARIA su controlli timer/blocklist.
* **File**: componenti in `components/` coinvolti.
* **Dipendenze**: M3.T7
* **Criteri di accettazione**:
  - Tutti i controlli interattivi raggiungibili da tastiera (tab order sensato).
  - Nessun elemento interattivo privo di label accessibile.

#### M4.T5 — Suite e2e completa multi-scenario
* **Obiettivo**: coprire con Playwright gli scenari end-to-end principali: avvio timer → crescita città, tentativo accesso sito bloccato → overlay → malus, applicazione preset → verifica blocco effettivo.
* **File**: `tests/e2e/*.spec.ts`
* **Dipendenze**: M3.T6
* **Criteri di accettazione**:
  - Ciascuno dei tre scenario sopra ha almeno un test e2e verde su Chromium.

---

## 3. Strategia di testing (TDD)

### 3.1 Regola generale — ciclo red/green/refactor

Per ogni task delle Milestone 1–4 che produce logica non puramente dichiarativa (quindi esclusi task di solo scaffolding come M0.T1, M0.T5), il flusso di lavoro è:

1. **Red** — scrivere il test che descrive il comportamento atteso del criterio di accettazione, verificare che fallisca (o non compili, se il modulo non esiste ancora).
2. **Green** — scrivere il minimo codice necessario a far passare il test.
3. **Refactor** — rifinire il codice (naming, estrazione funzioni, applicazione dei principi di Sezione 1.1) mantenendo i test verdi.

Questo vale in modo particolarmente stringente per tutto ciò che vive in `lib/` (funzioni pure): essendo senza dipendenze browser, non c'è alibi per scrivere l'implementazione prima del test. Per componenti React di sola presentazione (es. `TimerDisplay`), è accettabile scrivere prima un test di rendering minimo ("il componente monta e mostra il testo atteso") e poi iterare.

### 3.2 Strumenti per tipo di test

| Tipo | Strumento | Ambito |
|---|---|---|
| Unit | `vitest` | Funzioni pure in `lib/`, singoli slice Zustand in isolamento (store instanziato ad-hoc nel test, non l'app intera). |
| Component | `vitest` + `happy-dom` + `@testing-library/react` + `@testing-library/user-event` | Componenti React singoli: render, interazione utente, assert su testo/attributi/chiamate a mock delle azioni store. |
| Integrazione | `vitest` + `wxt/testing` (`fakeBrowser`) | Interazione tra più moduli con le API browser mockate: background + store + alarm provider + DNR; content script + message bus. |
| E2E | `@playwright/test` (solo Chromium) | Scenari utente completi con estensione reale caricata in un browser reale: avvio timer, overlay su sito bloccato, applicazione preset. |

Nota: `@testing-library/jest-dom` estende i matcher di `vitest`/`expect` per asserzioni DOM leggibili (es. `toBeInTheDocument`, `toHaveTextContent`) e va configurato in `tests/setup.ts` (M0.T3).

### 3.3 Mappatura test/task

| Task | Tipo test | Strumenti | Casi limite da coprire |
|---|---|---|---|
| M1.T2 (`domain.ts`) | Unit | vitest | Sottodomini multipli, protocolli diversi (http/https), URL senza protocollo, URL malformato, IP al posto di dominio, dominio con porta esplicita. |
| M1.T3 (storage adapter) | Integrazione | vitest + `wxt/testing` | Scrittura/lettura valore grande vicino ai limiti di `storage.local`; `getItem` su chiave inesistente. |
| M1.T4 (store skeleton) | Unit + Integrazione | vitest | Campi volatili non sopravvivono a "riavvio" simulato; campi persistiti sì; `partialize` non esclude per errore un campo che dovrebbe persistere. |
| M1.T5 (alarm adapter) | Unit (via Fake) + Integrazione (via `wxt/testing`) | vitest | Chiamata `schedule` con tempo nel passato; `clear` su alarm non esistente; tick minimo 60s rispettato anche se viene richiesto un intervallo minore. |
| M1.T6 (message bus) | Integrazione | vitest + `wxt/testing` | Messaggio con `type` non riconosciuto; listener multipli sullo stesso `type`; nessun listener registrato (nessun crash). |
| M1.T7 (background skeleton) | Integrazione | vitest + `wxt/testing` | Avvio senza stato pregresso in storage (prima installazione) vs avvio con stato esistente. |
| M2.T1 (`timerSlice`) | Unit | vitest | `pauseTimer()` quando già `idle` (no-op sicuro, non stato inconsistente); `startTimer()` quando già `running` (idempotenza o errore esplicito, da definire). |
| M2.T2 (restore timer) | Integrazione | vitest + `wxt/testing` (fake alarms) | Alarm scaduto proprio durante il "riavvio" simulato (race condition); stato persistito corrotto/parziale. |
| M2.T3 (Timer UI) | Component | Testing Library | Rendering con `remainingSeconds` a 0; rendering con valori > 3600s (formattazione oltre i 60 minuti, comportamento da chiarire). |
| M2.T4 (`blocklistSlice`) | Unit | vitest | Aggiunta dominio già presente in allowlist mentre lo si aggiunge a blocklist (o viceversa); rimozione di un dominio non esistente. |
| M2.T5 (presets data) | Unit | vitest | Validazione struttura dati (ogni preset ha almeno un dominio, tag non vuoto). |
| M2.T6 (DNR rules) | Unit | vitest | Blocklist vuota → nessuna regola; stesso dominio duplicato in blocklist → una sola regola; conflitto allow/block sullo stesso dominio (vedi criterio di accettazione). |
| M2.T7 (apply DNR rules) | Integrazione | vitest + `wxt/testing` | Cambio blocklist mentre `status !== 'running'` → nessuna chiamata a `updateDynamicRules` (o comportamento concordato, vedi §4). |
| M2.T8 (overlay content script) | Component (per `BlockedOverlay.tsx`) + Integrazione (per il content script) | Testing Library, vitest + `wxt/testing` | Overlay montato due volte sulla stessa pagina (idempotenza); messaggio inviato al background quando il background non risponde (timeout). |
| M2.T9 (calculate score) | Unit | vitest | Valori esattamente sui confini (0, 0.2, 0.5, 1.0); valori fuori range [0,1] (input difensivo). |
| M2.T10 (apply malus) | Unit | vitest | Malus applicato quando la città è già "vuota" (nessun edificio da distruggere: comportamento deve essere esplicito, non un crash). |
| M2.T11 (`citySlice`) | Unit | vitest | `destroyBuilding` su coordinate fuori griglia. |
| M2.T12 (growth engine) | Unit | vitest | Delta di tempo zero (no-op); delta molto grande (oltre capienza griglia: comportamento da chiarire, vedi §4); griglia già completamente piena. |
| M2.T13 (palette) | Unit | vitest | Stringa dominio vuota; dominio con caratteri Unicode (IDN). |
| M2.T14 (CityCanvas/CityCell) | Component | Testing Library | Griglia vuota (nessun edificio); griglia con tutte le celle `destroyed`. |
| M2.T15 (growth ↔ tick) | Integrazione | vitest + `wxt/testing` | Tick che avviene mentre `status === 'paused'` (non deve far crescere la città). |
| M2.T16 (malus ↔ distruzione) | Integrazione | vitest + `wxt/testing` | Doppio evento di malus ravvicinato (nessuna doppia applicazione se non intenzionale). |
| M2.T17 (ScoreBadge) | Component | Testing Library | Transizione di stato da `excellent` a `bad` tra due render successivi. |
| M3.T1 (PresetPicker) | Component | Testing Library | Applicare due preset con domini sovrapposti (nessun duplicato risultante, riusa la logica di M2.T4). |
| M3.T2 (TagEditor) | Component | Testing Library | Tag con nome duplicato (case-insensitive?); rimozione di un tag ancora assegnato a siti. |
| M3.T3 (SiteList) | Component | Testing Library | Input vuoto/whitespace; input che `tldts` non riesce a parsare (feedback errore visibile). |
| M3.T4 (App.tsx) | Integrazione (component-level) | Testing Library | Flusso completo: apri popup → applica preset → avvia timer → simula tick → verifica aggiornamento sia timer sia città nello stesso render tree. |
| M3.T5 (animazioni) | Component | Testing Library (con `framer-motion` mockato/disabilitato se necessario per determinismo) | Nessuna asserzione sui tempi di animazione reali in unit/component test (fragile); solo che lo stato finale sia corretto. |
| M3.T6 (multi-browser) | Manuale + preparazione per M4.T5 | — | — |
| M3.T7 (mobile layout) | Component (snapshot/viewport) | Testing Library con viewport forzato, o verifica manuale | — |
| M4.T1 (malus proporzionale) | Unit | vitest | Proprietà monotona testata con più valori crescenti di tempo (property-based semplice o tabella di casi). |
| M4.T2 (TexturePacker) | Component (regressione visiva manuale) | — | — |
| M4.T3 (logging) | Unit + Integrazione | vitest | Un errore lanciato in un punto noto viene effettivamente loggato (spy sul logger) e non propaga fino a crashare il listener. |
| M4.T4 (accessibilità) | Component (a11y) | Testing Library + eventuale `jest-axe` (da valutare se aggiungerla, vedi Sezione 1.4 su dipendenze minime) | — |
| M4.T5 (e2e) | E2E | Playwright | I tre scenari elencati nel criterio di accettazione del task, più un quarto scenario di regressione: build Firefox con stesso scenario del timer (se Playwright + Firefox è disponibile, altrimenti solo Chromium come da vincolo del documento). |

### 3.4 Priorità sulle logiche critiche

In ordine di priorità assoluta (da testare più a fondo, con più casi limite, e da non lasciare mai senza copertura anche sotto pressione di tempo):

1. **Persistenza del timer tramite `browser.alarms`** (M1.T5, M2.T1, M2.T2) — è la logica con più superficie per bug "silenziosi" (timer che si azzera, duplica, o non riprende dopo il riavvio del service worker). Priorità massima perché un bug qui rompe la fiducia dell'utente nell'intero concetto di "sessione di focus".
2. **Parsing URL con `tldts`** (M1.T2) — è la base di sicurezza/correttezza di tutto il sistema di blocco: un bug qui può far passare siti che dovrebbero essere bloccati (o viceversa, bloccare siti legittimi). Va testato con un set ampio di URL reali eterogenei, non solo i casi "felici".
3. **Logica di blocco dei siti** (M2.T6, M2.T7) — direttamente dipendente dal punto precedente; il conflitto allowlist/blocklist va testato esplicitamente come caso di prima classe, non come edge case marginale.
4. **Calcolo dello score e dei malus** (M2.T9, M2.T10, M4.T1) — è il cuore della "gamification" e della percezione di equità da parte dell'utente: i confini tra Excellent/Good/Bad devono essere esatti e coperti da test parametrici su tutti i valori soglia.
5. **Determinismo della palette degli edifici** (M2.T13) — priorità minore rispetto alle precedenti (un colore "sbagliato" non rompe la funzionalità), ma va comunque garantito il determinismo con test di ripetizione, perché è un requisito esplicito del documento sorgente ("lo stesso edificio ha sempre lo stesso colore").

Questi cinque punti vanno inoltre ri-verificati (regressione) ogni volta che si tocca un modulo da cui dipendono, anche se il task che si sta completando è nominalmente un altro (es. modificare `growth-engine.ts` per M4.T1 richiede di rieseguire anche i test di M2.T12).

---