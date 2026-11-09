import { i18n } from '#i18n';
import { selectBlocklist, useAppStore } from '@/store';

// Explicit monospace: native buttons do not inherit the popup font (DESIGN.md).
const BLOCKLIST_SUMMARY_STYLES = `
  .blocklist-summary {
    margin: 0;
    padding: 0;
    background: none;
    border: 0;
    color: #7dfba0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    opacity: 0.7;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
  .blocklist-summary:hover { opacity: 1; }
  .blocklist-summary:focus-visible {
    outline: 1px solid currentColor;
    outline-offset: 2px;
  }
`;

/**
 * A quiet line under Start (UI.T4): how many sites the list blocks and that it
 * only grows during a session, so the lock is known before it is met. It is a
 * link to the Blocklist tab, not a control: activating it only changes the
 * visible tab. Presentational — the count comes from the granular selector.
 */
export function BlocklistSummary() {
  const count = useAppStore(selectBlocklist).length;
  const text =
    count === 0
      ? i18n.t('blocklist.summaryEmpty')
      : count === 1
        ? i18n.t('blocklist.summarySite')
        : i18n.t('blocklist.summarySites', [String(count)]);

  return (
    <>
      <style>{BLOCKLIST_SUMMARY_STYLES}</style>
      <button
        type="button"
        className="blocklist-summary"
        onClick={() => {
          useAppStore.getState().setActiveTab('blocklist');
        }}
      >
        {text}
      </button>
    </>
  );
}
