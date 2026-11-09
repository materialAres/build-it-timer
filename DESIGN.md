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

The CRT glow and the city are one image. The popup is a dark night sky (`crt-black`), and the ASCII skyline lights it up one character at a time, drawn in phosphor green with a faint glow. Every other part of the interface (tabs, timer, controls, score) belongs to that same sky. It is dim, monospace and flat, so the skyline stays the brightest thing on screen.

The popup is dense and small. Users open it for a few seconds, read the state and close it. Hierarchy comes from brightness and glow, not size. Uppercase, letter-spaced labels name the sections, body text sits at a quiet 0.8rem, and the phosphor glow (`text-shadow: 0 0 4px currentColor`) appears only on text that is active, earned or alarming. The tone follows PRODUCT.md: neutral and minimal. The skyline shows progress and loss, and the interface stays out of its way.

The blocked-site overlay carries the same world onto a page that isn't the extension's. It uses a scrim (a translucent dark layer over the page), one glowing panel, and plain wording.

**Key Characteristics:**
- Dark CRT ground (`#050805`). No light theme exists or is planned.
- One monospace stack for everything, including text the popup gets from its browser defaults.
- Phosphor green (`#7dfba0`) is the one interface accent. Glow marks emphasis.
- Thin 1px rules and outlines carry structure. Nothing is filled or raised.
- Pills (999px) for actions and status, 4px corners for frames and tabs.
- The city fades and scales each character in and out over 0.25s, with an ease-out.

## Colors

The palette is a phosphor monitor at night: a near-black ground, one green beam, and a few warm signal colors kept for warnings and scores.

### Primary
- **Phosphor Green** (`phosphor-green`): the one interface accent. It colors the tabs, the selected duration, the export actions, the overlay title and buttons, and the default city glyphs. Wherever something is active or has been earned, it glows in this color.
- **Phosphor Rule** (`phosphor-rule`): the 35% green line under the tab bar and around the selected tab.
- **Phosphor Wash** (`phosphor-wash`, `phosphor-wash-hover`): a 12–15% green fill behind the selected tab and behind outline buttons on hover. This is the only fill an interactive element ever gets.

### Neutral
- **CRT Black** (`crt-black`): the popup ground, with a slight green tint.
- **Night Sky** (`night-sky`): the city canvas backdrop when no theme supplies one.
- **Ink Field** (`ink-field`): the background of text inputs.
- **Moss Frame** (`moss-frame`): the 1px frame around the city canvas.
- **Screen White** (`screen-white`): the default text color. `#e9ecef` in the blocklist components is a near-duplicate and should merge into this.
- **Overlay Panel / Overlay Frame / Overlay Scrim** (`overlay-panel`, `overlay-frame`, `overlay-scrim`): the blocked-site overlay. The panel is a dark green box on a 92% near-black scrim, framed in a muted green.
- **Pale Phosphor** (`pale-phosphor`): the overlay's body copy, a softened green-white.

