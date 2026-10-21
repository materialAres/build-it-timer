import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '#i18n';
import { createLogger, type Logger } from '@/utils/logger';

/**
 * Popup error boundary (M4.T3d). React only catches render/lifecycle errors
 * with a class component, hence the class despite the rest of the popup being
 * function components.
 *
 * Scope limit: event-handler and async/promise errors do not pass through
 * `componentDidCatch`; those boundaries are owned by the message bus (M4.T3b),
 * the store (M4.T3c) and the content/export paths (M4.T3e).
 */
const defaultLogger = createLogger('popup:error-boundary');

const ERROR_BOUNDARY_STYLES = `
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 12rem;
    padding: 1rem;
    background: #050805;
    color: #e6e6e6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .error-boundary__panel {
    box-sizing: border-box;
    width: 100%;
    max-width: 26rem;
    padding: 1rem;
    border: 1px solid #8c3b3b;
    border-radius: 0.5rem;
    background: #140b0b;
    box-shadow: 0 0 1.5rem rgba(255, 155, 155, 0.2);
  }
  .error-boundary__title {
    margin: 0 0 0.75rem;
    color: #ff9b9b;
    font-size: 1rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .error-boundary__body {
    margin: 0 0 1rem;
    line-height: 1.5;
  }
  .error-boundary__button {
    padding: 0.4rem 1rem;
    border: 1px solid #7dfba0;
    border-radius: 0.25rem;
    background: transparent;
    color: #7dfba0;
    font: inherit;
    cursor: pointer;
  }
  .error-boundary__button:focus-visible {
    outline: 2px solid #7dfba0;
    outline-offset: 2px;
  }
`;

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Logger for the caught error; defaults to `popup:error-boundary`. */
  readonly logger?: Logger;
  /** Test/future integration hook called with the original error and stack. */
  readonly onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Recovery strategy. When provided, the fallback button calls it and clears
   * the boundary instead of reloading the page, which makes the reset path
   * deterministic in tests and leaves room for a future non-reload strategy.
   */
  readonly onReset?: () => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const logger = this.props.logger ?? defaultLogger;
    logger.error('popup component failed', error, {
      componentStack: info.componentStack ?? null,
    });
    this.props.onError?.(error, info);
  }

  private readonly handleReload = (): void => {
    if (this.props.onReset) {
      // Run the hook first so a child that stops throwing can render on the
      // same update that clears the error state.
      this.props.onReset();
      this.setState({ hasError: false });
      return;
    }

    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="error-boundary"
        role="alert"
        aria-labelledby="error-boundary-title"
        aria-describedby="error-boundary-body"
      >
        <style>{ERROR_BOUNDARY_STYLES}</style>
        <div className="error-boundary__panel">
          <h1 className="error-boundary__title" id="error-boundary-title">
            {i18n.t('common.errorTitle')}
          </h1>
          <p className="error-boundary__body" id="error-boundary-body">
            {i18n.t('common.errorBody')}
          </p>
          <button
            type="button"
            className="error-boundary__button"
            onClick={this.handleReload}
          >
            {i18n.t('common.reload')}
          </button>
        </div>
      </div>
    );
  }
}
