import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SoundSettings } from '@/components/settings/SoundSettings';
import { DEFAULT_SOUND_PREFERENCES } from '@/lib/sound/sound-preferences';
import { SOUND_THEMES } from '@/lib/sound/sound-themes';
import { useAppStore } from '@/store';
import type { TimerStatus } from '@/store/store.types';
import { setTestLocale } from '@/tests/helpers/i18n';

const { previewMock } = vi.hoisted(() => ({ previewMock: vi.fn() }));
vi.mock('@/components/settings/use-sound-preview', () => ({
  useSoundPreview: () => ({ preview: previewMock, previewingThemeId: null }),
}));

/** Messages that left the popup: the panel only ever asks the background. */
const sent: unknown[] = [];
const watchSentMessages = (): void => {
  sent.length = 0;
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(
    (message: unknown) => {
      sent.push(message);
    },
  );
};
const setMessage = (payload: unknown): unknown => ({
  type: 'PREFERENCES_SOUND_SET',
  payload,
});

const NAMES = ['Neon', 'Synthwave', 'Glitch', 'Terminal'];
const slider = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('slider', { name: 'Volume' });
const checkbox = (): HTMLElement =>
  screen.getByRole('checkbox', {
    name: 'Play a sound when a session starts and ends',
  });

/** One slider gesture: several `input` events, then the release. */
const drag = (to: number[]): void => {
  for (const value of to) fireEvent.change(slider(), { target: { value } });
};

