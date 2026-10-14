# Implementation Plan — Increase popup screen size (60 × 20) without breaking the city engine

## 1. Measured current state

| Aspect | Value |
|---|---|
| Grid | **40 × 12** (`city.slice.ts`) |
| Rendered | `40ch × 12em` @ `0.75rem` → **~360 × 144 px** (`CityCanvas.tsx`) |
| Bands (H=12) | sky 2 · houses 7 · street 3 |
| Session | 25 min (`timer.slice.ts`) |
| Baseline | 598 tests / 69 files; `compile` + `lint` clean; working tree clean |

## 2. Two defects found (verified empirically, not inferred)

**Defect 1 — the engine saturates at 6.7 minutes of a 25-minute session.**
Measured by running `growCity` to saturation: **201 characters total, full at tick 201 (6.7 min)**. ~73% of every session renders a frozen city. Pre-existing, unrelated to screen size.

**Defect 2 — 5 of 13 house-band rows would be permanently empty at 60 × 20.**
Root cause is one expression, `growth-engine.ts:257`: `randInt(rng, FLOORS_RANGE.min, FLOORS_RANGE.max)` caps houses at 4 floors, so the tallest possible house is `top(1) + 4 floors + base(2) = 7` rows, plus pavement = **8**. The loop below it only clamps *down*; it never scales up. Taller grids add sky (6% dense) and dead space, not city.

## 3. The fix, measured

Temporarily patching `buildHouse` to derive its floor ceiling from the band (option A) and re-running saturation:

| Size | Total chars | Full at | House rows used |
|---|---|---|---|
| 40×12 (today, unfixed) | 201 | 6.7 min | 7 / 7 |
| 40×12 (fixed) | 201 | 6.7 min | 7 / 7 |
| **60×20 (fixed)** | **452** | **15.1 min** | **13 / 13** |
| 72×24 (fixed) | 725 | 24.2 min | 15 / 16 |

Two things this tells us, and one corrects my earlier estimate:

- **The fix is proven, not projected.** At 60×20 it lifts the house band from 8 usable rows to all 13, and capacity from 201 → **452 characters (2.25×)**.
- **60×20 fills at 15.1 min, not 25.** My earlier "up to 780 cells" figure was a theoretical ceiling the engine never reaches — houses are 8 chars wide with 1–3 char gaps, so a 60-wide band fits ~6 houses per row. If you want the city to stay alive for the *whole* 25 minutes, **72×24 (24.2 min)** is the size that actually matches the session length.

Option A is confirmed safe: at H=12 it yields `maxFloors = 3` vs today's hardcoded 4, but the measured totals are **identical (201)** — the random draw rarely reaches 4 floors anyway, so existing behaviour is preserved.

## 4. Work breakdown

### Phase 0 — baseline
`bun run test` / `compile` / `lint`; record 598 tests across 69 files.

### Phase 1 — size constants
- Set `DEFAULT_CITY_WIDTH = 60`, `DEFAULT_CITY_HEIGHT = 20` in `city.slice.ts`. Injection at `store/index.ts:94` already propagates them; **no other production file hardcodes dimensions**.
- Export a single size constant consumed by both the store default and the canvas CSS, so the `ch`/`em` units can't drift from the grid.

### Phase 2 — engine floor fix (option A)
- In `buildHouse`, replace the constant ceiling with one derived from `maxRows`:
  ```ts
  const bandFloors = Math.max(FLOORS_RANGE.min, maxRows - base.rows.length - top.rows.length);
  const wanted = randInt(rng, FLOORS_RANGE.min, bandFloors);
  ```
- **Invariants to preserve** (established by fix commit `3c03dea`): one character per tick; every house complete (never roofless); silhouettes bottom-anchored; `null` not blank glyphs; full grid returns the *same* `CityLayers` reference.
- **Purity**: no `Math.random()`/`Date.now()`; same `(layers, elapsedMs, seed)` → deep-equal. `composeBuilding` and `BUILDING_UNLOCK_SCHEDULE` stay untouched, so `calculate-population` (which reduces over the schedule) is unaffected — verified that the schedule is *only* consumed by `calculate-population.ts:40`.
- Leave `SKY_MIN_GRID_HEIGHT = 10` and `STREET_MAX_SHARE = 0.3` as-is: both are size-relative and behave correctly at H=20 (sky 4, street 3).

### Phase 3 — canvas / popup
- Raise `font-size` in `CITY_STYLES` from `0.75rem` to ~`0.85rem`. At 60 chars that's ~440 px wide; at 0.9 rem, ~470 px — both inside Chrome's **800 × 600** popup cap.
- Keep the M3.T4 content-sized contract: no `max-width`, no `min-height: 100vh`, no scrollbar (`App.css`, `style.css`).
- Note: `CityCanvas` renders **all three layers at the same grid height** and fades them as parallax, but `bandOf` partitions by rows — so the layers are *not* overlaid; the canvas is a 3-band stack. A future *real* overlay parallax would need per-layer grid heights, which is out of scope here.

### Phase 4 — tests
- Update `emptyLayers(40, 12)` in `growth-engine.test.ts` to the new constants.
- `dbg7.test.ts` and `dbg8.test.ts` hardcode `W=40, H=12` and **assert nothing** (2 of 69 files, inflating the count). Recommend deleting.
- Component tests already import `DEFAULT_CITY_*`, so they follow automatically.
- **Add two regression tests** (the real acceptance criteria):
  1. *Vertical utilization* — at the default size, houses occupy the full middleground band. This is the test that would have caught Defect 2.
  2. *Capacity vs. session* — a default 25-min session must not saturate the grid before it ends.
- `export-image.ts` scales from the grid (8×14 px/char) automatically; verify the PNG at 60×20 is reasonable.

### Phase 5 — validation
`test` → `compile` → `lint` → `build` + `build:firefox`, then `bun run dev` and confirm manually: no scrollbar, city fills the canvas, and growth continues past the 7-minute mark. `tests/e2e/popup.spec.ts` is an Italian placeholder — no coverage there.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Persisted city from a running session keeps old dimensions (`version: 1`, no `migrate`) | `resetCityForNewSession` rebuilds at new dims; verify a mid-session reload doesn't crash on mixed-dimension layers |
| Engine change re-baselines every existing city | Expected (new size ⇒ new seed); re-baseline determinism tests, don't delete them |
| Growth cost | Measured 3 600 ticks: 87 ms @40×12 vs 307 ms @120×24. Production ticks 1 per 2 s — negligible |
| Popup exceeds 800 × 600 | ~470 px at 0.9 rem — ample headroom |
| Changelog rule | Post-roadmap change → bug-fix section (like I001/I002) |

## 6. Open decision

60×20 is **2.25× more city** but still saturates at **15.1 min** of a 25-min session — the city freezes for the last ~10 minutes. **72×24** fills at 24.2 min, matching the session almost exactly, and still fits the popup (~530 px at 0.9 rem).
