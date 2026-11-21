import { i18n } from '#i18n';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { classifyEntryError } from '@/lib/blocking/entry-error';
import { normalizeEntry } from '@/lib/blocking/normalize-entry';
import { computeEntrySourceLabels } from '@/lib/blocking/entry-sources';
import { PRESETS } from '@/lib/blocking/presets';
import {
  selectBlocklist,
  selectBlocklistAddAllowed,
  selectBlocklistEditable,
  selectUserPresets,
  useAppStore,
} from '@/store';
import { describeEntryError } from './entry-error-message';
import { SiteEntry } from './SiteEntry';
import { SITE_LIST_STYLES } from './site-list.styles';
import { useListChanges } from './use-list-changes';

/** How long a confirmation stays; an error stays until the field is edited. */
const INFO_FEEDBACK_MS = 3_000;

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
 * UI.T6 hardening: a rejected entry says why and is linked to the field, a
 * confirmation fades, new rows are highlighted and scrolled into view, and a
 * preset's additions/removals are announced in a live region.
 *
 * Two windows (CR5.T3): adding is allowed from `idle` through `paused`, while
 * removing stays `idle`-only, so the form and the × buttons follow different
 * predicates.
 */
export function SiteList({ quickAdd }: SiteListProps) {
  const entries = useAppStore(selectBlocklist);
  const userPresets = useAppStore(selectUserPresets);
  const presets = useMemo(() => [...PRESETS, ...userPresets], [userPresets]);
  const editable = useAppStore(selectBlocklistEditable);
  const addAllowed = useAppStore(selectBlocklistAddAllowed);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackId = useId();
  const formAdd = useRef<string | null>(null);
  const domains = useMemo(
    () => entries.map((entry) => entry.domain.value),
    [entries],
  );
  const { added, announcement } = useListChanges(domains, formAdd);

  useEffect(() => {
    if (feedback?.kind !== 'info') return;
    const timer = globalThis.setTimeout(() => {
      setFeedback(null);
    }, INFO_FEEDBACK_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [feedback]);

  const title = i18n.t('tabs.blocklist');
  const listName = i18n.t('blocklist.blocklistName');
  const preview = normalizeEntry(value.trim());
  const previewDomain = preview.ok ? preview.value : null;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const result = normalizeEntry(value);
    if (!result.ok) {
      setFeedback({
        kind: 'error',
        text: describeEntryError(classifyEntryError(value)),
      });
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
    formAdd.current = domain;
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
            disabled={!addAllowed}
            aria-invalid={feedback?.kind === 'error' ? true : undefined}
            aria-describedby={
              addAllowed && feedback !== null ? feedbackId : undefined
            }
            aria-label={i18n.t('blocklist.addTo', [title])}
            placeholder={i18n.t('blocklist.exampleDomain')}
            onChange={(event) => {
              setValue(event.target.value);
              setFeedback(null);
            }}
          />
          <button type="submit" disabled={!addAllowed}>
            {i18n.t('common.add')}
          </button>
        </form>

        {addAllowed &&
        previewDomain !== null &&
        previewDomain !== value.trim() ? (
          <p className="site-list__preview" aria-live="polite">
            → {previewDomain}
          </p>
        ) : null}

        {addAllowed && feedback !== null ? (
          <p
            id={feedbackId}
            className={`site-list__feedback site-list__feedback--${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        ) : null}

        <div
          className="site-list__announce"
          data-announcement
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>

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
              isNew={added.includes(entry.domain.value)}
              reveal={added[0] === entry.domain.value}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
