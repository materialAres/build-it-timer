import { useMemo, useState } from 'react';
import { i18n } from '#i18n';
import { selectCityPlan, selectVisibleFloors, useAppStore } from '@/store';
import { summarizePlan, type PlanSummary } from '@/lib/city/plan/plan-summary';
import type { CityPlan } from '@/lib/city/plan/city-plan.types';

interface Held {
  readonly plan: CityPlan | null;
  readonly summary: PlanSummary | null;
}

/** The sentence a screen reader gets; plural-neutral so one wording fits every count. */
export function describeSummary(summary: PlanSummary | null): string {
  if (summary === null || summary.floorsBuilt === 0) return i18n.t('city.summaryEmpty');
  const head = i18n.t('city.summary', [
    String(summary.floorsBuilt),
    String(summary.floorsTotal),
    String(summary.buildings),
  ]);
  const tallest =
    summary.tallestName === null
      ? i18n.t('city.summaryTallest', [String(summary.tallestLevels)])
      : i18n.t('city.summaryTallestNamed', [summary.tallestName, String(summary.tallestLevels)]);
  return `${head} ${tallest}`;
}

/**
 * What is standing, from the plan and the score (CR6.T8a). `live` follows every
 * floor, for the HUD line; `announced` changes only when the milestone (steps of
 * 10% of the floors) or the session changes, so a live region does not chatter
 * once per floor.
 */
export function useCitySummary(): { live: PlanSummary | null; announced: PlanSummary | null } {
  const plan = useAppStore(selectCityPlan);
  const visible = useAppStore(selectVisibleFloors);
  const live = useMemo(() => (plan === null ? null : summarizePlan(plan, visible)), [plan, visible]);
  const [held, setHeld] = useState<Held>({ plan, summary: live });
  if (held.plan !== plan || held.summary?.milestone !== live?.milestone) {
    setHeld({ plan, summary: live });
  }
  return { live, announced: held.plan === plan ? held.summary : live };
}
