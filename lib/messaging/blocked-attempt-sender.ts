import type { Browser } from 'wxt/browser';
import { getRegistrableDomain } from '@/lib/url/domain';
import type { Result } from '@/utils/result';
import { err, ok } from '@/utils/result';
import type { MessageOf } from './bus';

type BlockedAttempt = MessageOf<'SITE_BLOCKED_ATTEMPT'>;

/**
 * Rebuilds a `SITE_BLOCKED_ATTEMPT` from what the browser vouches for (M6.T1).
 * The overlay's answer is only meaningful from a tab, and the page it answers
 * for is the tab's own URL — the `domain` the sender wrote in the payload is
 * untrusted and is replaced, never used. The tab URL goes through the same
 * normalizer as the blocklist, so the result is canonical.
 */
export function bindAttemptToSender(
  message: BlockedAttempt,
  sender: Browser.runtime.MessageSender,
): Result<BlockedAttempt> {
  const url = sender.tab?.url;
  if (url === undefined) return err(new Error('sender has no tab URL'));
  const domain = getRegistrableDomain(url);
  if (!domain.ok) return domain;
  return ok({
    type: 'SITE_BLOCKED_ATTEMPT',
    payload: { domain: domain.value, choice: message.payload.choice },
  });
}
