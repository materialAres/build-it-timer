# UI review — task list

Source: `/impeccable critique entrypoints/popup` (Blocklist focus), run 2026-11-09, score **17/40 (Poor)**.
Full report: `.impeccable/critique/2026-11-09T16-33-10Z__entrypoints-popup.md` (local only: `.impeccable/critique/` is gitignored because snapshots hold machine-specific absolute paths; this file is the committed backlog).
Design authority: `PRODUCT.md`, `DESIGN.md` ("The Phosphor Skyline").

Tasks are meant to be tackled one at a time, following **Execution order** below, not the numeric order of the IDs. Each card follows the roadmap card shape (`#### <ID> — <Title>`, one-line **Dependencies**).

## Decisions taken (2026-11-09)

- **Custom tags become saved presets.** Tags currently affect nothing: no blocking code reads `tagIds`/`customTags` (only `lib/blocking/store-snapshot.ts` validation and `lib/blocking/legacy-blocklist.ts` migration). They will be reworked into user-defined presets that behave like Social/Video/News. This is new product scope, not only layout.
- **Presets become toggles.** Applying shows an applied state with a count; applying again removes that preset's sites; list rows show which preset a site came from.
- **Tags → saved presets is tracked as a change request**: roadmap **CR4** (`docs/roadmap-en.md` §2.7). Presets-as-toggles is part of the same CR, because it changes the store model and persistence (v3).
- **Adding sites mid-session is allowed** (stricter, never looser): roadmap **CR5** (`docs/roadmap-en.md` §2.8), amending CR2. In `running`/`paused` adding a site or toggling a preset on is allowed; removing, toggling off and managing presets stay `idle`-only; `completed` stays locked until Reset.

- **Duration picker becomes the Duration Drum** (2026-11-09): a terminal-style vertical scroll-wheel over the existing 8 presets, inspired by `docs/ui/references/duration-drum-reference.png` (motion and composition only), specified in `DESIGN.md` → Components → Duration Drum. Tracked as UI.T9. All 8 presets stay.

## Open decisions

- None.

## Decisions taken (2026-11-10, after the UI.T8 critique)

- Follow-ups UI.T10–UI.T13 cover the critique's findings except the **City canvas overflow** (P1), which the user chose not to take on. Revisit it only if the popup is seen clipped in real Chrome. Re-run the critique after UI.T10–UI.T13 to compare against 26/40.

## Decisions taken (2026-11-11, CR6 three.js city)

- The City tab is rebuilt by **CR6** (roadmap §2.9): a three.js city from a per-session plan, with an ASCII fallback. The City canvas overflow decision above is **superseded**: the new view is sized to the tab width.
- Order: **UI.T10** first (no city impact), then **CR6.T1–CR6.T8a**, then **UI.T11** and **UI.T12** built on the new view, **UI.T13** whenever (no city impact). UI.T11's tier legend and `STARTING` treatment do not touch the city and may be done earlier; its empty-city hint waits for CR6.T8a.
- UI.T12's Timer-tab strip is **text only** (score badge and population): showing the 3D city there would load three.js on the Timer tab and break CR6's lazy-loading rule.

## Execution order

The IDs reflect the order findings were recorded, not the order of work. Follow this sequence; it is derived from the **Dependencies** fields here and in the roadmap cards for CR4 (§2.7) and CR5 (§2.8).

