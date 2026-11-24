import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { useMotionValue, useReducedMotion } from 'framer-motion';
import { FOCUS_PRESETS } from '@/lib/timer/focus-presets';
import { findDrumIndex } from '@/lib/timer/duration-drum';
import { selectTimer, useAppStore } from '@/store';
import { DrumRow } from './DrumRow';
import { DrumRuler } from './DrumRuler';
import { TimerDisplay } from './TimerDisplay';
import { DURATION_DRUM_STYLES } from './duration-drum.styles';
import { useDrumCommit } from './use-drum-commit';
import { useDrumGesture } from './use-drum-gesture';

const MINUTES = FOCUS_PRESETS.map((preset) => preset.minutes);
const FIRST = MINUTES[0] ?? 0;
const LAST = MINUTES[MINUTES.length - 1] ?? 0;

/**
 * The duration picker and the clock in one slot (UI.T9, DESIGN.md Duration
 * Drum). While the timer is idle it is a vertical scroll-wheel over the
 * `FOCUS_PRESETS`; in a session it stops scrolling and becomes the countdown,
 * in the same frame. Presentational: the maths is in `lib/timer/duration-drum`,
 * input in `use-drum-gesture`, the single settle-time request in
 * `use-drum-commit`, and the countdown is the existing `TimerDisplay`.
 */
export function DurationDrum() {
  const { status, durationSeconds } = useAppStore(selectTimer);
  const locked = status !== 'idle';
  const reducedMotion = useReducedMotion() ?? false;
  const storeMinutes = durationSeconds / 60;
  const storeIndex = findDrumIndex(MINUTES, storeMinutes);

  const [index, setIndex] = useState(storeIndex);
  const [dragging, setDragging] = useState(false);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const offset = useMotionValue(storeIndex);

  const gesture = useDrumGesture({
    count: MINUTES.length,
    offset,
    enabled: !locked,
    reducedMotion,
    onIndexChange: setIndex,
    onDraggingChange: setDragging,
    element,
  });
  const minutes = MINUTES[index] ?? FIRST;
  const commit = useDrumCommit({
    minutes,
    storeMinutes: MINUTES[storeIndex] ?? FIRST,
    dragging,
    send: (value) => {
      useAppStore.getState().requestSetDuration(value * 60);
    },
  });

  const { moveTo, setCurrentIndex } = gesture;
  useEffect(() => {
    setCurrentIndex(index);
  }, [index, setCurrentIndex]);

  // Follow the background when it changes the length (a restore, another
  // popup), unless the user is mid-gesture or a choice of theirs is in flight.
  useEffect(() => {
    if (dragging || commit.isBusy() || storeIndex === index) return;
    moveTo(storeIndex);
  }, [storeIndex, index, dragging, commit, moveTo]);

  const spinbutton = locked
    ? { 'aria-hidden': true as const, tabIndex: -1 }
    : {
        role: 'spinbutton',
        tabIndex: 0,
        'aria-label': i18n.t('timer.durationLabel'),
        'aria-valuemin': FIRST,
        'aria-valuemax': LAST,
        'aria-valuenow': minutes,
        'aria-valuetext': i18n.t('timer.durationOption', [String(minutes)]),
        ...gesture.handlers,
      };

  return (
    <div
      className={`duration-drum${locked ? ' duration-drum--clock' : ''}${
        status === 'paused' ? ' duration-drum--paused' : ''
      }`}
      data-reduced={reducedMotion ? '' : undefined}
    >
      <style>{DURATION_DRUM_STYLES}</style>
      <div ref={setElement} className="duration-drum__wheel" {...spinbutton}>
        <div className="duration-drum__rows" aria-hidden="true">
          {MINUTES.map((value, rowIndex) => (
            <DrumRow
              key={value}
              minutes={value}
              index={rowIndex}
              offset={offset}
              onSelect={gesture.selectRow}
            />
          ))}
        </div>
        <DrumRuler count={MINUTES.length} offset={offset} />
        <span className="duration-drum__major duration-drum__major--left" aria-hidden="true">
          ──┤
        </span>
        <span className="duration-drum__major duration-drum__major--right" aria-hidden="true">
          ├──
        </span>
        <span className="duration-drum__unit" aria-hidden="true">
          {i18n.t('timer.minutesUnit')}
        </span>
      </div>
      <span className="duration-drum__hairline duration-drum__hairline--top" />
      <span className="duration-drum__hairline duration-drum__hairline--bottom" />
      <div className="duration-drum__clock">
        <TimerDisplay />
        {status === 'paused' ? (
          <span className="duration-drum__paused">{i18n.t('timer.paused')}</span>
        ) : null}
      </div>
    </div>
  );
}
