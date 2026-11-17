import { i18n } from '#i18n';
import { CityFallback } from './CityFallback';
import { describeSummary, useCitySummary } from './use-city-summary';
import { useCityView } from './use-city-view';
import './city-panel.css';

function CityHud() {
  const { live } = useCitySummary();
  if (live === null) return null;
  return (
    <p className="city-hud" aria-hidden="true">
      {i18n.t('city.hud', [String(live.floorsBuilt), String(live.floorsTotal)])}
    </p>
  );
}

/** Announced at milestones (every 10% of the floors) and when a new city starts. */
function CitySummary() {
  const { announced } = useCitySummary();
  return (
    <p className="city-summary" role="status" aria-live="polite">
      {describeSummary(announced)}
    </p>
  );
}

/**
 * The City tab's picture: a stage that shows a loading line at once and while
 * the 3D view loads, then the 3D view (or the text city with a note where
 * WebGL2 is missing or lost), the HUD line
 * over it, and a screen-reader summary beside it. The canvas is not
 * focusable and orbiting with the pointer is optional, so there is no keyboard
 * trap and nothing to operate without a mouse.
 */
export interface CityPanelProps {
  /** The full-city page (CR6.T11): the stage fills the window and the camera is free. */
  readonly full?: boolean;
}

export function CityPanel({ full = false }: CityPanelProps) {
  // Without WebGL2 the 3D chunk is never requested; if it fails later, the view reports it.
  const [view, onUnavailable] = useCityView();
  return (
    <>
      <div className={full ? 'city-stage city-stage--full' : 'city-stage'} role="img" aria-label={i18n.t('city.canvasAriaLabel')}>
        {view.kind === 'ready' ? (
          <view.View onUnavailable={onUnavailable} freeCamera={full} probe={view.probe} />
        ) : view.kind === 'checking' ? (
          <p className="city-view__message" aria-hidden="true">{i18n.t('city.loading')}</p>
        ) : (
          <CityFallback />
        )}
        <CityHud />
      </div>
      {view.kind === 'unavailable' ? <p className="city-note">{i18n.t('city.fallbackNote')}</p> : null}
      <CitySummary />
    </>
  );
}
