import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useAppStore } from '@/store';

const mocks = vi.hoisted(() => ({ freeCamera: false }));

vi.mock('@/components/city/webgl-support', () => ({ hasWebGl2: () => true }));
vi.mock('@/components/city/CityView3D', () => ({
  default: ({ freeCamera }: { freeCamera?: boolean }) => {
    mocks.freeCamera = freeCamera === true;
    return <div data-testid="view-3d" />;
  },
}));

import App from '@/entrypoints/city/App';

function setCity(sessionId: string | null, built: number): void {
  act(() => {
    useAppStore.setState((state) => ({
      city: { ...state.city, sessionId },
      score: { ...state.score, builtCharacters: built },
    }));
  });
}

describe('full-city page (CR6.T11)', () => {
  beforeEach(() => {
    mocks.freeCamera = false;
    setCity(null, 0);
  });
  afterEach(cleanup);

  it('shows the city on a full-size stage with the free camera', async () => {
    const { container } = render(<App />);
    await screen.findByTestId('view-3d');

    expect(container.querySelector('.city-stage')).toHaveClass('city-stage--full');
    expect(mocks.freeCamera).toBe(true);
    expect(screen.getByRole('img', { name: /city/i })).toBeInTheDocument();
  });

  it('is titled and tells how to move the camera', async () => {
    render(<App />);
    await screen.findByTestId('view-3d');

    expect(document.title).toBe('Build-it! — Full city');
    expect(screen.getByRole('heading', { name: 'Build-it! — Full city' })).toBeInTheDocument();
    expect(screen.getByText('Drag to turn, scroll to zoom, right-drag to move.')).toBeInTheDocument();
  });

  it('updates live from the store, and keeps the empty-city hint while nothing is built', async () => {
    render(<App />);
    await screen.findByTestId('view-3d');
    expect(screen.getByText(/your city grows while you focus/i)).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('City: nothing built yet.');

    setCity('session-page', 300);
    expect(screen.getByRole('status').textContent).toMatch(/^City: \d+ of \d+ floors built/);
    expect(screen.queryByText(/your city grows while you focus/i)).not.toBeInTheDocument();
  });

  it('has no controls that change anything: no buttons at all', async () => {
    render(<App />);
    await screen.findByTestId('view-3d');
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('never writes the store: its sources do not call store actions or setState (§1.3)', () => {
    const dir = resolve(import.meta.dirname, '../../../entrypoints/city');
    for (const name of readdirSync(dir).filter((n) => /\.(ts|tsx)$/.test(n))) {
      const source = readFileSync(resolve(dir, name), 'utf8');
      expect(source).not.toMatch(/\.setState\(|getState\(\)\s*\./);
    }
  });
});
