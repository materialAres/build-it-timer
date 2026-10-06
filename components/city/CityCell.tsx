/**
 * A single character of the city grid (roadmap M2.T14). Purely presentational:
 * it receives its character and color as props and never reads the store
 * (Separation of Concerns, acceptance criterion 1), so it is trivially testable
 * and can be reused by every layer (and by M3.T5's animated variant).
 */
export interface CityCellProps {
  /** ASCII character to render; `null` once the cell has been destroyed. */
  readonly char: string | null;
  /**
   * Overrides the default CRT green when the cell belongs to a colored
   * building; the glow follows it through `text-shadow: … currentColor`.
   */
  readonly color?: string;
}

export function CityCell({ char, color }: CityCellProps) {
  if (char === null || char === '') {
    // A destroyed cell keeps a blank placeholder so the monospace grid stays
    // aligned, but it exposes neither the building's character nor its color.
    return <span className="city-cell city-cell--empty"> </span>;
  }

  return (
    <span className="city-cell" style={color === undefined ? undefined : { color }}>
      {char}
    </span>
  );
}
