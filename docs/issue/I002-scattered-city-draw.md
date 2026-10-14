# I002 — The drawn city is scattered characters, not recognizable buildings

- **Status**: open
- **Severity**: high (the city is the product's main visual output; it reads as noise)
- **Type**: real bug — a design defect in the growth engine's placement strategy
- **Found**: manual run of the built extension (M3.T4 popup, City tab)
- **Related tasks**: M2.T11b, M2.T11c, M2.T12, M2.T12b, M2.T14, M4.T2
- **Related changelog issues**: #10 (`city.buildings` never populated)

---

## Symptom

The rendered city is a field of unrelated characters. Buildings are not distinguishable: there
are no recognizable shapes, no coherent silhouettes, just scattered glyphs (`#`, `|`, `_`, `=`,
`[`, `]`) spread across the grid.

## Root cause

Two independent choices in `lib/city/growth-engine.ts` are decoupled from each other:

1. **The glyph is chosen by index, not by position.** `glyphFor` flattens the composed
   building's rows and picks `characters.charAt(tick % characters.length)` — a single character
   selected by the *global tick counter*.
2. **The cell is chosen independently of that character.** `nextFreeSlot` fills column-major,
   bottom-to-top, so the character lands in whatever cell happens to be free next.

The character and its destination are therefore unrelated. The building composer's output is
effectively shuffled across the grid.

### Reproduction

At 10 minutes of focus the composer (`composeBuilding`) intends this building:

```
|[#][#]|
|______|
|[=][=]|
```

The growth engine, after 300 ticks (10 minutes at one character per 2s), produces this
middleground grid:

```
####__==
####|__=
####=__|
####==__
####_==_
####__=|
####__|=
####=__=
####==__=
####_=|__
#####|=__
#####_==_
```

The building's characters are present but scattered; the structure is lost.

## Compounding factor — the three layers superimpose

`components/city/CityCanvas.tsx` stacks the three layers absolutely at the same coordinates
(`position: absolute; inset: 0`) with opacity `0.4 / 0.75 / 1` to fake parallax. Because each
layer is itself a field of scattered characters, all three superimpose in the same 40×12 space,
which is what makes the result read as noise rather than as three depth planes.

## Why the tests did not catch it

The M2.T12 suite asserts *"one character per tick, not in blocks"* and determinism — both of
which the current implementation satisfies. The roadmap's acceptance criterion for M2.T12 is
literally *"one character is inserted at a time, not in blocks"*, so the implementation meets
the letter of the spec while missing its intent. **No acceptance criterion anywhere states that
the result must be recognizable as a building.**

## Why no remaining task fixes it

- **M2.T12b** (decoration engine) only adds windows/decorations *on top of* the existing
  structure; it cannot repair placement. It is also **implemented but never wired** — nothing
  outside its own module and tests references `decorate`/`createDecorator`, and its changelog
  note claims M2.T14 would wire it, while M2.T14's entry never mentions decoration. That is a
  separate unowned gap.
- **M4.T2** (TexturePacker) replaces the *renderer* and explicitly requires *"no visual
  regression compared to the base ASCII behavior"* — it would faithfully render the same mess.
- No card in Milestones 4–5 specifies that the characters must reconstruct the building's shape.

## Expected behaviour

Each character is placed at its position **within the building's footprint**, so that as the
session progresses the composed building materializes on the grid and is recognizable as a
structure. Growth still proceeds one character at a time (the M2.T12 cadence is preserved); what
changes is *where* each character goes.

## Suggested direction (not implemented)

- Give each building a footprint on the grid (an origin cell plus the module's `widthChars` and
  row count) and place each character at its offset inside that footprint, instead of at the
  next free cell.
- Keep the composer as the single source of the building's shape (M2.T11c) and the engine as the
  single source of the cadence (M2.T12); the engine should consume the composed rows
  positionally rather than flattening them.
- Decide explicitly how the three layers relate spatially (separate bands vs. true parallax
  offsets) so the layers do not superimpose into noise.
- Preserve determinism: same `(layers, elapsedMs, seed)` → same result, no internal
  `Date.now()`/`Math.random()` (§1.4).

## Acceptance criteria for the fix

- After enough focus time, the grid shows a recognizable building whose shape matches what
  `composeBuilding` produced for that focused time.
- Growth still inserts exactly one character per 2s tick (M2.T12 criterion preserved).
- Determinism is preserved (same state + delta + seed → deep-equal result).
- The three layers are visually distinguishable rather than superimposed into noise.
- The full-grid cap still returns the same reference without exceeding the grid dimensions.

## Evidence

- `lib/city/growth-engine.ts` — `glyphFor` picks `characters.charAt(tick % characters.length)`;
  `nextFreeSlot` picks the next free cell column-major, independently of the glyph.
- `lib/city/building-composer.ts` — produces coherent `rows` that the engine never uses
  positionally.
- `components/city/CityCanvas.tsx` — the three layers are absolutely stacked with
  opacity `0.4 / 0.75 / 1`.
- `docs/roadmap-en.md` (M2.T12) — the acceptance criterion covers cadence and the full-grid cap,
  but never the recognizability of the result.
