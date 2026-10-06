import type { CityGrid, CityLayerName } from './city.types';
import { CityCell } from './CityCell';

/**
 * One parallax layer of the city (roadmap M2.T14): renders a `CityGrid` as a
 * monospace `<pre>`, one `<CityCell>` per character. It receives the grid and
 * the layer's fallback color as props — no store access — so `CityCanvas` is the
 * only city component coupled to the store (acceptance criterion 1).
 */
export interface CityLayerProps {
  readonly name: CityLayerName;
  readonly grid: CityGrid;
  /**
   * Deterministic palette color applied to occupied cells that do not carry
   * their own (per-building domain colors arrive with M2.T16). Empty cells
   * ignore it and stay invisible.
   */
  readonly color?: string;
}

export function CityLayer({ name, grid, color }: CityLayerProps) {
  return (
    <pre className={`city-layer city-layer--${name}`} data-layer={name}>
      {grid.cells.map((row, rowIndex) => (
        <span className="city-layer__row" key={rowIndex}>
          {row.map((cell, colIndex) => (
            <CityCell
              key={colIndex}
              char={cell.char}
              color={cell.char === null ? undefined : (cell.color ?? color)}
            />
          ))}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}
