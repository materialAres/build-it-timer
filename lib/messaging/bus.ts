import { browser, type Browser } from 'wxt/browser';
import { createLogger, type Logger } from '@/utils/logger';
import type { Result } from '@/utils/result';
import { ok, err } from '@/utils/result';
import { parseRuntimeMessage } from './message-guards';
import type { RuntimeMessage } from './messages.types';

/**
 * Typed wrapper over `browser.runtime.sendMessage` / `browser.runtime.onMessage`
 * built on the `RuntimeMessage` discriminated union (M1.T1). Its purpose is to
 * keep the three "worlds" (background, content script, popup) decoupled: they
 * exchange typed messages instead of importing each other's modules.
 *
 * This module handles transport, type-safety and, for every receiver, the two
 * checks an incoming message needs (M6.T1): it must come from this extension
 * (`sender.id`) and it must pass the runtime guards of `message-guards.ts`.
 */

export type MessageType = RuntimeMessage['type'];

/** The full message variant carrying a given `type` (discriminated narrowing). */
export type MessageOf<T extends MessageType> = Extract<RuntimeMessage, { type: T }>;

/** Handler invoked for a message of a specific `type`, with a typed payload. */
export type MessageHandler<T extends MessageType> = (
  message: MessageOf<T>,
  sender: Browser.runtime.MessageSender,
) => void | Promise<void>;

const messagingLogger = createLogger('messaging');

/** The raw `type`, read without ever throwing on a hostile object. */
function readType(raw: unknown): unknown {
  try {
    return typeof raw === 'object' && raw !== null
      ? (raw as { type?: unknown }).type
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Send a typed message to the extension's listeners. Accepts only valid
 * `RuntimeMessage` variants at the type level (no `any`/free-form object).
 *
 * Returns a `Result` because sending crosses an untrusted boundary: a browser
 * with no listener rejects the send, which is an expected failure mode, not a
 * bug (see §1.4). Callers decide whether a missing listener is worth surfacing.
 */
export async function sendMessage(message: RuntimeMessage): Promise<Result<undefined>> {
  try {
    await browser.runtime.sendMessage(message);
    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Subscribe to messages of a given `type`. The handler receives the full typed
 * message variant, so `message.payload` is narrowed to that type's payload.
 *
 * Returns an unsubscribe function. Registering twice for the same `type` simply
 * adds a second listener; both are invoked (roadmap §3.3, M1.T6).
 *
 * Handler failures are a known boundary (§1.4): a synchronous throw or a
 * rejected async handler is logged with the message type and contained, so it
 * cannot become an unhandled rejection that takes down the context. The browser
 * still receives `void`, exactly as before (M4.T3b).
 */
export function onMessage<T extends MessageType>(
  type: T,
  handler: MessageHandler<T>,
  logger: Logger = messagingLogger,
): () => void {
  const listener = (rawMessage: unknown, sender?: Browser.runtime.MessageSender): void => {
    // Messages of another type are none of this listener's business, so they
    // are skipped silently: only a message *for* this type is worth a log line.
    if (readType(rawMessage) !== type) return;

    // Provenance (M6.T1): only this extension's own contexts may talk to us.
    if (sender === undefined || sender.id !== browser.runtime.id) {
      logger.warn('ignored a message from a foreign sender', { type });
      return;
    }
    const parsed = parseRuntimeMessage(rawMessage);
    if (!parsed.ok) {
      logger.warn('ignored a malformed message', { type });
      return;
    }
    // The guard is keyed by `type`, so the variant is the one registered for.
    const message = parsed.value as MessageOf<T>;

    try {
      const result = handler(message, sender);
      if (result !== undefined) {
        void result.catch((error: unknown) => {
          logger.error('message handler failed', error, { type });
        });
      }
    } catch (error: unknown) {
      logger.error('message handler failed', error, { type });
    }
  };

  browser.runtime.onMessage.addListener(listener);
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}
