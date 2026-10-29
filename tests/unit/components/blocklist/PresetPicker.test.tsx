import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetPicker } from '@/components/blocklist/PresetPicker';
import { PRESETS } from '@/lib/blocking/presets';
import { useAppStore } from '@/store';

const domainValues = (): readonly string[] =>
  useAppStore.getState().blocklist.blocklist.map((entry) => entry.domain.value);

describe('PresetPicker (M3.T1)', () => {
  beforeEach(() => {
    useAppStore.setState({
      blocklist: { blocklist: [], customTags: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders one button per available preset', () => {
    render(<PresetPicker />);

    for (const preset of PRESETS) {
      expect(screen.getByRole('button', { name: `Apply ${preset.name} preset` })).toBeEnabled();
    }
  });

  it('adds every Social domain to the blocklist in a single action', async () => {
    const applyPreset = vi.spyOn(useAppStore.getState(), 'applyPreset');

    render(<PresetPicker />);
    await userEvent.click(screen.getByRole('button', { name: 'Apply Social preset' }));

    // The component invokes exactly one action for the whole preset.
    expect(applyPreset).toHaveBeenCalledTimes(1);
    expect(applyPreset).toHaveBeenCalledWith('social');
    expect(domainValues()).toEqual([
      'instagram.com',
      'facebook.com',
      'x.com',
      'tiktok.com',
    ]);
  });

  it('does not create duplicates when the same preset is applied again', async () => {
    render(<PresetPicker />);

    await userEvent.click(screen.getByRole('button', { name: 'Apply Social preset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply Social preset' }));

    expect(domainValues()).toHaveLength(PRESETS[0]?.domains.length ?? 0);
  });

  it('carries its own stylesheet', () => {
    const { container } = render(<PresetPicker />);

    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.preset-picker');
    expect(style?.textContent).toContain('text-shadow: 0 0 4px currentColor');
  });
});
