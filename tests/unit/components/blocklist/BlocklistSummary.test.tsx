import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlocklistSummary } from '@/components/blocklist/BlocklistSummary';
import { useAppStore } from '@/store';
import type { BlocklistEntry, TimerState } from '@/store/store.types';

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

const setStatus = (status: TimerState['status']): void => {
  useAppStore.setState({
    timer: { ...useAppStore.getState().timer, status },
  });
};

describe('BlocklistSummary (UI.T4)', () => {
  beforeEach(() => {
    seed([]);
    setStatus('idle');
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
      screen.getByRole('button', { name: 'Blocks 1 site' }),
    ).toBeInTheDocument();
  });

  it('only counts the sites while idle: removal is allowed again (UI.T10)', () => {
    seed([entry('a.com'), entry('b.com'), entry('c.com')]);
    render(<BlocklistSummary />);

    expect(
      screen.getByRole('button', { name: 'Blocks 3 sites' }),
    ).toBeInTheDocument();
  });

  it.each(['running', 'paused'] as const)(
    'adds that the list is add-only while the session is %s (UI.T10)',
    (status) => {
      seed([entry('a.com'), entry('b.com'), entry('c.com')]);
      setStatus(status);
      render(<BlocklistSummary />);

      expect(
        screen.getByRole('button', {
          name: 'Blocks 3 sites · add-only during a session',
        }),
      ).toBeInTheDocument();
    },
  );

  it.each(['idle', 'completed'] as const)(
    'drops the add-only note when the status is %s (UI.T10)',
    (status) => {
      seed([entry('a.com')]);
      setStatus(status);
      render(<BlocklistSummary />);

      expect(screen.getByRole('button')).toHaveTextContent(/^Blocks 1 site$/);
    },
  );

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

  it('has a target at least 24px tall in the shared outline style (UI.T10)', () => {
    const { container } = render(<BlocklistSummary />);

    const css = container.querySelector('style')?.textContent ?? '';
    // 1.5rem = 24px at the popup's 16px root; the pill border/background come
    // from the shared `:where(.popup) button` rule, not from this component.
    expect(css).toMatch(/min-height:\s*1\.5rem/);
    expect(css).not.toMatch(/border:\s*0/);
    expect(css).not.toMatch(/text-decoration:\s*underline/);
  });

  it('carries its own monospace style', () => {
    const { container } = render(<BlocklistSummary />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.blocklist-summary');
    expect(style?.textContent).toContain('monospace');
  });
});
