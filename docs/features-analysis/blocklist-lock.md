# Blocklist lock during a session — code analysis

> Change request: **the blocklist cannot be edited once the timer starts.**
> Status: analysis only — no code has been modified.
> Scope: where an edit can enter the system today, what has to be guarded, and
> which decisions the implementation still needs.

## 1. Core idea

Editing the blocklist is a **mutation of persisted state**, and today every such
mutation can happen at any time: the blocklist tab stays fully interactive while
a session runs. That defeats the point of the feature — a user who is blocked
from a site can open the popup, remove the domain and reload the page.

The request is therefore not a new blocking rule but a **write guard**: the
blocklist (and the tags/presets that shape it) may only change while no session
is in progress. Reading, filtering and scrolling the list must keep working, and
enforcement (`selectActiveRules`, `isDomainBlocked`) must not change at all.

The important structural fact: there are **three independent write paths**, and
guarding only the visible one is not enough.

| Layer | Path | Can bypass the UI? |
|---|---|---|
| UI | `components/blocklist/*` invoke store actions | — |
| Store actions | `store/blocklist.slice.ts` apply the change locally and forward one mutation | yes (tests, any future caller) |
| Background | `lib/messaging/apply-mutation.ts` is the single writer that persists | yes (any context can send a message) |

The lock is **derived state**, not persisted configuration: it is a function of
`timer.status`, which already survives restarts (M1.T5/M2.T2). No schema change,
no `version` bump.

---

## 2. Timer status — the single source of truth

`TimerStatus = 'idle' | 'running' | 'paused' | 'completed'`
(`store/store.types.ts:1`), read through the granular selector
`selectTimerStatus` (`store/timer.slice.ts:381`, re-exported at
`store/index.ts:290-298`).

Transitions (`store/timer.slice.ts`):

| Action | Line | Transition |
|---|---|---|
| `startTimer` | `:140` | `idle → running` (fresh session) or `paused → running` (resume); a `completed` session is **not** resumable |
| `pauseTimer` | `:204` | `running → paused` |
| `resetTimer` | `:235` | any state `→ idle` (keeps the selected duration) |
| `completeTimer` | `:253` | `running → completed` |

Consequences for the lock:

- `completed` is a **finished** session, but as decided (§10-A) the list stays
  locked until `resetTimer` returns the timer to `idle`; `resetTimer` is enabled
  in `completed` (`components/timer/TimerControls.tsx:44-52`), so the way out is
  one click and does not start anything.
- `paused` is still an **in-progress** session: enforcement is off while paused,
  but resuming turns it back on, so allowing edits there would be a one-click
  bypass (pause → unblock → resume).

Decided truth table:

| `timer.status` | Blocking active? (`lib/blocking/apply-rules.ts:56-57`) | Blocklist editable? |
|---|---|---|
| `idle` | no | **yes** |
| `running` | yes | **no** |
| `paused` | no | **no** |
| `completed` | no | **no** (until Reset) |

The rule is therefore a single predicate: `editable === (status === 'idle')`.

---

## 3. Store layer — the mutation surface

`BlocklistState` is exactly `{ blocklist, customTags }`
(`store/blocklist.slice.ts:47-50`). Seven actions can change it
(`store/blocklist.slice.ts:9-40`):

| Action | Line | Forwarded message | Notes |
|---|---|---|---|
| `applyPreset(presetId)` | `:70-85` | `BLOCKLIST_APPLY_PRESET` | whole preset in one update |
| `addSite(site)` | `:86-94` | `BLOCKLIST_ADD_SITE` | via `applyBlocklistMutation` |
| `removeSite(site)` | `:95-103` | `BLOCKLIST_REMOVE_SITE` | via `applyBlocklistMutation` |
| `createTag(label)` | `:104-117` | `TAG_UPSERT` | own duplicate check + id minting |
| `deleteTag(tagId)` | `:118-123` | `TAG_REMOVE` | detaches the tag from every entry |
| `assignTag(site, tagId)` | `:124-135` | `TAG_ASSIGN` | via `applyBlocklistMutation` |
| `unassignTag(site, tagId)` | `:136-147` | `TAG_UNASSIGN` | via `applyBlocklistMutation` |

