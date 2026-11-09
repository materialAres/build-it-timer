import { i18n } from '#i18n';
import { useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { computeEntrySourceLabels } from '@/lib/blocking/entry-sources';
import { PRESETS } from '@/lib/blocking/presets';
import {
  selectBlocklist,
  selectBlocklistEditable,
  selectUserPresets,
  useAppStore,
} from '@/store';
import { SiteEntry } from './SiteEntry';
import { SITE_LIST_STYLES } from './site-list.styles';

interface Feedback {
  readonly kind: 'error' | 'info';
  readonly text: string;
}

interface SiteListProps {
  /** Rendered between the add form and the list (the preset quick-add row). */
  readonly quickAdd?: ReactNode;
}

/**
 * The Blocklist tab's single list (M3.T3, revised by CR1.T1 and UI.T1).
 *
 * Presentational: entries come from the granular selector, the input is
 * canonicalized live with `normalizeEntry` (M1.T2/M2.T21) to preview and
 * validate, and duplicates are detected only for the visible feedback — the
 * authoritative dedup stays in the store's pure helpers (M2.T4). Each domain is
 * rendered exactly once (UI.T1), labelled with the presets/tags it came from.
 */
export function SiteList({ quickAdd }: SiteListProps) {
  const entries = useAppStore(selectBlocklist);
  const userPresets = useAppStore(selectUserPresets);
  const presets = useMemo(() => [...PRESETS, ...userPresets], [userPresets]);
  const editable = useAppStore(selectBlocklistEditable);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const title = i18n.t('blocklist.blockedSites');
  const listName = i18n.t('blocklist.blocklistName');
  const preview = normalizeEntry(value.trim());
  const previewDomain = preview.ok ? preview.value : null;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = normalizeEntry(value);
    if (!result.ok) {
      setFeedback({ kind: 'error', text: i18n.t('blocklist.invalidUrl') });
      return;
    }
    const domain = result.value;
    // A site only a preset listed is not a duplicate: adding it by hand makes it
    // a manual entry, so switching that preset off keeps it.
    if (
      entries.some((entry) => entry.domain.value === domain && entry.manual)
    ) {
      setFeedback({
        kind: 'info',
        text: i18n.t('blocklist.alreadyInList', [domain, listName]),
      });
      return;
    }
    useAppStore.getState().addSite(domain);
    setFeedback({ kind: 'info', text: i18n.t('blocklist.added', [domain]) });
    setValue('');
  };

  return (
    <section className="site-list" aria-label={title}>
      <style>{SITE_LIST_STYLES}</style>
      <div className="site-list__compose">
        <h3 className="site-list__title">
          <span className="site-list__title-text">{title}</span>
          <span className="site-list__count">{entries.length}</span>
        </h3>

        <form className="site-list__form" onSubmit={handleSubmit}>
          <input
            className="site-list__input"
            type="text"
            value={value}
            disabled={!editable}
            aria-label={i18n.t('blocklist.addTo', [title])}
            placeholder={i18n.t('blocklist.exampleDomain')}
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback(null);
            }}
          />
          <button type="submit" disabled={!editable}>
            {i18n.t('common.add')}
          </button>
        </form>

        {editable &&
        previewDomain !== null &&
        previewDomain !== value.trim() ? (
          <p className="site-list__preview" aria-live="polite">
            → {previewDomain}
          </p>
        ) : null}

        {editable && feedback !== null ? (
          <p
            className={`site-list__feedback site-list__feedback--${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        ) : null}

        {quickAdd}
      </div>

      {entries.length === 0 ? (
        <p className="site-list__empty">{i18n.t('blocklist.empty')}</p>
      ) : (
        <ul
          className="site-list__entries"
          aria-label={i18n.t('blocklist.entriesAriaLabel', [title])}
        >
          {entries.map((entry) => (
            <SiteEntry
              key={entry.domain.value}
              domain={entry.domain.value}
              sources={computeEntrySourceLabels(entry.presetIds, presets)}
              editable={editable}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
