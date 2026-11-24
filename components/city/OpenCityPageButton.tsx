import { useState } from 'react';
import { i18n } from '#i18n';
import { openExtensionPage } from '@/lib/browser/open-extension-page';
import { createLogger, type Logger } from '@/utils/logger';
import type { Result } from '@/utils/result';

const defaultLogger = createLogger('popup:open-city-page');

export interface OpenCityPageButtonProps {
  /** Injected so a test needs no browser; defaults to opening the extension page. */
  readonly opener?: (path: string) => Promise<Result<void>>;
  readonly logger?: Logger;
}

/** The extension page that shows the whole city (CR6.T11, `entrypoints/city/`). */
export const CITY_PAGE_PATH = '/city.html';

/**
 * "View full city": opens the full-city page in a new tab. Presentation only;
 * a failure is logged and shown as a short localized message.
 */
export function OpenCityPageButton({
  opener = (path) => openExtensionPage(path),
  logger = defaultLogger,
}: OpenCityPageButtonProps) {
  const [failed, setFailed] = useState(false);

  const open = (): void => {
    setFailed(false);
    void opener(CITY_PAGE_PATH).then((result) => {
      if (result.ok) return;
      logger.error('city page could not be opened', result.error);
      setFailed(true);
    });
  };

  return (
    <div className="open-city-page">
      <button type="button" className="open-city-page__button" onClick={open}>
        {i18n.t('city.openFull')}
      </button>
      {failed ? (
        <p className="open-city-page__error" role="alert">
          {i18n.t('city.openError')}
        </p>
      ) : null}
    </div>
  );
}
