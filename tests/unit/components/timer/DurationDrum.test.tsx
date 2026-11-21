import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DurationDrum } from '@/components/timer/DurationDrum';
import { useAppStore } from '@/store';
import type { TimerState, TimerStatus } from '@/store/store.types';

const request = vi.fn<(seconds: number) => void>();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const setTimer = (patch: Partial<TimerState>): void => {
  useAppStore.setState({ timer: { ...useAppStore.getState().timer, ...patch } });
};
const spinbutton = (): HTMLElement => screen.getByRole('spinbutton');

describe('DurationDrum (UI.T9)', () => {
  beforeEach(() => {
    request.mockReset();
    useAppStore.setState({ requestSetDuration: request });
    setTimer({
      status: 'idle',
      durationSeconds: 30 * 60,
      remainingSeconds: 30 * 60,
    });
    useAppStore.getState().setLiveRemainingSeconds(30 * 60);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('the spinbutton contract', () => {
    it('exposes the value in minutes with its label and text', () => {
      render(<DurationDrum />);

      const drum = screen.getByRole('spinbutton', { name: 'Focus duration' });
      expect(drum).toHaveAttribute('aria-valuemin', '5');
      expect(drum).toHaveAttribute('aria-valuemax', '120');
      expect(drum).toHaveAttribute('aria-valuenow', '30');
      expect(drum).toHaveAttribute('aria-valuetext', '30 min');
      expect(drum).toHaveAttribute('tabindex', '0');
    });

    it('lists every preset zero-padded, hidden from assistive tech', () => {
      render(<DurationDrum />);

      for (const text of ['005', '010', '020', '030', '045', '060', '090', '120']) {
        expect(screen.getByText(text).closest('[aria-hidden="true"]')).not.toBeNull();
      }
    });

    it('shows a fixed MIN label and a hidden ruler', () => {
      const { container } = render(<DurationDrum />);

      expect(screen.getByText('MIN')).toBeInTheDocument();
      expect(
        container.querySelector('[data-drum-ruler]')?.getAttribute('aria-hidden'),
      ).toBe('true');
    });

    it('follows a duration changed in the store', () => {
      render(<DurationDrum />);

      act(() => {
        setTimer({ durationSeconds: 10 * 60, remainingSeconds: 10 * 60 });
      });

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '10');
    });
  });

  describe('keyboard', () => {
    it('changes the visible value at once but asks the background only once settled', async () => {
      render(<DurationDrum />);
      spinbutton().focus();

      await userEvent.keyboard('{ArrowUp}');

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '45');
      expect(spinbutton()).toHaveAttribute('aria-valuetext', '45 min');
      expect(request).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(45 * 60);
      });
    });

    it('sends a single request for several quick steps, never one per row', async () => {
      render(<DurationDrum />);
      spinbutton().focus();

      await userEvent.keyboard('{ArrowUp}{ArrowUp}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '60');
      await waitFor(() => {
        expect(request).toHaveBeenCalled();
      });
      await sleep(400);

      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(60 * 60);
    });

    it('moves down, by pages, and to the ends without looping', async () => {
      render(<DurationDrum />);
      spinbutton().focus();

      await userEvent.keyboard('{ArrowDown}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '20');
      await userEvent.keyboard('{PageUp}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '45');
      await userEvent.keyboard('{PageDown}{PageDown}{PageDown}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '5');
      await userEvent.keyboard('{ArrowDown}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '5');
      await userEvent.keyboard('{End}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '120');
      await userEvent.keyboard('{ArrowUp}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '120');
      await userEvent.keyboard('{Home}');
      expect(spinbutton()).toHaveAttribute('aria-valuenow', '5');
    });

    it('sends nothing when the drum returns to the stored value', async () => {
      render(<DurationDrum />);
      spinbutton().focus();

      await userEvent.keyboard('{ArrowUp}{ArrowDown}');
      await sleep(400);

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '30');
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('pointer and wheel', () => {
    it('selects a neighbouring row on click', async () => {
      render(<DurationDrum />);

      fireEvent.click(screen.getByText('045'));

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '45');
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(45 * 60);
      });
    });

    it('turns one wheel notch into one step', async () => {
      render(<DurationDrum />);

      fireEvent.wheel(spinbutton(), { deltaY: 100 });

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '45');
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(45 * 60);
      });
    });

    it('snaps a drag to a row and commits once on release', async () => {
      // A frozen clock: the drag has no velocity, so only the distance counts.
      vi.spyOn(performance, 'now').mockReturnValue(1_000);
      render(<DurationDrum />);
      const drum = spinbutton();

      fireEvent.pointerDown(drum, { pointerId: 1, clientY: 300 });
      // Two rows of 2.5rem (40px) upwards moves the content up: longer.
      fireEvent.pointerMove(drum, { pointerId: 1, clientY: 220 });
      expect(request).not.toHaveBeenCalled();
      fireEvent.pointerUp(drum, { pointerId: 1, clientY: 220 });

      expect(drum).toHaveAttribute('aria-valuenow', '60');
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(60 * 60);
      });
      await sleep(400);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('carries a quick flick a little further, then snaps to a row', async () => {
      const clock = vi.spyOn(performance, 'now');
      render(<DurationDrum />);
      const drum = spinbutton();

      clock.mockReturnValue(1_000);
      fireEvent.pointerDown(drum, { pointerId: 1, clientY: 300 });
      // A quarter row in 16ms is a fast flick: it carries about two rows more.
      clock.mockReturnValue(1_016);
      fireEvent.pointerMove(drum, { pointerId: 1, clientY: 290 });
      fireEvent.pointerUp(drum, { pointerId: 1, clientY: 290 });

      expect(drum).toHaveAttribute('aria-valuenow', '60');
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(60 * 60);
      });
    });

    it('does not read a drag as a click on the row under the pointer', () => {
      vi.spyOn(performance, 'now').mockReturnValue(1_000);
      render(<DurationDrum />);
      const drum = spinbutton();

      fireEvent.pointerDown(drum, { pointerId: 1, clientY: 300 });
      fireEvent.pointerMove(drum, { pointerId: 1, clientY: 220 });
      fireEvent.pointerUp(drum, { pointerId: 1, clientY: 220 });
      fireEvent.click(screen.getByText('030'));

      expect(drum).toHaveAttribute('aria-valuenow', '60');
    });

    it('springs back to the end row after a pull past it', async () => {
      vi.spyOn(performance, 'now').mockReturnValue(1_000);
      render(<DurationDrum />);
      const drum = spinbutton();
      await userEvent.click(drum);
      await userEvent.keyboard('{End}');

      fireEvent.pointerDown(drum, { pointerId: 1, clientY: 200 });
      fireEvent.pointerMove(drum, { pointerId: 1, clientY: 50 });
      fireEvent.pointerUp(drum, { pointerId: 1, clientY: 50 });

      expect(drum).toHaveAttribute('aria-valuenow', '120');
    });
  });

  describe('reduced motion', () => {
    it('still steps and commits, without animating', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      }));
      render(<DurationDrum />);
      spinbutton().focus();

      await userEvent.keyboard('{ArrowUp}');

      expect(spinbutton()).toHaveAttribute('aria-valuenow', '45');
      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(45 * 60);
      });
    });
  });

  describe.each(['running', 'paused', 'completed'] as const)(
    'while the session is %s (the drum becomes the clock)',
    (status: TimerStatus) => {
      beforeEach(() => {
        setTimer({ status });
      });

      it('shows the countdown instead of a spinbutton', () => {
        render(<DurationDrum />);

        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(screen.getByText('00:30:00')).toBeInTheDocument();
        expect(screen.getByLabelText('Time remaining')).toBeInTheDocument();
      });

      it('ignores wheel, click and keys and never asks the background', async () => {
        render(<DurationDrum />);

        fireEvent.wheel(screen.getByText('045'), { deltaY: 100 });
        fireEvent.click(screen.getByText('045'));
        await userEvent.keyboard('{ArrowUp}');
        await sleep(400);

        expect(request).not.toHaveBeenCalled();
      });

      it('returns to the drum on Reset', () => {
        render(<DurationDrum />);

        act(() => {
          setTimer({ status: 'idle' });
        });

        expect(spinbutton()).toHaveAttribute('aria-valuenow', '30');
      });
    },
  );

  describe('the paused marker (UI.T10)', () => {
    it('labels the clock Paused and dims the digits while paused', () => {
      setTimer({ status: 'paused' });

      const { container } = render(<DurationDrum />);

      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(container.querySelector('.duration-drum')).toHaveClass(
        'duration-drum--paused',
      );
    });

    it.each(['idle', 'running', 'completed'] as const)(
      'shows no marker while %s',
      (status: TimerStatus) => {
        setTimer({ status });

        const { container } = render(<DurationDrum />);

        expect(screen.queryByText('Paused')).not.toBeInTheDocument();
        expect(container.querySelector('.duration-drum')).not.toHaveClass(
          'duration-drum--paused',
        );
      },
    );

    it('takes no room: the label is positioned out of the flow', () => {
      const { container } = render(<DurationDrum />);

      const css = container.querySelector('style')?.textContent ?? '';
      expect(css).toMatch(/\.duration-drum__paused\s*\{[^}]*position:\s*absolute/);
    });
  });

  it('keeps the same frame height idle and in a session', () => {
    const { container } = render(<DurationDrum />);
    const frame = container.querySelector('.duration-drum');
    expect(frame).not.toBeNull();
    expect(container.querySelector('style')?.textContent).toContain(
      'height: 8.5rem',
    );
    act(() => {
      setTimer({ status: 'running' });
    });
    expect(container.querySelectorAll('.duration-drum')).toHaveLength(1);
  });
});
