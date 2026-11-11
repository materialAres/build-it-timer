import { lazy, Suspense } from 'react';
import { i18n } from '#i18n';
import { describeSummary, useCitySummary } from './use-city-summary';

// The dynamic import is what makes the three.js chunk: only the City tab mounts this.
const CityView3D = lazy(() => import('./CityView3D'));

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
 * The City tab's picture: a stage that keeps its size while the 3D view loads,
 * the HUD line over it, and a screen-reader summary beside it. The canvas is not
 * focusable and orbiting with the pointer is optional, so there is no keyboard
 * trap and nothing to operate without a mouse.
 */
export function CityPanel() {
  return (
    <>
      <div className="city-stage" role="img" aria-label={i18n.t('city.canvasAriaLabel')}>
        <Suspense fallback={<p className="city-view__message" aria-hidden="true">{i18n.t('city.loading')}</p>}>
          <CityView3D />
        </Suspense>
        <CityHud />
      </div>
      <CitySummary />
    </>
  );
}
