import { describe, it, expect } from 'vitest';
import { createStartupGate } from '@/lib/messaging/startup-gate';
import { createLogger, type LogRecord } from '@/utils/logger';

const recordingLogger = (
  records: LogRecord[],
): ReturnType<typeof createLogger> =>
  createLogger('gate-test', {
    sink: (record) => records.push(record),
    minLevel: 'debug',
  });

describe('createStartupGate (PR5.T1)', () => {
  it('runs a task at once when created open', () => {
    const gate = createStartupGate(recordingLogger([]), true);
    const calls: string[] = [];

    gate.run(() => calls.push('a'));

    expect(calls).toEqual(['a']);
  });

  it('holds tasks until the settled promise resolves, then runs them in arrival order', async () => {
    const gate = createStartupGate(recordingLogger([]), false);
    const calls: string[] = [];
    let settle: () => void = () => undefined;
    gate.openAfter(new Promise<void>((resolve) => (settle = resolve)));

    gate.run(() => calls.push('first'));
    gate.run(() => calls.push('second'));
    expect(calls).toEqual([]);

    settle();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(['first', 'second']);
  });

  it('opens when the settled promise rejects, so waiting tasks are released', async () => {
    const gate = createStartupGate(recordingLogger([]), false);
    const calls: string[] = [];
    gate.openAfter(Promise.reject(new Error('startup failed')));

    await Promise.resolve();
    await Promise.resolve();
    gate.run(() => calls.push('after'));

    expect(calls).toEqual(['after']);
  });

  it('runs a task queued while draining after the ones already waiting', async () => {
    const gate = createStartupGate(recordingLogger([]), false);
    const calls: string[] = [];
    gate.run(() => {
      calls.push('one');
      gate.run(() => calls.push('three'));
    });
    gate.run(() => calls.push('two'));

    gate.openAfter(Promise.resolve());
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual(['one', 'two', 'three']);
  });

  it('logs a failing task and still runs the ones behind it', async () => {
    const records: LogRecord[] = [];
    const gate = createStartupGate(recordingLogger(records), false);
    const calls: string[] = [];
    gate.run(() => {
      throw new Error('bad payload');
    });
    gate.run(() => calls.push('survivor'));

    gate.openAfter(Promise.resolve());
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual(['survivor']);
    expect(records.map((record) => record.message)).toEqual([
      'startup-gated task failed',
    ]);
  });
});
