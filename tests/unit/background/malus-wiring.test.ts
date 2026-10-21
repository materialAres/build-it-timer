import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore } from '@/store';
import { createMalusWiring } from '@/entrypoints/background';
import { applyMalus, malusForDistractionTicks } from '@/lib/score/apply-malus';
import {
  DEFAULT_FOCUS_PRESET,
  tickMsForDurationSeconds,
} from '@/lib/timer/focus-presets';
import { FakeAlarmProvider } from '@/tests/helpers/fake-alarm-adapter';
import type { CityLayers } from '@/components/city/city.types';
import type { RuntimeMessage } from '@/lib/messaging/messages.types';

const T0 = 1_700_000_000_000;
/** Cadence of the default preset, which the store starts sessions with. */
const TICK_MS = tickMsForDurationSeconds(DEFAULT_FOCUS_PRESET.durationSeconds);

function countOccupied(layers: CityLayers): number {
  return [layers.background, layers.middleground, layers.foreground].reduce(
    (total, grid) =>
      total + grid.cells.flat().filter((cell) => cell.char !== null).length,
    0,
  );
}

describe('malus wiring (M2.T16)', () => {
  let alarmProvider: FakeAlarmProvider;

  beforeEach(() => {
    fakeBrowser.reset();
    alarmProvider = new FakeAlarmProvider(T0);
  });

  function setup() {
    const store = createAppStore({
      dependencies: { alarmProvider, now: () => T0, random: () => 0.5 },
    });
    let accumulatedMs = 0;
    const send = vi.fn<(message: RuntimeMessage) => void>();
    const wiring = createMalusWiring({
      store,
      tracker: { getAccumulatedMs: () => accumulatedMs },
      send,
    });
    return {
      store,
      wiring,
      send,
      /** Make `value` whole session ticks of weighted distraction time accrued. */
      setTicks: (value: number) => {
        accumulatedMs = value * TICK_MS;
      },
    };
  }

  async function startSessionWithCharacters(
    store: ReturnType<typeof createAppStore>,
    characterCount: number,
  ): Promise<void> {
    await store.getState().startTimer();
    store.getState().growCityByTicks(characterCount);
  }

  it('destroys a character in the same update cycle as "proceed"', async () => {
    const { store, wiring, setTicks } = setup();
    await startSessionWithCharacters(store, 3);
    const before = store.getState().city.layers;
    setTicks(0);

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });

    expect(store.getState().city.layers).toEqual(applyMalus(before, 1));
    expect(countOccupied(store.getState().city.layers)).toBe(2);
  });

  it('emits MALUS_APPLIED with the domain and the removed character count', async () => {
    const { store, wiring, send } = setup();
    await startSessionWithCharacters(store, 2);

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });

    expect(send).toHaveBeenCalledWith({
      type: 'MALUS_APPLIED',
      payload: { domain: 'facebook.com', charactersRemoved: 1 },
    });
  });

  it('ignores the "go-back" choice (no destruction, no message)', async () => {
    const { store, wiring, send } = setup();
    await startSessionWithCharacters(store, 2);
    const before = store.getState().city.layers;

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'go-back' } });

    expect(store.getState().city.layers).toBe(before);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not double-apply on two malus events in close succession', async () => {
    const { store, wiring, send } = setup();
    await startSessionWithCharacters(store, 3);

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });

    expect(countOccupied(store.getState().city.layers)).toBe(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not start the malus when the timer is not running', () => {
    const { store, wiring, send } = setup();
    // Grow without starting a session so the city has a character to lose.
    store.getState().growCityByTicks(1);
    const before = store.getState().city.layers;

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });

    expect(store.getState().city.layers).toBe(before);
    expect(send).not.toHaveBeenCalled();
  });

  it('removes one character per accrued distraction tick after "proceed"', async () => {
    const { store, wiring, setTicks } = setup();
    await startSessionWithCharacters(store, 5);
    setTicks(0);
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    expect(countOccupied(store.getState().city.layers)).toBe(4);

    setTicks(1);
    wiring.handleTick();
    expect(countOccupied(store.getState().city.layers)).toBe(3);

    setTicks(2);
    wiring.handleTick();
    expect(countOccupied(store.getState().city.layers)).toBe(2);

    // A tick sample without new whole ticks applies nothing.
    wiring.handleTick();
    expect(countOccupied(store.getState().city.layers)).toBe(2);
  });

  it('escalates the malus with the time spent on the blocked site (M4.T1)', async () => {
    const { store, wiring, setTicks } = setup();
    await startSessionWithCharacters(store, 40);
    setTicks(0);
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    const afterProceed = countOccupied(store.getState().city.layers);
    expect(afterProceed).toBe(39);

    // 12 elapsed ticks cost more than one character each: the wiring removes the
    // escalated amount in one go, not the linear `1 + 12`.
    setTicks(12);
    wiring.handleTick();
    const removed = afterProceed - countOccupied(store.getState().city.layers);
    expect(removed).toBe(malusForDistractionTicks(12));
    expect(removed).toBeGreaterThan(12);
  });

  it('forgives the pre-"proceed" open time of the blocked tab', async () => {
    const { store, wiring, setTicks } = setup();
    await startSessionWithCharacters(store, 5);
    // The blocked tab was already open for 10s (5 tracker ticks) before the
    // user chose "proceed": only the proceed event itself is charged.
    setTicks(5);

    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });

    expect(countOccupied(store.getState().city.layers)).toBe(4);
  });

  it('is a safe no-op when the city is already empty', async () => {
    const { store, wiring, send } = setup();
    await store.getState().startTimer();

    expect(() => {
      wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    }).not.toThrow();

    expect(send).not.toHaveBeenCalled();
  });

  it('resets the malus stretch when a new session starts', async () => {
    const { store, wiring, setTicks } = setup();
    await startSessionWithCharacters(store, 3);
    setTicks(0);
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    expect(countOccupied(store.getState().city.layers)).toBe(2);

    // A new session resets the city and the stretch, so a fresh "proceed"
    // applies to the new city instead of being ignored as a re-mount.
    store.getState().resetCityForNewSession('session-2', 'default');
    store.getState().growCityByTicks(1);
    setTicks(0);
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'x.com', choice: 'proceed' } });

    expect(countOccupied(store.getState().city.layers)).toBe(0);
  });

  it('stops reacting to session changes after dispose', async () => {
    const { store, wiring } = setup();
    await startSessionWithCharacters(store, 2);
    wiring.handleAttempt({ type: 'SITE_BLOCKED_ATTEMPT', payload: { domain: 'facebook.com', choice: 'proceed' } });
    wiring.dispose();

    // Disposing must not throw even when the store changes afterwards.
    expect(() => {
      store.getState().resetCityForNewSession('session-3', 'default');
    }).not.toThrow();
  });
});
