# Saved presets and preset toggles — code analysis

> Change request: **presets become toggles over the single blocklist, and custom
> tags become saved presets** (CR4; origin: UI critique UI.T2/UI.T3 in
> `docs/ui/ui-review-tasks.md`).
> Status: **in progress** — written by CR4.T1; CR4.T2 (pure logic) and CR4.T3 (store, v3 migration) are implemented; CR4.T4–CR4.T6 remain. Names
> below refer to the code *before* CR4 unless stated otherwise; references use
> symbols, not line numbers, because the files change under the following tasks.

## 1. Core idea

Today a preset is a **one-shot insert**: `applyPreset` copies four domains into
the blocklist and forgets where they came from. Custom tags are **inert
labels**: no blocking code reads `tagIds` or `customTags` — only the popup
(`TagEditor`, the interim source chips of UI.T1) and the persistence/migration
code touch them. The UI shows two concepts (preset, tag) that do the same job
badly.

After CR4 there is **one concept: a preset**, a named set of domains that can be
switched on and off.

- A preset is **built-in** (`lib/blocking/presets.ts`, data only) or **saved by
  the user** (persisted, same `Preset` shape).
- A preset is **applied** or not. Applying adds its domains with the preset as a
  *source*; un-applying removes the source and deletes only the entries left
  with no source.
- Enforcement does not change: `buildDnrRules`, `isDomainBlocked` and
  `selectActiveRules` read `blocklist[].domain.value` only, never sources.

## 2. Current paths (before CR4)

### 2.1 Write paths

| Concern | Path | Notes |
|---|---|---|
| Apply a preset | UI `PresetPicker` → `applyPreset` (`store/blocklist.slice.ts`) → `addPresetToBlocklist` → `BLOCKLIST_APPLY_PRESET` → `applyBlocklistMutation` in `lib/messaging/apply-mutation.ts` | same pure helper runs in the popup (optimistic) and the background (authoritative) |
| Create tag | `TagEditor` → `createTag` (mints id with `generateTagId`, rejects blank/duplicate label) → `TAG_UPSERT` → `upsertTag` | |
| Delete tag | `TagEditor` → `deleteTag` → `TAG_REMOVE` → `removeTag` (detaches from every entry) | |
| Assign / unassign | `TagEditor` → `assignTag`/`unassignTag` → `TAG_ASSIGN`/`TAG_UNASSIGN` → `assignTagToSite`/`unassignTagFromSite` | |
| Add / remove site | `SiteList` → `addSite`/`removeSite` → `BLOCKLIST_ADD_SITE`/`BLOCKLIST_REMOVE_SITE` | untouched in shape; `toEntry` creates `tagIds: []` |

All seven mutations pass through the **CR2 lock** twice: `isBlocklistEditable`
in the store action (`applyBlocklistMutation` helper / the `if` in each action)
and the `default` branch of `createMutationHandler` in `apply-mutation.ts`,
which drops everything while `timer.status !== 'idle'` and logs only the message
type at `debug`. The message list is closed by `MUTATION_TYPES` in
`lib/messaging/messages.types.ts`.

### 2.2 Persistence

- `partialize` (`store/index.ts`) writes `blocklist: { blocklist, customTags }`;
  `version: 2`; `migrate` runs `migrateBlocklistState` only for `version < 2`
  (the v1 two-list shape, CR1.T3); `merge` sanitizes the blocklist slice with
  `sanitizeBlocklistState`.
- `lib/blocking/legacy-blocklist.ts` owns `toEntry`/`toTags` (untrusted-input
  rebuilding, total: bad data degrades to empty).
- `lib/blocking/store-snapshot.ts` (`parseStoreSnapshot`) is the **content-script
  and background read path** for the raw persisted string. Its
  `isBlocklistEntry` currently *requires* `tagIds: string[]`, so a payload
  without `tagIds` would be rejected as malformed → this must change in CR4.T3
  (§6).

