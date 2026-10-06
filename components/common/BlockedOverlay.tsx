/**
 * The overlay's own stylesheet, rendered *inside* the shadow root (M2.T8).
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
    max-width: 30rem;
    margin: 1rem;
    padding: 1.5rem;
    border: 1px solid #2f6b45;
    border-radius: 0.5rem;
    background: #0b1410;
    box-shadow: 0 0 2rem rgba(125, 251, 160, 0.25);
    text-align: center;
  }
  .blocked-overlay__title {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #7dfba0;
    text-shadow: 0 0 6px currentColor;
  }
  .blocked-overlay__message {
    margin: 0 0 1.25rem;
    font-size: 0.95rem;
    line-height: 1.5;
    color: #cfe9d8;
  }
  .blocked-overlay__domain {
    color: #ffd479;
    text-shadow: 0 0 6px currentColor;
  }
  .blocked-overlay__feedback {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: #7dfba0;
  }
  .blocked-overlay__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  .blocked-overlay__button {
    all: unset;
    cursor: pointer;
    padding: 0.5rem 1.25rem;
    border: 1px solid #2f6b45;
    border-radius: 0.25rem;
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
  /** "Yes": the caller reports the attempt and hands the page over (M2.T10). */
  readonly onProceed: () => void;
  /** "No": the caller reports the refusal and tries to go back. */
  readonly onGoBack: () => void;
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
          Stay focused
        </h1>
        {dismissed ? (
          <p className="blocked-overlay__feedback" id="blocked-overlay-message">
            Great! Keep focusing!
          </p>
        ) : (
          <>
            <p className="blocked-overlay__message" id="blocked-overlay-message">
              You put <span className="blocked-overlay__domain">{domain}</span> on your blocklist.
              Are you sure you want to access it?
            </p>
            <div className="blocked-overlay__actions">
              <button
                type="button"
                className="blocked-overlay__button blocked-overlay__button--danger"
                onClick={onProceed}
              >
                Yes
              </button>
              <button type="button" className="blocked-overlay__button" onClick={onGoBack}>
                No
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
