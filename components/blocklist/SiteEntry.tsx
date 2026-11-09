import { i18n } from '#i18n';
import { useAppStore } from '@/store';

interface SiteEntryProps {
  readonly domain: string;
  /** Display names of the presets/tags the entry came from; empty = manual. */
  readonly sources: ReadonlyArray<string>;
  readonly editable: boolean;
}

/**
 * One row of the blocked-sites list (UI.T1): the domain, the chips naming where
 * it came from, and its remove button. Styles live in `SiteList`'s stylesheet
 * so the `<style>` element is emitted once per list, not once per row.
 */
export function SiteEntry({ domain, sources, editable }: SiteEntryProps) {
  return (
    <li className="site-entry">
      <span className="site-entry__domain" title={domain}>
        {domain}
      </span>
      {sources.map((source) => (
        <span key={source} className="site-entry__source">
          {source}
        </span>
      ))}
      <button
        type="button"
        disabled={!editable}
        aria-label={i18n.t('common.remove', [domain])}
        onClick={() => {
          useAppStore.getState().removeSite(domain);
        }}
      >
        ×
      </button>
    </li>
  );
}