### 2.3 Read paths

| Reader | Reads | Used for |
|---|---|---|
| `lib/blocking/apply-rules.ts` → `buildDnrRules` | `blocklist[].domain.value` | DNR rules — **no** tags |
| `lib/blocking/is-domain-blocked.ts` | domains | content-script matching — **no** tags |
| `selectBlocklist`, `selectCustomTags`, `filterEntriesByTag` (slice) | entries / tags | `SiteList`, `TagEditor` |
| `lib/blocking/entry-sources.ts` (`computeEntrySourceLabels`, UI.T1) | `tagIds` + `PRESETS` + `customTags` | source chips; explicitly interim until CR4 |

### 2.4 UI, copy, tests

- Components: `PresetPicker` (one button per built-in preset, no state),
  `TagEditor` (create/assign/filter/delete; **unmounted** since UI.T1, deleted by
  CR4.T5), `SiteList` (chips via `computeEntrySourceLabels`), `entrypoints/popup/App.tsx`.
- Locales (`en.yml`, `it.yml`, `blocklist.*`): `presets`, `applyPreset`, `tags`,
  `newTagName`, `newTag`, `createTag`, `customTags`, `assignTag`, `filterByTag`,
  `deleteTag`.
- Test footprint (files mentioning the affected names, from a grep): 21 files.
  Heaviest: `tests/unit/store/blocklist-tags.test.ts`, `blocklist-lock.test.ts`,
  `tests/integration/messaging/mutation-bus.test.ts`,
  `tests/integration/store/store.test.ts`,
  `tests/unit/lib/blocking/legacy-blocklist.test.ts`.

### 2.5 Structural issues the change must also fix

- `store/blocklist.slice.ts` is already **~420 lines** (limit 200): the pure
  helpers (`addBlocklistSite`, tag helpers, selectors) share a file with the
  actions. CR4.T3 must split them (§7).
- `Preset.tag` only exists to feed the tag system; it goes away.

## 3. Decisions

### 3.1 Entry sources (replaces `tagIds`)

```ts
interface BlocklistEntry {
  readonly domain: Domain;
  /** The user typed it (or kept it) themselves. */
  readonly manual: boolean;
  /** Ids of the applied presets (built-in or user) that contributed it. */
  readonly presetIds: ReadonlyArray<string>;
}
```

Why two fields and not one string array with a `'manual'` sentinel: a sentinel
can collide with a preset id, and the validator for two typed fields is one line
each. **Invariant**: an entry always has `manual || presetIds.length > 0`; an
entry that loses its last source is deleted. `presetIds` only contains ids that
are in `appliedPresetIds` (enforced by sanitize on read).

### 3.2 Applied presets — persisted, not derived

Derived ("applied = some entry carries the id") fails three cases: an empty user
preset, a preset whose last entry was removed with ×, and the "applied but no
longer covers this domain" state the behavioral rule wants after ×. So the
state is explicit:

```ts
interface BlocklistState {
  readonly blocklist: ReadonlyArray<BlocklistEntry>;
  readonly appliedPresetIds: ReadonlyArray<string>;
  readonly userPresets: ReadonlyArray<Preset>;   // replaces customTags
}
```

`Preset` loses `tag`: `{ id, name, domains }`. Built-ins stay in `PRESETS`
(Open/Closed); user presets are persisted data of the same shape. The applied
set refers to either kind by id; an id that resolves to no preset is dropped on
read.

### 3.3 Ids and names

- Built-in ids unchanged (`social`, `video`, `news`).
- User preset ids: `user:<base36 time>-<base36 entropy>` — `generatePresetId`
  replaces `generateTagId`, same injected clock/entropy (the id is minted by the
  store action, never in a component). The `user:` prefix cannot collide with a
  built-in id.
