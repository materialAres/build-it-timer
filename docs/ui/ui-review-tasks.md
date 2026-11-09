# UI review — task list

Source: `/impeccable critique entrypoints/popup` (Blocklist focus), run 2026-11-09, score **17/40 (Poor)**.
Full report: `.impeccable/critique/2026-11-09T16-33-10Z__entrypoints-popup.md`.
Design authority: `PRODUCT.md`, `DESIGN.md` ("The Phosphor Skyline").

Tasks are meant to be tackled one at a time, in order. Each card follows the roadmap card shape (`#### <ID> — <Title>`, one-line **Dependencies**).

## Decisions taken (2026-11-09)

- **Custom tags become saved presets.** Tags currently affect nothing: no blocking code reads `tagIds`/`customTags` (only `lib/blocking/store-snapshot.ts` validation and `lib/blocking/legacy-blocklist.ts` migration). They will be reworked into user-defined presets that behave like Social/Video/News. This is new product scope, not only layout.
- **Presets become toggles.** Applying shows an applied state with a count; applying again removes that preset's sites; list rows show which preset a site came from.
- **Tags → saved presets is tracked as a change request**: roadmap **CR4** (`docs/roadmap-en.md` §2.7). Presets-as-toggles is part of the same CR, because it changes the store model and persistence (v3).
- **Adding sites mid-session is allowed** (stricter, never looser): roadmap **CR5** (`docs/roadmap-en.md` §2.8), amending CR2. In `running`/`paused` adding a site or toggling a preset on is allowed; removing, toggling off and managing presets stay `idle`-only; `completed` stays locked until Reset.

- **Duration picker becomes the Duration Drum** (2026-11-09): a terminal-style vertical scroll-wheel over the existing 8 presets, inspired by `docs/ui/references/duration-drum-reference.png` (motion and composition only), specified in `DESIGN.md` → Components → Duration Drum. Tracked as UI.T9. All 8 presets stay.

## Open decisions

- None.

---

#### UI.T1 — Blocklist: one list, shown once, owning the tab
**Priority**: P0 · **Command**: `/impeccable layout` · **Dependencies**: none

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

- Overlay buttons: `Open anyway` / `Back to work` instead of `Yes` / `No`.
- Score: avoid a red `BAD` badge seconds into a session (neutral voice); consider showing tier only after a minimum of elapsed time or a softer early state.
- City tab: empty-state hint that the city grows every 2s of focus.

---

#### UI.T9 — Duration Drum: terminal scroll-wheel duration picker
**Priority**: P1 · **Command**: `/impeccable animate` (motion) after building the component; `/impeccable polish` to finish · **Dependencies**: UI.T5 (shared button/focus styles)

**Spec (normative):** `DESIGN.md` → Components → **Duration Drum (signature)**, plus the `duration-drum*` and `numeral*` tokens in its frontmatter and the `Duration Drum` snippet and `drum-*` motion tokens in `.impeccable/design.json`.
**References:**
- `docs/ui/references/duration-drum-reference.png`: what the user asked for. Copy its **motion and composition only** (centered selected value, faded neighbors, ruler ticks on both edges, snapping vertical wheel). Don't copy its look (white card, grey shading, 3D, hours:minutes).
- `docs/ui/references/duration-drum-target.png`: the static target in the Phosphor Skyline style.

**Problem**
- `components/timer/DurationPicker.tsx` renders 8 grey browser-default buttons below Start: low contrast (4.1:1), too many options at once (8 > 4), and the wrong order (start before choose). The countdown is body-sized text in Chrome's sans.

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

Compare against 17/40 and close the snapshot.
