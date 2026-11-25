import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { PresetPicker } from '@/components/blocklist/PresetPicker';
import { PRESETS } from '@/lib/blocking/presets';
import { useAppStore } from '@/store';
import type { TimerStatus } from '@/store/store.types';

const domainValues = (): readonly string[] =>
  useAppStore.getState().blocklist.blocklist.map((entry) => entry.domain.value);

/** A preset toggle by name; its accessible name also carries the count. */
const toggle = (name: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${name} preset,`) });

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

const setStatus = (status: TimerStatus): void => {
  useAppStore.setState({
    timer: { ...useAppStore.getState().timer, status },
  });
};

describe('PresetPicker (M3.T1, toggles CR4.T3/T5)', () => {
  beforeEach(() => {
    useAppStore.setState({
      blocklist: { blocklist: [], appliedPresetIds: [], userPresets: [] },
    });
    setStatus('idle');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders one button per available preset', () => {
    render(<PresetPicker />);

    for (const preset of PRESETS) {
      expect(
        toggle(preset.name),
      ).toBeEnabled();
    }
  });

  it('adds every Social domain to the blocklist in a single action', async () => {
    const togglePreset = vi.spyOn(useAppStore.getState(), 'togglePreset');

    render(<PresetPicker />);
    await userEvent.click(
      toggle('Social'),
    );

    // The component invokes exactly one action, with the target state.
    expect(togglePreset).toHaveBeenCalledTimes(1);
    expect(togglePreset).toHaveBeenCalledWith('social', true);
    expect(domainValues()).toEqual([
      'instagram.com',
      'facebook.com',
      'x.com',
      'tiktok.com',
    ]);
  });

  it('is a toggle: the second click switches the preset off again', async () => {
    render(<PresetPicker />);
    const button = toggle('Social');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(domainValues()).toHaveLength(PRESETS[0]?.domains.length ?? 0);

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(domainValues()).toEqual([]);
  });

  it('keeps a manually added site when its preset is switched off', async () => {
    useAppStore.getState().addSite('x.com');
    render(<PresetPicker />);
    const button = toggle('Social');

    await userEvent.click(button);
    await userEvent.click(button);

    expect(domainValues()).toEqual(['x.com']);
  });

  it('shows the count and names the covered sites (CR4.T5)', async () => {
    render(<PresetPicker />);
    const social = toggle('Social');
    expect(social).toHaveAccessibleName('Social preset, 0 of 4 sites blocked');
    expect(social).toHaveTextContent('Social4');

    await userEvent.click(social);
    expect(social).toHaveAccessibleName('Social preset, 4 of 4 sites blocked');

    act(() => {
      useAppStore.getState().removeSite('x.com');
    });
    expect(social).toHaveTextContent('Social3/4');
  });

  it('lists a preset\'s domains before it is applied (CR4.T5)', () => {
    render(<PresetPicker />);

    expect(toggle('Social')).toHaveAttribute(
      'title',
      'Blocks instagram.com, facebook.com, x.com, tiktok.com',
    );
  });

  it('shows saved presets next to the built-in ones (CR4.T5)', () => {
    useAppStore.setState({
      blocklist: {
        blocklist: [{ domain: { value: 'a.com' }, manual: false, presetIds: ['user:w'] }],
        appliedPresetIds: ['user:w'],
        userPresets: [{ id: 'user:w', name: 'Work', domains: [{ value: 'a.com' }] }],
      },
    });
    render(<PresetPicker />);

    expect(toggle('Work')).toHaveAttribute('aria-pressed', 'true');
    const buttons = screen.getAllByRole('button', { pressed: false });
    expect(buttons.map((button) => button.dataset.presetId)).toEqual([
      'social',
      'video',
      'news',
    ]);
  });

  it('carries its own stylesheet', () => {
    const { container } = render(<PresetPicker />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.preset-picker');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});

const APPLIED_SOCIAL = {
  blocklist: PRESETS.find((preset) => preset.id === 'social')?.domains.map(
    (domain) => ({ domain, manual: false, presetIds: ['social'] }),
  ) ?? [],
  appliedPresetIds: ['social'],
  userPresets: [],
};

describe.each(['running', 'paused'] as const)(
  'PresetPicker while the timer is %s (CR5.T3)',
  (status) => {
    beforeEach(() => {
      useAppStore.setState({ blocklist: APPLIED_SOCIAL });
      setStatus(status);
      watchSentMessages();
    });

    afterEach(() => {
      cleanup();
      vi.restoreAllMocks();
    });

    it('keeps the presets that are off enabled and the applied one disabled', () => {
      render(<PresetPicker />);

      expect(toggle('Social')).toBeDisabled();
      expect(toggle('Video')).toBeEnabled();
    });

    it('switches an unapplied preset on', async () => {
      render(<PresetPicker />);

      await userEvent.click(toggle('Video'));

      expect(useAppStore.getState().blocklist.appliedPresetIds).toEqual([
        'social',
        'video',
      ]);
      expect(sentTypes()).toEqual(['PRESET_TOGGLE']);
    });

    it('does not switch an applied preset off', () => {
      render(<PresetPicker />);
      const social = toggle('Social');

      fireEvent.click(social);

      expect(social).toBeDisabled();
      expect(sentTypes()).toEqual([]);
      expect(useAppStore.getState().blocklist.appliedPresetIds).toEqual([
        'social',
      ]);
      expect(domainValues()).toHaveLength(4);
    });

    it('disables saving, since it reshapes the list', () => {
      render(<PresetPicker />);

      const save = screen.getByRole('button', { name: 'Save list as preset' });

      fireEvent.click(save);

      expect(save).toBeDisabled();
      expect(sentTypes()).toEqual([]);
    });

    it('re-enables the applied preset when the timer returns to idle', () => {
      render(<PresetPicker />);

      act(() => {
        setStatus('idle');
      });

      expect(toggle('Social')).toBeEnabled();
    });
  },
);

describe('PresetPicker once the session is completed (CR2.T3a, CR5.T3)', () => {
  beforeEach(() => {
    useAppStore.setState({ blocklist: APPLIED_SOCIAL });
    setStatus('completed');
    watchSentMessages();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('disables every preset button', () => {
    render(<PresetPicker />);

    for (const preset of PRESETS) {
      expect(toggle(preset.name)).toBeDisabled();
    }
  });

  it('does not change the blocklist when a disabled button is clicked', () => {
    render(<PresetPicker />);

    const video = toggle('Video');

    fireEvent.click(video);

    expect(video).toBeDisabled();
    expect(sentTypes()).toEqual([]);
    expect(useAppStore.getState().blocklist.appliedPresetIds).toEqual([
      'social',
    ]);
  });

  it('re-enables the buttons when the timer returns to idle', () => {
    render(<PresetPicker />);

    act(() => {
      setStatus('idle');
    });

    for (const preset of PRESETS) {
      expect(toggle(preset.name)).toBeEnabled();
    }
  });
});
