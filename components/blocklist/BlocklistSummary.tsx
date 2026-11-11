import { i18n } from '#i18n';
import { selectBlocklist, selectTimerStatus, useAppStore } from '@/store';

// Pill, border, hover and focus ring come from the shared popup button rule
// (UI.T5); only the compact size is set here. min-height 1.5rem is the 24px
// minimum target (UI.T10). Explicit monospace: native buttons do not inherit
// the popup font (DESIGN.md).
const BLOCKLIST_SUMMARY_STYLES = `
  .blocklist-summary {
    min-height: 1.5rem;
    color: #7dfba0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-shadow: none;
    cursor: pointer;
  }
`;

/**
 * A quiet line under Start (UI.T4): how many sites the list blocks and, while a
 * session is running or paused, that it only grows (UI.T10: idle and completed
 * state only the count, since removal is allowed again after Reset). It opens
 * the Blocklist tab: activating it only changes the visible tab.
 * Presentational — the count and status come from granular selectors.
 */
export function BlocklistSummary() {
  const count = useAppStore(selectBlocklist).length;
  const status = useAppStore(selectTimerStatus);
  const inSession = status === 'running' || status === 'paused';
  const countText =
    count === 0
      ? i18n.t('blocklist.summaryEmpty')
      : count === 1
        ? i18n.t('blocklist.summarySite')
        : i18n.t('blocklist.summarySites', [String(count)]);
  const text = inSession
    ? i18n.t('blocklist.summaryAddOnly', [countText])
    : countText;

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
