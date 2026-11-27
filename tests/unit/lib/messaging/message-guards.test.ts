import { describe, it, expect } from 'vitest';
import { parseRuntimeMessage } from '@/lib/messaging/message-guards';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';

const VALID: ReadonlyArray<RuntimeMessage> = [
  { type: 'TIMER_TICK', payload: { remainingSeconds: 42 } },
  { type: 'TIMER_STARTED', payload: {} },
  { type: 'TIMER_PAUSED', payload: {} },
  { type: 'TIMER_RESET', payload: {} },
  { type: 'TIMER_SET_DURATION', payload: { durationSeconds: 1500 } },
  {
    type: 'SITE_BLOCKED_ATTEMPT',
    payload: { domain: 'facebook.com', choice: 'proceed' },
  },
  {
    type: 'MALUS_APPLIED',
    payload: { domain: 'facebook.com', charactersRemoved: 3 },
  },
  {
    type: 'SESSION_ENDED',
    payload: { sessionId: 's1', score: 'good', population: 10, endedAt: 1 },
  },
  { type: 'BLOCKLIST_ADD_SITE', payload: { site: 'facebook.com' } },
  { type: 'BLOCKLIST_REMOVE_SITE', payload: { site: 'facebook.com' } },
  { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: true } },
  { type: 'PRESET_SAVE', payload: { id: 'user:abc', name: 'Work' } },
  { type: 'PRESET_RENAME', payload: { presetId: 'user:abc', name: 'Deep' } },
  { type: 'PRESET_DELETE', payload: { presetId: 'user:abc' } },
  { type: 'PREFERENCES_SOUND_SET', payload: { volume: 30 } },
  {
    type: 'PLAY_SOUND',
    payload: { themeId: 'glitch', cue: 'start', volume: 50 },
  },
];

describe('parseRuntimeMessage (M6.T1)', () => {
  it.each(VALID)('accepts a well-formed $type and returns a fresh equal object', (message) => {
    const result = parseRuntimeMessage(message);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(message);
    expect(result.value).not.toBe(message);
    expect(result.value.payload).not.toBe(message.payload);
  });

  it.each(VALID)('drops the unknown fields of $type', (message) => {
    const forged = {
      ...message,
      tabId: 7,
      // Timer commands keep their strict empty payload: an extra payload
      // field rejects them (covered below), so only the top level is forged.
      payload:
        Object.keys(message.payload).length === 0
          ? message.payload
          : { ...message.payload, tabId: 7, admin: true },
    };

    const result = parseRuntimeMessage(forged);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(message);
    expect(JSON.stringify(result.value)).not.toContain('tabId');
  });

  it.each([
    null,
    undefined,
    42,
    'TIMER_TICK',
    true,
    [],
    {},
    { type: 42 },
    { type: 'NOPE', payload: {} },
    { type: 'TIMER_TICK' },
    { type: 'TIMER_TICK', payload: null },
    { type: 'TIMER_TICK', payload: 'x' },
    { type: 'constructor', payload: {} },
    { type: '__proto__', payload: {} },
    { type: 'toString', payload: {} },
  ])('rejects the non-message %j', (raw) => {
    expect(parseRuntimeMessage(raw).ok).toBe(false);
  });

  it.each([
    { type: 'TIMER_TICK', payload: { remainingSeconds: '42' } },
    { type: 'TIMER_TICK', payload: { remainingSeconds: Number.NaN } },
    { type: 'TIMER_TICK', payload: { remainingSeconds: Infinity } },
    { type: 'TIMER_TICK', payload: {} },
    { type: 'TIMER_SET_DURATION', payload: { durationSeconds: 1500.5 } },
    { type: 'TIMER_SET_DURATION', payload: { durationSeconds: '1500' } },
    { type: 'TIMER_SET_DURATION', payload: {} },
    { type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'a.com', choice: 'maybe' } },
    { type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 7, choice: 'proceed' } },
    { type: 'SITE_BLOCKED_ATTEMPT', payload: { choice: 'proceed' } },
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: '' } },
    { type: 'BLOCKLIST_ADD_SITE', payload: { site: 42 } },
    { type: 'BLOCKLIST_REMOVE_SITE', payload: {} },
    { type: 'PRESET_TOGGLE', payload: { presetId: 'social', applied: 'yes' } },
    { type: 'PRESET_TOGGLE', payload: { presetId: '', applied: true } },
    { type: 'PRESET_SAVE', payload: { id: 'social', name: 'x' } },
    { type: 'PRESET_SAVE', payload: { id: 'user:a', name: 7 } },
    { type: 'PRESET_RENAME', payload: { presetId: 'user:a' } },
    { type: 'PRESET_DELETE', payload: { presetId: 7 } },
    { type: 'PREFERENCES_SOUND_SET', payload: {} },
    { type: 'PREFERENCES_SOUND_SET', payload: { volume: 101 } },
    { type: 'PREFERENCES_SOUND_SET', payload: { enabled: 'true' } },
    { type: 'PREFERENCES_SOUND_SET', payload: { themeId: 'nope' } },
    { type: 'PLAY_SOUND', payload: { themeId: 'glitch', cue: 'nope', volume: 50 } },
    { type: 'PLAY_SOUND', payload: null },
    { type: 'MALUS_APPLIED', payload: { domain: 'a.com', charactersRemoved: 'x' } },
    { type: 'SESSION_ENDED', payload: { sessionId: 's1' } },
  ])('rejects the malformed message %j', (raw) => {
    expect(parseRuntimeMessage(raw).ok).toBe(false);
  });

  it.each(['TIMER_STARTED', 'TIMER_PAUSED', 'TIMER_RESET'])(
    'keeps the strict empty payload of %s: any field rejects the message',
    (type) => {
      expect(parseRuntimeMessage({ type, payload: { x: 1 } }).ok).toBe(false);
    },
  );

  it('ignores a sound patch key it does not know and keeps the known ones', () => {
    const result = parseRuntimeMessage({
      type: 'PREFERENCES_SOUND_SET',
      payload: { volume: 10, evil: true },
    });

    expect(result).toEqual({
      ok: true,
      value: { type: 'PREFERENCES_SOUND_SET', payload: { volume: 10 } },
    });
  });

  it('does not let an inherited or polluted property count as a field', () => {
    const payload = Object.create({ site: 'facebook.com' }) as Record<string, unknown>;

    expect(parseRuntimeMessage({ type: 'BLOCKLIST_ADD_SITE', payload }).ok).toBe(false);
  });

  it('never throws, even on a hostile getter or a proxy', () => {
    const throwing = {
      get type(): string {
        throw new Error('boom');
      },
    };
    const proxy = new Proxy(
      {},
      {
        get(): never {
          throw new Error('boom');
        },
      },
    );

    expect(() => parseRuntimeMessage(throwing)).not.toThrow();
    expect(parseRuntimeMessage(throwing).ok).toBe(false);
    expect(() => parseRuntimeMessage(proxy)).not.toThrow();
    expect(parseRuntimeMessage(proxy).ok).toBe(false);
  });

  it('does not accept inherited PLAY_SOUND fields', () => {
    const fields = { themeId: 'glitch', cue: 'start', volume: 50 };
    const inherited = Object.create(fields) as Record<string, unknown>;

    expect(parseRuntimeMessage({ type: 'PLAY_SOUND', payload: inherited }).ok).toBe(false);

    const parsed = parseRuntimeMessage({ type: 'PLAY_SOUND', payload: { ...fields } });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.payload).toEqual(fields);
  });
});
