import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { PresetPicker } from '@/components/blocklist/PresetPicker';
import { useAppStore } from '@/store';
import type { BlocklistState, TimerStatus } from '@/store/store.types';

const seed = (blocklist: Partial<BlocklistState> = {}): void => {
  useAppStore.setState({
    blocklist: {
      blocklist: [],
      appliedPresetIds: [],
      userPresets: [],
      ...blocklist,
    },
  });
};

const setStatus = (status: TimerStatus): void => {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, status } });
};

const manual = (domain: string) => ({
  domain: { value: domain },
  manual: true,
  presetIds: [],
});

const WORK: BlocklistState = {
  blocklist: [
    { domain: { value: 'a.com' }, manual: false, presetIds: ['user:w'] },
  ],
  appliedPresetIds: ['user:w'],
  userPresets: [{ id: 'user:w', name: 'Work', domains: [{ value: 'a.com' }] }],
};

/** Mutation messages that left the popup (PR5.T3); the store sends them through the bus. */
const sent: unknown[] = [];
const watchSentMessages = (): void => {
  sent.length = 0;
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(
    (message: unknown) => {
      sent.push(message);
    },
  );
};
const sentTypes = (): unknown[] =>
  sent.map((message) => (message as { type: unknown }).type);

const button = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

describe('saving the list as a preset (CR4.T5)', () => {
  beforeEach(() => {
    seed({ blocklist: [manual('a.com'), manual('b.com')] });
    setStatus('idle');
  });

  afterEach(cleanup);

  it('saves the current list under a new name and shows it as an applied toggle', async () => {
    render(<PresetPicker />);

    await userEvent.click(button('Save list as preset'));
    expect(
      screen.getByText(
        'Saves every site in the list. Switching the preset off removes them.',
      ),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Preset name'), 'Deep work');
    await userEvent.click(button('Save'));

    const [saved] = useAppStore.getState().blocklist.userPresets;
    expect(saved?.name).toBe('Deep work');
    expect(saved?.domains.map((domain) => domain.value)).toEqual([
      'a.com',
      'b.com',
    ]);
    expect(
      screen.getByRole('button', { name: /^Deep work preset,/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Preset name')).not.toBeInTheDocument();
  });

  it.each([
    ['', 'Enter a name.'],
    ['Social', 'A preset with this name already exists.'],
    ['x'.repeat(25), 'Use at most 24 characters.'],
  ])('explains why %j is refused and saves nothing', async (name, message) => {
    render(<PresetPicker />);

    await userEvent.click(button('Save list as preset'));
    if (name !== '')
      await userEvent.type(screen.getByLabelText('Preset name'), name);
    await userEvent.click(button('Save'));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Preset name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(useAppStore.getState().blocklist.userPresets).toEqual([]);
  });

  it('cannot save an empty list', () => {
    seed();
    render(<PresetPicker />);

    expect(button('Save list as preset')).toBeDisabled();
  });

  it('cancel closes the field without saving', async () => {
    render(<PresetPicker />);

    await userEvent.click(button('Save list as preset'));
    await userEvent.click(button('Cancel'));

    expect(screen.queryByLabelText('Preset name')).not.toBeInTheDocument();
    expect(useAppStore.getState().blocklist.userPresets).toEqual([]);
  });
});

describe('editing saved presets (CR4.T5)', () => {
  beforeEach(() => {
    seed(WORK);
    setStatus('idle');
  });

  afterEach(cleanup);

  it('offers the edit panel only when saved presets exist', () => {
    seed();
    render(<PresetPicker />);

    expect(
      screen.queryByRole('button', { name: 'Edit saved presets' }),
    ).not.toBeInTheDocument();
  });

  it('renames a saved preset', async () => {
    render(<PresetPicker />);

    await userEvent.click(button('Edit saved presets'));
    await userEvent.click(button('Rename Work'));
    const field = screen.getByLabelText('Rename Work');
    await userEvent.clear(field);
    await userEvent.type(field, 'Study');
    await userEvent.click(button('Save'));

    expect(useAppStore.getState().blocklist.userPresets[0]?.name).toBe('Study');
    expect(
      screen.getByRole('button', { name: /^Study preset,/ }),
    ).toBeInTheDocument();
  });

  it('asks before deleting and keeps the sites blocked', async () => {
    render(<PresetPicker />);

    await userEvent.click(button('Edit saved presets'));
    await userEvent.click(button('Delete Work'));
    expect(
      screen.getByText('Delete Work? Its sites stay blocked.'),
    ).toBeInTheDocument();
    expect(useAppStore.getState().blocklist.userPresets).toHaveLength(1);

    await userEvent.click(button('Delete'));

    expect(useAppStore.getState().blocklist.userPresets).toEqual([]);
    expect(useAppStore.getState().blocklist.blocklist).toEqual([
      manual('a.com'),
    ]);
  });

  it('"Keep" cancels the deletion', async () => {
    render(<PresetPicker />);

    await userEvent.click(button('Edit saved presets'));
    await userEvent.click(button('Delete Work'));
    await userEvent.click(button('Keep'));

    expect(useAppStore.getState().blocklist.userPresets).toHaveLength(1);
    expect(button('Delete Work')).toBeInTheDocument();
  });
});

describe.each(['running', 'paused', 'completed'] as const)(
  'saved-preset controls while the timer is %s (CR4.T5)',
  (status) => {
    beforeEach(() => {
      seed(WORK);
      setStatus(status);
      watchSentMessages();
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('disables saving, renaming and deleting', async () => {
      render(<PresetPicker />);

      expect(button('Save list as preset')).toBeDisabled();
      await userEvent.click(button('Edit saved presets'));
      expect(button('Rename Work')).toBeDisabled();
      expect(button('Delete Work')).toBeDisabled();
    });

    it('sends no mutation when a disabled control is clicked', async () => {
      render(<PresetPicker />);
      await userEvent.click(button('Edit saved presets'));

      for (const name of ['Save list as preset', 'Rename Work', 'Delete Work']) {
        fireEvent.click(button(name));
        expect(button(name)).toBeDisabled();
      }

      expect(sentTypes()).toEqual([]);
      expect(useAppStore.getState().blocklist.userPresets).toHaveLength(1);
    });

    it('re-enables them when the timer returns to idle', async () => {
      render(<PresetPicker />);
      await userEvent.click(button('Edit saved presets'));

      act(() => {
        setStatus('idle');
      });

      expect(button('Save list as preset')).toBeEnabled();
      expect(button('Rename Work')).toBeEnabled();
    });
  },
);
