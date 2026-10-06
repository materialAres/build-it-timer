import { useAppStore, selectPopulation } from '@/store';

/**
 * The counter's own stylesheet, consistent with the city's CRT look (M2.T14)
 * and the score badge (M2.T17): monospace, a subtle glow via
 * `text-shadow: … currentColor`.
 */
const POPULATION_COUNTER_STYLES = `
  .population-counter {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #51cf66;
    text-shadow: 0 0 4px currentColor;
  }
  .population-counter__value {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .population-counter__label {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.8;
  }
`;

/**
 * Current session's city population (roadmap M2.T18). Presentational only: it
 * reads the population through the granular store selector (M2.T18) and renders
 * it — no calculation happens here (Separation of Concerns, §1.1). `role="status"`
 * makes it a polite live region, so growth is announced without stealing focus.
 */
export function PopulationCounter() {
  const population = useAppStore(selectPopulation);
  // Defensive: a persisted payload written before the field existed (or a
  // non-finite value) must not render `NaN`/`undefined` into the UI (§1.4).
  const safePopulation = Number.isFinite(population) ? population : 0;
  const populationLabel = String(safePopulation);

  return (
    <span
      className="population-counter"
      data-population={safePopulation}
      role="status"
      aria-label={`Population: ${populationLabel}`}
    >
      <style>{POPULATION_COUNTER_STYLES}</style>
      <span className="population-counter__value">{safePopulation}</span>
      <span className="population-counter__label">population</span>
    </span>
  );
}
