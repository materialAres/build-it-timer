# Istruzioni — Aggiornare il changelog

> Documento di processo per gli agenti AI. Descrive **quando** e **come** aggiornare `.continue/rules/changelog.md` ogni volta che un task della `docs/roadmap.md` viene completato.

## Regola generale (obbligatoria)

Ogni volta che completi un task della roadmap (Milestone 0–4), **prima di dichiarare il task concluso** devi aggiornare `.continue/rules/changelog.md`. Il changelog è parte integrante della Definition of Done di un task: un task senza voce nel changelog è da considerarsi non concluso.

Vale anche per task parziali: se completi solo una parte di un task, aggiorna la voce con lo stato reale (es. `parziale`) e annota cosa resta.

## Version control — l'agente NON committa né pusha mai

- L'agente **non esegue mai** `git commit`, `git push`, `git tag`, `git merge`, `git rebase`, `git reset` o qualsiasi altro comando che scriva nella storia del repository, né direttamente né tramite strumenti indiretti/alias/script.
- L'agente può usare git **solo in lettura** (`git status`, `git log`, `git diff`, `git show`, `git rev-parse`) per raccogliere informazioni (es. l'hash di un commit già esistente).
- Tutte le modifiche (codice, test, changelog) vengono lasciate **non committate**: è sempre lo sviluppatore umano a revisionare e committare.
- Di conseguenza la colonna `Commit` del changelog **non può** essere compilata dall'agente al momento del task: la compila lo sviluppatore dopo aver committato. Finché il commit non esiste, l'agente scrive `—` (oppure `da committare`) e **non inventa mai un hash**.

## Quando aggiornare

Aggiorna il changelog **subito dopo** aver verificato i criteri di accettazione del task, nello stesso contesto/lavoro in cui prepari l'implementazione (le modifiche restano **non committate**, vedi la sezione "Version control"):

- dopo che i test del task passano (`bun run test`);
- dopo che il type-check è pulito (`bun run compile`);
- dopo aver confermato i criteri di accettazione elencati nella scheda del task.

Non rinviare l'aggiornamento a "dopo": scrivi la voce mentre hai ancora fresco cosa hai realmente fatto, quali file hai toccato e quali criteri hai coperto.

## Come aggiornare (procedura passo-passo)

