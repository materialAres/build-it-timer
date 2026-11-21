import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteList } from '@/components/blocklist/SiteList';
import { useAppStore } from '@/store';
import type { BlocklistEntry, TimerStatus } from '@/store/store.types';

const entry = (value: string): BlocklistEntry => ({
  domain: { value },
  manual: true,
  presetIds: [],
});

const resetBlocklist = (
  blocklist: ReadonlyArray<BlocklistEntry> = [],
): void => {
  useAppStore.setState({
    blocklist: { blocklist, appliedPresetIds: [], userPresets: [] },
  });
};

const setStatus = (status: TimerStatus): void => {
  useAppStore.setState({
    timer: { ...useAppStore.getState().timer, status },
  });
};

const currentBlocklist = () => useAppStore.getState().blocklist;
const values = (list: ReadonlyArray<BlocklistEntry>) =>
  list.map((item) => item.domain.value);

describe('SiteList (M3.T3)', () => {
  beforeEach(() => {
    resetBlocklist();
    setStatus('idle');
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
      screen.getByLabelText('Add to Blocklist'),
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
      screen.getByLabelText('Add to Blocklist'),
      'https://m.facebook.com/x',
    );

    expect(screen.getByText('→ facebook.com')).toBeInTheDocument();
  });

  it('does not duplicate an already-present domain and gives explicit feedback', async () => {
    resetBlocklist([entry('facebook.com')]);
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocklist'),
      'facebook.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(currentBlocklist().blocklist).toHaveLength(1);
    expect(
      screen.getByText('facebook.com is already in the blocklist.'),
    ).toBeInTheDocument();
  });

  it('names a bare public suffix instead of a generic error and adds nothing (UI.T6)', async () => {
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocklist'),
      'co.uk',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      screen.getByText(
        'co.uk is a domain ending, not a site. Add the site name, like example.com.',
      ),
    ).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('asks for a site when the input is empty (UI.T6)', async () => {
    render(<SiteList />);

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a site, like example.com.')).toBeInTheDocument();
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('renders only the blocklist, with no allowlist section', () => {
    render(<SiteList />);

    expect(
      screen.getByRole('region', { name: 'Blocklist' }),
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

describe.each(['running', 'paused'] as const)(
  'SiteList while the timer is %s (CR5.T3)',
  (status) => {
    beforeEach(() => {
      resetBlocklist([entry('a.com')]);
      setStatus(status);
    });

    afterEach(() => {
      cleanup();
    });

    it('keeps the add form enabled and the remove buttons disabled', () => {
      render(<SiteList />);

      expect(screen.getByLabelText('Add to Blocklist')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'Remove a.com' }),
      ).toBeDisabled();
    });

    it('adds a site with its preview and feedback', () => {
      const { container } = render(<SiteList />);
      const input = screen.getByLabelText('Add to Blocklist');

      fireEvent.change(input, {
        target: { value: 'https://m.facebook.com/x' },
      });
      expect(screen.getByText('→ facebook.com')).toBeInTheDocument();

      fireEvent.submit(container.querySelector('form') as HTMLFormElement);

      expect(screen.getByText('Added facebook.com.')).toBeInTheDocument();
      expect(values(currentBlocklist().blocklist)).toEqual([
        'a.com',
        'facebook.com',
      ]);
    });

    it('never removes a site, even when the disabled button is clicked', () => {
      render(<SiteList />);

      fireEvent.click(screen.getByRole('button', { name: 'Remove a.com' }));

      expect(values(currentBlocklist().blocklist)).toEqual(['a.com']);
    });

    it('re-enables the remove buttons when the timer returns to idle', () => {
      render(<SiteList />);

      act(() => {
        setStatus('idle');
      });

      expect(
        screen.getByRole('button', { name: 'Remove a.com' }),
      ).toBeEnabled();
    });
  },
);

describe('SiteList once the session is completed (CR2.T3a, CR5.T3)', () => {
  beforeEach(() => {
    resetBlocklist([entry('a.com')]);
    setStatus('completed');
  });

  afterEach(() => {
    cleanup();
  });

  it('disables the add form and the remove buttons', () => {
    render(<SiteList />);

    expect(screen.getByLabelText('Add to Blocklist')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove a.com' })).toBeDisabled();
  });

  it('keeps the entries readable', () => {
    render(<SiteList />);

    expect(screen.getByText('a.com')).toBeInTheDocument();
  });

  it('hides the preview and the add feedback and never mutates the list', () => {
    const { container } = render(<SiteList />);
    const input = screen.getByLabelText('Add to Blocklist');

    fireEvent.change(input, {
      target: { value: 'https://m.facebook.com/x' },
    });
    expect(screen.queryByText('→ facebook.com')).not.toBeInTheDocument();

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(screen.queryByText('Added facebook.com.')).not.toBeInTheDocument();
    expect(values(currentBlocklist().blocklist)).toEqual(['a.com']);
  });

  it('re-enables the controls when the timer returns to idle', () => {
    render(<SiteList />);

    act(() => {
      setStatus('idle');
    });

    expect(screen.getByLabelText('Add to Blocklist')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove a.com' })).toBeEnabled();
  });
});

describe('SiteList layout (UI.T1)', () => {
  beforeEach(() => {
    resetBlocklist();
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the number of blocked sites next to the heading', () => {
    resetBlocklist([entry('a.com'), entry('b.com'), entry('c.com')]);
    render(<SiteList />);

    const heading = screen.getByRole('heading', { name: /Blocklist/ });
    expect(heading).toHaveTextContent('3');
  });

  it('shows an empty state only when the list has no sites', () => {
    const { rerender } = render(<SiteList />);
    expect(screen.getByText('No sites blocked yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    act(() => {
      resetBlocklist([entry('a.com')]);
    });
    rerender(<SiteList />);

    expect(screen.queryByText('No sites blocked yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('labels each row with the presets it came from', () => {
    useAppStore.setState({
      blocklist: {
        blocklist: [
          {
            domain: { value: 'x.com' },
            manual: false,
            presetIds: ['social', 'user:work'],
          },
          entry('mine.com'),
        ],
        appliedPresetIds: ['social', 'user:work'],
        userPresets: [
          { id: 'user:work', name: 'Work', domains: [{ value: 'x.com' }] },
        ],
      },
    });
    render(<SiteList />);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('x.com');
    expect(rows[0]).toHaveTextContent('Social');
    expect(rows[0]).toHaveTextContent('Work');
    expect(rows[1]).toHaveTextContent('mine.com');
    expect(rows[1]?.querySelectorAll('.site-entry__source')).toHaveLength(0);
  });

  it('typing a site only a preset listed makes it manual instead of a duplicate', async () => {
    useAppStore.setState({
      blocklist: {
        blocklist: [
          { domain: { value: 'x.com' }, manual: false, presetIds: ['social'] },
        ],
        appliedPresetIds: ['social'],
        userPresets: [],
      },
    });
    render(<SiteList />);

    await userEvent.type(
      screen.getByLabelText('Add to Blocklist'),
      'x.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(useAppStore.getState().blocklist.blocklist[0]?.manual).toBe(true);
    expect(screen.queryByText(/already in/i)).not.toBeInTheDocument();
  });

  it('renders the quick-add slot between the add form and the list', () => {
    resetBlocklist([entry('a.com')]);
    render(<SiteList quickAdd={<div data-testid="quick-add" />} />);

    const input = screen.getByLabelText('Add to Blocklist');
    const quickAdd = screen.getByTestId('quick-add');
    const list = screen.getByRole('list');

    expect(
      input.compareDocumentPosition(quickAdd) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      quickAdd.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('SiteList error feedback (UI.T6)', () => {
  beforeEach(() => {
    resetBlocklist();
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
  });

  const submit = (container: HTMLElement, text: string): HTMLElement => {
    const input = screen.getByLabelText('Add to Blocklist');
    fireEvent.change(input, { target: { value: text } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    return input;
  };

  it.each([
    ['com', 'com is a domain ending, not a site. Add the site name, like example.com.'],
    ['192.168.1.1', 'IP addresses cannot be blocked. Enter a domain name.'],
    ['not a url', 'Enter a valid URL'],
  ])('says specifically what is wrong with %j', (text, message) => {
    const { container } = render(<SiteList />);

    submit(container, text);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(currentBlocklist().blocklist).toEqual([]);
  });

  it('links the error to the field and marks it invalid', () => {
    const { container } = render(<SiteList />);

    const input = submit(container, 'com');

    const alert = screen.getByRole('alert');
    expect(alert.id).not.toBe('');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('drops the link and the invalid mark once the user edits the field', () => {
    const { container } = render(<SiteList />);
    const input = submit(container, 'com');

    fireEvent.change(input, { target: { value: 'co' } });

    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('SiteList transient feedback and live updates (UI.T6)', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView.mockReset();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    resetBlocklist([entry('a.com')]);
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const addByForm = (container: HTMLElement, text: string): void => {
    fireEvent.change(screen.getByLabelText('Add to Blocklist'), {
      target: { value: text },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
  };
  const announcement = (container: HTMLElement): string =>
    container.querySelector('[data-announcement]')?.textContent ?? '';
  const advance = (ms: number): void => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('clears "Added x." on its own but keeps an error until the user edits', () => {
    const { container } = render(<SiteList />);

    addByForm(container, 'facebook.com');
    expect(screen.getByText('Added facebook.com.')).toBeInTheDocument();
    advance(4_000);
    expect(screen.queryByText('Added facebook.com.')).not.toBeInTheDocument();

    addByForm(container, 'com');
    advance(60_000);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not highlight or scroll to the rows already there', () => {
    const { container } = render(<SiteList />);

    expect(container.querySelector('.site-entry--new')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('highlights a new row, scrolls it into view and lets the highlight go', () => {
    const { container } = render(<SiteList />);

    addByForm(container, 'facebook.com');

    const fresh = container.querySelectorAll('.site-entry--new');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toHaveTextContent('facebook.com');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    advance(3_000);
    expect(container.querySelector('.site-entry--new')).toBeNull();
  });

  it('highlights every site a preset adds and reveals the first', () => {
    const { container } = render(<SiteList />);

    act(() => {
      useAppStore.getState().togglePreset('social', true);
    });

    expect(container.querySelectorAll('.site-entry--new')).toHaveLength(4);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('announces what a preset added and removed, and the announcement fades', () => {
    const { container } = render(<SiteList />);

    act(() => {
      useAppStore.getState().togglePreset('social', true);
    });
    expect(announcement(container)).toBe('Added 4 sites');

    advance(5_000);
    expect(announcement(container)).toBe('');

    act(() => {
      useAppStore.getState().togglePreset('social', false);
    });
    expect(announcement(container)).toBe('Removed 4 sites');
  });

  it('announces a single removal by name', () => {
    const { container } = render(<SiteList />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove a.com' }));

    expect(announcement(container)).toBe('Removed a.com.');
  });

  it('leaves a site added through the form to its own feedback', () => {
    const { container } = render(<SiteList />);

    addByForm(container, 'facebook.com');

    expect(announcement(container)).toBe('');
  });

  it('keeps the announcement in a live region', () => {
    const { container } = render(<SiteList />);

    const region = container.querySelector('[data-announcement]');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });
});

describe('SiteList long names (UI.T6)', () => {
  beforeEach(() => {
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the full domain in a tooltip when the row truncates it', () => {
    const long = 'a-really-quite-long-subdomain-name-for-testing.example.com';
    resetBlocklist([entry(long)]);
    render(<SiteList />);

    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });

  it('keeps the full preset name in a tooltip on a source chip', () => {
    useAppStore.setState({
      blocklist: {
        blocklist: [
          { domain: { value: 'x.com' }, manual: false, presetIds: ['user:w'] },
        ],
        appliedPresetIds: ['user:w'],
        userPresets: [
          { id: 'user:w', name: 'Very long preset name', domains: [{ value: 'x.com' }] },
        ],
      },
    });
    render(<SiteList />);

    expect(screen.getByText('Very long preset name')).toHaveAttribute(
      'title',
      'Very long preset name',
    );
  });
});
