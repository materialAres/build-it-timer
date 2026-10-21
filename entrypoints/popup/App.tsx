import {
  useAppStore,
  selectActiveTab,
  selectTimerStatus,
  type PopupTab,
} from '@/store';
import { PopupTabs, tabButtonId, tabPanelId } from '@/components/common/PopupTabs';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { TimerControls } from '@/components/timer/TimerControls';
import { DurationPicker } from '@/components/timer/DurationPicker';
import { useTimerTickEmitter } from '@/components/timer/use-timer-tick-emitter';
import { useCountdownEstimate } from '@/components/timer/use-countdown-estimate';
import { CityCanvas } from '@/components/city/CityCanvas';
import { ExportCityButton } from '@/components/city/ExportCityButton';
import { ScoreBadge } from '@/components/score/ScoreBadge';
import { PopulationCounter } from '@/components/score/PopulationCounter';
import { SessionHistory } from '@/components/score/SessionHistory';
import { PresetPicker } from '@/components/blocklist/PresetPicker';
import { TagEditor } from '@/components/blocklist/TagEditor';
import { SiteList } from '@/components/blocklist/SiteList';
import './App.css';

/**
 * The popup's section content (M3.T4). Each section is a pure composition of
 * the components owned by the earlier tasks: none of them computes anything,
 * they read the store through granular selectors and invoke store actions.
 */
function TimerSection() {
  return (
    <div className="popup-section popup-section--timer">
      <TimerDisplay />
      <TimerControls />
      <DurationPicker />
    </div>
  );
}

function CitySection() {
  const status = useAppStore(selectTimerStatus);

  return (
    <div className="popup-section popup-section--city">
      <CityCanvas />
      {/* The export is offered once the session has ended, not while it runs
          (M3.T4): `completed` is the status M3.T3c introduced for exactly this
          signal, so a finished city can be saved without exposing the button
          mid-session. */}
      {status === 'completed' && <ExportCityButton />}
    </div>
  );
}

function ScoreSection() {
  return (
    <div className="popup-section popup-section--score">
      <div className="popup-section__row">
        <ScoreBadge />
        <PopulationCounter />
      </div>
      <SessionHistory />
    </div>
  );
}

function BlocklistSection() {
  return (
    <div className="popup-section popup-section--blocklist">
      <PresetPicker />
      <TagEditor />
      {/* One instance per list: `SiteList` is generic over the list it edits
          (M3.T3), so the blocklist and the allowlist are two mounts. */}
      <SiteList list="blocklist" />
      <SiteList list="allowlist" />
    </div>
  );
}

const SECTIONS: Readonly<Record<PopupTab, () => React.JSX.Element>> = {
  timer: TimerSection,
  city: CitySection,
  blocklist: BlocklistSection,
  score: ScoreSection,
};

function App() {
  const activeTab = useAppStore(selectActiveTab);
  const Section = SECTIONS[activeTab];

  // The popup owns the fine-grained 2s tick (M3.T3b): it is the context that is
  // active while the user watches the city.
  useTimerTickEmitter();
  // The popup also owns the displayed countdown estimate (I001): the background
  // never rewrites `remainingSeconds` while the session runs.
  useCountdownEstimate();

  return (
    <div className="popup">
      <PopupTabs />
      <div
        id={tabPanelId(activeTab)}
        className="popup-panel"
        role="tabpanel"
        aria-labelledby={tabButtonId(activeTab)}
        tabIndex={0}
      >
        <Section />
      </div>
    </div>
  );
}

export default App;
