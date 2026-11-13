import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, selectCityPlan, selectVisibleFloors } from '@/store';
import { generateCityPlan } from '@/lib/city/plan/generate-city-plan';
import { seedFromSession } from '@/lib/city/plan/seed';
import type { AppStore } from '@/store';

const DURATION_S = 30 * 60;

function store(): AppStore {
  return createAppStore();
}

function setSession(s: AppStore, sessionId: string | null): void {
  s.setState({ city: { ...s.getState().city, sessionId } });
}

function setProgress(s: AppStore, built: number, focusedMs: number): void {
  s.setState({
    score: { ...s.getState().score, builtCharacters: built },
    timer: { ...s.getState().timer, focusedMs, durationSeconds: DURATION_S },
  });
}

describe('city selectors (CR6.T5a)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('selectCityPlan', () => {
    it('is null while there is no session', () => {
      expect(selectCityPlan(store().getState())).toBeNull();
    });

    it('is the plan generated from the session seed', () => {
      const s = store();
      setSession(s, 'session-a');
      expect(selectCityPlan(s.getState())).toEqual(
        generateCityPlan(seedFromSession('session-a')),
      );
    });

    it('is computed once per session id, not on every read', () => {
      const s = store();
      setSession(s, 'session-b');
      const first = selectCityPlan(s.getState());
      s.setState({ city: { ...s.getState().city } });
      expect(selectCityPlan(s.getState())).toBe(first);
    });

    it('is another plan for another session', () => {
      const s = store();
      setSession(s, 'session-c');
      const first = selectCityPlan(s.getState());
      setSession(s, 'session-d');
      const second = selectCityPlan(s.getState());
      expect(second).not.toBe(first);
      expect(second?.seed).not.toBe(first?.seed);
    });
  });

  describe('selectVisibleFloors', () => {
    it('shows nothing without a session', () => {
      expect(selectVisibleFloors(store().getState())).toEqual({
        complete: 0,
        partialFraction: 0,
        damaged: false,
      });
    });

    it('follows the built characters of the score', () => {
      const s = store();
      setSession(s, 'session-e');
      setProgress(s, 300, 15 * 60_000);
      const plan = selectCityPlan(s.getState());
      const view = selectVisibleFloors(s.getState());
      expect(view.complete).toBe(Math.floor(((plan?.totalFloors ?? 0) * 300) / 600));
      expect(view.damaged).toBe(false);
    });

    it('marks the top floor damaged while the city is losing characters', () => {
      const s = store();
      setSession(s, 'session-f');
      setProgress(s, 300, 15 * 60_000);
      selectVisibleFloors(s.getState());
      // A blocked site takes 49 characters back.
      setProgress(s, 251, 15 * 60_000);
      const view = selectVisibleFloors(s.getState());
      expect(view.partialFraction).toBeGreaterThan(0);
      expect(view.damaged).toBe(true);
    });

    it('builds the top floor again, not damaged, once the city grows after a loss (I015)', () => {
      const s = store();
      setSession(s, 'session-f2');
      setProgress(s, 300, 15 * 60_000);
      selectVisibleFloors(s.getState());
      setProgress(s, 251, 15 * 60_000);
      selectVisibleFloors(s.getState());
      // Back to focus: every new character is construction, never damage.
      for (let built = 252; built <= 260; built += 1) {
        setProgress(s, built, 15 * 60_000 + (built - 251) * 3_000);
        expect(selectVisibleFloors(s.getState()).damaged).toBe(false);
      }
    });

    it('does not show damage on a view opened while the city regrows (I015)', () => {
      const s = store();
      setSession(s, 'session-f3');
      // 15 min of focus is worth 300 characters; 251 are left from an earlier loss.
      setProgress(s, 251, 15 * 60_000);
      expect(selectVisibleFloors(s.getState()).damaged).toBe(false);
    });

    it('returns the same object while its inputs are unchanged (no re-render churn)', () => {
      const s = store();
      setSession(s, 'session-g');
      setProgress(s, 120, 12 * 60_000);
      const first = selectVisibleFloors(s.getState());
      s.setState({ ui: { ...s.getState().ui, activeTab: 'city' } });
      expect(selectVisibleFloors(s.getState())).toBe(first);
      setProgress(s, 121, 12 * 60_000);
      expect(selectVisibleFloors(s.getState())).not.toBe(first);
    });
  });
});