- Names: trimmed, 1–24 characters (popup width), unique **case-insensitively
  across built-in and user presets** (same rule `hasTagLabel` enforced for tags).
  Built-in presets cannot be renamed or deleted.

### 3.4 Preset operations (pure, `lib/blocking/preset-toggle.ts`)

| Operation | Effect |
|---|---|
| `togglePreset(state, preset, applied)` | `applied = true`: add the id to `appliedPresetIds`; for every preset domain add the entry if missing (through `addBlocklistSite`, so `normalizeEntry` and dedup are reused) and add the id to its `presetIds`. Idempotent; re-applying also restores domains removed with ×. `applied = false`: remove the id from the set and from every entry's `presetIds`; **delete** entries with no source left; keep a manual entry and any entry another applied preset still covers. |
| `saveUserPreset(state, id, name)` | Snapshot **every current entry** into a new user preset, mark it applied, give each captured entry the new id as source and clear its `manual` flag. Rejects blank/duplicate name and an empty blocklist (same reference returned). |
| `renameUserPreset(state, id, name)` | Same validation; built-in or unknown id is a no-op. |
| `deleteUserPreset(state, id)` | Remove from `userPresets` and `appliedPresetIds`; entries it alone contributed become `manual: true` (**the sites stay blocked** — deleting a group must not unblock anything). |
| `addBlocklistSite` / `removeBlocklistSite` | Add creates `manual: true, presetIds: []`; adding a domain that exists as preset-only sets `manual: true`. Remove deletes the entry whatever its sources; applied presets stay applied. |

Decisions worth flagging to the user:

1. **"Filled later" is dropped.** CR4's rule said a preset can be created "from
   the current list or empty and filled later". Filling later needs a fourth
   editing surface (add/remove a domain *inside* a preset) that nothing else in
   the product asks for (YAGNI, §1.1). v1 saves from the current list only; to
   change a preset the user edits the list and saves a new one. The only empty
   user presets are migrated tags with no entries (§5).
2. **Saving captures the whole list and clears `manual`.** Keeping `manual` would
   make the first un-apply a visible no-op. The cost: toggling a saved preset
   off removes those sites (as designed for a toggle) — the confirmation copy in
   CR4.T5 must say so.
3. **Deleting a preset never unblocks.** Orphaned entries become manual.

### 3.5 Messages

`BLOCKLIST_APPLY_PRESET` and `TAG_UPSERT/REMOVE/ASSIGN/UNASSIGN` are removed from
`MutationMessage` and `MUTATION_TYPES`; unknown types are already dropped by the
closed list.

| Message | Payload | Handler |
|---|---|---|
| `PRESET_TOGGLE` | `{ presetId: string; applied: boolean }` | `togglePreset` — explicit target state, **not** a flip, so a redelivered message cannot invert the result |
| `PRESET_SAVE` | `{ id: string; name: string }` | `saveUserPreset`; the background snapshots **its own** blocklist, the popup never sends domains (single writer stays authoritative) |
| `PRESET_RENAME` | `{ presetId: string; name: string }` | `renameUserPreset` |
| `PRESET_DELETE` | `{ presetId: string }` | `deleteUserPreset` |

Payloads are validated at the boundary (types, non-empty, length); malformed ones
return the same state, are not persisted and log only the message type at
`debug`. `BLOCKLIST_ADD_SITE`/`BLOCKLIST_REMOVE_SITE` are unchanged.

### 3.6 Lock (CR2) and the CR5 add-only window

| Operation | `idle` | `running` / `paused` | `completed` |
|---|---|---|---|
| `addSite` | yes | **CR5: yes** | no |
| `PRESET_TOGGLE applied: true` | yes | **CR5: yes** (tightens only) | no |
| `PRESET_TOGGLE applied: false` | yes | no | no |
| `removeSite` | yes | no | no |
| save / rename / delete preset | yes | no | no |

