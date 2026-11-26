/**
 * The sound panel (M5.T19), in the popup's own language: monospace, phosphor
 * green only on what can be acted on, glow only on the theme that is playing.
 * Buttons keep the shared outline pill from `App.css`; only their size is set
 * here, so the preview button stays a compact, still tappable, square.
 */
export const SOUND_SETTINGS_STYLES = `
  .sound-settings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    color: #e6e6e6;
  }
  .sound-settings__heading {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .sound-settings__toggle,
  .sound-settings__volume,
  .sound-settings__theme,
  .sound-settings__theme label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sound-settings__toggle,
  .sound-settings__theme label {
    cursor: pointer;
  }
  .sound-settings__themes {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0.5rem 0.6rem;
    border: 1px solid rgba(125, 251, 160, 0.25);
  }
  .sound-settings__themes legend {
    padding: 0 0.35rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .sound-settings__theme {
    justify-content: space-between;
  }
  .sound-settings__theme--playing .sound-settings__theme-name {
    color: #7dfba0;
    text-shadow: 0 0 6px currentColor;
  }
  .sound-settings__preview {
    min-width: 28px;
    min-height: 28px;
    padding: 0;
    line-height: 1;
  }
  .sound-settings input {
    accent-color: #7dfba0;
  }
  .sound-settings__volume input[type='range'] {
    flex: 1;
    min-width: 0;
  }
  .sound-settings__volume output {
    min-width: 3.5ch;
    text-align: right;
    color: #7dfba0;
  }
  .sound-settings input:disabled,
  .sound-settings input:disabled + * {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;
