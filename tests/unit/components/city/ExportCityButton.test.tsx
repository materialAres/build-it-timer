import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  ExportCityButton,
  type CityImageExporter,
} from '@/components/city/ExportCityButton';
import { ok, err } from '@/utils/result';
import { createLogger, type LogRecord } from '@/utils/logger';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { setCityCapture } from '@/components/city/city-capture';
import type { FrameCapture } from '@/lib/city/export-image';
import { renderSkyline } from '@/lib/city/plan/plan-skyline';
import type { RasterizedCityImage } from '@/lib/city/rasterize-image';

const RASTER: RasterizedCityImage = {
  dataUrl: 'data:image/png;base64,AAAA',
  mimeType: 'image/png',
  width: 10,
  height: 10,
};

function setCity(sessionId: string | null, built: number): void {
  useAppStore.setState((state) => ({
    city: { ...state.city, sessionId },
    score: { ...state.score, builtCharacters: built },
  }));
}

function makeExporter() {
  return vi.fn<CityImageExporter>();
}

function captureLogger(): {
  records: LogRecord[];
  logger: ReturnType<typeof createLogger>;
} {
  const records: LogRecord[] = [];
  const logger = createLogger('export-test', {
    sink: (record) => {
      records.push(record);
    },
    minLevel: 'debug',
  });
  return { records, logger };
}

describe('ExportCityButton (M3.T8)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setCity(null, 0);
  });

  afterEach(() => {
    cleanup();
    setCityCapture(null);
  });

  it('offers both a PNG and a JPEG export', () => {
    render(<ExportCityButton exporter={makeExporter()} />);

    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export JPEG' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Export city' })).toBeInTheDocument();
  });

  it('exports the text city of the current plan and floors as PNG', async () => {
    setCity('session-export', 300);
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(exporter).toHaveBeenCalledTimes(1);
    const [rows, format] = exporter.mock.calls[0] ?? [];
    const state = useAppStore.getState();
    const plan = selectCityPlan(state);
    expect(plan).not.toBeNull();
    if (plan !== null) expect(rows).toEqual(renderSkyline(plan, selectVisibleFloors(state)));
    expect(rows?.join('')).toMatch(/#/);
    expect(format).toBe('png');
  });

  it('exports an empty picture, not an error, before there is a city', async () => {
    setCity(null, 0);
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(exporter.mock.calls[0]?.[0]).toEqual([]);
  });

  it('hands the exporter the 3D capture while the 3D view is running, and null without it', async () => {
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));
    const capture: FrameCapture = () => ok(RASTER);

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    expect(exporter.mock.calls[0]?.[2]).toBeNull();

    setCityCapture(capture);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));
    expect(exporter.mock.calls[1]?.[2]).toBe(capture);
  });

  it('asks for the JPEG format from the JPEG button', async () => {
    const exporter = makeExporter();
    exporter.mockResolvedValue(ok(RASTER));

    render(<ExportCityButton exporter={exporter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export JPEG' }));

    expect(exporter).toHaveBeenCalledTimes(1);
    expect(exporter.mock.calls[0]?.[1]).toBe('jpeg');
  });

  it('logs a failed result and keeps the localized error, without throwing', async () => {
    const exporter = makeExporter();
    const cause = new Error('canvas exploded');
    exporter.mockResolvedValue(err(cause));
    const { records, logger } = captureLogger();

    render(<ExportCityButton exporter={exporter} logger={logger} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not export the city image.',
    );

    const failure = records.find(
      (record) => record.message === 'city export failed',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('export-test');
    expect(failure?.details[0]).toBe(cause);
    expect(failure?.details[1]).toEqual({ format: 'png' });
  });

  it('logs a rejected export and keeps the localized error, without breaking the popup', async () => {
    const exporter = makeExporter();
    const cause = new Error('unexpected');
    exporter.mockRejectedValue(cause);
    const { records, logger } = captureLogger();

    render(<ExportCityButton exporter={exporter} logger={logger} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export JPEG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not export the city image.',
    );

    const failure = records.find(
      (record) => record.message === 'city export rejected',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('export-test');
    expect(failure?.details[0]).toBe(cause);
    expect(failure?.details[1]).toEqual({ format: 'jpeg' });
  });

  it('contains a synchronously throwing exporter', async () => {
    const exporter = makeExporter();
    exporter.mockImplementation(() => {
      throw new Error('sync failure');
    });
    const { records, logger } = captureLogger();

    render(<ExportCityButton exporter={exporter} logger={logger} />);
    await userEvent.click(screen.getByRole('button', { name: 'Export PNG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not export the city image.',
    );
    expect(
      records.find((record) => record.message === 'city export rejected')
        ?.details[1],
    ).toEqual({ format: 'png' });
  });

  it('carries its own CRT stylesheet', () => {
    const { container } = render(<ExportCityButton exporter={makeExporter()} />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.export-city__button');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