Two shapes to be aware of:

- Four actions share `applyBlocklistMutation` (`:156-168`), which applies the
  pure transformation, does an identity check (`next === current` → no write, no
  message) and calls `set(...)`. A status guard can live here and cover them at
  once.
- `applyPreset`, `createTag` and `deleteTag` write with their own `set(...)`, so
  each needs the guard explicitly.

The **pure helpers** (`addBlocklistSite` `:201`, `addPresetToBlocklist` `:226`,
`removeBlocklistSite` `:253`, `upsertTag` `:272`, `removeTag` `:284`,
`assignTagToSite` `:328`, `unassignTagFromSite` `:353`) take only
`BlocklistState` + payload: they must **not** learn about the timer. The lock is
a policy of the store action / message handler, not of normalization.

**Optimistic-update detail.** The popup store is read-only (M1.T9) but the
actions still `set(...)` locally before sending the mutation; the background
persists and the popup converges through the M1.T8 sync bridge. A guard placed
only in the background therefore leaves the popup showing a change that will
never be persisted (see §10-E).

---

## 4. UI layer

The blocklist tab is a pure composition (`entrypoints/popup/App.tsx:69-77`):

```tsx
<div className="popup-section popup-section--blocklist">
  <PresetPicker />
  <TagEditor />
  <SiteList />
</div>
```

Mutation entry points:

| Component | Line | Control |
|---|---|---|
| `components/blocklist/SiteList.tsx` | `:100-118` | add form (`addSite` at `:115`) |
| `components/blocklist/SiteList.tsx` | `:159-172` | per-entry remove button (`removeSite` at `:166`) |
| `components/blocklist/PresetPicker.tsx` | `:47-60` | one button per preset (`applyPreset` at `:55`) |
| `components/blocklist/TagEditor.tsx` | `:135-140` | create tag (`createTag` at `:138`) |
| `components/blocklist/TagEditor.tsx` | `:165-189` | delete tag (`deleteTag` at `:182`) |
| `components/blocklist/TagEditor.tsx` | `:92-109` | assign/unassign checkboxes (`:102-103`) |

What must stay usable while locked:

- the list itself and its per-entry domain text;
- the **tag filter** (`TagEditor.tsx:167-177`, local `filterTagId` state) — it
  only narrows the view;
- tab switching, the timer and the city.

The established pattern for status-driven controls is `TimerControls`
(`components/timer/TimerControls.tsx:21-54`): read `selectTimerStatus` with the
granular selector and `disabled` the buttons that cannot act. The blocklist
components follow the same rule (no computation inside the component):

- `SiteList` / `PresetPicker` / `TagEditor` read `selectTimerStatus` (or a
  dedicated `selectBlocklistEditable`, see §10-C), disable the inputs/buttons
  and render one localized notice;
- the notice should be rendered once per section (in `App.tsx`) or once per
  component — a layout decision, not a logic one;
- the notice must not depend on `aria-disabled` alone: keep the region rendered
  and readable.

---

## 5. Messaging and background (the authoritative guard)

All seven mutations are `MutationMessage` variants
(`lib/messaging/messages.types.ts:143-161`), registered on the background in one
loop (`entrypoints/background.ts:611-634`).

`createMutationHandler(store)` (`lib/messaging/apply-mutation.ts:113-151`) routes
timer commands to the timer slice and sends everything else to the default
branch (`:141-148`):

```ts
const current = store.getState().blocklist;
const next = applyBlocklistMutation(current, message);
if (next === current) return;
store.setState({ blocklist: next });
```

That branch is the natural place for the lock: it has the store, so it can read
`store.getState().timer.status` and refuse the mutation before the identity
check. `applyBlocklistMutation` (`:36-86`) stays a pure state transformation.

Two protocol facts matter for the design:

