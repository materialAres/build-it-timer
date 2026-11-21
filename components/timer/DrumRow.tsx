import { motion, useTransform, type MotionValue } from 'framer-motion';
import {
  DRUM_ROW_REM,
  computeRowColor,
  computeRowGlow,
  computeRowOpacity,
  computeRowScale,
  formatDrumValue,
} from '@/lib/timer/duration-drum';

interface DrumRowProps {
  readonly minutes: number;
  readonly index: number;
  /** Where the drum is drawn, in rows; every look below derives from it. */
  readonly offset: MotionValue<number>;
  readonly onSelect: (index: number) => void;
}

/**
 * One preset on the drum (UI.T9). Position, size, opacity, colour and glow are
 * all functions of the row's distance from the centre, computed by the pure
 * helpers from the shared `offset` motion value, so they interpolate while the
 * drum moves. Rows are hidden from assistive tech: the spinbutton carries the
 * value.
 */
export function DrumRow({ minutes, index, offset, onSelect }: DrumRowProps) {
  const y = useTransform(
    offset,
    (o) => `${String((index - o) * DRUM_ROW_REM)}rem`,
  );
  const opacity = useTransform(offset, (o) => computeRowOpacity(index - o));
  const scale = useTransform(offset, (o) => computeRowScale(index - o));
  const color = useTransform(offset, (o) => computeRowColor(index - o));
  const textShadow = useTransform(
    offset,
    (o) => `0 0 6px rgba(125, 251, 160, ${computeRowGlow(index - o).toFixed(2)})`,
  );

  return (
    <motion.div
      className="duration-drum__row"
      aria-hidden="true"
      style={{ y, opacity, scale, color, textShadow }}
      onClick={() => {
        onSelect(index);
      }}
    >
      {formatDrumValue(minutes)}
    </motion.div>
  );
}
