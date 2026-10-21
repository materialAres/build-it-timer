import { i18n } from '#i18n';
import { useState } from 'react';
import { selectCityLayers, selectCityThemeId, useAppStore } from '@/store';
import {
  DEFAULT_THEME_ID,
  getThemeById,
} from '@/lib/city/theme-registry';
import {
  exportCityImage,
  type ImageFormat,
} from '@/lib/city/export-image';
import type { RasterizedCityImage } from '@/lib/city/rasterize-image';
import type { Result } from '@/utils/result';
import { createLogger, type Logger } from '@/utils/logger';
import type { CityLayers, Theme } from './city.types';
import { FALLBACK_THEME } from './CityCanvas';

const defaultLogger = createLogger('popup:export-city');

/**
 * Injected boundary (principle D/L): the production default serializes and
 * rasterizes the real city, while a test substitutes a spy so it can assert the
 * component handed it the current grid and theme without touching a canvas.
 */
export type CityImageExporter = (
  layers: CityLayers,
  theme: Theme,
  format: ImageFormat,
) => Promise<Result<RasterizedCityImage>>;

export interface ExportCityButtonProps {
  readonly exporter?: CityImageExporter;
  /** Diagnostics sink (M4.T3e); defaults to scope `popup:export-city`. */
  readonly logger?: Logger;
}

const EXPORT_CITY_STYLES = `
  .export-city {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .export-city__button {
    padding: 0.3rem 0.7rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: #7dfba0;
    cursor: pointer;
    letter-spacing: 0.06em;
    text-shadow: 0 0 4px currentColor;
  }
  .export-city__button:hover {
    background: rgba(125, 251, 160, 0.15);
  }
  .export-city__error {
    margin: 0;
    color: #ff6b6b;
    font-size: 0.75rem;
  }
`;

/** Trigger a client-side download of a data URL at a known boundary (§1.4). */
function triggerDownload(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * Export the finished city as PNG/JPEG (roadmap M3.T8). The component is
 * presentational: it reads the current layers and active theme from the store,
 * then delegates serialization to `lib/city/export-image.ts` and only handles
 * the download and the error state (Separation of Concerns, §1.1). Because the
 * exporter returns a `Result`, a failed export shows a localized message
 * instead of breaking the popup. Strings are resolved through `i18n.t(...)`
 * (M3.T9).
 */
export function ExportCityButton({
  exporter = exportCityImage,
  logger = defaultLogger,
}: ExportCityButtonProps) {
  const layers = useAppStore(selectCityLayers);
  const themeId = useAppStore(selectCityThemeId);
  const theme = getThemeById(themeId ?? DEFAULT_THEME_ID) ?? FALLBACK_THEME;
  const [error, setError] = useState<string | null>(null);

  const handleExport = (format: ImageFormat): void => {
    setError(null);

    const fail = (cause: unknown, message: string): void => {
      logger.error(message, cause, { format });
      setError(i18n.t('city.exportError'));
    };

    try {
      void exporter(layers, theme, format)
        .then((result) => {
          if (!result.ok) {
            fail(result.error, 'city export failed');
            return;
          }
          triggerDownload(result.value.dataUrl, `focus-city.${format}`);
        })
        .catch((error: unknown) => {
          fail(error, 'city export rejected');
        });
    } catch (error: unknown) {
      // A custom exporter can throw before returning a promise. Contain it at
      // the same boundary so a failed export never escapes the popup.
      fail(error, 'city export rejected');
    }
  };

  return (
    <div
      className="export-city"
      role="group"
      aria-label={i18n.t('city.exportAriaLabel')}
    >
      <style>{EXPORT_CITY_STYLES}</style>
      <button
        type="button"
        className="export-city__button"
        onClick={() => {
          handleExport('png');
        }}
      >
        {i18n.t('city.exportPng')}
      </button>
      <button
        type="button"
        className="export-city__button"
        onClick={() => {
          handleExport('jpeg');
        }}
      >
        {i18n.t('city.exportJpeg')}
      </button>
      {error !== null && (
        <p className="export-city__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
