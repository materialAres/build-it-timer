import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteList } from '@/components/blocklist/SiteList';
import { useAppStore } from '@/store';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (value: string): BlocklistEntry => ({
  domain: { value },
  tagIds: [],
});

const resetBlocklist = (
  blocklist: ReadonlyArray<BlocklistEntry> = [],
): void => {
  useAppStore.setState({ blocklist: { blocklist, customTags: [] } });
};

const currentBlocklist = () => useAppStore.getState().blocklist;
const values = (list: ReadonlyArray<BlocklistEntry>) =>
  list.map((item) => item.domain.value);

describe('SiteList (M3.T3)', () => {
  beforeEach(() => {
    resetBlocklist();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders one row per blocklist entry', () => {
    resetBlocklist([entry('a.com'), entry('b.com')]);

    render(<SiteList />);

    expect(screen.getByText('a.com')).toBeInTheDocument();
    expect(screen.getByText('b.com')).toBeInTheDocument();
  });

  it('normalizes a full URL to a single registrable entry', async () => {
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'https://m.facebook.com/something',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(values(currentBlocklist().blocklist)).toEqual(['facebook.com']);
    expect(currentBlocklist().blocklist).toHaveLength(1);
    expect(screen.getByText('Added facebook.com.')).toBeInTheDocument();
  });

  it('shows a live normalization preview while typing', async () => {
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'https://m.facebook.com/x',
    );

    expect(screen.getByText('→ facebook.com')).toBeInTheDocument();
  });

  it('does not duplicate an already-present domain and gives explicit feedback', async () => {
    resetBlocklist([entry('facebook.com')]);
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'facebook.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(currentBlocklist().blocklist).toHaveLength(1);
    expect(
      screen.getByText('facebook.com is already in the blocklist.'),
    ).toBeInTheDocument();
  });

  it('shows "Enter a valid URL" for a bare public suffix and adds nothing', async () => {
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'co.uk',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a valid URL')).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('shows "Enter a valid URL" for empty/whitespace input', async () => {
    render(<SiteList />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a valid URL')).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('renders only the blocklist, with no allowlist section', () => {
    render(<SiteList />);

    expect(
      screen.getByRole('region', { name: 'Blocked sites' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Allowed sites' }),
    ).not.toBeInTheDocument();
  });

  it('removes an entry through the store action', async () => {
    resetBlocklist([entry('a.com')]);
    render(<SiteList />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove a.com' }));

    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('carries its own stylesheet', () => {
    const { container } = render(<SiteList />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.site-list');
  });
});