Until CR5 lands every row is `idle`-only (CR4 uses `isBlocklistEditable`). The
background's per-message check must read the **target** (`applied` field), which
is why `applied` is an explicit boolean. CR5.T1/T2 then switch the predicate for
the two add-direction rows to `isBlocklistAddAllowed`.

## 4. Persistence v3

```ts
// persisted `blocklist` slice, version 3
{ blocklist: BlocklistEntry[]; appliedPresetIds: string[]; userPresets: Preset[] }
```

`partialize`, `merge` (sanitize), `migrate` and `parseStoreSnapshot` all move to
it. `sanitizeBlocklistState` is rewritten for v3 and stays **total** (§1.4): bad
fields degrade to empty, duplicates collapse (first wins), entries whose
`presetIds` are not applied are cleaned, an entry with no source becomes
`manual: true` rather than being silently deleted.

## 5. Migration v2 → v3

`migrate(persisted, version)` chains: `version < 2` → `migrateBlocklistState`
(allowlist subtraction, unchanged) → `version < 3` → `migrateToPresets`.

For each v2 entry `{ domain, tagIds }`:

| v2 tag id | v3 result |
|---|---|
| equals a built-in preset id (`social`, `video`, `news`) | that id joins `presetIds` and `appliedPresetIds` |
| equals a `customTags[].id` | becomes the user preset `user:<tag id>` (name = tag label, domains = entries carrying the tag, in list order), added to `userPresets`, `presetIds` and `appliedPresetIds` |
| anything else | dropped |

An entry left with no preset source gets `manual: true`. `customTags` with no
entries become **empty, un-applied user presets** (data is never silently lost;
the user can delete them). The key `customTags` is removed.

**Accepted limit (recorded):** v2 cannot distinguish an entry typed by hand *and*
tagged from a tag-only entry, so such an entry migrates **without** `manual`;
un-applying its preset then removes it. Fixtures required: v1, v2 with built-in
tags, v2 with custom tags, v2 with a tag shared with an unknown id, and an empty
tag.

**Rollout window.** After the extension updates, storage still holds the v2
string until the background rehydrates and writes. `parseStoreSnapshot` (content
script, background boot) must therefore keep accepting v2 and v3 payloads. It
only needs the domains, so it validates `domain.value` and ignores sources — a
smaller contract than today's.

## 6. i18n

Remove `tags`, `newTagName`, `newTag`, `createTag`, `customTags`, `assignTag`,
`filterByTag`, `deleteTag`, `applyPreset`. Add (EN and IT, drift test green):
toggle label with state, applied count (`$1/$2`), save-preset name field and
button, rename, delete with confirmation text that states the sites stay
blocked, empty-preset hint, name errors (blank, duplicate, too long). The exact
keys belong to CR4.T5.

## 7. Code layout (file-size rule, §1.2)

| File | Action |
|---|---|
| `lib/blocking/preset-toggle.ts`, `saved-presets.ts`, `preset-toggle.types.ts` | new (CR4.T2) — toggle and coverage / save, rename, delete and ids / types |
| `lib/blocking/blocklist-sites.ts` | new (CR4.T3) — `addBlocklistSite`/`removeBlocklistSite`/`toEntry` moved out of the slice |
| `store/blocklist.slice.ts` | actions + selectors only (CR4.T3); drops 6 tag/preset helpers |
| `lib/blocking/legacy-blocklist.ts` | v3 `sanitize`; `migrateToPresets` in its own file `lib/blocking/migrate-presets.ts` if it passes 200 lines |
| `lib/blocking/entry-sources.ts` | simplified: chips = names of `presetIds` resolved over built-in + user presets; a manual-only entry has no chip (CR4.T5) |

The roadmap cards are amended with these file lists (§9).

## 8. Tests

