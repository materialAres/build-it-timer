import { describe, it, expect } from 'vitest';
import {
  SCORE_REVEAL_RATIO,
  isScoreTierSettled,
} from '@/lib/score/score-reveal';

describe('isScoreTierSettled (UI.T7)', () => {
  it('holds the tier back until a tenth of the session is built', () => {
    expect(isScoreTierSettled(0, 600)).toBe(false);
    expect(isScoreTierSettled(59, 600)).toBe(false);
  });

  it('reveals the tier from the threshold on', () => {
    expect(isScoreTierSettled(60, 600)).toBe(true);
    expect(isScoreTierSettled(600, 600)).toBe(true);
  });

  it('keeps the threshold as a share, not a character count', () => {
    expect(SCORE_REVEAL_RATIO).toBe(0.1);
    expect(isScoreTierSettled(5, 50)).toBe(true);
    expect(isScoreTierSettled(4, 50)).toBe(false);
  });

  it('never hides the tier when the total is invalid', () => {
    expect(isScoreTierSettled(0, 0)).toBe(true);
    expect(isScoreTierSettled(0, Number.NaN)).toBe(true);
  });
});