| Step | Task | Why here |
|---|---|---|
| 1 | **UI.T1**: one blocklist, shown once | No dependencies. CR4.T5, CR5.T3, UI.T4 and UI.T6 all build on its layout. |
| 2 | **CR4.T1 → CR4.T2 → CR4.T3 → CR4.T4**: analysis, toggle logic, store + v3 migration, messages | The logic behind UI.T2/UI.T3. CR4.T1 is analysis only and may run alongside step 1. |
| 3 | **CR4.T5**: preset toggles + saved-preset UI | Needs CR4.T4 and UI.T1. **Completing it also completes UI.T2 and UI.T3**; they are not separate work. |
| 4 | **CR4.T6**: docs, changelog, gate | Closes CR4. |
| 5 | **CR5.T1 → CR5.T2 → CR5.T3 → CR5.T4**: adding sites during a session | CR5.T1 needs CR4.T3, so "toggle a preset on" is opened mid-session in one pass. |
| 6 | **UI.T4**: "Blocks N sites" line + add-only notice | Needs CR5's notice behavior and copy. |
| 7 | **UI.T5**: visual coherence pass | After the structure settles (UI.T1–UI.T4), so nothing gets polished and then rewritten. |
| 8 | **UI.T9**: Duration Drum | Reuses UI.T5's pill and focus styles. |
| 9 | **UI.T6**: edge cases and feedback | Needs the final list and presets; running it late also covers the Timer tab and the drum. |
| 10 | **UI.T7**: minor items | Copy and small polish, last. |
| 11 | **UI.T8**: re-run the critique | Done: 26/40. Findings became UI.T10–UI.T13. |
| 12 | **UI.T10**: status copy and affordances | First follow-up: small, copy-only, no layout risk. |
| 13 | **CR6.T1 → CR6.T8a**: three.js city up to the popup view (roadmap §2.9) | Replaces the City tab; the city-related UI work below is built on it. CR6.T8b–CR6.T13 may continue in parallel with steps 14–16. |
| 14 | **UI.T11**: explain the score and the empty city | Needs the final copy voice from UI.T10; the empty-city hint needs CR6.T8a's view (legend and `STARTING` may go earlier). |
| 15 | **UI.T12**: live strip on the Timer tab | Needs CR6.T8a (City-tab height known); text-only strip. |
| 16 | **UI.T13**: undo after Reset, whole-domain hint | P3; no city impact, can run any time after UI.T10. |

Notes:
- **Gap between steps 1 and 3.** UI.T1 removes the tag checkbox grid before CR4 replaces tags, so tags can't be assigned from the popup in between. This is harmless: tags don't affect blocking, persisted tag data is untouched, and CR4.T3 migrates it.
- **UI.T9 may move earlier.** Its dependency on UI.T5 is soft (shared styles only) and it doesn't touch the blocklist. It can run any time after step 1; UI.T5 then restyles its focus ring and pills.
- **Roadmap tasks (CR4.\*, CR5.\*)** are done only with a changelog entry via the `changelog` skill (CLAUDE.md §4). UI.T\* cards are not roadmap tasks.
- **One task per session**: start with "do <ID> from `docs/ui/ui-review-tasks.md`" (or the roadmap for CR tasks) and read only that card and the cards it depends on.

---

#### UI.T1 — Blocklist: one list, shown once, owning the tab
**Priority**: P0 · **Command**: `/impeccable layout` · **Dependencies**: none

**Status**: done (2026-11-09, `6fed253`). One list in `SiteList` with a heading count, empty state and source chips (`SiteEntry`, `lib/blocking/entry-sources.ts`); presets passed in as the `quickAdd` slot with a visible label; the list scrolls inside a 17rem cap (fullest locked state: 455px). `TagEditor` is no longer rendered (deleted in CR4.T3). Visual drift (blue, grey buttons) is left to UI.T5.

**Problem**
- `TagEditor.tsx:198-207` renders every blocked domain with tag checkboxes; `SiteList.tsx:159-176` renders the same domains again under "Blocked sites".
- `App.tsx:71-86` orders the tab Presets → tag editor (no heading) → Blocked sites, so the core list comes last and the only heading sits mid-tab.
- After two presets and two tags the tab is 729px tall, over Chrome's 600px popup cap; DESIGN.md's "never scrolls" rule breaks.
- Screen readers announce every domain twice; the keyboard walk is ~26 Tab stops.

**Target structure**
1. "Blocked sites" heading with a count.
2. Add field (+ Add).
3. Preset quick-add row under the field (see UI.T2).
4. One list: domain · source chip (preset/custom preset) · ×.
5. Empty state for zero sites.

