import { describe, it, expect, expectTypeOf, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage, onMessage, type MessageOf } from '@/lib/messaging/bus';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';
import type { Result } from '@/utils/result';

describe('typed message bus', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('delivers a typed payload to the listener registered for its type', async () => {
    const handler = vi.fn();
    onMessage('SITE_BLOCKED_ATTEMPT', handler);

    const message: MessageOf<'SITE_BLOCKED_ATTEMPT'> = {
      type: 'SITE_BLOCKED_ATTEMPT',
      payload: { domain: 'facebook.com', choice: 'proceed' },
    };
    await sendMessage(message);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(message);
  });

  it('narrows the payload to the registered type', async () => {
    let received: MessageOf<'TIMER_TICK'> | undefined;
    onMessage('TIMER_TICK', (message) => {
      received = message;
      // `message.payload.remainingSeconds` is only available thanks to the
      // discriminated narrowing; the assertion documents the typed contract.
      expect(message.payload.remainingSeconds).toBe(42);
    });

    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 42 } });

    expect(received?.type).toBe('TIMER_TICK');
  });

  it('accepts only valid RuntimeMessage variants at the type level', () => {
    // `sendMessage` is typed against the discriminated union: the compiler
    // rejects an unknown `type` (no `any`/free-form object escapes the
    // type-safety, per M1.T6). `@ts-expect-error` turns a silent widening into
    // a hard `bun run compile` failure: if the call were accepted, the
    // directive itself would be reported as unused.
    // @ts-expect-error — 'NOPE' is not a RuntimeMessage variant.
    const invalidSend: Promise<Result<undefined>> = sendMessage({ type: 'NOPE', payload: {} });
    expectTypeOf(invalidSend).toEqualTypeOf<Promise<Result<undefined>>>();

    // The handler payload is narrowed to the variant's payload, not widened.
    type TickPayload = MessageOf<'TIMER_TICK'>['payload'];
    expectTypeOf<TickPayload>().toEqualTypeOf<{ readonly remainingSeconds: number }>();
    expectTypeOf(sendMessage).returns.toEqualTypeOf<Promise<Result<undefined>>>();
  });

  it('does not invoke a listener registered for a different type', async () => {
    const siteBlocked = vi.fn();
    onMessage('SITE_BLOCKED_ATTEMPT', siteBlocked);

    await sendMessage({ type: 'TIMER_PAUSED', payload: {} });

    expect(siteBlocked).not.toHaveBeenCalled();
  });

  it('invokes multiple listeners registered for the same type', async () => {
    const first = vi.fn();
    const second = vi.fn();
    onMessage('MALUS_APPLIED', first);
    onMessage('MALUS_APPLIED', second);

    await sendMessage({
      type: 'MALUS_APPLIED',
      payload: { domain: 'x.com', charactersRemoved: 1 },
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores an unrecognized message type without throwing', async () => {
    const handler = vi.fn();
    onMessage('TIMER_TICK', handler);

    // A forged/foreign message that is not part of the union at all.
    const forged = { type: 'UNKNOWN_TYPE', payload: {} } as unknown as RuntimeMessage;

    await expect(sendMessage(forged)).resolves.toEqual({ ok: true, value: undefined });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores non-object messages without throwing', async () => {
    const handler = vi.fn();
    onMessage('TIMER_TICK', handler);

    await expect(
      sendMessage('not-a-message' as unknown as RuntimeMessage),
    ).resolves.toEqual({ ok: true, value: undefined });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an error Result when no listener is registered', async () => {
    const result = await sendMessage({ type: 'TIMER_PAUSED', payload: {} });

    expect(result.ok).toBe(false);
  });

  it('stops notifying a listener after unsubscribe', async () => {
    const handler = vi.fn();
    const unsubscribe = onMessage('TIMER_TICK', handler);

    unsubscribe();
    const result = await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 1 } });

    expect(handler).not.toHaveBeenCalled();
    expect(result.ok).toBe(false); // listener removed: no listeners left
  });

  it('supports an async handler', async () => {
    const seen: number[] = [];
    onMessage('TIMER_TICK', async (message) => {
      await Promise.resolve();
      seen.push(message.payload.remainingSeconds);
    });

    await sendMessage({ type: 'TIMER_TICK', payload: { remainingSeconds: 7 } });

    expect(seen).toEqual([7]);
  });
});
