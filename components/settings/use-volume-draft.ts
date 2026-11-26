import { useState } from 'react';

interface Draft {
  readonly from: number;
  readonly value: number;
  readonly sent: boolean;
}

export interface VolumeDraft {
  /** What the slider shows: the value being dragged, else the stored one. */
  readonly value: number;
  /** Records a value while the slider moves; nothing is sent yet. */
  readonly change: (value: number) => void;
  /** Sends the dragged value, once, when the slider is released. */
  readonly commit: () => void;
}

/**
 * The volume being dragged (M5.T19). It is tied to the stored value it started
 * from, so a change made elsewhere wins, and `sent` stops a pointer release
 * followed by a key release (or the other way round) from asking twice before
 * the store has caught up.
 */
export function useVolumeDraft(
  stored: number,
  send: (volume: number) => void,
): VolumeDraft {
  const [draft, setDraft] = useState<Draft | null>(null);
  return {
    value: draft !== null && draft.from === stored ? draft.value : stored,
    change: (value) => {
      setDraft({ from: stored, value, sent: false });
    },
    commit: () => {
      if (draft === null || draft.sent || draft.from !== stored) return;
      setDraft({ ...draft, sent: true });
      if (draft.value !== stored) send(draft.value);
    },
  };
}
