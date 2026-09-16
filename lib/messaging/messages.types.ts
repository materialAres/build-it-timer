import type { SessionSummary } from '@/store/store.types';

interface TimerTickMessage {
  readonly type: 'TIMER_TICK';
  readonly payload: { readonly remainingSeconds: number };
}

interface TimerStartedMessage {
  readonly type: 'TIMER_STARTED';
  readonly payload: { readonly sessionId: string };
}

interface TimerPausedMessage {
  readonly type: 'TIMER_PAUSED';
  readonly payload: Record<string, never>; // no payload but explicit
}

interface SiteBlockedAttemptMessage {
  readonly type: 'SITE_BLOCKED_ATTEMPT';
  readonly payload: {
    readonly domain: string;
    readonly choice: 'proceed' | 'go-back';
    readonly tabId: number;
  };
}

interface MalusAppliedMessage {
  readonly type: 'MALUS_APPLIED';
  readonly payload: { readonly domain: string; readonly charactersRemoved: number };
}

interface SessionEndedMessage {
  readonly type: 'SESSION_ENDED';
  readonly payload: SessionSummary;
}

export type RuntimeMessage =
  | TimerTickMessage
  | TimerStartedMessage
  | TimerPausedMessage
  | SiteBlockedAttemptMessage
  | MalusAppliedMessage
  | SessionEndedMessage;