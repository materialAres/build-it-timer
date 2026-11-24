import { err, ok, type Result } from '@/utils/result';

/**
 * The persisted city since version 4 (CR6.T5a): only the id of the session it
 * belongs to. The plan is derived from it, and the floors from the score.
 */
export interface PersistedCity {
  readonly sessionId: string | null;
}

/** The session id of an untrusted persisted city: a non-empty string, else null. */
export function sanitizeSessionId(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * Bring a persisted `city` of any earlier version (v1–v3 held the ASCII layers,
 * the building index and the theme) to the version 4 shape: `layers`,
 * `buildings` and `themeId` are dropped, a session in progress keeps its id and
 * so gets its plan from it. Untrusted input (§1.4): a malformed city is
 * rejected with a `Result`, never a throw, and the error never echoes the data.
 */
export function migrateCity(raw: unknown): Result<PersistedCity> {
  if (raw === undefined || raw === null) return ok({ sessionId: null });
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return err(new Error('persisted city is not an object'));
  }
  const sessionId = (raw as { sessionId?: unknown }).sessionId;
  if (sessionId === undefined || sessionId === null) return ok({ sessionId: null });
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return err(new Error('persisted city sessionId is not a non-empty string'));
  }
  return ok({ sessionId });
}
