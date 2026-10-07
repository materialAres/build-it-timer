import { useState, type SyntheticEvent } from 'react';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import {
  selectAllowlist,
  selectBlocklist,
  useAppStore,
  type BlocklistListName,
} from '@/store';

/**
 * The list's own stylesheet, consistent with the CRT/monospace look used by the
 * rest of the popup (M2.T14/M2.T17/M2.T18/M3.T1/M3.T2).
 */
const SITE_LIST_STYLES = `
  .site-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #e9ecef;
  }
  .site-list__title {
    margin: 0;
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .site-list__form {
    display: flex;
    gap: 0.4rem;
  }
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
  .site-list__feedback {
    margin: 0;
    font-size: 0.75rem;
  }
  .site-list__feedback--error {
    color: #ff6b6b;
  }
  .site-list__feedback--info {
    color: #51cf66;
  }
  .site-list__entries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .site-list__entry {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .site-list__domain {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const LIST_LABELS: Record<
  BlocklistListName,
  { readonly title: string; readonly plural: string; readonly other: string }
> = {
  blocklist: { title: 'Blocked sites', plural: 'blocklist', other: 'allowlist' },
  allowlist: { title: 'Allowed sites', plural: 'allowlist', other: 'blocklist' },
};

interface Feedback {
  readonly kind: 'error' | 'info';
  readonly text: string;
}

export interface SiteListProps {
  readonly list: BlocklistListName;
}

/**
 * Site CRUD UI for one list (M3.T3, `blocklist` or `allowlist`).
 *
 * Presentational and generic over the list: it reads the entries through the
 * granular selectors and never computes list state itself. The input is
 * canonicalized live with `normalizeEntry` (M1.T2/M2.T21) both to preview the
 * registrable domain and to validate: an unparseable input or a "bare" public
 * suffix is rejected with the shared `INVALID_URL_MESSAGE` ("Enter a valid
 * URL") and is never dispatched. Duplicates and appends to the opposite list are
 * detected here only to produce the visible feedback; the authoritative dedup
 * and allowlist/blocklist mutual exclusion stay in the store's pure helpers
 * (M2.T4/M2.T20), so the UI cannot create a double entry even if it tried.
 */
export function SiteList({ list }: SiteListProps) {
  const entries = useAppStore(list === 'allowlist' ? selectAllowlist : selectBlocklist);
  const otherEntries = useAppStore(list === 'allowlist' ? selectBlocklist : selectAllowlist);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const labels = LIST_LABELS[list];
  const preview = normalizeEntry(value.trim());
  const previewDomain = preview.ok ? preview.value : null;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = normalizeEntry(value);
    if (!result.ok) {
      setFeedback({ kind: 'error', text: result.error.message });
      return;
    }
    const domain = result.value;
    if (entries.some((entry) => entry.domain.value === domain)) {
      setFeedback({ kind: 'info', text: `${domain} is already in the ${labels.plural}.` });
      return;
    }
    const moved = otherEntries.some((entry) => entry.domain.value === domain);
    useAppStore.getState().addSite(list, domain);
    setFeedback({
      kind: 'info',
      text: moved
        ? `Moved ${domain} from the ${labels.other}.`
        : `Added ${domain}.`,
    });
    setValue('');
  };

  return (
    <section className="site-list" aria-label={labels.title}>
      <style>{SITE_LIST_STYLES}</style>
      <h3 className="site-list__title">{labels.title}</h3>

      <form className="site-list__form" onSubmit={handleSubmit}>
        <input
          className="site-list__input"
          type="text"
          value={value}
          aria-label={`Add to ${labels.title}`}
          placeholder="example.com"
          onChange={(event) => {
            setValue(event.target.value);
            setFeedback(null);
          }}
        />
        <button type="submit">Add</button>
      </form>

      {previewDomain !== null && previewDomain !== value.trim() ? (
        <p className="site-list__preview" aria-live="polite">
          → {previewDomain}
        </p>
      ) : null}

      {feedback !== null ? (
        <p
          className={`site-list__feedback site-list__feedback--${feedback.kind}`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      ) : null}

      <ul className="site-list__entries" aria-label={`${labels.title} entries`}>
        {entries.map((entry) => (
          <li key={entry.domain.value} className="site-list__entry">
            <span className="site-list__domain">{entry.domain.value}</span>
            <button
              type="button"
              aria-label={`Remove ${entry.domain.value}`}
              onClick={() => {
                useAppStore.getState().removeSite(list, entry.domain.value);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