### Signal (not accents)
- **Sodium Amber** (`sodium-amber`): the lock notice shown while a session is running (the blocklist can't be edited).
- **Lamp Amber** (`lamp-amber`): the blocked domain highlighted inside the overlay message.
- **Alarm Red** (`alarm-red`, `alarm-red-soft`, `alarm-red-frame`): errors, removal and the "Yes, open it anyway" choice in the overlay.

### Score tiers
`score-excellent`, `score-great`, `score-good` and `score-bad` color only the score badge and the session-history rows. Their only job is to tell the four tiers apart. `score-great` is blue, and that's allowed only here.

### City palettes
`lib/city/theme-registry.ts` and `lib/city/palette.ts` define the building palettes per theme (Neon Metropolis, Sunset Strip, Arctic Dawn, CRT Phosphor). They are data for the city's contents, not interface tokens, and stay outside this system's accent rules.

### Named Rules
**The One Beam Rule.** Phosphor green is the only accent color the interface uses. Blue, amber and red appear only as signals (score tier, lock, alarm), never as decoration for an area of the interface.

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
- **Label** (400, 0.7–0.75rem, 0.14em, uppercase, 80–85% opacity): section titles ("Last sessions", "Blocked sites") and the population unit.
- **City** (400, 0.85rem, line-height 1): the ASCII grid. One `ch` per column, and the line height must stay at 1 so the rows tile.

### Named Rules
**The Explicit Mono Rule.** Every component declares the monospace stack itself. Chrome injects its own stylesheet into extension pages and resets `body` to the system sans (Cantarell on Linux) at 12px, so the `:root` declaration in `style.css` doesn't reach text that relies on inheritance.

## Layout

The popup sizes itself to its content and never scrolls. Its width is set by the city canvas (60 columns × 0.85rem `ch`, 20 rows). It is one column with 0.6rem padding and 0.6rem gaps between the tab bar, the section and the rows inside it. Rows use a 0.35–0.4rem gap, and tight lists use 0.2rem. The Timer tab is centered, while the City, Blocklist and Score tabs align left. Timer tab order, top to bottom: the Duration Drum (idle) or the countdown (in session) in the same slot, then Start/Pause/Reset. You choose the duration, then you start. Spacing steps are small (0.15 to 0.75rem). The blocked-site overlay is the one generous layout: a centered panel up to 30rem wide with 1.5rem padding.

## Elevation & Depth

The system is flat. Surfaces don't lift. Depth comes from light: the glow on text, and the city's three layers at different opacities (background 0.4, middleground 0.75, foreground 1), which make a parallax skyline without any shadow. The only box shadows are ambient halos on surfaces that sit over something else.

### Shadow Vocabulary
- **Phosphor halo** (`box-shadow: 0 0 2rem rgba(125, 251, 160, 0.25)`): the blocked-site overlay panel.
- **Alarm halo** (`box-shadow: 0 0 1.5rem rgba(255, 155, 155, 0.2)`): the popup's error-boundary panel.

### Named Rules
**The Light-Not-Lift Rule.** Never use offset drop shadows. Depth is a glow centered on the element (no x/y offset) or a change in layer opacity.

## Shapes

Lines are thin and corners are small. Frames, inputs and tabs use 1px borders with 4px corners. Tabs round only their top corners and sit on the green rule below them. Actions and status markers (presets, export, tags, the score badge) are 999px pills drawn as 1px `currentColor` outlines. The overlay panel is the one larger radius (0.5rem). Nothing is filled solid.

## Components

### Tabs
Quiet, labeled like a terminal.
- **Default:** transparent, phosphor green at 65% opacity, uppercase 0.75rem with 0.1em spacing, padding 0.35rem 0.7rem.
- **Hover:** full opacity.
- **Selected:** a phosphor-rule border on three sides, a phosphor-wash fill, and a 6px glow.
- **Focus:** a 1px `currentColor` outline offset by 1px.

### Buttons
- **Outline pill (canonical):** a 1px `currentColor` border, 999px radius, transparent background, phosphor green, 0.06em spacing, a 4px glow, and a phosphor-wash fill on hover. Used for export, and it's the intended style for every popup action.
- **Overlay button:** 4px corners, 0.5rem 1.25rem padding, an `overlay-frame` border. The danger variant uses `alarm-red-frame` with `alarm-red-soft` text. Focus is a 2px phosphor outline offset by 2px.
- **Toggle:** the pressed state turns the border and text phosphor green and adds a glow. It's not used for the duration presets; they use the Duration Drum below.

### Chips
- **Tag chip:** an outline pill with 0.1rem 0.5rem padding. When it's the active filter, it adds a glow and a wash fill.

### Inputs / Fields
- **Style:** an `ink-field` background, a 1px border, inherited text color, 0.3rem 0.5rem padding.
- **Feedback:** an info line in `score-excellent` green and an error line in `alarm-red`, both 0.75rem.

### Score Badge and Population
- **Badge:** an outline pill (0.15rem 0.6rem), uppercase 0.8rem, colored by the score tier, with a glow.
- **Population:** a bold 1.1rem numeral followed by a 0.7rem uppercase "population" label, both in `score-excellent` green with a glow.
- **Session history row:** 4px corners, a 20% white border, 0.15rem 0.5rem padding, the score in its tier color.

### City Canvas (signature)
The city is the product. It is a `night-sky` box with a 1px `moss-frame` border and 4px corners, holding three absolutely positioned `pre` layers. The content box must equal exactly 60ch × 20 rows (`box-sizing: content-box`). Each glyph renders in its building's palette color (phosphor green by default) with a 4px glow. A new glyph fades in from opacity 0 and scale 0.4 over 0.25s (ease-out), and a removed glyph reverses that animation. The city doesn't animate on first paint.

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
- **Don't** add a second interface accent. The blue (`#4dabf7`) on blocklist presets, tag chips, inputs and the domain preview is a known deviation to move to phosphor green. Score-tier blue stays.
- **Don't** leave native buttons unstyled. Start/Pause/Reset currently render as browser-default grey sans buttons, a known deviation to restyle as outline pills. The duration presets are a row of grey buttons, a known deviation to replace with the Duration Drum.
- **Don't** rely on inherited font settings in the popup. The timer readout and controls currently render in Chrome's injected sans at 12px, a known deviation. The countdown becomes the Numeral in the Duration Drum's slot.
- **Don't** use offset drop shadows, gradients or solid-filled buttons. The Duration Drum's edge fade is a `mask-image`, not a painted gradient, and is the only exception.
- **Don't** copy the drum reference's look. No 3D cylinder, white card, grey shading or hour/minute pair, and no "cyberpunk" clichés either: no glitch, scanline, chromatic-aberration or neon-magenta effects. Terminal character comes from the monospace grid, the ruler ticks and the single green beam.
- **Don't** glow resting text. Glow marks active, selected, earned or alarming state only.
