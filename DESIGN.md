---
name: Build-it! Timer Focus
description: A phosphor-green CRT terminal where focus time grows an ASCII skyline.
colors:
  phosphor-green: "#7dfba0"
  phosphor-rule: "rgba(125, 251, 160, 0.35)"
  phosphor-wash: "rgba(125, 251, 160, 0.12)"
  phosphor-wash-hover: "rgba(125, 251, 160, 0.15)"
  crt-black: "#050805"
  night-sky: "#000000"
  city-floor: "#000000"
  city-grid: "#7dfba0"
  city-rain: "#7dfba0"
  city-hud: "#7dfba0"
  ink-field: "#0b0f14"
  moss-frame: "#1f3d2b"
  overlay-panel: "#0b1410"
  overlay-frame: "#2f6b45"
  overlay-scrim: "rgba(4, 8, 12, 0.92)"
  screen-white: "#e6e6e6"
  pale-phosphor: "#cfe9d8"
  sodium-amber: "#ffd43b"
  lamp-amber: "#ffd479"
  alarm-red: "#ff6b6b"
  alarm-red-soft: "#ff9b9b"
  alarm-red-frame: "#8c3b3b"
  score-excellent: "#51cf66"
  score-great: "#4dabf7"
  score-good: "#fcc419"
  score-bad: "#ff6b6b"
typography:
  display:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 400
    letterSpacing: "0.05em"
  numeral:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "\"tnum\" 1"
  numeral-neighbor:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1.35rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "\"tnum\" 1"
  title:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1.1rem"
    fontWeight: 700
  body:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    letterSpacing: "0.14em"
  tab:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.1em"
  city:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  sm: "4px"
  md: "0.5rem"
  pill: "999px"
spacing:
  xxs: "0.15rem"
  xs: "0.25rem"
  sm: "0.35rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.5rem"
components:
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-green}"
    typography: "{typography.tab}"
    rounded: "{rounded.sm}"
    padding: "0.35rem 0.7rem"
  tab-selected:
    backgroundColor: "{colors.phosphor-wash}"
    textColor: "{colors.phosphor-green}"
    typography: "{typography.tab}"
    rounded: "{rounded.sm}"
    padding: "0.35rem 0.7rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-green}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.7rem"
  button-outline-hover:
    backgroundColor: "{colors.phosphor-wash-hover}"
    textColor: "{colors.phosphor-green}"
  duration-drum:
    backgroundColor: "{colors.crt-black}"
    textColor: "{colors.phosphor-green}"
    typography: "{typography.numeral}"
    rounded: "{rounded.sm}"
    height: "8.5rem"
    width: "100%"
  duration-drum-neighbor:
    textColor: "{colors.screen-white}"
    typography: "{typography.numeral-neighbor}"
  input:
    backgroundColor: "{colors.ink-field}"
    textColor: "{colors.screen-white}"
    typography: "{typography.body}"
    padding: "0.3rem 0.5rem"
  score-badge:
    backgroundColor: "transparent"
    rounded: "{rounded.pill}"
    padding: "0.15rem 0.6rem"
  city-canvas:
    backgroundColor: "{colors.night-sky}"
    textColor: "{colors.phosphor-green}"
    typography: "{typography.city}"
    rounded: "{rounded.sm}"
  overlay-panel:
    backgroundColor: "{colors.overlay-panel}"
    textColor: "{colors.pale-phosphor}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
  overlay-button:
    backgroundColor: "transparent"
    textColor: "{colors.phosphor-green}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1.25rem"
  overlay-button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.alarm-red-soft}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1.25rem"
---

# Design System: Build-it! Timer Focus

## Overview

**Creative North Star: "The Phosphor Skyline"**

The CRT glow and the city are one image. The popup is a dark night sky (`crt-black`), and the 3D skyline lights it up one floor at a time: neon edges on dark bodies over a black ground, with a faint bloom and a CRT scanline. Every other part of the interface (tabs, timer, controls, score) belongs to that same sky. It is dim, monospace and flat, so the skyline stays the brightest thing on screen.

The popup is dense and small. Users open it for a few seconds, read the state and close it. Hierarchy comes from brightness and glow, not size. Uppercase, letter-spaced labels name the sections, body text sits at a quiet 0.8rem, and the phosphor glow (`text-shadow: 0 0 4px currentColor`) appears only on text that is active, earned or alarming. The tone follows PRODUCT.md: neutral and minimal. The skyline shows progress and loss, and the interface stays out of its way.

