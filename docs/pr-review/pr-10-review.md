# PR #10 — Review report and fix plan

> PR: `feat(M6): security hardening of urls, messages and overlay` (`feat/milestone-6-security` → `main`), open.
> Review: done in the agent session with the `review-pr` skill and posted as a PR comment (https://github.com/materialAres/build-it-timer/pull/10#issuecomment-7215828618), made on 2026-11-27 at `af467c5`. At that commit `bun run compile` was clean and `bun run test` passed 2119/2119. Lint, builds and e2e were not run.

## Progress (2026-11-28)

| Task | Result | Commit |
|---|---|---|
| PR10.T1 | Done | `c52cf6b` |
| PR10.T2 | Done | `1a0d9d7` |
| PR10.T3 | Done | `e92223f` |
| PR10.T4 | Done | `43b27f6` |
| PR10.T5 | Done | `4c5a415` |
| PR10.T5b | Done | `ca1e646` |
| PR10.T6 | Done | `d780bfb` |
| PR10.T7 | Done | `f7c6876` |
| PR10.T8 | Done | — (its own commit cannot hold its hash) |

## 1. Review summary

Milestone 6 hardens four trust boundaries:

- **M6.T2:** URL normalization uses the WHATWG `URL` parser, accepts only http(s) and converts IDN to punycode.
- **M6.T3:** only canonical domains reach a DNR `urlFilter`.
- **M6.T1:** every bus receiver checks `sender.id` and rebuilds the message through typed runtime guards.
- **M6.T4:** the blocked-site overlay ignores script-fired clicks and remounts when its host is removed.

The review found M6.T2, T3 and T1 solid, and asked for changes because a hostile page can still defeat the M6.T4 remount. It also found two maintainability points, a stale changelog hash and two nits.

### Findings and verification

| # | Severity | Finding | Status on `feat/milestone-6-security` (`af467c5`) | Task |
|---|---|---|---|---|
| F1 | Major | A page element with the overlay's id blocks the mount and the remount | Still present: `host()` uses `getElementById` (`entrypoints/blocked-overlay.content.tsx:156`), read by the watcher (`:175`) and by `mount` (`:200`) | PR10.T3 |
| F2 | Major | The page can empty the open shadow root and nothing remounts the overlay | Still present: `attachShadow({ mode: 'open' })` (`:206`); the observer watches only `document.documentElement` (`:181`) | PR10.T4 |
| F3 | Minor | Mutations are accepted from content-script senders | Still present: the only provenance check is `sender.id` (`lib/messaging/bus.ts:83`); the mutation loop adds none (`entrypoints/background.ts:620`) | PR10.T5, PR10.T5b |
| F4 | Minor | The overlay content script is over the §1.2 size limits | Still present: 303 lines; `startBlockedOverlay` spans lines 121–292 | PR10.T2 |
| F5 | Minor | The M6.T4 commit hash is missing in the changelog and the memory | Still present: `docs/changelog.md:207` reads `— (to be committed)`; `.serena/memories/core.md` says "uncommitted at writing" | PR10.T1 |
| F6 | Nit | The `PLAY_SOUND` parser does not read its fields through `own()` | Still present: `lib/messaging/message-guards.ts:150–154` | PR10.T6 |
| F7 | Nit | The `as RuntimeMessage` cast in `parseUnsafe` has no comment | Still present at `message-guards.ts:166,172`. The cast in `bus.ts:93` already has one, so only `message-guards.ts` needs a change | PR10.T7 |

## F1 — A decoy element defeats the overlay

### Root cause

`startBlockedOverlay` finds its host with `document.getElementById(HOST_ID)` (`blocked-overlay.content.tsx:156–157`; `HOST_ID` is `'buildit-blocked-overlay'`, `:16`). The page controls the ids in its own DOM:

- `mount` (`:200`) returns early when an element with that id exists. If the page ships `<div id="buildit-blocked-overlay">` in its HTML, the overlay never appears, because content scripts run at `document_idle`, after the page's HTML is in the DOM.
- The watcher (`:175`) remounts only when no element with that id is left. If the page adds a decoy and then removes the real host, nothing remounts.
- `unmount` (`:170`) removes `host()`, which can be the page's decoy instead of the real host.

### Consequences

The page can get rid of the overlay without the user's answer, so the M6.T4 criterion "the overlay mounts again as soon as the page removes its host element" can be bypassed. The score is not affected, because the background measures distraction from the tab URL.

### Why the existing tests do not catch it

`tests/integration/content/blocked-overlay-hardening.test.ts` (describe *"the page cannot get rid of the overlay"*) removes the host or replaces `document.body`, but never adds an element with the same id.

### Fix direction

Recognize the host by **who created it**, not by its id (decision D5). The content script keeps a module-level `WeakSet<HTMLElement>` of the hosts it created. The page cannot write to it, because content scripts run in an isolated world. The host is a connected element with id `HOST_ID` that is in that set. A decoy is ignored, and two script instances on one page still produce a single overlay: the test *"mounts a single overlay when the script runs twice on the same page"* (`tests/integration/content/blocked-overlay.test.ts:168`) stays unchanged.

## F2 — The open shadow root can be emptied

The shadow root is `open` (`:206`), so the page can reach it through `host.shadowRoot`. `host.shadowRoot.replaceChildren()` removes the overlay but keeps the host. The `MutationObserver` watches only the light DOM (`document.documentElement`, `:181`), so it does not see the change and the overlay is not remounted. The M6.T4 card's audit reference names the open shadow root as part of the problem. Its out-of-scope list covers covering the overlay or hiding it with inline styles, not removing it.

**Fix direction (decision D1):** keep `mode: 'open'`, also observe the shadow root, and treat a shadow root with no `.blocked-overlay` element (the component's root, `components/common/BlockedOverlay.tsx:125–126`) as a removal.

## F3 — Mutations are accepted from content-script senders

`onMessage` (`lib/messaging/bus.ts:77–93`) checks only `sender.id === browser.runtime.id`. A content script has the extension's id and a `sender.tab`, so it passes. The background's mutation loop (`entrypoints/background.ts:620–630`) adds no other check, so `TIMER_RESET`, `BLOCKLIST_REMOVE_SITE` and the other `MUTATION_TYPES` are accepted from a tab. Content scripts share a renderer process with the hostile page (threat-model boundary 2 of the roadmap). The M6.T1 card asks only for the `sender.id` check, so this is not a criterion miss.

**Fix direction (decision D2):** accept `MUTATION_TYPES` only from extension pages: a `sender.url` that starts with the extension's origin (`browser.runtime.getURL('/')`). The review also suggested "no `sender.tab`"; decision D6 dropped that condition. The passive `SITE_BLOCKED_ATTEMPT`, which the overlay sends from a tab, is not a mutation and stays allowed. The full-city page (`entrypoints/city/`) opens in a tab but uses the read-only store (`entrypoints/city/main.tsx:10–11`) and sends no mutation, so it is not affected.

## F4 — Overlay content script size

`entrypoints/blocked-overlay.content.tsx` is 303 lines, and `startBlockedOverlay` spans lines 121–292, about 170 lines. The §1.2 limits are 200 lines per file and 40 per function. The file was already over the limits before this PR, and M6.T4 added about 30 lines. **Fix direction (decision D3):** first extract the watcher into `lib/browser/host-watcher.ts`, next to `open-extension-page.ts`, so the F1/F2 fixes land in the small module.

## F5 — Changelog and memory do not record the M6.T4 commit

The Completed tasks summary row for M6.T4 (`docs/changelog.md:207`) reads `— (to be committed)`, but the commit `af467c5` (`feat(M6): harden the blocked overlay (M6.T4)`) is part of this PR. The Milestone 6 bullet of `.serena/memories/core.md` says "M6.T4 done 2026-11-26 (uncommitted at writing; …)".

## F6 — `PLAY_SOUND` parser bypasses `own()`

Every parser in `PAYLOAD_PARSERS` reads fields with `own(payload, key)`, so an inherited property is not a field. `PLAY_SOUND` (`message-guards.ts:150–154`) calls `isSoundPlayRequest(payload)` and then destructures `payload`. `isSoundPlayRequest` (`lib/sound/sound-player.ts:28–34`) also destructures, which reads inherited properties. This is harmless for structured-clone input, but inconsistent with the rest of the module.

## F7 — Uncommented cast in `parseUnsafe`

`parseUnsafe` casts `PAYLOAD_PARSERS[type as MessageType] as (fields: Fields) => …` (`message-guards.ts:166`) and `ok({ type, payload: parsed } as RuntimeMessage)` (`:172`). The casts are sound: the table is keyed by `type`, so the parser and the payload belong to the same variant. But the M6.T1 card says "never `as RuntimeMessage`", and no comment explains why this cast is safe. `bus.ts:93` already has such a comment ("The guard is keyed by `type`, so the variant is the one registered for."), so no change is needed there.

## 2. Decisions

- **D1 — F2 fix (2026-11-27).** Observe the shadow root and remount when its `.blocked-overlay` element is gone. The shadow root stays `open`, so the overlay tests that read `host.shadowRoot` keep working.
- **D2 — F3 planned here (2026-11-27).** F3 gets tasks in this document (PR10.T5, PR10.T5b), not a separate roadmap card.
- **D3 — F4 first, in `lib/browser/` (2026-11-27).** The watcher is extracted into `lib/browser/host-watcher.ts` before the F1/F2 fixes. It cannot live in `entrypoints/`, because WXT treats every file there as an entrypoint.
- **D4 — Nits get tasks (2026-11-27).** F6 and F7 get one task each.
- **D5 — F1 host recognition (2026-11-27).** A module-level `WeakSet` of the hosts the script created, rather than a per-instance reference. Both ignore decoys. The `WeakSet` also keeps exactly one overlay when two instances run on one page. With per-instance references, two overlays would stack, each with its own watcher and answered state.
- **D6 — Extension pages in a tab are accepted (2026-11-27).** While doing PR10.T5b, 7 e2e tests failed: the e2e suite opens `popup.html` with `page.goto`, so the popup has a `sender.tab`, and the rule "no `sender.tab`" ignored its messages. Confirmed by removing the condition, rebuilding and re-running the sound specs. The user chose to drop it: a content script's `sender.url` is the web page's, never an extension URL, so the URL prefix alone excludes content scripts, and an extension page in a tab is still extension code. This changes the review's suggestion and the PR10.T5 predicate (committed in `4c5a415`), which PR10.T5b amends.

## 3. Tasks

Task IDs are local to this document (`PR10.Tn`). Do them one at a time, in order. Code tasks follow the red/green/refactor rule of CLAUDE.md §3.1, and each task records its entry with the `changelog` skill in the "PR reviews" section of `docs/changelog.md` (`Commit: —` until committed). Line numbers are those at `af467c5`. Earlier tasks shift them, so find the symbols with Serena (CLAUDE.md §0).

### PR10.T1 — Record the M6.T4 commit hash (F5)

- **Status:** done (`c52cf6b`).
- **Files:** `docs/changelog.md`, `.serena/memories/core.md`.
- **Work:**
  - In `docs/changelog.md`, the Completed tasks summary row `| M6.T4 | Content-script overlay hardening against the host page | completed | — (to be committed) |` gets the commit `` `af467c5` ``.
  - In the Milestone 6 bullet of `.serena/memories/core.md`, `**M6.T4 done 2026-11-26** (uncommitted at writing; 2119 tests/141 files, e2e 13)` becomes `**M6.T4 done 2026-11-26** (`af467c5`; 2119 tests/141 files, e2e 13)`. Edit the memory with Serena (`s.mem.edit_memory`).
  - Add this task's entry to the "PR reviews" section with the `changelog` skill.
- **Acceptance criteria:**
  - `grep -n "to be committed" docs/changelog.md` shows no M6.T4 row.
  - The `core.md` Milestone 6 bullet names `af467c5` for M6.T4 and no longer says "uncommitted".
  - No other line of either file changes, apart from the new changelog entry.
- **Notes:** do not touch other `— (to be committed)` rows. They belong to other tasks.

### PR10.T2 — Extract the overlay host watcher into `lib/browser/host-watcher.ts` (F4)

- **Status:** done (`1a0d9d7`).
- **Size:** about 140 changed lines, so at most 4 files.
- **Files:** `lib/browser/host-watcher.ts` (new), `tests/unit/lib/browser/host-watcher.test.ts` (new), `entrypoints/blocked-overlay.content.tsx`, `docs/changelog.md`.
- **Current behavior:** `startBlockedOverlay` owns a `MutationObserver` inline (`blocked-overlay.content.tsx:159–182`: `let hostWatcher`, `watchHost`, and the `disconnect` in `unmount`). On any `childList` change under `document.documentElement` it checks `!ctx.isValid || host() !== undefined`, and otherwise calls `unmount(); evaluate();`.
- **Wanted behavior:** the same, with the observer in its own module. **No behavior change.**
- **Work:**
  - Red first (§3.1): write `tests/unit/lib/browser/host-watcher.test.ts`, then the module. The test environment is already `happy-dom` (`vitest.config` `environment`).
  - `lib/browser/host-watcher.ts` exports:
    ```ts
    export interface HostWatcherOptions {
      /** Every node whose subtree is watched (`childList`, `subtree`). */
      readonly targets: readonly Node[];
      /** Asked after each batch of mutations. */
      readonly isLost: () => boolean;
      /** Called when `isLost()` is true. */
      readonly onLost: () => void;
    }
    export interface HostWatcher {
      readonly disconnect: () => void;
    }
    export function createHostWatcher(options: HostWatcherOptions): HostWatcher;
    ```
    One `MutationObserver` observes every target with `{ childList: true, subtree: true }`. Its callback calls `onLost()` only when `isLost()` returns `true`. `disconnect()` stops it, and calling it twice is safe.
  - In `blocked-overlay.content.tsx`, replace `watchHost` with `createHostWatcher({ targets: [document.documentElement], isLost: () => ctx.isValid && host() === undefined, onLost: () => { unmount(); evaluate(); } })`. Keep the existing comment's *why* (a page that removes the host would otherwise hide the overlay until the next storage change; the watcher is alive only while mounted). `unmount` still disconnects it first.
- **Acceptance criteria:**
  - Unit tests in `host-watcher.test.ts` (describe *"createHostWatcher (PR10.T2)"*):
    - a child removed under a target with `isLost` → `true` calls `onLost` once;
    - with `isLost` → `false`, `onLost` is not called;
    - after `disconnect()`, a mutation does not call `onLost`;
    - every node in `targets` is watched (a mutation under the second target is seen).
  - `tests/integration/content/blocked-overlay-hardening.test.ts` and `tests/integration/content/blocked-overlay.test.ts` pass **unchanged**.
  - `blocked-overlay.content.tsx` no longer references `MutationObserver`.
  - `bun run compile`, `bun run lint` and `bun run test` are green.
- **Notes:** this is a refactor. If an existing overlay test needs a change to pass, stop and report it. Do not fix F1 or F2 here.

### PR10.T3 — Recognize the overlay host by a private registry, not by its id (F1)

- **Status:** done (`e92223f`).
- **Depends on:** PR10.T2.
- **Files:** `entrypoints/blocked-overlay.content.tsx`, `tests/integration/content/blocked-overlay-hardening.test.ts`, `docs/changelog.md`.
- **Current behavior:** `host()` returns `document.getElementById(HOST_ID)`, so an element the page creates with the id `buildit-blocked-overlay` counts as the overlay. It blocks `mount`, stops the remount, and is the element `unmount` removes.
- **Wanted behavior:** only a host this content script created counts (decision D5).
- **Work:**
  - Red first (§3.1): add the tests below to the describe *"the page cannot get rid of the overlay"* and watch them fail.
  - Add a module-level `const ownHosts = new WeakSet<HTMLElement>();` with a comment on the *why*: the page shares the DOM but cannot reach the content script's variables, so ids can be forged and membership of this set cannot.
  - `host()` returns the first element of `document.querySelectorAll<HTMLElement>(`#${HOST_ID}`)` that is in `ownHosts`, or `undefined`.
  - `mount` adds the created element to `ownHosts` before appending it.
  - Nothing else changes: `unmount` keeps calling `host()?.remove()`, which now never removes a decoy.
  - The test file's `host()` helper uses `getElementById` and would return the decoy. Add a helper that returns the element with id `HOST_ID` that has a `shadowRoot`, and use it in the new tests.
- **Acceptance criteria:**
  - New tests:
    - *"mounts even when the page already holds an element with the overlay id"*: a decoy `<div id="buildit-blocked-overlay">` is in `document.body` before `startBlockedOverlay`, and the overlay still mounts, with `facebook.com` in its shadow root.
    - *"mounts it again when the page adds a decoy and removes the real host"*: the overlay comes back.
    - *"leaves the page's decoy in place on teardown"*: after `teardown()`, the decoy is still in the DOM and no host with a shadow root is left.
  - `blocked-overlay.test.ts` passes unchanged, including *"mounts a single overlay when the script runs twice on the same page"* (`:168`).
  - The other hardening tests pass unchanged.
  - `bun run compile`, `bun run lint` and `bun run test` are green.
- **Notes:** do not change `HOST_ID`. `tests/e2e/session-helpers.ts:15,158` looks the host up by that id.

### PR10.T4 — Remount the overlay when the page empties its shadow root (F2)

- **Status:** done (`43b27f6`).
- **Depends on:** PR10.T2, PR10.T3.
- **Files:** `entrypoints/blocked-overlay.content.tsx`, `tests/integration/content/blocked-overlay-hardening.test.ts`, `docs/changelog.md`.
- **Current behavior:** the watcher observes only `document.documentElement`. `host.shadowRoot.replaceChildren()` removes the overlay, keeps the host, and nothing remounts it.
- **Wanted behavior:** emptying the shadow root counts as losing the overlay (decision D1). The shadow root stays `mode: 'open'`.
- **Work:**
  - Red first (§3.1): add the tests below.
  - In `mount`, pass the new shadow root to the watcher too: `targets: [document.documentElement, shadow]`.
  - `isLost` becomes `ctx.isValid && (host() === undefined || shadow.querySelector('.blocked-overlay') === null)`. `.blocked-overlay` is the component's root (`components/common/BlockedOverlay.tsx:125–126`), rendered in both the question and the "Back to work" state.
  - React's own renders also mutate the shadow root. They must not count as a loss, because `.blocked-overlay` is still there.
  - If `root.unmount()` throws because the page removed React's nodes, catch the error in `unmount` and log it with `logger.error` (§1.4: never an empty `catch`). Then continue removing the host, so the remount still happens.
- **Acceptance criteria:**
  - New tests in *"the page cannot get rid of the overlay"*:
    - *"mounts it again when the page empties the shadow root"*: after `host.shadowRoot.replaceChildren()`, exactly one host with a shadow root containing `facebook.com` exists, and no error escapes the test.
    - *"does not remount on its own renders"*: with `isTrustedEvent: () => true`, clicking "Back to work" leaves exactly one host, showing the encouragement, and `sendAttempt` is called once.
  - The existing hardening and overlay tests pass unchanged.
  - `bun run compile`, `bun run lint` and `bun run test` are green.
- **Notes:**
  - Only a missing `.blocked-overlay` counts as a loss, as the review's fix direction says. Restyling or hiding the overlay from script stays out of scope (M6.T4 card).
  - If happy-dom cannot observe a `ShadowRoot` with `MutationObserver`, stop and report. Do not work around it in the production code.

### PR10.T5 — Pure predicate for extension-page senders (F3)

- **Status:** done (`4c5a415`).
- **Files:** `lib/messaging/extension-page-sender.ts` (new), `tests/unit/lib/messaging/extension-page-sender.test.ts` (new), `docs/changelog.md`.
- **Wanted behavior:** a pure function that tells whether a message comes from one of the extension's own pages (popup, offscreen document), not from a content script.
- **Work:**
  - Red first (§3.1): write the unit test, then the module.
  - Export `isExtensionPageSender(sender: Browser.runtime.MessageSender, extensionOrigin: string): boolean` (`import type { Browser } from 'wxt/browser'`, as in `blocked-attempt-sender.ts`). It returns `true` only when all of these hold (the `sender.tab` condition was dropped, decision D6):
    - `sender.url` is a string;
    - `extensionOrigin` is non-empty and ends with `/`;
    - `sender.url.startsWith(extensionOrigin)`.
  - The origin is a parameter, so the module never calls `browser.*` (§1.1 D). A doc comment gives the *why*: content scripts share a renderer process with the page, so the `sender.id` check alone does not exclude them. Their `sender.url` is the web page's, so the URL prefix tells them apart.
- **Acceptance criteria:** unit tests (describe *"isExtensionPageSender (PR10.T5)"*) with origin `chrome-extension://test-extension-id/`:
  - `{ url: 'chrome-extension://test-extension-id/popup.html' }` → `true`;
  - the same `url` with `tab: { id: 1 }` (an extension page shown in a tab) → `true` (amended by D6; the card first said `false`);
  - a content-script sender `{ tab: { id: 1, url: 'https://evil.com/' }, url: 'https://evil.com/' }` → `false`;
  - no `url` → `false`;
  - another extension `chrome-extension://other-id/popup.html` → `false`;
  - a look-alike prefix `chrome-extension://test-extension-id.evil/popup.html` → `false`;
  - an empty `extensionOrigin` → `false`, even for a popup URL;
  - an origin without a trailing `/` → `false`.

  `bun run compile`, `bun run lint` and `bun run test` are green. No production caller changes in this task.

### PR10.T5b — Accept mutations only from extension pages (F3)

- **Status:** done (`ca1e646`).
- **Depends on:** PR10.T5.
- **Files:** `entrypoints/background.ts`, `tests/helpers/fake-extension-sender.ts`, `tests/integration/messaging/message-hardening.test.ts`, `docs/changelog.md`. Done with more files (D6): also `lib/messaging/extension-page-sender.ts`, `tests/unit/lib/messaging/extension-page-sender.test.ts` and `tests/integration/messaging/bus.test.ts` (its sender assertion now expects the popup `url`), plus this document.
- **Current behavior:** the mutation loop (`entrypoints/background.ts:620–630`) registers `onMessage(type, (message) => { startup.run(() => { applyMutation(message); }); }, busLog)` for every `MUTATION_TYPES` entry, whoever the sender is.
- **Wanted behavior:** a mutation whose sender fails `isExtensionPageSender` is ignored before `startup.run`, with `busLog.warn('ignored a mutation from outside an extension page', { type: message.type })` (type only, never a payload field). Passive messages (`MESSAGE_TYPES`: `TIMER_TICK`, `SITE_BLOCKED_ATTEMPT`) are not affected.
- **Work:**
  - Red first (§3.1): add the tests below.
  - In `startBackground`, compute the origin once: `browser.runtime.getURL('/')`. WXT types the argument to its public paths, so cast it the way `lib/browser/open-extension-page.ts:12` does. The loop handler takes `(message, sender)` and checks `isExtensionPageSender(sender, extensionOrigin)` first.
  - In `tests/helpers/fake-extension-sender.ts`, `installExtensionSender` delivers `{ id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') }`, so the messages tests send through `sendMessage` keep arriving as the popup would send them. Update its doc comment. `deliverAs` and `sendFromTab` stay as they are.
- **Acceptance criteria:**
  - New tests in `message-hardening.test.ts`, describe *"sender provenance"*:
    - *"rejects a mutation sent from a tab (content script)"*: `TIMER_STARTED` delivered with `{ id: fakeBrowser.runtime.id, tab: { id: 1, url: 'https://evil.com/' }, url: 'https://evil.com/' }` leaves `timer.status` at `idle`, and the warn record carries `{ type: 'TIMER_STARTED' }` only.
    - *"accepts a mutation from an extension page shown in a tab"* (amended by D6; the card first asked for a rejection): `TIMER_STARTED` with a popup `url` and a `tab` makes `timer.status` `running`.
    - *"rejects a mutation with no sender url"*: `{ id: fakeBrowser.runtime.id }`.
  - The existing test *"accepts the same message from the extension itself"* passes unchanged.
  - `tests/integration/background/malus.test.ts` passes unchanged: `SITE_BLOCKED_ATTEMPT` from a tab is still accepted.
  - The whole suite is green: `bun run compile`, `bun run lint`, `bun run test`. Also `bun run build` and `bun run e2e`, because the real popup's sender must still pass.
- **Notes:**
  - If an existing test (outside `message-hardening.test.ts`) delivers a mutation through `deliverAs` with a sender that has no `url`, stop and report it rather than loosening the rule.
  - The Firefox popup's sender was not checked in a real browser (the e2e suite is Chromium-only). Say so in the changelog entry.

### PR10.T6 — `PLAY_SOUND` parser reads its fields through `own()` (F6)

- **Status:** done (`d780bfb`).
- **Files:** `lib/messaging/message-guards.ts`, `tests/unit/lib/messaging/message-guards.test.ts`, `docs/changelog.md`.
- **Current behavior:** `PLAY_SOUND(payload)` (`message-guards.ts:150–154`) validates `payload` with `isSoundPlayRequest`, which destructures it and so reads inherited properties, then destructures it again.
- **Wanted behavior:** like every other parser, it reads `themeId`, `cue` and `volume` with `own(payload, …)`, validates the rebuilt object `{ themeId, cue, volume }` with `isSoundPlayRequest`, and returns that object.
- **Work:** red first (§3.1). Add the test, then change only the `PLAY_SOUND` entry. Do not change `isSoundPlayRequest` (`lib/sound/sound-player.ts`), which other callers use.
- **Acceptance criteria:**
  - New test in the describe *"parseRuntimeMessage (M6.T1)"*: *"does not accept inherited PLAY_SOUND fields"*. A payload built with `Object.create({ themeId: 'glitch', cue: 'start', volume: 50 })` is an `err`; the same fields as own properties are `ok` and equal to `{ themeId: 'glitch', cue: 'start', volume: 50 }`.
  - The existing `message-guards.test.ts` tests pass unchanged.
  - `bun run compile`, `bun run lint` and `bun run test` are green.

### PR10.T7 — Explain the cast in `parseUnsafe` (F7)

- **Status:** done (`f7c6876`).
- **Files:** `lib/messaging/message-guards.ts`, `docs/changelog.md`.
- **Work:** above the casts in `parseUnsafe` (`message-guards.ts:166–172`), add one short comment that gives the *why*: `PAYLOAD_PARSERS` is keyed by `type`, so the parser picked for `type` returns that variant's payload, and `{ type, payload }` is a valid `RuntimeMessage`. TypeScript cannot correlate the two through an indexed access, hence the casts. Do not change any code.
- **Acceptance criteria:**
  - `git diff` shows only comment lines in `message-guards.ts`.
  - `bun run compile`, `bun run lint` and `bun run test` are green.
- **Notes:** comment only, so there is no red test (§3.1 covers logic). Do not touch `bus.ts:93`, which already has its comment.

### PR10.T8 — Close-out

- **Status:** done.
- **Depends on:** PR10.T1–PR10.T7.
- **Files:** `docs/changelog.md`, `docs/pr-review/pr-10-review.md`, `.serena/memories/core.md`.
- **Work:**
  - `docs/changelog.md`: check that each PR10 task has its entry in "PR reviews" (`changelog` skill) and that the test counts are the real ones from `bun run test`. Add any that are missing.
  - This document: fill the Progress table and set each task's **Status**.
  - `.serena/memories/core.md`: replace the PR #10 review note with the lasting invariants these fixes introduced, or remove it if there are none. Edit the memory with Serena. The invariants:
    - the overlay host is recognized through the module-level `WeakSet`, never by id;
    - the watcher (`lib/browser/host-watcher.ts`) also observes the shadow root;
    - background mutations are accepted only from extension pages (`isExtensionPageSender`).
- **Acceptance criteria:** `bun run compile`, `bun run lint`, `bun run test`, `bun run build` and `bun run build:firefox` are green. Also run `bun run e2e` if the Playwright suite is available (run `bun run build` first).