describe('SoundSettings (M5.T19)', () => {
  beforeEach(() => {
    useAppStore.setState({ preferences: { sound: DEFAULT_SOUND_PREFERENCES } });
    useAppStore.setState({
      timer: { ...useAppStore.getState().timer, status: 'idle' },
    });
    previewMock.mockClear();
    watchSentMessages();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('structure', () => {
    it('shows the heading, the toggle, the theme list and the volume', () => {
      render(<SoundSettings />);

      expect(screen.getByRole('heading', { name: 'Sound' })).toBeInTheDocument();
      expect(checkbox()).toBeChecked();
      expect(screen.getByRole('group', { name: 'Sound theme' })).toBeInTheDocument();
      expect(slider()).toHaveValue('50');
    });

    it('lists one radio per theme, in the order of the theme data', () => {
      render(<SoundSettings />);

      const radios = screen.getAllByRole('radio');
      expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(
        SOUND_THEMES.map((theme) => theme.id),
      );
      expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual(
        NAMES,
      );
    });

    it('checks the radio of the stored theme', () => {
      useAppStore.setState({
        preferences: { sound: { ...DEFAULT_SOUND_PREFERENCES, themeId: 'terminal' } },
      });
      render(<SoundSettings />);
      expect(screen.getByRole('radio', { name: 'Terminal' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Neon' })).not.toBeChecked();
    });

    it('gives the slider its range and shows the value as a percentage', () => {
      render(<SoundSettings />);
      expect(slider()).toHaveAttribute('min', '0');
      expect(slider()).toHaveAttribute('max', '100');
      expect(slider()).toHaveAttribute('step', '5');
      expect(slider()).toHaveAttribute('aria-valuetext', '50%');
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('has one preview button per theme, named after it', () => {
      render(<SoundSettings />);
      for (const name of NAMES) {
        expect(screen.getByRole('button', { name: `Preview ${name}` })).toBeInTheDocument();
      }
    });
  });

  describe('what each control sends', () => {
    it('sends { enabled } from the toggle', async () => {
      render(<SoundSettings />);
      await userEvent.click(checkbox());
      expect(sent).toEqual([setMessage({ enabled: false })]);
    });

    it('sends { themeId } when a theme is selected', async () => {
      render(<SoundSettings />);
      await userEvent.click(screen.getByRole('radio', { name: 'Glitch' }));
      expect(sent).toEqual([setMessage({ themeId: 'glitch' })]);
    });

    it('never writes the local store: it only asks', async () => {
      render(<SoundSettings />);
      const before = useAppStore.getState().preferences;
      await userEvent.click(screen.getByRole('radio', { name: 'Glitch' }));
      await userEvent.click(checkbox());
      expect(useAppStore.getState().preferences).toBe(before);
    });
  });

  describe('volume slider', () => {
    it('sends one { volume } message for a whole drag, on release', () => {
      render(<SoundSettings />);

      drag([55, 60, 70, 80]);
      expect(sent).toEqual([]);
      fireEvent.pointerUp(slider());

      expect(sent).toEqual([setMessage({ volume: 80 })]);
    });

    it('shows the dragged value before it is sent', () => {
      render(<SoundSettings />);
      drag([75]);
      expect(slider()).toHaveValue('75');
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(slider()).toHaveAttribute('aria-valuetext', '75%');
    });

    it('sends on key release too, for keyboard users', () => {
      render(<SoundSettings />);
      drag([55]);
      fireEvent.keyUp(slider(), { key: 'ArrowRight' });
      expect(sent).toEqual([setMessage({ volume: 55 })]);
    });

    it('sends nothing when released at the stored value', () => {
      render(<SoundSettings />);
      fireEvent.pointerUp(slider());
      drag([70, 50]);
      fireEvent.pointerUp(slider());
      expect(sent).toEqual([]);
    });

    it('does not send the same drag twice', () => {
      render(<SoundSettings />);
      drag([90]);
      fireEvent.pointerUp(slider());
      fireEvent.keyUp(slider(), { key: 'ArrowRight' });
      expect(sent).toHaveLength(1);
    });

    it('follows the stored value when it changes elsewhere', () => {
      const { rerender } = render(<SoundSettings />);
      drag([90]);
      useAppStore.setState({
        preferences: { sound: { ...DEFAULT_SOUND_PREFERENCES, volume: 20 } },
      });
      rerender(<SoundSettings />);
      expect(slider()).toHaveValue('20');
    });
  });

  describe('preview', () => {
    it('previews the theme at the stored volume', async () => {
      render(<SoundSettings />);
      await userEvent.click(screen.getByRole('button', { name: 'Preview Glitch' }));
      expect(previewMock).toHaveBeenCalledWith('glitch', 50);
    });

    it('previews at the value the slider shows while it is dragged', async () => {
      render(<SoundSettings />);
      drag([80]);
      await userEvent.click(screen.getByRole('button', { name: 'Preview Neon' }));
      expect(previewMock).toHaveBeenCalledWith('neon', 80);
    });

    it('sends no message for a preview', async () => {
      render(<SoundSettings />);
      await userEvent.click(screen.getByRole('button', { name: 'Preview Neon' }));
      expect(sent).toEqual([]);
    });
  });

  describe('when sounds are off', () => {
    beforeEach(() => {
      useAppStore.setState({
        preferences: { sound: { ...DEFAULT_SOUND_PREFERENCES, enabled: false } },
      });
    });

    it('disables the themes, the previews and the slider, but not the toggle', () => {
      render(<SoundSettings />);

      expect(checkbox()).toBeEnabled();
      expect(checkbox()).not.toBeChecked();
      expect(slider()).toBeDisabled();
      for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
      for (const name of NAMES) {
        expect(screen.getByRole('button', { name: `Preview ${name}` })).toBeDisabled();
      }
    });

    it('turns them back on when the toggle is switched on', () => {
      const { rerender } = render(<SoundSettings />);
      useAppStore.setState({
        preferences: { sound: { ...DEFAULT_SOUND_PREFERENCES, enabled: true } },
      });
      rerender(<SoundSettings />);
      expect(slider()).toBeEnabled();
    });
  });

  describe('never locked by the timer', () => {
    it.each<TimerStatus>(['running', 'paused', 'completed'])(
      'works while the timer is %s',
      async (status) => {
        useAppStore.setState({ timer: { ...useAppStore.getState().timer, status } });
        render(<SoundSettings />);

        expect(slider()).toBeEnabled();
        await userEvent.click(screen.getByRole('radio', { name: 'Synthwave' }));
        expect(sent).toEqual([setMessage({ themeId: 'synthwave' })]);
      },
    );
  });

  describe('translation', () => {
    it('is translated when the browser is Italian', () => {
      setTestLocale('it');
      render(<SoundSettings />);

      expect(screen.getByRole('heading', { name: 'Suono' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Tema sonoro' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Terminale' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ascolta Terminale' })).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', {
          name: "Riproduci un suono all'inizio e alla fine della sessione",
        }),
      ).toBeInTheDocument();
    });
  });
});
