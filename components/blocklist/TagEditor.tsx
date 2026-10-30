import { i18n } from '#i18n';
import { useState, type SyntheticEvent } from 'react';
import {
  filterEntriesByTag,
  hasTagLabel,
  selectBlocklist,
  selectCustomTags,
  useAppStore,
} from '@/store';
import type { Tag } from '@/store/store.types';

/**
 * The editor's own stylesheet, consistent with the CRT/monospace look used by
 * the rest of the popup (M2.T14/M2.T17/M2.T18/M3.T1).
 */
const TAG_EDITOR_STYLES = `
  .tag-editor {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #e9ecef;
  }
  .tag-editor__form {
    display: flex;
    gap: 0.4rem;
  }
  .tag-editor__input {
    flex: 1;
    background: #0b0f14;
    border: 1px solid #4dabf7;
    color: inherit;
    padding: 0.3rem 0.5rem;
  }
  .tag-editor__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tag-editor__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    color: #4dabf7;
  }
  .tag-editor__sites {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .tag-editor__site {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tag-editor__domain {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tag-editor__filter[aria-pressed='true'] {
    text-shadow: 0 0 6px currentColor;
    background: rgba(77, 171, 247, 0.15);
  }
`;

interface TagSiteRowProps {
  readonly domain: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<Tag>;
}

/**
 * One site row with a checkbox per custom tag. Private and purely presentational
 * (one level of nesting, §1.2): it only reads the entry's `tagIds` and invokes
 * the assignment actions, never computes tag state itself.
 */
function TagSiteRow({ domain, tagIds, tags }: TagSiteRowProps) {
  return (
    <li className="tag-editor__site">
      <span className="tag-editor__domain">{domain}</span>
      {tags.map((tag) => {
        const assigned = tagIds.includes(tag.id);
        return (
          <label key={tag.id} className="tag-editor__assign">
            <input
              type="checkbox"
              checked={assigned}
              aria-label={i18n.t('blocklist.assignTag', [tag.label, domain])}
              onChange={() => {
                const action = useAppStore.getState();
                if (assigned) action.unassignTag(domain, tag.id);
                else action.assignTag(domain, tag.id);
              }}
            />
            {tag.label}
          </label>
        );
      })}
    </li>
  );
}

/**
 * Tag editor (M3.T2): create custom categories, assign them to sites and filter
 * the site list by tag to shape a custom preset.
 *
 * Presentational: it holds no tag logic — creation goes through the
 * `createTag` store action (which owns the duplicate check and id minting) and
 * assignment through `assignTag`/`unassignTag`. The read-only popup store
 * updates optimistically and the action forwards one mutation to the background
 * — the single writer (M1.T9/M1.T10) — which persists it.
 */
export function TagEditor() {
  const tags = useAppStore(selectCustomTags);
  const blocklist = useAppStore(selectBlocklist);
  const [label, setLabel] = useState('');
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  const trimmed = label.trim();
  const canCreate = trimmed.length > 0 && !hasTagLabel(tags, trimmed);
  const visibleSites =
    filterTagId === null ? blocklist : filterEntriesByTag(blocklist, filterTagId);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canCreate) return;
    useAppStore.getState().createTag(trimmed);
    setLabel('');
  };

  return (
    <section className="tag-editor" aria-label={i18n.t('blocklist.tags')}>
      <style>{TAG_EDITOR_STYLES}</style>
      <form className="tag-editor__form" onSubmit={handleSubmit}>
        <input
          className="tag-editor__input"
          type="text"
          value={label}
          aria-label={i18n.t('blocklist.newTagName')}
          placeholder={i18n.t('blocklist.newTag')}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
        />
        <button type="submit" disabled={!canCreate}>
          {i18n.t('blocklist.createTag')}
        </button>
      </form>

      <ul
        className="tag-editor__tags"
        aria-label={i18n.t('blocklist.customTags')}
      >
        {tags.map((tag) => (
          <li key={tag.id} className="tag-editor__chip">
            <button
              type="button"
              className="tag-editor__filter"
              aria-pressed={filterTagId === tag.id}
              aria-label={i18n.t('blocklist.filterByTag', [tag.label])}
              onClick={() => {
                setFilterTagId(filterTagId === tag.id ? null : tag.id);
              }}
            >
              {tag.label}
            </button>
            <button
              type="button"
              aria-label={i18n.t('blocklist.deleteTag', [tag.label])}
              onClick={() => {
                useAppStore.getState().deleteTag(tag.id);
                if (filterTagId === tag.id) setFilterTagId(null);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <ul className="tag-editor__sites" aria-label={i18n.t('blocklist.sites')}>
        {visibleSites.map((entry) => (
          <TagSiteRow
            key={entry.domain.value}
            domain={entry.domain.value}
            tagIds={entry.tagIds}
            tags={tags}
          />
        ))}
      </ul>
    </section>
  );
}
