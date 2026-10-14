import type { MutationMessage } from './messages.types';

/**
 * Collaborator required to change persisted state from a non-owner context
 * (M1.T10): the popup asks the background — the single writer (M1.T9) — to apply
 * the change, and converges on the result through the M1.T8 sync bridge.
 *
 * Injectable (principle D) so the slices stay unit-testable without the message
 * bus; the store barrel supplies the real `sendMessage`. Shared by every slice
 * that owns a mutation (blocklist/tags M1.T10, timer M3.T3b) instead of being
 * redeclared per slice.
 */
export interface MessagingDependencies {
  /** Ask the background to apply/persist a mutation. */
  readonly sendMutation?: (message: MutationMessage) => void;
}
