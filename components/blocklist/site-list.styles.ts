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
    color: #e9ecef;
  }
  .site-list__compose { display: flex; flex-direction: column; gap: 0.4rem; }
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
  .site-list__form { display: flex; gap: 0.4rem; }
  .site-list__input {
    flex: 1;
    background: #0b0f14;
    border: 1px solid #4dabf7;
    color: inherit;
    padding: 0.3rem 0.5rem;
  }
  .site-list__preview {
    margin: 0;
    font-size: 0.7rem;
    color: #4dabf7;
    opacity: 0.9;
  }
  .site-list__feedback { margin: 0; font-size: 0.75rem; }
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
  .site-entry { display: flex; align-items: center; gap: 0.4rem; min-height: 1.6rem; }
  .site-entry__domain {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .site-entry__source {
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
