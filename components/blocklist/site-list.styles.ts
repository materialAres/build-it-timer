/**
 * Two rhythms (UI.T1): the "compose" group (heading, field, feedback, quick-add)
 * is tight, and a wider gap separates it from the list it feeds. The list
 * scrolls on its own so the popup never outgrows Chrome's 600px cap.
 */
export const SITE_LIST_STYLES = `
  .site-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #e6e6e6;
  }
  .site-list__compose { display: flex; flex-direction: column; gap: 0.6rem; }
  .site-list__title {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .site-list__title-text { opacity: 0.85; }
  .site-list__count {
    color: #7dfba0;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }
  .site-list__form { display: flex; gap: 0.35rem; }
  .site-list__input {
    flex: 1;
    min-width: 0;
    background: #0b0f14;
    border: 1px solid #1f3d2b;
    border-radius: 4px;
    color: #e6e6e6;
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    caret-color: #7dfba0;
  }
  .site-list__input:focus { border-color: #7dfba0; }
  .site-list__preview {
    margin: 0;
    font-size: 0.7rem;
    color: #7dfba0;
    opacity: 0.9;
    overflow-wrap: anywhere;
  }
  .site-list__feedback { margin: 0; font-size: 0.75rem; overflow-wrap: anywhere; }
  .site-list__announce {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .site-list__feedback--error { color: #ff6b6b; }
  .site-list__feedback--info { color: #51cf66; }
  .site-list__empty { margin: 0; font-size: 0.8rem; opacity: 0.6; }
  .site-list__entries {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 17rem;
    margin: 0;
    padding: 0 0.25rem 0 0;
    list-style: none;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(125, 251, 160, 0.35) transparent;
  }
  .site-entry { display: flex; align-items: center; gap: 0.35rem; min-height: 1.6rem; }
  .site-entry button {
    padding: 0 0.55rem;
    line-height: 1.5;
    text-shadow: none;
  }
  .site-entry__domain {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .site-entry--new {
    border-radius: 4px;
    animation: site-entry-new 1.4s ease-out;
  }
  @keyframes site-entry-new {
    from { background: rgba(125, 251, 160, 0.28); }
    to { background: transparent; }
  }
  @media (prefers-reduced-motion: reduce) {
    .site-entry--new { animation: none; background: rgba(125, 251, 160, 0.12); }
  }
  .site-entry__source {
    min-width: 0;
    max-width: 7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 0.4rem;
    border: 1px solid rgba(125, 251, 160, 0.35);
    border-radius: 999px;
    color: #7dfba0;
    font-size: 0.65rem;
    line-height: 1.4;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0.8;
  }
`;