1. **There is no rejection channel.** `sendMessage` returns only a transport
   `Result` (`lib/messaging/bus.ts:38-45`); the handler returns `void`. A guard
   that silently drops a message is invisible to the popup (see §10-E).
2. **Ordering is not guaranteed.** `TIMER_STARTED` and a blocklist mutation sent
   in the same tick can be handled in either order, so the guard must be
   evaluated against the background's current status at handling time — which is
   exactly what reading `store.getState()` does.

Startup edge case: listeners are registered while the background reconciles a
restored session (`background.ts:656-700`). Until `restoreTimer` has set
`running`, the status is still the persisted one from `rehydrate` — in practice
already `running`, but the window exists and should be covered by a test
(§10-F).

---

## 6. Persistence and enforcement

- `PersistedState` is declared explicitly (`store/index.ts:68-79`) and
  `partialize` copies the blocklist slice field by field (`:138-147`). The lock
  adds **no** field, so the persisted payload and `version: 2` stay untouched —
  including the CR1 migration path.
- DNR is active only while running (`lib/blocking/apply-rules.ts:56-57`), and the
  overlay/navigation check only consults the blocklist. A lock therefore changes
  nothing about enforcement; it only prevents the list from changing underneath
  an active (or resumable) session.

---

## 7. i18n

The blocklist strings live in `locales/en.yml:43-62` and the mirrored
`locales/it.yml:44-63`; both must gain the new lock notice key (e.g.
`blocklist.lockedWhileRunning`) because the drift test
(`tests/unit/i18n/locales.test.ts:30-54`) fails on an EN key without an IT
counterpart. If disabling is explained per control, prefer one shared key plus
positional arguments (`$1`) over several near-duplicates.

---

## 8. Tests

| Test file | What it covers today | What the lock needs |
|---|---|---|
| `tests/unit/store/blocklist-sites.test.ts` | `addSite`/`removeSite` local update + one mutation | plain actions only in `idle`; no local write and no mutation while locked |
| `tests/unit/store/blocklist-preset.test.ts` | preset expansion, one update/mutation | `applyPreset` guarded like the site actions |
| `tests/unit/store/blocklist-tags.test.ts` | tag CRUD, assign/unassign, detach on delete | tag mutations guarded; `removeTag` cannot be triggered while locked |
| `tests/unit/store/blocklist-mutations.test.ts` | pure helpers, normalization, dedup | unchanged (helpers stay status-agnostic) |
| `tests/unit/components/blocklist/SiteList.test.tsx` | add/remove, preview, validation, no allowlist section | controls disabled + notice while not `idle`; list still rendered |
| `tests/unit/components/blocklist/PresetPicker.test.tsx` | one button per preset, single action | buttons disabled while locked |
| `tests/unit/components/blocklist/TagEditor.test.tsx` | create/assign/filter/delete | create/assign/delete disabled; **filter still works** |
| `tests/integration/messaging/mutation-bus.test.ts` | every mutation reaches the background store and persists once | a forged mutation while not `idle` is dropped without persisting |
| `tests/integration/popup/app-composition.test.tsx` | tab composition (`:134-141`), start via UI | end-to-end: start → blocklist tab shows the lock → reset → editing works again; `completed` still locked |
| `tests/unit/i18n/i18n.test.tsx`, `locales.test.ts` | EN/IT rendering and key parity | new key resolves in both locales |

A small key set for the integration test already exists in the popup test
(`startBackground` + `attachStoreSync` + `fakeBrowser`), so no new harness is
needed.

---

## 9. Files to modify

Production:

- `store/blocklist.slice.ts` — status guard in the seven actions + a shared
  predicate (e.g. `isBlocklistEditable(status)`).
- `store/index.ts` — export the predicate / `selectBlocklistEditable` selector.
- `components/blocklist/SiteList.tsx` — disable add/remove, render the notice.
- `components/blocklist/TagEditor.tsx` — disable create/delete/assign, keep the
  filter active.
