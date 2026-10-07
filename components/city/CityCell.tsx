import { AnimatePresence, motion } from 'framer-motion';

/**
 * A single character of the city grid (roadmap M2.T14). Purely presentational:
 * it receives its character and color as props and never reads the store
 * (Separation of Concerns, acceptance criterion 1), so it is trivially testable
 * and reused by every layer.
 *
 * M3.T5 adds the growth/destruction transitions: `framer-motion` animates a cell
 * that becomes occupied (a character appears) and one that is destroyed (the
 * last character fades/shrinks away). The animation is purely visual — the grid
 * state and its final DOM are unchanged, which keeps the M2.T14 assertions
 * valid (the tests disable animations globally, see `tests/setup.ts`).
 */
export interface CityCellProps {
  /** ASCII character to render; `null` once the cell has been destroyed. */
  readonly char: string | null;
  /**
   * Overrides the default CRT green when the cell belongs to a colored
   * building; the glow follows it through `text-shadow: … currentColor`.
   */
  readonly color?: string;
}

const GROWTH_DURATION_SECONDS = 0.25;

/** Fade + pop used both when a character appears and when it disappears. */
const CELL_TRANSITION = {
  duration: GROWTH_DURATION_SECONDS,
  ease: 'easeOut',
} as const;

export function CityCell({ char, color }: CityCellProps) {
  const isOccupied = char !== null && char !== '';

  return (
    // `initial={false}` keeps the whole city from animating on first paint (a
    // service-worker restart must not replay every building's growth). The
    // `building` key is constant so a character swap (e.g. decoration) does not
    // remount the cell; mounting/unmounting is what triggers the transition.
    // `popLayout` takes the exiting character out of the flow so the monospace
    // grid stays aligned while it fades away.
    <AnimatePresence initial={false} mode="popLayout">
      {isOccupied ? (
        <motion.span
          key="building"
          className="city-cell"
          style={color === undefined ? undefined : { color }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={CELL_TRANSITION}
        >
          {char}
        </motion.span>
      ) : (
        // A destroyed cell keeps a blank placeholder so the monospace grid stays
        // aligned, but it exposes neither the building's character nor its color.
        <span key="empty" className="city-cell city-cell--empty">
          {' '}
        </span>
      )}
    </AnimatePresence>
  );
}
