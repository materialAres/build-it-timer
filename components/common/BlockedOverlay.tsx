import type { MouseEvent } from 'react';
import { i18n } from '#i18n';

/**
 * The overlay's own stylesheet, rendered *inside* the shadow root (M2.T8).
 *
 * Sizes are in `px`, never `rem`: a rem is the *page's* root font size (YouTube
 * sets it to 10px), which shrank the text on such sites.
 *
 * A shadow root stops the host page's rules from matching the overlay's
 * elements, but inheritable properties (`color`, `font`, `line-height`,
 * `visibility`, …) still cross the shadow boundary. `all: initial` on the root
 * element is therefore what actually makes the overlay immune to the page, and
 * the rest of the sheet only has to look after itself — it cannot rely on any
 * page style, because none reaches it.
 */
const OVERLAY_STYLES = `
  .blocked-overlay {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(4, 8, 12, 0.92);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #7dfba0;
  }
  .blocked-overlay__panel {
    box-sizing: border-box;
    max-width: 480px;
    margin: 16px;
    padding: 24px;
    border: 1px solid #2f6b45;
    border-radius: 8px;
    background: #0b1410;
    box-shadow: 0 0 32px rgba(125, 251, 160, 0.25);
    text-align: center;
  }
  .blocked-overlay__title {
    margin: 0 0 12px;
    font-size: 24px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #7dfba0;
    text-shadow: 0 0 6px currentColor;
  }
  .blocked-overlay__message {
    margin: 0 0 20px;
    font-size: 16px;
    line-height: 1.5;
    color: #cfe9d8;
  }
  .blocked-overlay__domain {
    color: #ffd479;
    text-shadow: 0 0 6px currentColor;
  }
  .blocked-overlay__feedback {
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
    color: #7dfba0;
  }
  .blocked-overlay__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  .blocked-overlay__button {
    all: unset;
    cursor: pointer;
    padding: 8px 20px;
    border: 1px solid #2f6b45;
    border-radius: 999px;
    font: inherit;
    color: #7dfba0;
  }
  .blocked-overlay__button:focus-visible {
    outline: 2px solid #7dfba0;
    outline-offset: 2px;
  }
  .blocked-overlay__button--danger {
    border-color: #8c3b3b;
    color: #ff9b9b;
  }
`;

export interface BlockedOverlayProps {
  /** Registrable domain the user landed on (already normalized, M1.T2). */
  readonly domain: string;
  /**
   * `true` once "No" has been chosen: the overlay swaps the question for the
   * encouragement instead of closing, because the caller may not be able to
   * navigate back (the tab can have no history to return to).
   */
  readonly dismissed: boolean;
  /**
   * "Yes": the caller reports the attempt and hands the page over (M2.T10). It
   * receives the click so it can tell a real one from a script-fired one (M6.T4).
   */
  readonly onProceed: (event: MouseEvent<HTMLButtonElement>) => void;
  /** "No": the caller reports the refusal and tries to go back. */
  readonly onGoBack: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Alert shown over a blocked site (M2.T8). Purely presentational: it renders
 * the domain it is given and reports the two choices through callbacks, holding
 * no knowledge of the blocklist and sending no message of its own — the content
 * script owns the transport, so this component stays testable in isolation.
 *
 * Its stylesheet travels with the markup (see `OVERLAY_STYLES`) instead of
 * living in a CSS file, because a `*.content.css` entrypoint would be injected
 * into the *page*: only a `<style>` inside the shadow root reaches the overlay.
 */
export function BlockedOverlay({
  domain,
  dismissed,
  onProceed,
  onGoBack,
}: BlockedOverlayProps) {
  return (
    <div
      className="blocked-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="blocked-overlay-title"
      aria-describedby="blocked-overlay-message"
    >
      <style>{OVERLAY_STYLES}</style>
      <div className="blocked-overlay__panel">
        <h1 className="blocked-overlay__title" id="blocked-overlay-title">
          {i18n.t('overlay.title')}
        </h1>
        {dismissed ? (
          <p className="blocked-overlay__feedback" id="blocked-overlay-message">
            {i18n.t('overlay.keepFocusing')}
          </p>
        ) : (
          <>
            <p
              className="blocked-overlay__message"
              id="blocked-overlay-message"
            >
              {i18n.t('overlay.questionPrefix')}
              <span className="blocked-overlay__domain">{domain}</span>
              {i18n.t('overlay.questionSuffix')}
            </p>
            <div className="blocked-overlay__actions">
              <button
                type="button"
                className="blocked-overlay__button blocked-overlay__button--danger"
                onClick={onProceed}
              >
                {i18n.t('overlay.openAnyway')}
              </button>
              <button
                type="button"
                className="blocked-overlay__button"
                onClick={onGoBack}
              >
                {i18n.t('overlay.backToWork')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