**Acceptance criteria**
- Each domain appears exactly once in the DOM and in the accessibility tree.
- The tag checkbox grid is gone.
- With the three built-in presets applied, the popup stays within 600px (list scrolls internally if needed, the popup doesn't).
- Tab order: heading region → field → Add → presets → list rows.

---

#### UI.T2 — Presets as toggles
**Priority**: P1 · **Command**: `/impeccable layout` (UI) + TDD on store/lib logic · **Dependencies**: UI.T1 · **Implemented by**: CR4.T1–CR4.T5 (logic), UI side in CR4.T5

**Status**: done with CR4.T5 (2026-11-09). Preset pills are green toggles (`aria-pressed`) with a count (`total` while off, `covered/total` once a site was removed by hand), the domains in the tooltip, dimmed when locked; rows carry source chips. The other popup controls keep their pre-UI.T5 look.

**Problem**
- `applyPreset` (`store/blocklist.slice.ts:255-280`) inserts domains once: no applied state, no `aria-pressed`, no feedback, no undo. The preset tag ids are never shown.

**Acceptance criteria**
- A pure function in `lib/blocking/` computes the toggle (add / remove a preset's domains), with unit tests written first (§3.1). Removing a preset keeps domains that were also added manually or by another applied preset.
- Preset buttons expose `aria-pressed` and show state + count (e.g. `Social ✓ 4`).
- Each list row shows its source preset as a chip.
- A preset's domains are inspectable before applying (expand or tooltip).
- Presets are visibly dimmed when the blocklist is locked (today they keep glowing).

---

#### UI.T3 — Custom tags become saved presets
**Priority**: P1 · **Command**: `/impeccable shape` first (new scope), then implement · **Dependencies**: UI.T2 · **Implemented by**: CR4 (analysis CR4.T1, migration CR4.T3, UI CR4.T5)

**Status**: done with CR4.T5 (2026-11-09). "Save list as preset" (name validated with the reason shown) and "Edit saved presets" (rename in place, delete after a confirmation that says the sites stay blocked); saved presets toggle next to the built-in ones; tags migrate to saved presets (CR4.T3).

**Problem**
- Creating a tag changes nothing about blocking; it only filters the duplicated list. Trust breaker and the heaviest clutter on the tab.

**Direction**
- "Save current list as preset" / "New preset" creates a user preset that sits next to Social/Video/News and toggles exactly like them (UI.T2).
- Reuse the existing data-driven `Preset` shape (Open/Closed, §1.1); migrate existing `customTags` + `tagIds` into user presets (extend `legacy-blocklist.ts`/persist migration).

**Acceptance criteria**
- No standalone tag editor remains in the popup.
- User presets can be created, renamed or deleted, and toggled; deletion asks for confirmation or offers undo.
- Existing persisted tags migrate without data loss (migration test).
- i18n keys for all new strings in `locales/en.yml` and `locales/it.yml`.
- Roadmap cards exist: CR4 in `docs/roadmap-en.md` §2.7. Follow them; this card only holds the UX intent.

---

#### UI.T4 — Reassurance before the session lock
**Priority**: P1 · **Command**: `/impeccable clarify` · **Dependencies**: UI.T1, CR5 (`docs/roadmap-en.md` §2.8; notice copy in CR5.T3)

**Status**: done (2026-11-09). Implemented directly, without running the impeccable command. `BlocklistSummary` (`components/blocklist/BlocklistSummary.tsx`) sits under Start on the Timer tab as a monospace, dotted-underline link to the Blocklist tab: `Blocks N sites · add-only during a session` (singular `Blocks 1 site …`), or `No sites blocked`. The notice is shorter: `blocklist.addOnly` (running/paused) "Sites can be added during a session. Removing them needs a timer reset." and `blocklist.locked` (completed) "The blocklist is locked. Reset the timer to edit it.", rendered in explicit monospace; EN and IT. Checked in the built extension at 420px (empty, with sites, running, notice): the notice wraps to two lines and the Timer tab stays short.

**Problem**
- Start says nothing about the blocklist; users first learn about the lock from the amber notice afterwards, which tells them to Reset (losing the city).
- Decided: sites can be added during a session (CR5), so a forgotten site no longer forces a Reset. Only removals and preset changes stay locked.

**Acceptance criteria**
- A quiet line under Start: `Blocks N sites · add-only during session` (wording to refine), or `No sites blocked` when empty, linking to the Blocklist tab.
- The lock notice becomes an add-only notice during `running`/`paused` (sites can be added; removing needs Reset) and keeps the Reset wording in `completed`. It is shorter and renders in monospace.
- Neutral voice per PRODUCT.md (no scolding, no cheering).

---

#### UI.T5 — Visual coherence across the popup
**Priority**: P1 · **Command**: `/impeccable polish` (then `/impeccable typeset` for the timer numeral) · **Dependencies**: UI.T1–UI.T4

**Status**: done (2026-11-09). Implemented directly, without running the impeccable command. Shared rules in `entrypoints/popup/App.css`, all in `:where()` so components override them: every popup button is the outline pill (Start/Pause/Reset, Add, ×, the duration buttons until UI.T9), one phosphor focus ring, the placeholder at `#8a948e` (6.14:1, was 4.17:1) and `.timer-controls` spaced. `entrypoints/popup/style.css` gives inputs the monospace stack. The blocklist input and preview are phosphor green (no blue left outside the score tier), `#e9ecef` became `#e6e6e6`, blocks are 0.6rem apart and rows 0.35rem. `tests/unit/styles/popup-styles.test.ts` guards these. The timer numeral and the duration picker stay with UI.T9. Checked in the built extension at 420px (idle, running, empty, 22 sites with the save form open, the notice): the tallest state is 565px, under Chrome's 600px cap.

**Problem** (DESIGN.md "known deviations")
- Blue accent `#4dabf7` in `PresetPicker.tsx:21`, `TagEditor.tsx:32,51`, `SiteList.tsx:32,39` (One Beam Rule).
- Browser-default grey buttons: Add, ×, Create tag, Start/Pause/Reset, durations; grey buttons nested in tag pills.
- Chrome's injected sans on inputs and `.popup-section__lock` (Explicit Mono Rule).
- Placeholders `#757575` on `#0b0f14` = 4.17:1 (fails AA); selected duration 4.1:1 on grey.
- Browser-default white focus rings on most controls.
- `#e9ecef` duplicates `#e6e6e6`; gaps 0.6rem vs 0.4rem between blocklist blocks.

**Acceptance criteria**
- Only phosphor green as interface accent (score tier colors excepted).
- Every action is an outline pill or documented toggle; no native-styled button remains.
- All text, inputs and placeholders in the mono stack; placeholder contrast ≥ 4.5:1.
- Phosphor focus ring on every focusable control.
- The Timer tab's numeral and the duration picker are UI.T9's job (Duration Drum); UI.T5 only restyles Start/Pause/Reset.

---

#### UI.T6 — Edge cases and feedback
**Priority**: P2 · **Command**: `/impeccable harden` · **Dependencies**: UI.T1, UI.T2

**Status**: done (2026-11-10). Implemented directly, without running the impeccable command. New rows are highlighted for about 1.6s and the first is scrolled into view (the list keeps its order rather than moving new entries to the top). A live region (`data-announcement`, `aria-live="polite"`) announces what changed from the list's own diff (`lib/blocking/diff-domains.ts`): `Added 4 sites`, `Removed 4 sites`, `Removed a.com.`; a site typed in the form keeps its own visible feedback and is not announced twice. `Added x.` fades after 3s; an error stays until the field is edited. Rejected entries say why (`lib/blocking/entry-error.ts`): empty, an IP address, a bare public suffix named back to the user (`com is a domain ending, not a site…`), or the generic message; the error is linked to the field with `aria-describedby` and `aria-invalid`. Long domains and source chips truncate with an ellipsis and keep the full text in a tooltip; long feedback wraps. The tab panel was already named after its tab (`aria-labelledby`), so only a test was added. EN and IT. Checked in the built extension at 420px (suffix and IP errors, a 62-character domain, a long preset chip, a preset toggle).

**Acceptance criteria**
- New entries appear at the top of the list (or are scrolled into view) and are briefly highlighted.
- Applying/removing a preset announces the change (`Added 4 sites` / `Removed 4 sites`) in a live region.
- "Added x." feedback clears on its own.
- Specific error copy (e.g. bare public suffix `com`), linked to the input via `aria-describedby`.
- Consistent long-domain truncation with full name available (title/tooltip).
- Popup tab panel gets a proper accessible name (not all its inner text).

---

#### UI.T7 — Minor items
**Priority**: P3 · **Command**: `/impeccable clarify` / `/impeccable polish` · **Dependencies**: UI.T5

**Status**: done (2026-11-10). Implemented directly, without running the impeccable commands. Overlay buttons read `Open anyway` / `Back to work` (keys `overlay.openAnyway`, `overlay.backToWork`; IT `Apri comunque` / `Torna al lavoro`). The score badge shows a neutral grey `Starting` until a tenth of the session is built (`lib/score/score-reveal.ts`, `SCORE_REVEAL_RATIO`) and never for a `completed` session; only `bad` is held back, the other tiers are earned. The City tab shows `CityEmptyHint` while idle with nothing built. The hint does not say "every 2s": the cadence is `duration ÷ 600` characters (3s for 30 min), so the copy stays general. EN and IT.

- Overlay buttons: `Open anyway` / `Back to work` instead of `Yes` / `No`.
- Score: avoid a red `BAD` badge seconds into a session (neutral voice); consider showing tier only after a minimum of elapsed time or a softer early state.
- City tab: empty-state hint that the city grows every 2s of focus.

---

#### UI.T9 — Duration Drum: terminal scroll-wheel duration picker
**Priority**: P1 · **Command**: `/impeccable animate` (motion) after building the component; `/impeccable polish` to finish · **Dependencies**: UI.T5 (shared button/focus styles)

**Status**: done (2026-11-09). Implemented directly, without running the impeccable commands. Pure math in `lib/timer/duration-drum.ts` (index, step, clamp, snap, rubber-band, row opacity/scale/colour/glow, wheel accumulation, key targets; 30 tests written first); `components/timer/DurationDrum.tsx` composes `DrumRow`, `DrumRuler` and the existing `TimerDisplay`; input in `use-drum-gesture.ts` (pointer, keys) and `use-drum-wheel.ts`; the single settle-time request in `use-drum-commit.ts`; `framer-motion` only. `DurationPicker.tsx` is removed. Idle it is a `spinbutton` (5–120 min, `aria-valuetext` `30 min`); in a session the wheel fades out over 200ms and the countdown shows in the same 8.5rem frame, and Reset reverses it. Reduced motion: no animation or rubber-band, 80ms opacity crossfade. Layout: the drum comes first on the Timer tab, then Start/Pause/Reset and the blocklist summary. Checked in the built extension at 420px (idle, a step, the end row, mid-drag, after a drag, running, Reset, reduced motion); the Timer tab is 256px tall.

**Spec (normative):** `DESIGN.md` → Components → **Duration Drum (signature)**, plus the `duration-drum*` and `numeral*` tokens in its frontmatter and the `Duration Drum` snippet and `drum-*` motion tokens in `.impeccable/design.json`.
**References:**
- `docs/ui/references/duration-drum-reference.png`: what the user asked for. Copy its **motion and composition only** (centered selected value, faded neighbors, ruler ticks on both edges, snapping vertical wheel). Don't copy its look (white card, grey shading, 3D, hours:minutes).
- `docs/ui/references/duration-drum-target.png`: the static target in the Phosphor Skyline style.

**Problem**
- (Resolved by UI.T9.) `components/timer/DurationPicker.tsx` rendered 8 grey browser-default buttons below Start: low contrast (4.1:1), too many options at once (8 > 4), and the wrong order (start before choose). The countdown is body-sized text in Chrome's sans.

**Acceptance criteria**
- Values come from `FOCUS_PRESETS` (`lib/timer/focus-presets.ts`); no hard-coded list. A finite list that doesn't loop.
- 3 visible rows plus faded edges; zero-padded `005`…`120`; fixed `MIN` label; hairlines and major ruler ticks frame the selected row; minor ticks scroll with the rows.
- Input: drag/swipe, wheel (one step per notch, trackpad-throttled), click a neighbor, ArrowUp/Down, PageUp/Down (±2), Home/End.
- Motion: 180ms `cubic-bezier(0.22, 1, 0.36, 1)` per step, momentum then always snap, a 0.25-row rubber-band at the ends; `prefers-reduced-motion` gives an 80ms crossfade with no momentum. `framer-motion` only, no new dependency.
- `requestSetDuration` is sent once on settle, never per intermediate row.
- `role="spinbutton"` with `aria-valuemin`/`max`/`now` in minutes, `aria-valuetext` from `timer.durationOption`, label from `timer.durationLabel`; neighbors and ruler `aria-hidden`; phosphor focus outline.
- In `running`/`paused`/`completed` the drum doesn't scroll and **becomes the clock**: the neighbors, ruler and `MIN` fade out (200ms) and the countdown renders in the same slot with the same Numeral type; Reset reverses it. Layout height doesn't change between the two states.
- Timer tab order: drum/clock, then Start/Pause/Reset.
- Architecture (CLAUDE.md §1): the index/step/clamp/snap math is a pure function in `lib/timer/` (e.g. `computeDrumIndex`), written test-first; gesture handling is in a hook (e.g. `components/timer/use-drum-gesture.ts`); `DurationDrum.tsx` only renders. Each file ≤ 200 lines. `TimerDisplay`'s countdown estimate (`use-countdown-estimate.ts`) is reused, not duplicated.
- Tests: pure index math (bounds, steps, snapping); component rendering of the spinbutton contract and keyboard steps; a single commit on settle (mocked `requestSetDuration`); locked state renders the countdown and ignores input.
- Visual check at popup size (~420px wide) against `duration-drum-target.png`, idle and running.

---

#### UI.T8 — Re-run the critique
**Command**: `/impeccable critique entrypoints/popup` · **Dependencies**: UI.T1–UI.T7, UI.T9

**Status**: critique re-run (2026-11-10): **26/40 (Acceptable)**, up from 17/40; snapshot `.impeccable/critique/2026-11-10T12-05-34Z__entrypoints-popup.md` (local only). The first snapshot (17/40) is not closed yet: `/impeccable polish` closes it. Open findings: P1 the City canvas is about 492px wide and overflows a 420px popup, P1 time, city and score live on three tabs, P2 paused and Resume copy plus a stale blocklist summary after Reset (the summary target is 13px tall), P2 nothing explains the score tiers, P3 Reset has no undo. Detector: 8 advisory findings, none structural; `#8a948e` is missing from DESIGN.md's front-matter tokens.

Compare against 17/40 and close the snapshot.

---

#### UI.T10 — Status copy and affordances
**Priority**: P2 · **Command**: `/impeccable clarify` · **Dependencies**: UI.T8

**Problem** (critique 26/40)
- While `paused` the main button still says `Start` (the locale has only `timer.start` and `timer.pause`) and nothing marks the pause.
- `BlocklistSummary` keeps `Blocks N sites · add-only during a session` after Reset (idle), when removal is allowed again.
- The summary is dotted text but a tab stop, 115×13px: below the 24px target size and not obviously a link.
- The tab is `Blocklist`, the heading `Blocked sites`.

**Acceptance criteria**
- Paused shows a visible, quiet marker on the clock (for example the digits dimmed plus a `Paused` label in the same slot, no layout shift) and the button reads `Resume` (EN and IT, both locales, drift test green).
- The summary drops `add-only during a session` unless a session is running or paused; idle copy states only the count.
- The summary is a clear link/button with a target of at least 24px tall, in the shared outline style.
- One name for the list in the tab and the heading.
- Neutral voice kept (PRODUCT.md): no cheering or scolding.
- Tests: label per status, idle vs in-session summary, target size class.

---

#### UI.T11 — Explain the score and the empty city
**Priority**: P2 · **Command**: `/impeccable onboard` · **Dependencies**: UI.T10; the empty-city hint part: CR6.T8a

**Problem**
- The Score tab never says what the tiers mean (30/70/100% of the city) or what population counts.
- The empty City canvas is a blank box; the hint sits below it, away from the eye.
- `STARTING` looks like a disabled button.

**Acceptance criteria**
- A quiet tier legend on the Score tab (factual: `Good from 30%, Great from 70%, Excellent at 100%`), data-driven from `COMPLETION_BANDS`, not hard-coded.
- The empty-city hint moves into or directly under the 3D view (CR6.T8a); it still disappears once a session runs or a city exists.
- The `STARTING` state is visibly a status, not a control (shape or treatment differs from the pills that act); keep it neutral.
- EN and IT; no number that depends on the session length (the cadence is `duration ÷ 600`).

---

#### UI.T12 — Live strip on the Timer tab
**Priority**: P1 · **Command**: `/impeccable layout` · **Dependencies**: UI.T10, UI.T11, CR6.T8a

**Problem**
- Time, city and score live on three tabs, so the feedback loop is split: the running Timer tab is a clock in an empty frame, and the City tab cannot show the time left.

**Acceptance criteria**
- While `running`/`paused`, the Timer tab shows a compact read-only **text** strip (the score badge plus population) under the clock. No city rendering on the Timer tab: three.js loads only with the City tab (CR6).
- The City tab shows the remaining time in one quiet line next to the 3D view while a session is active, within the 600px height cap measured after CR6.T8a.
- Presentation only: values come from existing selectors; no new store state; the Timer tab stays under the 600px popup cap.
- Idle layout does not change.

---

#### UI.T13 — Undo after Reset, whole-domain hint
**Priority**: P3 · **Command**: `/impeccable harden` · **Dependencies**: UI.T12

**Problem**
- Reset is one click and discards the in-progress city.
- Adding `news.ycombinator.com` silently becomes `ycombinator.com` (the whole domain); only the confirmation line shows it.

**Acceptance criteria**
- Decide in the shape step whether Reset needs an undo window or a confirm step; the background stays the single writer, so any undo is a background message, not popup-only state.
- When normalization widens a subdomain, the add feedback says so plainly (`Added ycombinator.com (the whole domain).`), EN and IT.
- Tests for both paths; no regression to the add-only window (CR5).
