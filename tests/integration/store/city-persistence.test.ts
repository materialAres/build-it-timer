import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createAppStore, partialize, STORE_NAME, type AppStore } from '@/store';
import { createLogger, type LogRecord } from '@/utils/logger';

const legacyCity = {
  layers: { background: { width: 1, height: 1, cells: [[{ char: '#' }]] } },
  buildings: { 'a.com': { domain: 'a.com' } },
  themeId: 'sunset',
  sessionId: 'sess-1',
};

async function rehydrate(
  state: Record<string, unknown>,
  version: number,
  records: LogRecord[] = [],
): Promise<AppStore> {
  await fakeBrowser.storage.local.set({
    [STORE_NAME]: JSON.stringify({ state, version }),
  });
  const store = createAppStore({
    logger: createLogger('test', { sink: (r) => records.push(r) }),
  });
  await store.persist.rehydrate();
  return store;
}

describe('persistence v4: a derived city (CR6.T5a)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('persists only the session id of the city', () => {
    const store = createAppStore();
    store.setState({ city: { ...store.getState().city, sessionId: 's-9' } });
    expect(partialize(store.getState()).city).toEqual({ sessionId: 's-9' });
  });

  it('writes version 4', async () => {
    const store = createAppStore();
    store.setState({ city: { ...store.getState().city, sessionId: 's-4' } });
    await store.persist.rehydrate();
    store.setState({ city: { ...store.getState().city, sessionId: 's-5' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = (await fakeBrowser.storage.local.get(STORE_NAME))[STORE_NAME] as string;
    const parsed = JSON.parse(raw) as { version: number; state: { city: unknown } };
    expect(parsed.version).toBe(4);
    expect(parsed.state.city).toEqual({ sessionId: 's-5' });
  });

  it.each([3, 2, 1])('migrates a version %i snapshot, dropping layers and buildings', async (version) => {
    const store = await rehydrate(
      {
        timer: { status: 'running', sessionId: 'sess-1', durationSeconds: 1800 },
        city: legacyCity,
        score: { builtCharacters: 42 },
      },
      version,
    );
    const state = store.getState();
    expect(state.city.sessionId).toBe('sess-1');
    expect(partialize(state).city).toEqual({ sessionId: 'sess-1' });
    expect(state.timer.status).toBe('running');
    expect(state.score.builtCharacters).toBe(42);
  });

  it('keeps an in-progress session: same score, a plan from its session id', async () => {
    const store = await rehydrate(
      {
        timer: { status: 'running', sessionId: 'sess-7', durationSeconds: 1800, focusedMs: 900_000 },
        city: { ...legacyCity, sessionId: 'sess-7' },
        score: { builtCharacters: 300 },
      },
      3,
    );
    expect(store.getState().score.builtCharacters).toBe(300);
    expect(store.getState().city.sessionId).toBe('sess-7');
  });

  it('rejects a malformed city with a log, never a throw, and keeps the rest', async () => {
    const records: LogRecord[] = [];
    const store = await rehydrate(
      { timer: { status: 'paused', sessionId: 's' }, city: 'garbage', score: { builtCharacters: 5 } },
      3,
      records,
    );
    expect(store.getState().city.sessionId).toBeNull();
    expect(store.getState().timer.status).toBe('paused');
    expect(store.getState().score.builtCharacters).toBe(5);
    expect(records.some((r) => r.level === 'error')).toBe(true);
  });

  it('ignores legacy layers inside a version 4 payload', async () => {
    const store = await rehydrate({ city: { sessionId: 's-8', layers: 'x' } }, 4);
    expect(store.getState().city.sessionId).toBe('s-8');
    expect(JSON.stringify(partialize(store.getState()).city)).not.toContain('layers');
  });

  it('keeps the blocklist, timer and history of a version 3 snapshot untouched', async () => {
    const store = await rehydrate(
      {
        timer: { status: 'idle', sessionId: null, durationSeconds: 3600 },
        city: legacyCity,
        blocklist: {
          blocklist: [{ domain: { value: 'a.com' }, manual: true, presetIds: [] }],
          appliedPresetIds: [],
          userPresets: [],
        },
        sessionHistory: { sessions: [{ sessionId: 'h1', score: 'good', population: 10, endedAt: 1 }] },
      },
      3,
    );
    expect(store.getState().timer.durationSeconds).toBe(3600);
    expect(store.getState().blocklist.blocklist).toHaveLength(1);
    expect(store.getState().sessionHistory.sessions).toHaveLength(1);
  });
});
