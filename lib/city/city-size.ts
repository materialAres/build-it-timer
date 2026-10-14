/**
 * Canonical geometry of a city (roadmap M2.T11): the single source of truth for
 * how many characters a city is made of.
 *
 * The store builds its layers with these dimensions and `CityCanvas` derives its
 * CSS box from the grid it renders (`ch`/`em`), so the on-screen canvas can never
 * drift from the grid the growth engine fills. Nothing else hardcodes a size.
 *
 * Only the *total* size lives here. The band split inside the grid (sky, houses,
 * street) is derived from the height by `bandOf` in `growth-engine.ts`, so a
 * taller grid automatically gets taller bands and no constant here encodes it.
 */

/** Grid width in characters. */
export const CITY_WIDTH_CHARS = 60;

/** Grid height in rows. */
export const CITY_HEIGHT_ROWS = 20;

/**
 * Font size of the city canvas, in rem. The canvas is monospace with
 * `line-height: 1`, so one grid character is exactly one `ch` wide and one `em`
 * tall: this single value sets the on-screen scale of the whole city
 * (60 × 20 chars at 0.85rem ≈ 490 × 272 px).
 */
export const CITY_FONT_SIZE_REM = 0.85;