- `components/blocklist/PresetPicker.tsx` — disable every preset button.
- `entrypoints/popup/App.tsx` — optional section-level notice / layout.
- `lib/messaging/apply-mutation.ts` — reject blocklist/tag mutations outside
  `idle` in the handler.
- `locales/en.yml`, `locales/it.yml` — lock notice key(s).

Tests: the files listed in §8 — the four store unit tests, the three component
tests, the two integration tests, and the two i18n tests.

Docs (when implemented): `README.md` (feature bullet), `docs/changelog.md`, and
the roadmap task card for this change request.

Not touched: `lib/blocking/*` (rule generation, snapshot, overlay),
`store/store.types.ts` (no new field), the storage adapter, the content script.

---

## 10. Open decisions

> Status: these choices are resolved by **change request CR2** (§2.5 of
> `docs/roadmap-en.md`). A is decided (`idle` only); B–G adopt the
> recommendations below.

**A. Lock window — decided: `idle` only.** The blocklist is editable exclusively
while `timer.status === 'idle'`, i.e. before the first Start and after an
explicit Reset. `running`, `paused` and `completed` are all locked. Consequences
to keep in mind while implementing: the lock predicate is exactly
`status === 'idle'`; a completed session must be reset (one click, no new
session) before editing; and the notice copy should mention Reset as the way
out, not "when the session ends".

**B. Scope of the lock.** Recommended: every mutation of `BlocklistState` — sites,
presets **and** tags — because tags are what presets are built from and deleting a
tag silently rewrites every entry's `tagIds`. Alternative: sites only, leaving tag
metadata editable; this is inconsistent (a tag edit still changes the persisted
blocklist).

**C. Enforcement depth.** Recommended: all three layers (UI, store actions,
background). The background is the only one that can stop a forged/stale
message; the store guard keeps the popup's optimistic copy honest; the UI
explains why.

**D. UX shape.** Options: (1) disable the controls and show an inline notice
(recommended — the list stays readable and the reason is visible); (2) replace
the whole editor with a banner while locked (simpler, but hides the list);
(3) allow the clicks and show an error after the fact (worst: silent drift).

**E. Race between `TIMER_STARTED` and a mutation.** The popup may add a domain
just as the session starts. The background rejects it, but the popup already
applied it locally (optimistic `set`), and no storage write follows — so the two
copies drift until the next successful write or rehydrate. Options: (1) guard in
the store action too, which shrinks the window to the message/status latency;
(2) rehydrate the popup store on the `running` transition (cheap, self-healing);
(3) add a rejection reply to the bus so the popup can revert (protocol change,
largest diff). Recommended: (1) + (2), and a test that reproduces the race.

**F. Startup window.** A mutation handled before `restoreTimer` completes is
evaluated against the rehydrated status. Recommended: rely on the persisted
status (it is already authoritative for a running session) and add an
integration test for "background restart mid-session + mutation rejected".

**G. Feedback for a rejected message.** Silent drop is the current convention for
invalid payloads (identity check → no persist). Recommended: keep it silent for
forged messages, but log at debug level with the message type, so a support
report can distinguish "the lock worked" from "the message was lost".

---

## 11. Summary of the dependency chain

```
timer.status (running | paused)  ← source of truth, already persisted
  ├── UI
  │     ├── SiteList (add form + remove buttons)
  │     ├── PresetPicker (apply preset)
  │     └── TagEditor (create / delete / assign / unassign)
  │           └── tag filter stays enabled (view only)
  ├── store actions (store/blocklist.slice.ts)
  │     ├── applyBlocklistMutation → addSite / removeSite / assignTag / unassignTag
  │     ├── applyPreset
  │     └── createTag / deleteTag
  ├── background (lib/messaging/apply-mutation.ts)
  │     └── default branch → setState({ blocklist })  ← the only persist path
  └── no persisted field, no schema change, no enforcement change
```

The most important observation: **the blocklist can be written from more than
the screen the user sees**. A correct implementation treats the request as a
write guard evaluated against `timer.status` in the store actions *and* in the
background mutation handler, with the UI only reflecting that decision — never as
a purely visual disable.
