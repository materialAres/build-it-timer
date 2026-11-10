import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockedOverlay } from '@/components/common/BlockedOverlay';

describe('BlockedOverlay (M2.T8)', () => {
  afterEach(cleanup);

  it('asks for confirmation naming the blocked domain', () => {
    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={vi.fn()}
        onGoBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('facebook.com')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to access it\?/i)).toBeInTheDocument();
  });

  it('offers exactly the two choices "Open anyway" and "Back to work"', () => {
    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={vi.fn()}
        onGoBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open anyway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to work' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('reports "Open anyway" through onProceed only', async () => {
    const onProceed = vi.fn();
    const onGoBack = vi.fn();

    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={onProceed}
        onGoBack={onGoBack}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open anyway' }));

    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(onGoBack).not.toHaveBeenCalled();
  });

  it('reports "Back to work" through onGoBack only', async () => {
    const onProceed = vi.fn();
    const onGoBack = vi.fn();

    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={onProceed}
        onGoBack={onGoBack}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back to work' }));

    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(onProceed).not.toHaveBeenCalled();
  });

  it('shows the encouragement instead of the question once dismissed', () => {
    render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed
        onProceed={vi.fn()}
        onGoBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Great! Keep focusing!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open anyway' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to work' })).not.toBeInTheDocument();
  });

  it('carries its stylesheet inside its own markup', () => {
    const { container } = render(
      <BlockedOverlay
        domain="facebook.com"
        dismissed={false}
        onProceed={vi.fn()}
        onGoBack={vi.fn()}
      />,
    );

    // The sheet must travel with the markup: a `*.content.css` entrypoint would
    // be injected into the page and never reach the shadow root.
    const style = container.querySelector('style');
    expect(style?.textContent).toContain('.blocked-overlay');
    expect(style?.textContent).toContain('all: initial');
  });
});
