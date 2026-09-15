# 1 -- Principi di design

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

# 2 -- Organizzazione del codice

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
