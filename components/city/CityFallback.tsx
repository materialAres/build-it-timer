import { useMemo } from 'react';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { renderSkyline } from '@/lib/city/plan/plan-skyline';

/**
 * The city as text (CR6.T8b), shown where the 3D view cannot run: the same
 * plan and the same visible floors as `CityView3D`. It is part of the stage,
 * which already carries the label and the screen-reader summary, so it is
 * hidden from assistive technology itself.
 */
export function CityFallback() {
  const plan = useAppStore(selectCityPlan);
  const visible = useAppStore(selectVisibleFloors);
  const rows = useMemo(() => (plan === null ? [] : renderSkyline(plan, visible)), [plan, visible]);
  return (
    <pre className="city-fallback" aria-hidden="true">
      {rows.join('\n')}
    </pre>
  );
}