1. **Leggi lo stato corrente** di `.continue/rules/changelog.md` e la scheda del task in `docs/roadmap.md` (§2).
2. **Compila/correggi la colonna "Commit"**: se lo sviluppatore ha già committato il task, puoi leggere l'hash esistente in sola lettura (`git log --oneline -1`, `git rev-parse --short HEAD`) e inserirlo. Se il task non è ancora committato (caso normale, dato che l'agente non committa mai: vedi "Version control"), scrivi `—` / `da committare` e non inventare alcun hash.
3. **Aggiorna la sezione "Stato attuale"**:
   - sposta il marcatore "Aggiornato a: **<ID task>**";
   - aggiorna lo stato della milestone (completata / in corso, con l'elenco dei task fatti e di quelli rimanenti);
   - aggiorna i **conteggi dei test** (`bun run test` → N test verdi su M file) e lo stato del type-check;
   - se hai toccato il numero di file di test o il totale dei test, i numeri devono riflettere la realtà: non copiarli dal passato.
4. **Aggiungi una riga nella tabella "Riepilogo task completati"** con: `ID`, `Titolo` (dalla roadmap), `Stato`, `Commit`.
5. **Aggiungi la voce di dettaglio** del task nella sezione della milestone corretta, seguendo il formato standard (sotto).
6. **Aggiorna la tabella "Dipendenze aggiunte"** se nel task hai introdotto nuove dipendenze runtime o dev (con versione esatta da `package.json`/`bun.lock`).
7. **Aggiorna "Issue aperte e punti da chiarire"**: aggiungi nuove issue scoperte; rimuovi quelle risolte da questo task. Se il task risolve un'issue esistente, spostala fuori dall'elenco e menzionane la risoluzione nella voce del task.
8. **Non toccare** sezioni non pertinenti al task (evita rumore nel diff).

## Formato della voce di dettaglio (obbligatorio)

Per ogni task completato, aggiungi una sotto-sezione (`###`) nel gruppo della milestone, usando questo schema:

```markdown
### <ID> — <Titolo dalla roadmap>
- <Cosa è stato implementato, in termini di API/comportamento concreti, non di mere intenzioni.>
- File creati/modificati: `<path>` (con una breve descrizione se non ovvio dal nome).
- Dipendenze aggiunte: `<package>` `<versione>` (motivo) — oppure "nessuna".
- Test: `<path test>` (N test, <unit|integrazione|component>) — casi coperti in breve.
- Note/decisioni rilevanti: (es. open point rimandato, scelta di design, comportamento per un caso limite).
- Criteri di accettazione: <verificati / parziali — spiega cosa manca>.
```

## Regole di contenuto

- **Scrivi ciò che è stato realmente fatto**, verificabile dal codice e dai test. Non inventare file, funzioni, test o commit che non esistono: se hai dubbi, controlla con `git show`/`git diff` e con i file reali.
- **Niente dettagli ridondanti**: non incollare interi file; descrivi le API pubbliche e il comportamento rilevante.
- **Riferimenti precisi**: usa i path reali dei file e gli hash reali dei commit.
- **Numeri veritieri**: conteggi di test, versioni di dipendenze e stato lint/type-check devono essere quelli effettivi al momento dell'aggiornamento.
- **Rispetta la lingua del documento**: il changelog è in **italiano**.
- **Stile**: conciso, elenchi puntati, tabelle dove già presenti. Mantieni coerenza con la formattazione esistente (non riformattare sezioni non toccate).
- **Un task = una voce**: non accorpare più task in una sola voce, né spezzare un task su più voci.

## Distinzione tra "completato" e "nice-to-have"

- Se il task è marcato *(Nice to have)* nella roadmap, indicalo nella voce (es. `stato: completato (nice-to-have)`).
- Se il task è stato **saltato** o **rinviato**, non aggiungerlo alla tabella dei completati: annota il rinvio (e il motivo) in "Issue aperte e punti da chiarire" o in una nota di stato.

## Verifica finale dell'aggiornamento

> Ricorda: l'agente **non committa mai** (vedi "Version control"). Questa checklist va eseguita prima di concludere il task e lasciare le modifiche pronte per la revisione umana.

Prima di concludere il task, controlla che:

- [ ] esiste esattamente una voce di dettaglio per il task appena completato;
- [ ] la tabella di riepilogo contiene la riga del task; la colonna `Commit` riporta un hash reale solo se il commit esiste già, altrimenti `—` / `da committare`;
- [ ] "Stato attuale" e i conteggi (test / type-check) riflettono la realtà;
- [ ] le nuove dipendenze sono elencate con la versione esatta;
- [ ] le issue risolte sono state rimosse e quelle nuove aggiunte;
- [ ] nessuna sezione non correlata è stata alterata.

Se uno di questi punti non è soddisfatto, l'aggiornamento del changelog è incompleto.

## Esempio minimo di aggiornamento

Per il completamento di un ipotetico `M1.T4`:

1. riga in tabella: `| M1.T4 | Store Zustand — scheletro + combinazione slice | completato | — (da committare) |` (l'hash reale lo aggiunge lo sviluppatore dopo il commit)
2. voce di dettaglio:

```markdown
### M1.T4 — Store Zustand — scheletro + combinazione slice
- `store/index.ts` combina gli slice (stub) con il middleware `persist`, usando `browserStorage` (M1.T3); `partialize` esclude i campi volatili (timer a grana fine, stato UI, flag temporanei).
- File creati/modificati: `store/index.ts`, `store/timer.slice.ts`, `store/city.slice.ts`, `store/blocklist.slice.ts`, `store/score.slice.ts`.
- Dipendenze aggiunte: nessuna.
- Test: `tests/unit/store/store.test.ts` (N test, unit+integrazione) — campo persistito sopravvive al "riavvio"; campo volatile torna al default.
- Note: esporta l'hook unico `useAppStore` + selector granulari per slice.
- Criteri di accettazione: verificati.
```

3. aggiornamento di "Stato attuale" (conteggio test, marcatore "Aggiornato a: M1.T4").
