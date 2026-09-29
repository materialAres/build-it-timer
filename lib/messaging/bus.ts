import { browser } from 'wxt/browser';
import type { Result } from '@/utils/result';
import { ok, err } from '@/utils/result';
import type { RuntimeMessage } from './messages.types';

/**
 * Typed wrapper over `browser.runtime.sendMessage` / `browser.runtime.onMessage`
 * built on the `RuntimeMessage` discriminated union (M1.T1). Its purpose is to
 * keep the three "worlds" (background, content script, popup) decoupled: they
 * exchange typed messages instead of importing each other's modules.
 *
 * This module is deliberately thin: it only handles transport and type-safety.
 * Runtime validation of untrusted payloads and sender provenance hardening are
 * additive and land in M5.T1.
 */

export type MessageType = RuntimeMessage['type'];

/** The full message variant carrying a given `type` (discriminated narrowing). */
export type MessageOf<T extends MessageType> = Extract<RuntimeMessage, { type: T }>;

/** Handler invoked for a message of a specific `type`, with a typed payload. */
export type MessageHandler<T extends MessageType> = (
  message: MessageOf<T>,
) => void | Promise<void>;

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
 */
export function onMessage<T extends MessageType>(
  type: T,
  handler: MessageHandler<T>,
): () => void {
  const listener = (rawMessage: unknown): void => {
    // Minimal structural guard so a foreign/unknown message can never reach a
    // typed handler. Full runtime validation is M5.T1.
    if (typeof rawMessage !== 'object' || rawMessage === null) return;
    const received = (rawMessage as { type?: unknown }).type;
    if (typeof received !== 'string' || received !== type) return;

    void handler(rawMessage as MessageOf<T>);
  };

  browser.runtime.onMessage.addListener(listener);
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}
