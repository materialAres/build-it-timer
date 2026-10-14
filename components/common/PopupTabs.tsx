import { i18n } from '#i18n';
import { useAppStore, selectActiveTab, type PopupTab } from '@/store';

/**
 * The popup's tab bar (M3.T4): one section visible at a time, driven by the
 * volatile `ui.activeTab` field through the `setActiveTab` action.
 *
 * Presentational only — it renders the tabs and reports the selection; the
 * section content is `App.tsx`'s concern. The ARIA wiring (`tablist`/`tab`/
 * `tabpanel` via `aria-controls`/`aria-selected`) is the minimum M4.T4 then
 * polishes; arrow-key navigation is included here because a `tablist` without
 * it is not keyboard-navigable at all.
 */
export const TAB_ORDER: ReadonlyArray<PopupTab> = [
  'timer',
  'city',
  'blocklist',
  'score',
];

/** Locale key of each tab's label, kept next to the order it is rendered in. */
export const TAB_LABEL_KEYS = {
  timer: 'tabs.timer',
  city: 'tabs.city',
  blocklist: 'tabs.blocklist',
  score: 'tabs.score',
} as const satisfies Readonly<Record<PopupTab, string>>;

/** DOM id of the panel a tab controls, shared with `App.tsx`. */
export function tabPanelId(tab: PopupTab): string {
  return `popup-panel-${tab}`;
}

/** DOM id of a tab button, referenced by its panel's `aria-labelledby`. */
export function tabButtonId(tab: PopupTab): string {
  return `popup-tab-${tab}`;
}

const TAB_BAR_STYLES = `
  .popup-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid rgba(125, 251, 160, 0.35);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .popup-tabs__tab {
    padding: 0.35rem 0.7rem;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: transparent;
    color: #7dfba0;
    font: inherit;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    opacity: 0.65;
  }
  .popup-tabs__tab:hover {
    opacity: 1;
  }
  .popup-tabs__tab[aria-selected='true'] {
    border-color: rgba(125, 251, 160, 0.35);
    background: rgba(125, 251, 160, 0.12);
    opacity: 1;
    text-shadow: 0 0 6px currentColor;
  }
  .popup-tabs__tab:focus-visible {
    outline: 1px solid currentColor;
    outline-offset: 1px;
  }
`;

export function PopupTabs() {
  const activeTab = useAppStore(selectActiveTab);

  // Roving focus: the arrow keys move the selection, which is what a `tablist`
  // is expected to do. Home/End jump to the ends.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const index = TAB_ORDER.indexOf(activeTab);
    let next: PopupTab | undefined;

    if (event.key === 'ArrowRight') next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    else if (event.key === 'ArrowLeft') {
      next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    } else if (event.key === 'Home') next = TAB_ORDER[0];
    else if (event.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];

    if (next === undefined) return;
    event.preventDefault();
    useAppStore.getState().setActiveTab(next);
    document.getElementById(tabButtonId(next))?.focus();
  };

  return (
    <div
      className="popup-tabs"
      role="tablist"
      aria-label={i18n.t('tabs.ariaLabel')}
      onKeyDown={handleKeyDown}
    >
      <style>{TAB_BAR_STYLES}</style>
      {TAB_ORDER.map((tab) => (
        <button
          key={tab}
          id={tabButtonId(tab)}
          type="button"
          role="tab"
          className="popup-tabs__tab"
          aria-selected={tab === activeTab}
          aria-controls={tabPanelId(tab)}
          tabIndex={tab === activeTab ? 0 : -1}
          onClick={() => {
            useAppStore.getState().setActiveTab(tab);
          }}
        >
          {i18n.t(TAB_LABEL_KEYS[tab])}
        </button>
      ))}
    </div>
  );
}