The blocked-site overlay carries the same world onto a page that isn't the extension's. It uses a scrim (a translucent dark layer over the page), one glowing panel, and plain wording.

**Key Characteristics:**
- Dark CRT ground (`#050805`). No light theme exists or is planned.
- One monospace stack for everything, including text the popup gets from its browser defaults.
- Phosphor green (`#7dfba0`) is the one interface accent. Glow marks emphasis.
- Thin 1px rules and outlines carry structure. Nothing is filled or raised.
- Pills (999px) for actions and status, 4px corners for frames and tabs.
- The city grows floor by floor: a new floor drops in over 360ms, a removed floor glitches out in red (see City 3D motion).

## Colors

The palette is a phosphor monitor at night: a near-black ground, one green beam, and a few warm signal colors kept for warnings and scores.

### Primary
- **Phosphor Green** (`phosphor-green`): the one interface accent. It colors the tabs, the selected duration, the export actions, the overlay title and buttons, and the default city glyphs. Wherever something is active or has been earned, it glows in this color.
- **Phosphor Rule** (`phosphor-rule`): the 35% green line under the tab bar and around the selected tab.
- **Phosphor Wash** (`phosphor-wash`, `phosphor-wash-hover`): a 12–15% green fill behind the selected tab and behind outline buttons on hover. This is the only fill an interactive element ever gets.

### Neutral
- **CRT Black** (`crt-black`): the popup ground, with a slight green tint.
- **Night Sky** (`night-sky`): the city canvas backdrop.
- **Ink Field** (`ink-field`): the background of text inputs.
- **Moss Frame** (`moss-frame`): the 1px frame around the city canvas.
- **Screen White** (`screen-white`): the default text color. `#e9ecef` in the blocklist components is a near-duplicate and should merge into this.
- **Overlay Panel / Overlay Frame / Overlay Scrim** (`overlay-panel`, `overlay-frame`, `overlay-scrim`): the blocked-site overlay. The panel is a dark green box on a 92% near-black scrim, framed in a muted green.
- **Pale Phosphor** (`pale-phosphor`): the overlay's body copy, a softened green-white.

