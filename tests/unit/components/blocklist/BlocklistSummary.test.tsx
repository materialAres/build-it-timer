import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlocklistSummary } from '@/components/blocklist/BlocklistSummary';
import { useAppStore } from '@/store';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (value: string): BlocklistEntry => ({
  domain: { value },
  manual: true,
  presetIds: [],
});

const seed = (entries: ReadonlyArray<BlocklistEntry>): void => {
  useAppStore.setState({
    blocklist: { blocklist: entries, appliedPresetIds: [], userPresets: [] },
  });
};

describe('BlocklistSummary (UI.T4)', () => {
  beforeEach(() => {
    seed([]);
    useAppStore.getState().setActiveTab('timer');
  });

  afterEach(() => {
    cleanup();
  });

  it('says nothing is blocked when the list is empty', () => {
    render(<BlocklistSummary />);

    expect(
      screen.getByRole('button', { name: 'No sites blocked' }),
    ).toBeInTheDocument();
  });

  it('names the single site in the singular', () => {
    seed([entry('a.com')]);
    render(<BlocklistSummary />);

    expect(
      screen.getByRole('button', {
        name: 'Blocks 1 site · add-only during a session',
      }),
    ).toBeInTheDocument();
  });

  it('counts the sites and says the list is add-only during a session', () => {
    seed([entry('a.com'), entry('b.com'), entry('c.com')]);
    render(<BlocklistSummary />);

    expect(
      screen.getByRole('button', {
        name: 'Blocks 3 sites · add-only during a session',
      }),
    ).toBeInTheDocument();
  });

  it('follows the list as it changes', () => {
    render(<BlocklistSummary />);
    expect(screen.getByRole('button')).toHaveTextContent('No sites blocked');

    act(() => {
      seed([entry('a.com'), entry('b.com')]);
    });

    expect(screen.getByRole('button')).toHaveTextContent('Blocks 2 sites');
  });

  it('opens the Blocklist tab when activated', async () => {
    render(<BlocklistSummary />);

    await userEvent.click(screen.getByRole('button'));

    expect(useAppStore.getState().ui.activeTab).toBe('blocklist');
  });

  it('carries its own monospace style', () => {
    const { container } = render(<BlocklistSummary />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.blocklist-summary');
    expect(style?.textContent).toContain('monospace');
  });
});
