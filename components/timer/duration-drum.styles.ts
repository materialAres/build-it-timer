/**
 * Stylesheet of the Duration Drum (UI.T9, DESIGN.md Duration Drum). Rows and
 * ruler are masked, not painted over, at the top and bottom; the frame itself
 * is never masked. In a session the wheel layer fades out and the clock layer
 * fades in over the same slot, so the frame's height never changes.
 */
export const DURATION_DRUM_STYLES = `
  .duration-drum {
    position: relative;
    width: 100%;
    height: 8.5rem;
    border: 1px solid #1f3d2b;
    border-radius: 4px;
    background: #050805;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    user-select: none;
  }
  .duration-drum:has(.duration-drum__wheel:focus-visible) {
    outline: 1px solid #7dfba0;
    outline-offset: 2px;
  }
  .duration-drum__wheel {
    position: absolute;
    inset: 0;
    touch-action: none;
    cursor: ns-resize;
    transition: opacity 200ms ease;
  }
  .duration-drum__wheel:focus-visible { outline: none; }
  .duration-drum--clock .duration-drum__wheel {
    opacity: 0;
    pointer-events: none;
    cursor: default;
  }
  .duration-drum__rows,
  .duration-drum__ruler {
    position: absolute;
    inset: 0;
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent);
  }
  .duration-drum__row {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2.5rem;
    margin-top: -1.25rem;
    font-size: 2.25rem;
    line-height: 2.5rem;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
    text-align: center;
    cursor: pointer;
    will-change: transform, opacity;
  }
  .duration-drum[data-reduced] .duration-drum__row { transition: opacity 80ms linear; }
  .duration-drum__tick {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
  }
  .duration-drum__tick::before,
  .duration-drum__tick::after {
    content: '';
    position: absolute;
    top: 0;
    width: 0.5rem;
    height: 1px;
    background: rgba(125, 251, 160, 0.35);
  }
  .duration-drum__tick::before { left: 0.6rem; }
  .duration-drum__tick::after { right: 0.6rem; }
  .duration-drum__tick--half::before,
  .duration-drum__tick--half::after { width: 0.25rem; }
  .duration-drum__tick--half::before { left: 0.85rem; }
  .duration-drum__tick--half::after { right: 0.85rem; }
  .duration-drum__hairline {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    height: 1px;
    background: rgba(125, 251, 160, 0.35);
    pointer-events: none;
  }
  .duration-drum__hairline--top { top: calc(50% - 1.25rem); }
  .duration-drum__hairline--bottom { top: calc(50% + 1.25rem); }
  .duration-drum__major {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: #7dfba0;
    font-size: 0.8rem;
    line-height: 1;
    pointer-events: none;
  }
  .duration-drum__major--left { left: 0.3rem; }
  .duration-drum__major--right { right: 0.3rem; }
  .duration-drum__unit {
    position: absolute;
    top: 50%;
    left: calc(50% + 3rem);
    transform: translateY(-50%);
    color: #7dfba0;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    opacity: 0.8;
    pointer-events: none;
  }
  .duration-drum__clock {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }
  .duration-drum--clock .duration-drum__clock { opacity: 1; }
  .duration-drum__clock .timer-display {
    color: #7dfba0;
    font-size: 2.25rem;
    line-height: 1;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 6px rgba(125, 251, 160, 0.6);
  }
  .duration-drum--paused .timer-display {
    opacity: 0.55;
    text-shadow: none;
  }
  .duration-drum__paused {
    position: absolute;
    bottom: 1.4rem;
    left: 0;
    right: 0;
    text-align: center;
    color: #8a948e;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  @media (prefers-reduced-motion: reduce) {
    .duration-drum__wheel,
    .duration-drum__clock { transition: none; }
  }
`;
