import { i18n } from '#i18n';
import { useAppStore, selectScoreLevel } from '@/store';
import type { ScoreLevel } from '@/store/store.types';

/**
 * i18n key per score level, as data (Open/Closed, §1.1): a new level is an entry
 * here, never an `if/else` chain in the render path. The keys resolve to the EN
 * default and fall back to it for any missing translation (M3.T9).
 */
export const SCORE_LEVEL_LABEL_KEYS = {
  excellent: 'score.excellent',
  good: 'score.good',
  bad: 'score.bad',
} as const satisfies Record<ScoreLevel, string>;

/** Localized display label for a score level, resolved at render time. */
export function scoreLevelLabel(level: ScoreLevel): string {
  return i18n.t(SCORE_LEVEL_LABEL_KEYS[level]);
}

/**
 * The badge's own stylesheet. Each level gets a distinct color so the three
 * variants are visually unambiguous; the CRT glow follows the level's color
 * through `text-shadow: … currentColor`, matching the city's look (M2.T14).
 */
const SCORE_BADGE_STYLES = `
  .score-badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 4px currentColor;
  }
  .score-badge--excellent { color: #51cf66; }
  .score-badge--good { color: #fcc419; }
  .score-badge--bad { color: #ff6b6b; }
`;

/**
 * Current session score level as a styled badge (M2.T17). Presentational only:
 * it reads the level through the store selector (M2.T9) and derives both its
 * label and its modifier class from it — no scoring logic lives here
 * (Separation of Concerns, §1.1). `role="status"` makes it a polite live region,
 * so a level change is announced without stealing focus.
 */
export function ScoreBadge() {
  const level = useAppStore(selectScoreLevel);
  const label = scoreLevelLabel(level);

  return (
    <span
      className={`score-badge score-badge--${level}`}
      data-level={level}
      role="status"
      aria-label={i18n.t('score.badgeAriaLabel', [label])}
    >
      <style>{SCORE_BADGE_STYLES}</style>
      {label}
    </span>
  );
}
