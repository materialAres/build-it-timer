import { i18n } from '#i18n';
import { selectBuiltCharacters, selectTimerStatus, useAppStore } from '@/store';

/**
 * Tells a user who has not built anything yet how the city comes to life. It
 * leaves as soon as a session runs or a city exists, so it never competes with
 * the canvas itself.
 */
export function CityEmptyHint() {
  const status = useAppStore(selectTimerStatus);
  const built = useAppStore(selectBuiltCharacters);

  if (status !== 'idle' || built > 0) return null;
  return <p className="city-empty-hint">{i18n.t('city.emptyHint')}</p>;
}
