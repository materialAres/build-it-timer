import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { CityCanvas } from '@/components/city/CityCanvas';
import { CityCell } from '@/components/city/CityCell';
import { applyMalus } from '@/lib/score/apply-malus';
import { getBuildingColor } from '@/lib/city/palette';
import { getThemeById } from '@/lib/city/theme-registry';
import { useAppStore, DEFAULT_CITY_HEIGHT, DEFAULT_CITY_WIDTH } from '@/store';
import type {
  CityCell as CityCellData,
  CityGrid,
  CityLayers,
} from '@/components/city/city.types';

/** Build a grid where the keys of `occupied` are `"row:col"`. */
function makeGrid(
  width: number,
  height: number,
  occupied: Readonly<Record<string, CityCellData>> = {},
): CityGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, (_, row) =>
      Array.from(
        { length: width },
        (_, col) => occupied[String(row) + ':' + String(col)] ?? { char: null },
      ),
    ),
  };
}

function makeLayers(overrides: Partial<CityLayers> = {}): CityLayers {
  return {
    background: makeGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
    middleground: makeGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
    foreground: makeGrid(DEFAULT_CITY_WIDTH, DEFAULT_CITY_HEIGHT),
    ...overrides,
  };
}

function setCity(layers: CityLayers, themeId: string | null = null): void {
  useAppStore.setState((state) => ({
    city: { ...state.city, layers, themeId },
  }));
}

function cellAt(container: HTMLElement, selector: string): HTMLElement {
  const cell = container.querySelector(selector);
  expect(cell).not.toBeNull();
  return cell as HTMLElement;
}

describe('CityCell (M2.T14)', () => {
  afterEach(cleanup);

  it('renders the character with the given color', () => {
    const { container } = render(<CityCell char="#" color="#ff0000" />);

    const cell = cellAt(container, '.city-cell');
    expect(cell).toHaveTextContent('#');
    expect(cell.style.color).toBe('#ff0000');
  });

  it('renders a destroyed cell without any visible character or color', () => {
    const { container } = render(<CityCell char={null} color="#ff0000" />);

    const cell = cellAt(container, '.city-cell');
    expect(cell).toHaveClass('city-cell--empty');
    expect(cell).not.toHaveAttribute('style');
  });
});

describe('CityCanvas (M2.T14)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setCity(makeLayers());
  });

  afterEach(cleanup);

  it('renders the three layers of an empty grid with no visible character', () => {
    const { container } = render(<CityCanvas />);

    expect(container.querySelectorAll('.city-layer')).toHaveLength(3);
    expect(container.querySelector('.city-layer--background')).not.toBeNull();
    expect(container.querySelector('.city-layer--middleground')).not.toBeNull();
    expect(container.querySelector('.city-layer--foreground')).not.toBeNull();

    for (const cell of container.querySelectorAll('.city-cell')) {
      expect(cell).toHaveClass('city-cell--empty');
    }
  });

  it('renders the characters of every layer', () => {
    setCity(
      makeLayers({
        background: makeGrid(4, 2, { '0:0': { char: '.' } }),
        middleground: makeGrid(4, 2, { '1:1': { char: '#' } }),
        foreground: makeGrid(4, 2, { '1:2': { char: '|' } }),
      }),
    );

    const { container } = render(<CityCanvas />);

    expect(
      cellAt(container, '.city-layer--background .city-cell'),
    ).toHaveTextContent('.');
    expect(
      cellAt(
        container,
        '.city-layer--middleground .city-layer__row:nth-child(2) .city-cell:nth-child(2)',
      ),
    ).toHaveTextContent('#');
    expect(
      cellAt(
        container,
        '.city-layer--foreground .city-layer__row:nth-child(2) .city-cell:nth-child(3)',
      ),
    ).toHaveTextContent('|');
  });

  it('applies a palette color from the active theme to occupied cells', () => {
    setCity(
      makeLayers({ background: makeGrid(4, 2, { '0:0': { char: '#' } }) }),
      'phosphor',
    );

    const palette = getThemeById('phosphor')?.palette ?? [];
    const expected = getBuildingColor('background', palette);

    const { container } = render(<CityCanvas />);

    const cell = cellAt(container, '.city-layer--background .city-cell');
    expect(cell).toHaveTextContent('#');
    expect(cell.style.color).toBe(expected);
  });

  it('lets a cell color override the layer palette color', () => {
    setCity(
      makeLayers({
        middleground: makeGrid(4, 2, { '0:0': { char: '#', color: '#ff0000' } }),
      }),
    );

    const { container } = render(<CityCanvas />);

    expect(
      cellAt(container, '.city-layer--middleground .city-cell').style.color,
    ).toBe('#ff0000');
  });

  it('does not show the building character or color once the cell is destroyed', () => {
    const built = makeLayers({
      background: makeGrid(4, 2, { '0:0': { char: '#', color: '#ff0000' } }),
    });
    // One malus tick removes the topmost occupied cell (M2.T10).
    setCity(applyMalus(built, 1));

    const { container } = render(<CityCanvas />);

    const cell = cellAt(container, '.city-layer--background .city-cell');
    expect(cell).toHaveClass('city-cell--empty');
    expect(cell).not.toHaveTextContent('#');
    expect(cell).not.toHaveAttribute('style');
  });

  it('handles a grid whose cells are all destroyed', () => {
    setCity(
      makeLayers({
        background: makeGrid(3, 3, { '0:0': { char: null }, '1:1': { char: null } }),
        middleground: makeGrid(3, 3, { '2:2': { char: null } }),
        foreground: makeGrid(3, 3, { '0:2': { char: null } }),
      }),
    );

    const { container } = render(<CityCanvas />);

    for (const cell of container.querySelectorAll('.city-cell')) {
      expect(cell).toHaveClass('city-cell--empty');
    }
  });

  it('carries the CRT glow stylesheet with the required text-shadow', () => {
    const { container } = render(<CityCanvas />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });

  it('uses the active theme background color and id', () => {
    setCity(makeLayers(), 'sunset');

    const { container } = render(<CityCanvas />);

    const canvas = cellAt(container, '.city-canvas');
    expect(canvas).toHaveAttribute('data-theme', 'sunset');
    expect(canvas.style.backgroundColor).toBe('#1a0f12');
  });
});
