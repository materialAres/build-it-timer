import { hashString } from '@/utils/hash';

/**
 * The plan seed of a session: a 32-bit hash of its id (`generateSessionId`
 * is random per session), so the same session always rebuilds the same city
 * and no geometry has to be stored. `null` (no session) hashes like `''`.
 */
export function seedFromSession(sessionId: string | null): number {
  return hashString(sessionId ?? '');
}