### Signal (not accents)
- **Sodium Amber** (`sodium-amber`): the lock notice shown while a session is running (the blocklist can't be edited).
- **Lamp Amber** (`lamp-amber`): the blocked domain highlighted inside the overlay message.
- **Alarm Red** (`alarm-red`, `alarm-red-soft`, `alarm-red-frame`): errors, removal and the "Open anyway" choice (the other button is "Back to work") in the overlay.

### Score tiers
`score-excellent`, `score-great`, `score-good` and `score-bad` color only the score badge and the session-history rows. Their only job is to tell the four tiers apart. `score-great` is blue, and that's allowed only here.

### City environment and session palettes
The city's environment is fixed (`lib/city/plan/environment-colors.ts`): a black floor (`city-floor`), a phosphor-green grid (`city-grid`), rain (`city-rain`) and HUD text (`city-hud`). They never change with the session and are not part of any palette.

Only the buildings change. Each session draws one palette from `lib/city/plan/city-palettes.ts` (Neon City, Sunset Strip, Arctic Dawn, Toxic Grid, Synthwave, Amber Terminal), turns its hues by up to 25° either way, and gives every building a color from it, so no two buildings that share an edge match. Every building, window, lamp and sign color keeps a contrast ratio of at least 4.5:1 on the black floor. Session palettes are the one sanctioned exception to the One Beam Rule: they are the city's contents, not interface tokens, and they never reach a button, tab or text.

### Named Rules
**The One Beam Rule.** Phosphor green is the only accent color the interface uses. Blue, amber and red appear only as signals (score tier, lock, alarm), never as decoration for an area of the interface. The one exception is the session palette inside the city view.

**The Earned Glow Rule.** Glow (`text-shadow: 0 0 4px currentColor`, or 6px for a selected tab or a title) is reserved for text that is active, selected, earned or alarming. Resting body text never glows.

## Typography

**Display Font:** none separate. The same monospace stack is used everywhere.
**Body Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

**Character:** a single terminal voice. Hierarchy comes from case, letter-spacing, glow and brightness rather than font changes or large size jumps.

### Hierarchy
- **Numeral** (400, 2.25rem, line-height 1, 0.08em, tabular figures): the Timer tab's one big number. It is the selected row of the Duration Drum while idle and the countdown during a session, in the same slot and size, so the number never jumps. **Numeral neighbor** (1.35rem) is only for the drum's non-selected rows.
- **Display** (400, 1.25rem, 0.05em, uppercase): the overlay title only.
- **Title** (700, 1.1rem): the population number, the one bold numeral.
- **Body** (400, 0.8rem, 1.5): list rows, session history and helper text. The overlay message runs larger at 0.95rem because it sits on a full page.
- **Tab** (400, 0.75rem, 0.1em, uppercase): popup tabs.
- **Label** (400, 0.7–0.75rem, 0.14em, uppercase, 80–85% opacity): section titles ("Last sessions", "Blocklist") and the population unit.
- **City** (400, 0.85rem, line-height 1): the ASCII grid. One `ch` per column, and the line height must stay at 1 so the rows tile.

### Named Rules
**The Explicit Mono Rule.** Every component declares the monospace stack itself. Chrome injects its own stylesheet into extension pages and resets `body` to the system sans (Cantarell on Linux) at 12px, so the `:root` declaration in `style.css` doesn't reach text that relies on inheritance.

## Layout

The popup never scrolls. Its width is fixed at 32rem, and the City tab's view fills it (CR6.T8a). It is one column with 0.6rem padding and 0.6rem gaps between the tab bar, the section and the rows inside it. Rows use a 0.35–0.4rem gap, and tight lists use 0.2rem. The Timer tab is centered, while the City, Blocklist and Score tabs align left. Timer tab order, top to bottom: the Duration Drum (idle) or the countdown (in session) in the same slot, then Start/Pause/Reset. You choose the duration, then you start. Spacing steps are small (0.15 to 0.75rem). The blocked-site overlay is the one generous layout: a centered panel up to 30rem wide with 1.5rem padding.

## Elevation & Depth

The system is flat. Surfaces don't lift. Depth comes from light: the glow on text, and the city's three layers at different opacities (background 0.4, middleground 0.75, foreground 1), which make a parallax skyline without any shadow. The only box shadows are ambient halos on surfaces that sit over something else.

### Shadow Vocabulary
- **Phosphor halo** (`box-shadow: 0 0 2rem rgba(125, 251, 160, 0.25)`): the blocked-site overlay panel.
- **Alarm halo** (`box-shadow: 0 0 1.5rem rgba(255, 155, 155, 0.2)`): the popup's error-boundary panel.

### Named Rules
**The Light-Not-Lift Rule.** Never use offset drop shadows. Depth is a glow centered on the element (no x/y offset) or a change in layer opacity.

## Shapes

Lines are thin and corners are small. Frames, inputs and tabs use 1px borders with 4px corners. Tabs round only their top corners and sit on the green rule below them. Actions and status markers (presets, export, source chips, the score badge) are 999px pills drawn as 1px `currentColor` outlines. The overlay panel is the one larger radius (0.5rem). Nothing is filled solid.

## Components

### Tabs
Quiet, labeled like a terminal.
- **Default:** transparent, phosphor green at 65% opacity, uppercase 0.75rem with 0.1em spacing, padding 0.35rem 0.7rem.
- **Hover:** full opacity.
- **Selected:** a phosphor-rule border on three sides, a phosphor-wash fill, and a 6px glow.
- **Focus:** a 1px `currentColor` outline offset by 1px. Every other focusable control in the popup gets a 1px phosphor outline offset by 2px (`:where(.popup) :focus-visible`), never the browser's white ring.

### Buttons
- **Outline pill (canonical):** a 1px `currentColor` border, 999px radius, transparent background, phosphor green, 0.06em spacing, a 4px glow, and a phosphor-wash fill on hover. Used for export, and it's the intended style for every popup action.
- **Overlay button:** 4px corners, 0.5rem 1.25rem padding, an `overlay-frame` border. The danger variant uses `alarm-red-frame` with `alarm-red-soft` text. Focus is a 2px phosphor outline offset by 2px.
- **Toggle:** the pressed state turns the border and text phosphor green and adds a glow. The blocklist preset row uses it (`aria-pressed`, a count inside, 0.4 opacity and no glow when the list is locked). It's not used for the duration presets; they use the Duration Drum below.

### Chips
- **Source chip:** on each blocklist row, a read-only outline pill (1px phosphor border at 35% opacity, phosphor text at 80% opacity, 0.65rem uppercase, 0.08em spacing, 0 0.4rem padding) naming the preset that put the site on the list. It has no hover, focus or active state because it isn't interactive.

### Inputs / Fields
- **Style:** an `ink-field` background, a 1px `moss-frame` border with 4px corners that turns phosphor green on focus, `screen-white` text in the monospace stack, 0.8rem, 0.3rem 0.5rem padding and a phosphor caret.
- **Placeholder:** `#8a948e`, 6.14:1 on `ink-field` (the browser default `#757575` is 4.17:1 and fails AA).
- **Feedback:** an info line in `score-excellent` green and an error line in `alarm-red`, both 0.75rem. A confirmation fades after 3 seconds; an error stays until the field is edited and is linked to it with `aria-describedby`. A row that was just added gets a `phosphor-wash` highlight for about 1.6 seconds (static under reduced motion).

### Score Badge and Population
- **Badge:** an outline pill (0.15rem 0.6rem), uppercase 0.8rem, colored by the score tier, with a glow. During the first tenth of a session (and while idle) it reads "Starting" in muted grey, with no glow, instead of a red "Bad"; a finished session always shows its real tier.
- **Population:** a bold 1.1rem numeral followed by a 0.7rem uppercase "population" label, both in `score-excellent` green with a glow.
- **Session history row:** 4px corners, a 20% white border, 0.15rem 0.5rem padding, the score in its tier color.

### City Canvas (signature)
The city is the product. Since CR6 it is a 3D view, not an ASCII grid. The **stage** (`.city-stage`) is a black box (`city-floor`, `#000000`) with a 1px `moss-frame` border and 4px corners, the full width of the tab and 17rem (272px) tall, so the popup stays under the 600px height cap. The three.js canvas fills it, loaded only when the City tab opens; while it loads (and if it cannot start) the stage keeps its size and says so in a quiet 0.75rem line, so the tab never jumps. The camera is a fixed isometric view from above that can be orbited a quarter turn with the pointer (no pan, limited zoom); orbiting is optional, nothing in the stage takes keyboard focus, and the stage itself is a labelled image.

**HUD line:** at the stage's bottom left, `> 120/240 FLOORS` in `city-hud` (`#7dfba0`), 0.7rem, 0.08em tracking, with the standard 4px glow, not interactive (`aria-hidden`). It follows every floor.

**Tower labels:** `> NAME` on landmark towers, drawn inside the 3D view (see City 3D motion).

**Screen-reader summary:** below the stage there is a visually hidden `role="status"` line (`aria-live="polite"`): floors built of total, buildings standing and the tallest building. It changes at milestones (every 10% of the floors) and when a new city starts, not once per floor. EN and IT.

**Order in the tab:** stage, empty-city hint (only while idle and nothing is built), export button (only once completed).

**Full-city page (CR6.T11):** "View full city" under the stage (the outline pill of the buttons below, 0.75rem) opens `city.html` in a new tab: the same city on a stage that fills the window below a 2rem header (`calc(100vh - 2.6rem)`, at least 16rem tall), on the same dark ground and monospace stack. The header holds the title in `phosphor-green` (0.85rem uppercase, 0.14em tracking, glow) and a quiet 0.75rem hint on the right ("Drag to turn, scroll to zoom, right-drag to move."). The camera is free: all the way round, tilted from nearly overhead to just above the horizon, zoomed 0.5–4× and pannable. The page is read-only, has no controls, follows the session live, and its ambient layer pauses while the tab is hidden. The HUD line, the summary, the empty-city hint and the text fallback are the popup's, with the fallback at 1rem.

**Exported image (CR6.T10):** 1600 × 900, PNG or JPEG. With the 3D view running it is one frame of it with bloom and the CRT pass, from the camera as the user left it, at pixel ratio 1; the HUD line and the screen-reader summary are DOM and are not part of it. Without WebGL, or if the capture fails, it is the text city: `#`, `:`, `=` and `!` glyphs in `city-hud` green on the black `city-floor`, on a fixed 8 × 14 px grid.

**Fallback view (CR6.T8b):** where WebGL2 is missing, or after the GPU context is lost, the stage shows the same city as text: a monospace `pre` (`city-hud` green, 0.8rem, line-height 1, the standard 4px glow, top-aligned so the bottom 1rem stays free for the HUD line) of 20 rows by 60 columns, 16rem tall and about 29rem wide, inside the 32rem popup. It is a front view of the same plan and the same visible floors: `#` for the edges of a standing floor, `:` for its windows, `=` for the floor under construction and `!` for a damaged one, `_` for the ground, nearer buildings hiding farther ones. It keeps the stage label, the HUD line and the same screen-reader summary, is hidden from assistive technology itself, and a quiet 0.7rem line under the stage says that the 3D view is unavailable and a text version is shown. The 3D chunk is not requested at all when WebGL2 is missing.

The old three-layer ASCII canvas (`CityCanvas`) is gone (CR6.T9a); the text city above is the only ASCII view.

#### City 3D motion (CR6.T7)
The 3D city has an ambient layer and three floor effects. Reference for the behavior; the shader and colors are tuned by eye in CR6.T8a.

- **Ambient layer:** rain streaks in `city-rain` falling over the whole ground, cars (small boxes in the palette's lamp color) driving along the roads, about one window in ten flickering (mostly lit with short dips), and beacons on landmarks and spires pulsing slowly, each out of step. Lamps and signs are scenery, not motion.
- **Floor drop:** a floor that is added falls 2.4 world units into place in 360ms with an ease-out cubic and lands exactly.
- **Glitch-out:** a floor that is removed stays for 320ms, flickering in `alarm-red` with blink-outs and a tiny sideways shake, and then it is gone. A burst of removals ends with the exact final count.
- **Damaged floor:** the partly paid top floor after a loss has `alarm-red` edges that flicker with sharp dropouts on a 1.7s cycle.
- **Tower labels:** `> NAME` in `city-hud` on landmark towers, shown once the tower is complete, always facing the camera.
- **The 30 fps cap:** the ambient layer updates at most 30 times a second. It pauses when the tab or the document is hidden and stops drawing when nothing moves; floor animations draw at the display rate for their few hundred milliseconds only.
- **Reduced motion:** under `prefers-reduced-motion: reduce` there is no rain, no cars, no flicker, no pulse and no floor animation. Growth, removals and the damaged state still appear, as instant static changes (the damaged floor stays steady red).

### Duration Drum (signature)
A vertical scroll-wheel for picking the session length, drawn like a terminal readout. **Reference for the motion and composition only:** `docs/ui/references/duration-drum-reference.png` (an iOS-style time wheel). Take its structure: a centered selected value, faded neighbors above and below, ruler ticks on both edges, and snapping vertical motion. Leave out its look: no white card, no grey shading, no soft 3D cylinder, no hour/minute pair.

- **Values:** the existing preset table `FOCUS_PRESETS` (`lib/timer/focus-presets.ts`): 5, 10, 20, 30, 45, 60, 90, 120 min. It's data-driven, so a new preset appears in the drum with no code change. It's a finite list that doesn't loop; past the ends the slots are empty.
- **Rows:** 3 visible rows (previous, selected, next), plus the edge of a 4th fading out top and bottom. Values are zero-padded to three digits (`005` … `120`) so the column stays aligned. A fixed `MIN` label in label typography sits to the right of the selected row and doesn't scroll.
- **Selected row:** Numeral type, phosphor green, 6px glow. It's bracketed by two 1px `phosphor-rule` hairlines across the drum's width. There's no fill, or at most `phosphor-wash`.
- **Neighbors:** Numeral-neighbor type in `screen-white`, 35% opacity next to the selection and 12% at the faded edge, with no glow. Opacity and size interpolate continuously with distance from the center while moving.
- **Edge fade:** a vertical `mask-image` on the rows and ruler layers, not on the frame, that fades them to transparent at the top and bottom. The frame clips its content (`overflow: hidden`). A mask is the one gradient allowed here, because it only hides rows; it never paints a fill.
- **Static target:** `docs/ui/references/duration-drum-target.png`, the at-rest render of the `Duration Drum` snippet in `.impeccable/design.json`. Match its composition; the motion is described below.
- **Ruler:** a tick scale down both side gutters in the drum's monospace grid. Minor ticks (`╴`/`╶` or 1px × 0.5rem lines) are in `phosphor-rule`, one per row step plus half-steps. At the selected row a longer major tick sits on each side (`──┤` left, `├──` right), in full phosphor green, so the two major ticks and the hairlines frame the value like a crosshair. The ticks scroll with the rows, so the ruler reads as the drum moving.
- **Frame:** a 1px `moss-frame` border with 4px corners on `crt-black`, matching the City canvas. When focused, a 1px phosphor outline offset by 2px.
- **Motion:** one step moves the rows by exactly one row height in 180ms with `cubic-bezier(0.22, 1, 0.36, 1)` (a fast ease-out). A drag or wheel flick carries a little momentum, then always snaps to the nearest preset; nothing ever rests between two rows. Hitting either end gives a 1-row rubber-band of at most 0.25 row that springs back. Implement with `framer-motion` (already in the stack); no new dependency.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, there's no momentum or rubber-band. Each step swaps values instantly with an 80ms opacity crossfade.
- **Input:** a vertical drag or swipe, the mouse wheel (one step per notch, accumulated and throttled for trackpads), a click or tap on a neighbor row (selects it), and the keyboard: ArrowUp/ArrowDown step, PageUp/PageDown step 2, Home/End jump to the first/last preset.
- **Commit:** the visible value changes immediately. `requestSetDuration` is sent once, when the drum settles, never for each intermediate row during a flick. The background stays the single writer.
- **Accessibility:** `role="spinbutton"` with `aria-label` = `timer.durationLabel`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` in minutes, and `aria-valuetext` = `timer.durationOption` (e.g. "30 min"). Neighbor rows and the ruler are `aria-hidden`.
- **In a session** (`running`/`paused`/`completed`): the drum doesn't scroll. The neighbors, ruler and `MIN` label fade out in 200ms, and the selected row becomes the countdown in the same slot and Numeral type. **The drum becomes the clock.** On Reset it reverses: the countdown becomes the selected preset again and the neighbors fade back in. Under reduced motion this is an instant swap.

### Blocked-Site Overlay (signature)
A full-viewport `overlay-scrim` over the page in Shadow DOM. It holds a centered `overlay-panel` with a phosphor halo, an uppercase glowing title ("Stay focused"), a `pale-phosphor` message with the domain in `lamp-amber`, and two overlay buttons. The danger button is the one that opens the site anyway.

### Lock Notice
A 1px 60% amber frame, amber text, 0.75rem, 0.35rem 0.5rem padding. Shown in the blocklist while a session is running.

## Do's and Don'ts

### Do:
- **Do** declare the monospace stack on every component root (see The Explicit Mono Rule).
- **Do** use phosphor green (`#7dfba0`) for every interactive accent, and the phosphor wash (12–15%) as the only interactive fill.
- **Do** make a new action an outline pill (1px `currentColor`, 999px radius, transparent) unless it lives in the overlay.
- **Do** keep the city the brightest, most saturated thing on screen. The interface around it stays dim.
- **Do** keep the city font's line height at 1 and the canvas content box at exactly 60ch × 20 rows.

### Don't:
- **Don't** add a second interface accent. The blocklist input and the domain preview are phosphor green now; only the score tier's blue (`#4dabf7`) remains, and that is data, not interface.
- **Don't** leave native buttons unstyled. Every popup button is the outline pill by default (`:where(.popup) button` in `entrypoints/popup/App.css`, zero specificity so a component's own class overrides it).
- **Don't** rely on inherited font settings in the popup. Buttons and inputs inherit the monospace stack from `entrypoints/popup/style.css`, which Chrome would otherwise replace with its sans. The countdown is the Numeral in the Duration Drum's slot.
- **Don't** use offset drop shadows, gradients or solid-filled buttons. The Duration Drum's edge fade is a `mask-image`, not a painted gradient, and is the only exception.
- **Don't** copy the drum reference's look. No 3D cylinder, white card, grey shading or hour/minute pair, and no "cyberpunk" clichés either: no glitch, scanline, chromatic-aberration or neon-magenta effects. Terminal character comes from the monospace grid, the ruler ticks and the single green beam.
- **Don't** glow resting text. Glow marks active, selected, earned or alarming state only.
