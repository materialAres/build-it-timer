# build-it-timer — core

WXT MV3 browser extension ("Build-it! Timer Focus"): a focus-session timer that grows an ASCII city, blocks distracting domains during a session, and scores the session. Single TypeScript package — no separate deployable modules.

## Source map
- `entrypoints/` — `background.ts` (orchestrator), `blocked-overlay.content.tsx` (Shadow-DOM overlay), `popup/` (React UI).
- `store/` — Zustand store composed of `*.slice.ts` factories, `storage-adapter.ts` (persist adapter + self-write tracking), `sync-storage.ts` (`attachStoreSync`).
- `lib/` — pure domain logic (`url/`, `blocking/`, `timer/`, `city/`, `score/`, `messaging/`); only `lib/timer/alarm-adapter.ts` touches `browser.alarms`.
- `components/` — presentational React (`timer/`, `city/`, `blocklist/`, `score/`, `common/`).
- `utils/` — logger, duration formatting, hash, `Result`.
- `tests/` — unit · integration · e2e · helpers; unit tests mirror the source tree.
- `docs/` — `roadmap-en.md` (authoritative task cards), `changelog.md` (mandatory per-task record), `store-analysis.md`, `issue/`.
- `locales/en.yml` (default) + `locales/it.yml`.
- `.github/copilot-instructions.md` — binding design/testing/changelog rules; consult before implementing a roadmap task.

## Invariants
- **Three worlds, typed messages only**: background / content script / popup never import each other's modules; they exchange `RuntimeMessage` variants (`lib/messaging/messages.types.ts`) via `sendMessage`/`onMessage` (`lib/messaging/bus.ts`).
- **Single writer = background.** The popup builds its store with `createAppStore({ readOnly: true })`; components call `request*` actions that send a `MutationMessage`, applied by `lib/messaging/apply-mutation.ts`. The popup converges through `attachStoreSync` (`storage.onChanged` → `persist.rehydrate()`; self-writes skipped via `SELF_WRITE`).
- **Pure core**: `lib/` functions receive clock/RNG/seed as parameters — no internal `Date.now()`/`Math.random()`. Collaborators are injected through slice factories (`StoreDependencies`) and ports (`AlarmProvider`, growth/rule appliers).
- **One city per session**, reset on the idle→running transition only; pause/resume keeps the built city.
- **Growth derives from cumulative `timer.focusedMs`** with the persisted wall-clock checkpoint `timer.lastAccountedAt` (not sampled ticks), so catch-up after popup close / worker restart is idempotent. Malus converts `distractedMs` at the same session cadence.
- **DNR**: blocklist → dynamic rules installed only while `status === 'running'`; there is a single blocklist (the allowlist was removed by CR1). The empty but enabled static ruleset (`public/rules/empty-rule-set.json`) must stay declared — Firefox ≤132 drops dynamic rules on restart without it.
- **Distraction tracking**: `TabDistractionTracker` seeds open tabs once and otherwise follows `tabs.onUpdated`/`onRemoved`, so it must be `refresh()`ed when the timer enters `running` — the construction-time seed runs while the store is idle, and a tab already open on a blocked site never emits an update. Malus accrual starts at the overlay's "Yes" (pre-`proceed` time is forgiven).
- **Persist**: key `timer-focus-store`, `version: 2`, payload `{ timer, city, blocklist: { blocklist, customTags }, score, sessionHistory }`; `partialize` excludes `ui`; keep the slice-aware `merge` so fields added later rehydrate to their default instead of `undefined`.
- **Both build targets are MV3**; Firefox gets a `background.scripts` event page instead of a service worker. Permissions are declared manually in `wxt.config.ts` (WXT does not infer them).
- **Blocklist (single list, CR1 complete)**: the allowlist was removed end-to-end — popup UI/locales (CR1.T1), mutation protocol (CR1.T2), persisted data migrated to `{ blocklist, customTags }` at version 2 (CR1.T3), enforcement (`buildDnrRules(blocklist)`, `isDomainBlocked({ blocklist })`, CR1.T4), production state model (CR1.T5a) and tests (CR1.T5b/T5c). `BlocklistState` is exactly `{ blocklist, customTags }`; helpers/actions take no list name. **Never reintroduce a second list or a precedence rule.** The only runtime reader of the legacy field is `lib/blocking/legacy-blocklist.ts` (`migrateBlocklistState`); raw version-1 JSON fixtures remain only in the `legacy-blocklist`, `store-snapshot`, `blocked-overlay`, `store` and `dnr-rules` tests.

## Related memories
- Language/framework versions and toolchain: `mem:tech_stack`.
- Commands to develop, build, test: `mem:suggested_commands`.
- Code style, slice/component patterns, test layout: `mem:conventions`.
- Definition of done (checks + changelog + no commits): `mem:task_completion`.