**Change** (fixtures use `tagIds: []` today → `manual: true, presetIds: []`;
introduce a shared `entry(domain)` test helper to keep the diff mechanical):
`tests/unit/store/blocklist-tags.test.ts` (replaced by preset tests),
`blocklist-preset.test.ts`, `blocklist-mutations.test.ts`, `blocklist-lock.test.ts`,
`tests/integration/messaging/mutation-bus.test.ts`,
`tests/integration/background/blocklist-lock.test.ts`,
`tests/integration/store/store.test.ts`, `read-only-store.test.ts`,
`sync-storage.test.ts`, `tests/unit/lib/blocking/legacy-blocklist.test.ts`,
`store-snapshot.test.ts`, `entry-sources.test.ts`, the component tests
(`PresetPicker`, `SiteList`, `TagEditor` deleted), `tests/unit/i18n/i18n.test.tsx`.

**Must keep passing with only fixture-shape edits, never assertion changes**
(they prove enforcement is unaffected): `rules.test.ts`, `is-domain-blocked.test.ts`,
`apply-rules.test.ts`, `tests/integration/background/dnr-rules.test.ts`,
`tests/integration/content/blocked-overlay.test.ts`.

**New** (written first, §3.1 TDD): `tests/unit/blocking/preset-toggle.test.ts`
(CR4.T2), `tests/unit/store/blocklist-migration-v3.test.ts` (CR4.T3), lock truth
table for the four preset messages (CR4.T4).

## 9. Roadmap deltas

- CR4.T2 (**revised while implementing**): to keep the tree green and commit T2 on
  its own, the new model lives in `lib/blocking/preset-toggle.types.ts`
  (`SourcedEntry`, `PresetBlocklistState`, `PresetShape`) and the logic in
  `lib/blocking/preset-toggle.ts` (toggle, applied state, coverage) and
  `lib/blocking/saved-presets.ts` (save/rename/delete, name rules, ids — split
  for the 200-line rule). `store/store.types.ts` is **not** touched in T2.
  CR4.T3 then makes `BlocklistEntry` = `SourcedEntry`, `Preset` = `PresetShape`
  and the persisted state = `PresetBlocklistState`, and deletes the duplicates.
  The earlier "T2 and T3 in one commit" rule is withdrawn.
- CR4.T3: adds `lib/blocking/blocklist-sites.ts` and `lib/blocking/migrate-presets.ts`.
- CR4.T5 confirmation copy: deleting a preset keeps its sites blocked; toggling a
  saved preset off removes its sites.
- UI.T2/UI.T3 are completed by CR4.T5 (unchanged).
- CR4.T3 (**implemented**): the model types moved into `store/store.types.ts`
  (`BlocklistEntry`, `Preset`, `BlocklistState`); `preset-toggle.types.ts` was
  removed and `PresetCoverage` now lives in `preset-toggle.ts`. Besides the store
  files, T3 also had to touch the message types and the background handler
  (`PRESET_*` replace `BLOCKLIST_APPLY_PRESET`/`TAG_*` — the slice sends them
  and the tree would not compile otherwise), delete `TagEditor`, turn
  `PresetPicker` into toggles and move `SiteList` to `presetIds`. CR4.T4 keeps
  the boundary hardening, the lock/CR5 matrix tests and the sender; CR4.T5 keeps
  the applied count, saved-preset management and the copy.
- Persistence helpers added by T3: `lib/blocking/blocklist-state.ts`
  (`sanitizeBlocklistState` for v3, total), `lib/blocking/migrate-presets.ts`
  (`migrateToPresets`, `migratePersistedBlocklist` for v1/v2/v3),
  `lib/blocking/blocklist-sites.ts` (site helpers moved out of the slice).
  Enforcement (`rules.ts`, `is-domain-blocked.ts`, `apply-rules.ts`) now types an
  entry as `Pick<BlocklistEntry, 'domain'>`, so it provably reads domains only.
- Known edge of the migration: a v2 custom tag named like a built-in preset
  (`Social`) becomes a second preset with the same name; names are only
  validated on save/rename, so the migration keeps the user's label verbatim.
