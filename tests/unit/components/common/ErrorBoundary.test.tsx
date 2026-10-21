import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { createLogger, type LogRecord } from '@/utils/logger';
import { setTestLocale } from '@/tests/helpers/i18n';

function captureLogger(): {
  records: LogRecord[];
  logger: ReturnType<typeof createLogger>;
} {
  const records: LogRecord[] = [];
  const logger = createLogger('error-boundary-test', {
    sink: (record) => {
      records.push(record);
    },
    minLevel: 'debug',
  });
  return { records, logger };
}

describe('ErrorBoundary (M4.T3d)', () => {
  beforeEach(() => {
    // React reports caught render errors to console.error as part of its
    // development diagnostics; the test asserts the logger record instead.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('contains a render error, logs it with component context and shows the translated fallback', () => {
    const error = new Error('render exploded');
    function Broken(): ReactNode {
      throw error;
    }
    const { records, logger } = captureLogger();
    const onError = vi.fn<(error: Error, info: ErrorInfo) => void>();

    render(
      <ErrorBoundary logger={logger} onError={onError}>
        <Broken />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveTextContent(
      'The popup hit an unexpected error. Reload to try again.',
    );
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    expect(onError).toHaveBeenCalledTimes(1);
    const [caughtError, info] = onError.mock.calls[0] ?? [];
    expect(caughtError).toBe(error);
    expect(info?.componentStack).toContain('Broken');

    const failure = records.find(
      (record) => record.message === 'popup component failed',
    );
    expect(failure?.level).toBe('error');
    expect(failure?.scope).toBe('error-boundary-test');
    expect(failure?.details[0]).toBe(error);
    const context = failure?.details[1] as
      { readonly componentStack?: string } | undefined;
    expect(context?.componentStack).toContain('Broken');
  });

  it('renders the recovery screen in Italian through the shared i18n instance', () => {
    setTestLocale('it');
    const { logger } = captureLogger();
    function Broken(): ReactNode {
      throw new Error('render exploded');
    }

    render(
      <ErrorBoundary logger={logger}>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Qualcosa è andato storto',
    );
    expect(
      screen.getByText(
        'Il popup ha riscontrato un errore imprevisto. Ricarica per riprovare.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ricarica' }),
    ).toBeInTheDocument();
  });

  it('resets and recovers when the child stops throwing', async () => {
    let shouldThrow = true;
    function Recoverable(): ReactNode {
      if (shouldThrow) throw new Error('recoverable');
      return <p>Recovered</p>;
    }
    const { logger } = captureLogger();
    const onReset = vi.fn(() => {
      shouldThrow = false;
    });

    render(
      <ErrorBoundary logger={logger} onReset={onReset}>
        <Recoverable />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('reloads the page by default when no reset strategy is provided', async () => {
    const reload = vi
      .spyOn(window.location, 'reload')
      .mockImplementation(() => undefined);
    const { logger } = captureLogger();
    function Broken(): ReactNode {
      throw new Error('render exploded');
    }

    render(
      <ErrorBoundary logger={logger}>
        <Broken />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
