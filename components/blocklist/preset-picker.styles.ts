/**
 * Stylesheet of the preset row and the saved-preset controls (M3.T1, CR4.T5).
 * Phosphor green is the only accent (DESIGN.md One Beam Rule): an off toggle is
 * a dim outline pill, an on toggle turns green and glows, and everything is
 * dimmed while the blocklist is locked. Chrome injects a sans body font into
 * extension pages, so every control sets the monospace stack explicitly.
 */
export const PRESET_PICKER_STYLES = `
  .preset-picker {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .preset-picker button,
  .preset-picker input {
    font-family: inherit;
  }
  .preset-picker__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }
  .preset-picker__label {
    margin-right: 0.2rem;
    color: #e6e6e6;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .preset-picker__button,
  .preset-picker__action {
    padding: 0.3rem 0.7rem;
    border: 1px solid rgba(125, 251, 160, 0.35);
    border-radius: 999px;
    background: transparent;
    color: #cfe9d8;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-shadow: none;
    cursor: pointer;
  }
  .preset-picker__action {
    padding: 0.15rem 0.6rem;
    font-size: 0.7rem;
  }
  .preset-picker__button:hover:not(:disabled),
  .preset-picker__action:hover:not(:disabled) {
    background: rgba(125, 251, 160, 0.15);
  }
  .preset-picker__button[aria-pressed='true'] {
    border-color: #7dfba0;
    background: rgba(125, 251, 160, 0.12);
    color: #7dfba0;
    text-shadow: 0 0 4px currentColor;
  }
  .preset-picker__count {
    margin-left: 0.45rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
  .preset-picker__button:disabled,
  .preset-picker__action:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    text-shadow: none;
  }
  .preset-picker button:focus-visible,
  .preset-picker input:focus-visible {
    outline: 1px solid #7dfba0;
    outline-offset: 2px;
  }
  .preset-picker__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .preset-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
  }
  .preset-form__input {
    flex: 1 1 8rem;
    min-width: 0;
    padding: 0.25rem 0.5rem;
    border: 1px solid #1f3d2b;
    border-radius: 4px;
    background: #0b0f14;
    color: #e6e6e6;
    font-size: 0.8rem;
    caret-color: #7dfba0;
  }
  .preset-form__note {
    flex-basis: 100%;
    margin: 0;
    color: #cfe9d8;
    font-size: 0.7rem;
    opacity: 0.75;
  }
  .preset-form__note--error {
    color: #ff9b9b;
    opacity: 1;
  }
  .saved-presets {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .saved-presets__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #e6e6e6;
  }
  .saved-presets__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .saved-presets__prompt {
    flex-basis: 100%;
    color: #ffd43b;
  }
`;
