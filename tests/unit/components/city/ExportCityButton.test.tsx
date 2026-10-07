import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  ExportCityButton,
  type CityImageExporter,
} from '@/components/city/ExportCityButton';
import { getThemeById } from '@/lib/city/theme-registry';
import { ok, err } from '@/utils/result';
import { useAppStore, DEFAULT_CITY_HEIGHT, DEFAULT_CITY_WIDTH } from '@/store';
import type {
  CityCell,
  CityGrid,
  CityLayers,
} from '@/components/city/city.types';
import type { RasterizedCityImage } from '@/lib/city/rasterize-image';

const RASTER: RasterizedCityImage = {
  dataUrl: 'data:image/png;base64,AAAA',
  mimeType: 'image/png',
  width: 10,
  height: 10,
};

function makeGrid(
  width: number,
  height: number,
  occupied: Readonly<Record<string, CityCell>> = {},
): CityGrid {
  return {
    width,
    height,
    cells: Array.from({ length: height }, (_, row) =>
      Array.from(
        { length: width },
        (_, col) => occupied[`${String(row)}:${String(col)}`] ?? { char: null },
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
  useAppStore.setState((state) => ({ city: { ...state.city, layers, themeId } }));
}

function makeExporter() {
  return vi.fn<CityImageExporter>();
}

describe('ExportCityButton (M3.T8)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setCity(makeLayers());
  });

  afterEach(cleanup);

  it('offers both a PNG and a JPEG export', () => {
    render(<ExportCityButton exporter={makeExporter()} />);

    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export JPEG' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Export city' })).toBeInTheDocument();
  });

  it('exports the current grid and active theme as PNG', async () => {
    const layers = makeLayers({
      background: makeGrid(4, 2, { '0:0': { char: '#' } }),
    });
    setCity(layers, 'phosphor');
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(exporter).toHaveBeenCalledTimes(1);
    const [calledLayers, calledTheme, calledFormat] = exporter.mock.calls[0] ?? [];
    expect(calledLayers).toBe(layers);
    expect(calledTheme?.id).toBe('phosphor');
    expect(calledTheme?.backgroundColor).toBe(
      getThemeById('phosphor')?.backgroundColor,
    );
    expect(calledFormat).toBe('png');
  });

  it('asks for the JPEG format from the JPEG button', async () => {
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export JPEG' }));

    expect(exporter).toHaveBeenCalledTimes(1);
    expect(exporter.mock.calls[0]?.[2]).toBe('jpeg');
  });

  it('shows an error message when the export fails, without throwing', async () => {
    const exporter = makeExporter();
    exporter.mockResolvedValue(err(new Error('canvas exploded')));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not export the city image.',
    );
  });

  it('handles a rejected export at the boundary without breaking the popup', async () => {
    const exporter = makeExporter();
    exporter.mockRejectedValue(new Error('unexpected'));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export JPEG' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('carries its own CRT stylesheet', () => {
    const { container } = render(<ExportCityButton exporter={makeExporter()} />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.export-city__button');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
