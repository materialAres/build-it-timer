import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { err, ok, type Result } from '@/utils/result';
import { OpenCityPageButton } from '@/components/city/OpenCityPageButton';
import { createLogger, type LogRecord } from '@/utils/logger';

type Opener = (path: string) => Promise<Result<void>>;

describe('OpenCityPageButton (CR6.T11)', () => {
  afterEach(cleanup);

  it('opens the full-city page', async () => {
    const opener = vi.fn<Opener>(() => Promise.resolve(ok(undefined)));
    render(<OpenCityPageButton opener={opener} />);

    await userEvent.click(screen.getByRole('button', { name: 'View full city' }));

    expect(opener).toHaveBeenCalledWith('/city.html');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('logs a failure and says so, without throwing', async () => {
    const records: LogRecord[] = [];
    const logger = createLogger('test', { sink: (record) => { records.push(record); }, minLevel: 'debug' });
    const opener = vi.fn<Opener>(() => Promise.resolve(err(new Error('blocked'))));
    render(<OpenCityPageButton opener={opener} logger={logger} />);

    await userEvent.click(screen.getByRole('button', { name: 'View full city' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the full city page.');
    expect(records).toHaveLength(1);
  });

  it('clears the message on the next attempt', async () => {
    const opener = vi.fn<Opener>()
      .mockResolvedValueOnce(err(new Error('blocked')))
      .mockResolvedValueOnce(ok(undefined));
    render(<OpenCityPageButton opener={opener} />);

    await userEvent.click(screen.getByRole('button', { name: 'View full city' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View full city' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
