/**
 * Share of a session that must be built before the score tier is shown. The
 * first band is `bad` from the very first character, so showing it earlier
 * would label a session as failing seconds after it started.
 */
export const SCORE_REVEAL_RATIO = 0.1;

/**
 * Whether enough of the session is built for its tier to mean something. An
 * invalid total never hides the tier: the badge degrades to the real level.
 */
export function isScoreTierSettled(builtCharacters: number, total: number): boolean {
  if (!Number.isFinite(total) || total <= 0) return true;
  return builtCharacters >= Math.ceil(SCORE_REVEAL_RATIO * total);
}
