import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, type LogRecord, type LogSink } from '@/utils/logger';

function captureRecords(): { records: LogRecord[]; sink: LogSink } {
  const records: LogRecord[] = [];
  return {
    records,
    sink: (record) => {
      records.push(record);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger (M4.T3a)', () => {
  it('emits a scoped record with its technical context', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });

    log.info('started', { mode: 'test' });

    expect(records).toEqual([
      {
        level: 'info',
        scope: 'background',
        message: 'started',
        details: [{ mode: 'test' }],
      },
    ]);
  });

  it('discards records below the configured threshold', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'warn' });

    log.debug('debug');
    log.info('info');
    log.warn('warn');
    log.error('error');

    expect(records.map((record) => record.level)).toEqual(['warn', 'error']);
  });

  it('appends child scopes and inherits the sink and threshold', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'warn' });
    const dnr = log.child(' dnr ');

    dnr.debug('ignored');
    dnr.warn('sync failed');

    expect(records).toHaveLength(1);
    expect(records[0]?.scope).toBe('background:dnr');
    expect(records[0]?.message).toBe('sync failed');
  });

  it('leaves the scope unchanged for an empty child scope', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });

    log.child('   ').debug('message');

    expect(records[0]?.scope).toBe('background');
  });

  it('preserves an Error cause and appends the context after it', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });
    const error = new Error('rule update failed');

    log.error('DNR rule sync failed', error, { boundary: 'dnr' });

    expect(records).toHaveLength(1);
    expect(records[0]?.details[0]).toBe(error);
    expect(records[0]?.details[1]).toEqual({ boundary: 'dnr' });
  });

  it('normalizes a string cause to an Error', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });

    log.error('failed', 'boom');

    const normalized = records[0]?.details[0];
    expect(normalized).toBeInstanceOf(Error);
    if (!(normalized instanceof Error)) return;
    expect(normalized.message).toBe('boom');
  });

  it('wraps a non-Error cause and keeps it as the Error cause', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });
    const cause = { code: 'E_FAIL' };

    log.error('failed', cause);

    const normalized = records[0]?.details[0];
    expect(normalized).toBeInstanceOf(Error);
    if (!(normalized instanceof Error)) return;
    expect(normalized.message).toBe('Non-Error value logged');
    expect(normalized.cause).toBe(cause);
  });

  it('omits details when neither a cause nor a context is provided', () => {
    const { records, sink } = captureRecords();
    const log = createLogger('background', { sink, minLevel: 'debug' });

    log.error('failed');

    expect(records[0]?.details).toEqual([]);
  });

  it('does not let a failing sink break the caller', () => {
    const log = createLogger('background', {
      sink: () => {
        throw new Error('sink unavailable');
      },
      minLevel: 'debug',
    });

    expect(() => {
      log.error('failed', new Error('cause'));
    }).not.toThrow();
  });

  it('writes to the console with the buildit prefix by default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = createLogger('background');

    log.warn('sync skipped', { key: 'timer-focus-store' });

    expect(warn).toHaveBeenCalledWith('[buildit:background] sync skipped', {
      key: 'timer-focus-store',
    });
  });
});
