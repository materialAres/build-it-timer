import { motion, useTransform, type MotionValue } from 'framer-motion';
import { DRUM_ROW_REM } from '@/lib/timer/duration-drum';

interface DrumRulerProps {
  readonly count: number;
  readonly offset: MotionValue<number>;
}

function Ticks({ index, offset }: { index: number; offset: MotionValue<number> }) {
  const y = useTransform(
    offset,
    (o) => `${String((index - o) * DRUM_ROW_REM)}rem`,
  );
  const halfY = useTransform(
    offset,
    (o) => `${String((index + 0.5 - o) * DRUM_ROW_REM)}rem`,
  );
  return (
    <>
      <motion.span className="duration-drum__tick" style={{ y }} />
      <motion.span
        className="duration-drum__tick duration-drum__tick--half"
        style={{ y: halfY }}
      />
    </>
  );
}

/**
 * The tick scale down both side gutters (UI.T9): a minor tick per row and per
 * half step, moving with the rows so the ruler reads as the drum turning. The
 * two long ticks at the selection are drawn by the frame, not here. Decorative:
 * hidden from assistive tech.
 */
export function DrumRuler({ count, offset }: DrumRulerProps) {
  return (
    <div className="duration-drum__ruler" data-drum-ruler aria-hidden="true">
      {Array.from({ length: count }, (_unused, index) => (
        <Ticks key={index} index={index} offset={offset} />
      ))}
    </div>
  );
}
