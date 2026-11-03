import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagEditor } from '@/components/blocklist/TagEditor';
import { useAppStore } from '@/store';
import type { BlocklistEntry, Tag, TimerStatus } from '@/store/store.types';

const entry = (value: string, tagIds: ReadonlyArray<string> = []): BlocklistEntry => ({
  domain: { value },
  tagIds,
});

const resetBlocklist = (
  blocklist: ReadonlyArray<BlocklistEntry> = [],
  customTags: ReadonlyArray<Tag> = [],
): void => {
  useAppStore.setState({ blocklist: { blocklist, customTags } });
};

const setStatus = (status: TimerStatus): void => {
  useAppStore.setState({
    timer: { ...useAppStore.getState().timer, status },
  });
};

const currentBlocklist = () => useAppStore.getState().blocklist;

describe('TagEditor (M3.T2)', () => {
  beforeEach(() => {
    resetBlocklist();
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a row per blocklisted site', () => {
    resetBlocklist([entry('a.com'), entry('b.com')]);

    render(<TagEditor />);

    expect(screen.getByText('a.com')).toBeInTheDocument();
    expect(screen.getByText('b.com')).toBeInTheDocument();
  });

  it('creates a tag through the store action', async () => {
    render(<TagEditor />);

    await userEvent.type(screen.getByLabelText('New tag name'), 'Focus');
    await userEvent.click(screen.getByRole('button', { name: 'Create tag' }));

    expect(currentBlocklist().customTags).toHaveLength(1);
    expect(currentBlocklist().customTags[0]?.label).toBe('Focus');
    expect(screen.getByRole('button', { name: 'Filter by Focus' })).toBeInTheDocument();
  });

  it('rejects a duplicate tag name case-insensitively', async () => {
    resetBlocklist([], [{ id: 'focus', label: 'Focus' }]);
    render(<TagEditor />);

    const input = screen.getByLabelText('New tag name');
    await userEvent.type(input, 'focus');

    expect(screen.getByRole('button', { name: 'Create tag' })).toBeDisabled();
    expect(currentBlocklist().customTags).toHaveLength(1);
  });

  it('assigns a tag to two sites and filters the list by it', async () => {
    resetBlocklist([entry('a.com'), entry('b.com'), entry('c.com')]);
    render(<TagEditor />);

    await userEvent.type(screen.getByLabelText('New tag name'), 'Focus');
    await userEvent.click(screen.getByRole('button', { name: 'Create tag' }));

    await userEvent.click(screen.getByLabelText('Assign Focus to a.com'));
    await userEvent.click(screen.getByLabelText('Assign Focus to b.com'));

    const tagged = currentBlocklist().blocklist.filter((site) => site.tagIds.length > 0);
    expect(tagged.map((site) => site.domain.value)).toEqual(['a.com', 'b.com']);

    await userEvent.click(screen.getByRole('button', { name: 'Filter by Focus' }));

    expect(screen.getByText('a.com')).toBeInTheDocument();
    expect(screen.getByText('b.com')).toBeInTheDocument();
    expect(screen.queryByText('c.com')).not.toBeInTheDocument();
  });

  it('deletes a tag and detaches it from the sites that carried it', async () => {
    resetBlocklist([entry('a.com', ['focus'])], [{ id: 'focus', label: 'Focus' }]);
    render(<TagEditor />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Focus' }));

    expect(currentBlocklist().customTags).toEqual([]);
    expect(currentBlocklist().blocklist[0]?.tagIds).toEqual([]);
  });

  it('carries its own stylesheet', () => {
    const { container } = render(<TagEditor />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.tag-editor');
  });
});

describe.each(['running', 'paused', 'completed'] as const)(
  'TagEditor while the timer is %s (CR2.T3b)',
  (status) => {
    beforeEach(() => {
      resetBlocklist(
        [entry('a.com', ['focus']), entry('b.com'), entry('c.com')],
        [{ id: 'focus', label: 'Focus' }],
      );
      setStatus(status);
    });

    afterEach(() => {
      cleanup();
    });

    it('disables tag creation, deletion and assignment', () => {
      render(<TagEditor />);

      expect(screen.getByLabelText('New tag name')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Create tag' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete Focus' })).toBeDisabled();
      expect(screen.getByLabelText('Assign Focus to b.com')).toBeDisabled();
    });

    it('keeps filtering the list by tag', async () => {
      render(<TagEditor />);

      const filter = screen.getByRole('button', { name: 'Filter by Focus' });
      expect(filter).toBeEnabled();

      await userEvent.click(filter);

      expect(screen.getByText('a.com')).toBeInTheDocument();
      expect(screen.queryByText('b.com')).not.toBeInTheDocument();
      expect(screen.queryByText('c.com')).not.toBeInTheDocument();
    });

    it('does not mutate anything when the disabled controls are clicked', () => {
      render(<TagEditor />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Focus' }));
      fireEvent.click(screen.getByLabelText('Assign Focus to b.com'));

      expect(currentBlocklist().customTags).toEqual([
        { id: 'focus', label: 'Focus' },
      ]);
      expect(currentBlocklist().blocklist[1]?.tagIds).toEqual([]);
    });

    it('re-enables the mutating controls when the timer returns to idle', () => {
      render(<TagEditor />);

      act(() => {
        setStatus('idle');
      });

      expect(screen.getByLabelText('New tag name')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Create tag' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete Focus' })).toBeEnabled();
      expect(screen.getByLabelText('Assign Focus to b.com')).toBeEnabled();
    });
  },
);
