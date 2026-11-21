import { describe, expect, it } from 'vitest';
import { migrateCity } from '@/lib/city/migrate-city';

const v3City = {
  layers: { background: { width: 60, height: 20, cells: [] }, middleground: {}, foreground: {} },
  buildings: { 'a.com': { domain: 'a.com', layer: 'middleground', topRow: 1, leftCol: 2, widthChars: 3 } },
  themeId: 'sunset',
  sessionId: '1700000000000-abc123',
};

describe('migrateCity (CR6.T5a)', () => {
  it('keeps only the session id of a version 3 city', () => {
    expect(migrateCity(v3City)).toEqual({
      ok: true,
      value: { sessionId: '1700000000000-abc123' },
    });
  });

  it('migrates a version 2 city, which had the same city shape', () => {
    const v2 = { ...v3City, sessionId: null, themeId: null };
    expect(migrateCity(v2)).toEqual({ ok: true, value: { sessionId: null } });
  });

  it('migrates a version 1 city that predates the session id', () => {
    const v1 = { layers: v3City.layers, buildings: {}, themeId: null };
    expect(migrateCity(v1)).toEqual({ ok: true, value: { sessionId: null } });
  });

  it('treats an already current city as itself', () => {
    expect(migrateCity({ sessionId: 's-1' })).toEqual({
      ok: true,
      value: { sessionId: 's-1' },
    });
  });

  it('treats a missing city as no session', () => {
    expect(migrateCity(undefined)).toEqual({ ok: true, value: { sessionId: null } });
    expect(migrateCity(null)).toEqual({ ok: true, value: { sessionId: null } });
  });

  it.each([
    ['a string', 'nope'],
    ['a number', 42],
    ['an array', []],
  ])('rejects %s without throwing', (_label, raw) => {
    const result = migrateCity(raw);
    expect(result.ok).toBe(false);
  });

  it.each([
    ['a number', 7],
    ['an object', {}],
    ['an empty string', ''],
  ])('rejects a session id that is %s', (_label, sessionId) => {
    const result = migrateCity({ sessionId });
    expect(result.ok).toBe(false);
  });

  it('never echoes the data it rejects', () => {
    const result = migrateCity({ sessionId: { secret: 'user.example.com' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain('user.example.com');
  });
});
