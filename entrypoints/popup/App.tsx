import {
  useAppStore,
  selectActiveTab,
  selectBlocklistAddAllowed,
  selectBlocklistEditable,
  selectTimerStatus,
  type PopupTab,
} from '@/store';
import { i18n } from '#i18n';
import {
  PopupTabs,
  tabButtonId,
  tabPanelId,
} from '@/components/common/PopupTabs';
import { TimerControls } from '@/components/timer/TimerControls';
import { DurationDrum } from '@/components/timer/DurationDrum';
import { useTimerTickEmitter } from '@/components/timer/use-timer-tick-emitter';
import { useCountdownEstimate } from '@/components/timer/use-countdown-estimate';
import { CityPanel } from '@/components/city/CityPanel';
import { CityEmptyHint } from '@/components/city/CityEmptyHint';
import { ExportCityButton } from '@/components/city/ExportCityButton';
import { OpenCityPageButton } from '@/components/city/OpenCityPageButton';
import { ScoreBadge } from '@/components/score/ScoreBadge';
import { PopulationCounter } from '@/components/score/PopulationCounter';
import { SessionHistory } from '@/components/score/SessionHistory';
import { BlocklistSummary } from '@/components/blocklist/BlocklistSummary';
import { PresetPicker } from '@/components/blocklist/PresetPicker';
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
      {/* UI.T9: the drum is the duration picker while idle and the clock in a
          session, so it comes first and Start/Pause/Reset follow it. */}
      <DurationDrum />
      <TimerControls />
      <BlocklistSummary />
    </div>
  );
}

function CitySection() {
  const status = useAppStore(selectTimerStatus);

  return (
    <div className="popup-section popup-section--city">
      <CityPanel />
      <CityEmptyHint />
      <OpenCityPageButton />
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
  const editable = useAppStore(selectBlocklistEditable);
  const addAllowed = useAppStore(selectBlocklistAddAllowed);
  // CR5.T3: idle shows nothing; a running or paused session says what is still
  // possible; a completed one keeps the Reset wording.
  const notice = editable
    ? null
    : i18n.t(addAllowed ? 'blocklist.addOnly' : 'blocklist.locked');

  return (
    <div className="popup-section popup-section--blocklist">
      {notice !== null ? (
        <p className="popup-section__lock" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {/* UI.T1: one list, shown once. CR4: presets (built-in and saved) are
          toggles over it, so there is no separate tag editor. */}
      <SiteList quickAdd={<PresetPicker />} />
    </div>
  );
}

// The heading follows the other section titles (monospace, small, spaced
// capitals). Its style is embedded, like the tab bar's, to keep this task to the
// files it names; M5.T19 fills the section and can move it with its own styles.
const SETTINGS_TITLE_STYLES = `
  .popup-section__title {
    margin: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.85;
  }
`;

function SettingsSection() {
  return (
    <div className="popup-section popup-section--settings">
      <style>{SETTINGS_TITLE_STYLES}</style>
      <h2 className="popup-section__title">{i18n.t('settings.title')}</h2>
    </div>
  );
}

const SECTIONS: Readonly<Record<PopupTab, () => React.JSX.Element>> = {
  timer: TimerSection,
  city: CitySection,
  blocklist: BlocklistSection,
  score: ScoreSection,
  settings: SettingsSection,
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
