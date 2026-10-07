import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { i18n } from '#i18n';
import { TimerControls } from '@/components/timer/TimerControls';
import { BlockedOverlay } from '@/components/common/BlockedOverlay';
import { useAppStore } from '@/store';
import type { TimerState } from '@/store/store.types';

const idleTimer: TimerState = {
  status: 'idle',
  remainingSeconds: 1500,
  sessionStartedAt: null,
  sessionId: null,
};

/**
 * M3.T9: the shared `@wxt-dev/i18n` instance resolves every visible string from
 * `locales/en.yml` (the default locale), and the components render through it.
 * The IT rendering half of the roadmap's criterion belongs to M3.T10, which
 * adds `locales/it.yml`; forcing the locale here would only exercise the EN
 * fallback, so it is covered by that task's tests instead.
 */
describe('i18n shared instance (M3.T9)', () => {
  afterEach(cleanup);

  it('resolves EN strings and positional substitutions from locales/en.yml', () => {
    expect(i18n.t('timer.start')).toBe('Start');
    expect(i18n.t('overlay.title')).toBe('Stay focused');
    expect(i18n.t('score.badgeAriaLabel', ['Good'])).toBe('Focus score: Good');
    expect(i18n.t('blocklist.assignTag', ['Focus', 'a.com'])).toBe(
      'Assign Focus to a.com',
    );
  });

  it('renders a component\u2019s visible strings through i18n.t', () => {
    useAppStore.setState({ timer: { ...idleTimer } });

    render(<TimerControls />);

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('renders the overlay question as translatable parts around the domain', () => {
    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={() => undefined}
        onGoBack={() => undefined}
      />,
    );

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('You put facebook.com on your blocklist.');
    expect(dialog).toHaveTextContent('Are you sure you want to access it?');
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });
});
