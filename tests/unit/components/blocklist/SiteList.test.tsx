import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteList } from '@/components/blocklist/SiteList';
import { useAppStore } from '@/store';
import type { BlocklistEntry } from '@/store/store.types';

const entry = (value: string): BlocklistEntry => ({ domain: { value }, tagIds: [] });

const resetBlocklist = (
  allowlist: ReadonlyArray<BlocklistEntry> = [],
  blocklist: ReadonlyArray<BlocklistEntry> = [],
): void => {
  useAppStore.setState({ blocklist: { allowlist, blocklist, customTags: [] } });
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

  it('renders one row per entry of the addressed list', () => {
    resetBlocklist([], [entry('a.com'), entry('b.com')]);

    render(<SiteList list="blocklist" />);

    expect(screen.getByText('a.com')).toBeInTheDocument();
    expect(screen.getByText('b.com')).toBeInTheDocument();
  });

  it('normalizes a full URL to a single registrable entry', async () => {
    render(<SiteList list="blocklist" />);

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
    render(<SiteList list="blocklist" />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocked sites'),
      'https://m.facebook.com/x',
    );

    expect(screen.getByText('→ facebook.com')).toBeInTheDocument();
  });

  it('does not duplicate an already-present domain and gives explicit feedback', async () => {
    resetBlocklist([], [entry('facebook.com')]);
    render(<SiteList list="blocklist" />);

    await userEvent.type(screen.getByLabelText('Add to Blocked sites'), 'facebook.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(currentBlocklist().blocklist).toHaveLength(1);
    expect(screen.getByText('facebook.com is already in the blocklist.')).toBeInTheDocument();
  });

  it('shows "Enter a valid URL" for a bare public suffix and adds nothing', async () => {
    render(<SiteList list="blocklist" />);

    await userEvent.type(screen.getByLabelText('Add to Blocked sites'), 'co.uk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a valid URL')).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('shows "Enter a valid URL" for empty/whitespace input', async () => {
    render(<SiteList list="blocklist" />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a valid URL')).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('moves a domain already in the opposite list instead of duplicating it', async () => {
    resetBlocklist([entry('facebook.com')], []);
    render(<SiteList list="blocklist" />);

    await userEvent.type(screen.getByLabelText('Add to Blocked sites'), 'facebook.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(values(currentBlocklist().blocklist)).toEqual(['facebook.com']);
    expect(currentBlocklist().allowlist).toEqual([]);
    expect(screen.getByText('Moved facebook.com from the allowlist.')).toBeInTheDocument();
  });

  it('removes an entry through the store action', async () => {
    resetBlocklist([], [entry('a.com')]);
    render(<SiteList list="blocklist" />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove a.com' }));

    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('renders the allowlist when addressed', () => {
    resetBlocklist([entry('keep.com')], []);

    render(<SiteList list="allowlist" />);

    expect(screen.getByText('keep.com')).toBeInTheDocument();
  });

  it('carries its own stylesheet', () => {
    const { container } = render(<SiteList list="blocklist" />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.site-list');
  });
});
