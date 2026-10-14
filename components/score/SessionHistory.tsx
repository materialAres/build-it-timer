import { i18n } from '#i18n';
import { useAppStore, selectSessionHistory } from '@/store';
import type { SessionSummary } from '@/store/store.types';
import { SCORE_LEVEL_LABEL_KEYS, scoreLevelLabel } from './ScoreBadge';

/**
 * The history's own stylesheet, consistent with the city (M2.T14) and the score
 * badge (M2.T17): monospace and the CRT glow via `text-shadow: … currentColor`.
 */
const SESSION_HISTORY_STYLES = `
  .session-history {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #e6e6e6;
  }
  .session-history__title {
    margin: 0;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .session-history__empty {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.6;
  }
  .session-history__list {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .session-history__item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid rgba(230, 230, 230, 0.2);
    border-radius: 4px;
    font-size: 0.8rem;
    text-shadow: 0 0 4px currentColor;
  }
  .session-history__score--excellent { color: #51cf66; }
  .session-history__score--good { color: #fcc419; }
  .session-history__score--bad { color: #ff6b6b; }
  .session-history__population { opacity: 0.85; }
`;

/**
 * Resolve the stored score level to its localized label without recalculating it
 * (the level is never derived from a ratio here, Separation of Concerns §1.1).
 * A stale/unknown persisted level degrades to its raw string instead of
 * rendering `undefined` at the untrusted storage boundary (§1.4).
 */
function scoreLabel(summary: SessionSummary): string {
  const known = Object.hasOwn(SCORE_LEVEL_LABEL_KEYS, summary.score);
  return known ? scoreLevelLabel(summary.score) : summary.score;
}

/**
 * Defensive read of a persisted population: a non-finite value must not leak
 * `NaN` into the UI (§1.4).
 */
function safePopulation(summary: SessionSummary): number {
  return Number.isFinite(summary.population) ? summary.population : 0;
}

/**
 * History of the last 5 completed sessions (roadmap M3.T7). Presentational only:
 * it reads the slice through the granular `selectSessionHistory` selector (M2.T19)
 * and computes nothing. Order and cap are the slice's contract (newest first,
 * max 5), so the list is rendered in the stored order — never re-sorted or
 * re-sliced here. Visible strings are resolved through `i18n.t(...)` (M3.T9).
 */
export function SessionHistory() {
  const sessions = useAppStore(selectSessionHistory);

  return (
    <section
      className="session-history"
      aria-label={i18n.t('score.historyAriaLabel')}
    >
      <style>{SESSION_HISTORY_STYLES}</style>
      <h2 className="session-history__title">{i18n.t('score.lastSessions')}</h2>
      {sessions.length === 0 ? (
        <p className="session-history__empty">{i18n.t('score.noSessions')}</p>
      ) : (
        <ol className="session-history__list">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="session-history__item"
              data-session-id={session.sessionId}
              data-score={session.score}
              data-population={safePopulation(session)}
            >
              <span
                className={`session-history__score session-history__score--${session.score}`}
              >
                {scoreLabel(session)}
              </span>
              <span className="session-history__population">
                {`${String(safePopulation(session))} ${i18n.t('score.populationShort')}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
