# Allowlist logic — code analysis

> Change request: remove the allowlist logic.
> Status: analysis only — no code has been modified.

## 1. Core idea

The allowlist is not an independent feature: it only exists as an **exclusion filter over the blocklist**. A domain is blocked only if it is in `blocklist` **and not** in `allowlist` ("allowlist always wins"). Since the extension's default behavior is already "everything is allowed unless blocklisted", the allowlist is logically redundant — it only subtracts domains that the user had previously added to the blocklist.

The logic is spread across five layers: state model, mutation helpers, enforcement (DNR + content overlay), messaging, and UI.

---

## 2. State model

| Location | Allowlist-related code |
|---|---|
| `store/blocklist.slice.ts:44-48` | `BlocklistState` contains `allowlist`, `blocklist`, `customTags` |
| `store/blocklist.slice.ts:67` | Initial state: `allowlist: []` |
| `store/blocklist.slice.ts:9` | `BlocklistListName = 'allowlist' \| 'blocklist'` — a union threaded through most CRUD actions |
| `store/blocklist.slice.ts:399-401` | `selectAllowlist` reads `state.blocklist.allowlist` |
| `store/index.ts:300` | Re-exports `selectAllowlist` |
| `store/index.ts:63-69` | The whole `blocklist` slice state (including `allowlist`) is part of `PersistedState`, so it is persisted in `browser.storage.local` |

`BlocklistEntry` itself (`store/store.types.ts:77-80`) is shared by both lists; there is no separate allowlist entry type.

---

## 3. Mutation semantics

### `addSiteToList` — `store/blocklist.slice.ts:209-236`

Adding a site is **generic over the list**, so the same code can add to either list. Key behavior:

- `oppositeList(list)` (`:175-176`) maps `allowlist ↔ blocklist`.
- If the domain already exists in the other list, it is **moved** to the target list.
- The moved entry keeps its `tagIds`.
- After every add, `resolveListConflicts` is applied, so the state is always conflict-free.

### `resolveListConflicts` — `store/blocklist.slice.ts:188-193`

This is the explicit precedence rule:

```ts
const allowed = new Set(state.allowlist.map(e => e.domain.value));
const blocklist = state.blocklist.filter(e => !allowed.has(e.domain.value));
```

- A domain present in both lists is **dropped from the blocklist**.
- The allowlist is never modified.
- Returns the same state reference when there is no conflict.

This is also called when a preset is expanded or when a pre-existing/imported state contains a conflict.

### Other mutation helpers

| Function | Allowlist involvement |
|---|---|
| `addPresetToList` (`:251-261`) | Generic over list, but production callers always pass `'blocklist'`; it can move a domain out of the allowlist via `addSiteToList` |
| `attachPresetTag` (`:263-275`) | Generic over list |
| `removeSiteFromList` (`:277-293`) | Generic over list |
| `removeTag` (`:303-311`) | Explicitly strips the tag from **both** `allowlist` and `blocklist` entries |
| `assignTagToSite` / `unassignTagFromSite` (`:345-386`) | Generic over list, so tags can target allowlist entries |
| `filterEntriesByTag` (`:392-397`) | Generic over entries; could be used for either list |

### Store actions

In `createBlocklistSlice` (`:62-133`):

- `addSite(list, site)` and `removeSite(list, site)` accept `BlocklistListName`.
- `assignTag(list, site, tagId)` and `unassignTag(...)` also accept it.
- `applyPreset` always targets `'blocklist'` (`:74`).

So the allowlist is a first-class CRUD target at the store API level, even though the production UI only uses part of that surface.

---

## 4. Enforcement paths

### 4.1 DNR rule generation

**`lib/blocking/rules.ts:54-75` — `buildDnrRules(blocklist, allowlist)`**

1. Canonicalizes all allowlist entries.
2. Builds a `Set` of allowed domains.
3. Canonicalizes blocklist entries and filters out every domain in the allowed set.
4. Emits one `sub_frame` block rule per remaining domain.

The allowlist does **not** generate its own DNR allow rule; it simply suppresses block rules.

**`lib/blocking/apply-rules.ts:57-60` — `selectActiveRules`**

```ts
return buildDnrRules(state.blocklist.blocklist, state.blocklist.allowlist);
```

`BlockingRulesSource` (`:9-15`) also declares the `allowlist` field. This is the only production caller of `buildDnrRules`.

### 4.2 Content-script overlay / navigation gate

**`lib/blocking/is-domain-blocked.ts:20-25`**

```ts
const isAllowed = input.allowlist.some(e => e.domain.value === domain);
if (isAllowed) return false;
return input.blocklist.some(e => e.domain.value === domain);
```

`BlockDecisionInput` (`:4-7`) contains both lists. This function is the shared membership check for the overlay and the background distraction predicate.

Callers:

- `entrypoints/blocked-overlay.content.tsx:210-230` — `evaluate()` passes the parsed `StoreSnapshot` to `isDomainBlocked`.
- `entrypoints/background.ts:321-332` — `createDistractionPredicate` passes the whole `blocklist` slice (`{ allowlist, blocklist }`) to `isDomainBlocked`.

### 4.3 Persisted snapshot read by the content script

**`lib/blocking/store-snapshot.ts`**

- `StoreSnapshot extends BlockDecisionInput` (`:8-11`).
- `parseStoreSnapshot` (`:46-75`) validates `allowlist` and `blocklist` separately (`:65-68`) and returns both in the snapshot (`:75`).
- A malformed allowlist makes the entire snapshot invalid.

So removing the allowlist also changes the persisted-state parsing contract.

---

## 5. Messaging layer

**`lib/messaging/messages.types.ts`**

Four mutation variants include a `list: 'allowlist' | 'blocklist'` field:

- `BLOCKLIST_ADD_SITE` (`:71-74`)
- `BLOCKLIST_REMOVE_SITE` (`:76-79`)
- `TAG_ASSIGN` (`:99-106`)
- `TAG_UNASSIGN` (`:108-115`)

**`lib/messaging/apply-mutation.ts`**

- `isListName` (`:18-20`) accepts `'allowlist'`.
- `BLOCKLIST_ADD_SITE`, `BLOCKLIST_REMOVE_SITE`, `TAG_ASSIGN`, `TAG_UNASSIGN` all use it to validate the payload.

Without the allowlist, these payloads either lose the `list` field entirely (if only one blocklist remains) or must reject `'allowlist'` as invalid.

---

## 6. UI and i18n

**`entrypoints/popup/App.tsx:65-76`**

The blocklist section renders two instances:

```tsx
<SiteList list="blocklist" />
<SiteList list="allowlist" />
```

**`components/blocklist/SiteList.tsx`** is generic over `BlocklistListName`:

- `LIST_KEYS` (`:78-92`) defines titles/names for both lists.
- Reads `selectAllowlist` or `selectBlocklist` (`:118`).
- Reads the opposite selector to detect a move (`:119`).
- Dispatches `addSite(list, domain)` / `removeSite(list, ...)` (`:146`, `:202`).
- Produces the "Moved … from the …" feedback using the opposite list name (`:145-151`).

**Localization keys** (`locales/en.yml:55-64`, `locales/it.yml`):

- `blocklist.allowedSites`
- `blocklist.allowlistName`
- `blocklist.movedFromList` (used for the cross-list move feedback)

`TagEditor` does not reference the allowlist directly; it operates on the blocklist.

---

## 7. Tests asserting allowlist behavior

The allowlist has first-class test coverage in:

| Test file | What it covers |
|---|---|
| `tests/unit/store/blocklist-mutations.test.ts` | Add/remove to allowlist, cross-list moves, residual-conflict healing, `resolveListConflicts` |
| `tests/unit/store/blocklist-preset.test.ts` | Preset domain moved from allowlist to blocklist |
| `tests/unit/store/blocklist-tags.test.ts` | Tag assignment on an allowlist entry |
| `tests/unit/store/blocklist-sites.test.ts` | `addSite('allowlist', ...)` via the store action |
| `tests/unit/lib/blocking/rules.test.ts` | Allowlist suppresses a block rule; allowlist-only domain generates no rule |
| `tests/unit/lib/blocking/is-domain-blocked.test.ts` | Allowlist wins over blocklist |
| `tests/unit/lib/blocking/apply-rules.test.ts` | `selectActiveRules` passes both lists |
| `tests/unit/lib/blocking/store-snapshot.test.ts` | Parsing/validation of the allowlist field |
| `tests/integration/messaging/mutation-bus.test.ts` | Adding to the allowlist, then moving to the blocklist through the background |
| `tests/integration/content/blocked-overlay.test.ts` | Overlay does not mount for an allowlisted domain |
| `tests/integration/background/navigation-normalization.test.ts` | Allowlist precedence on canonicalized navigation URLs |
| `tests/integration/background/dnr-rules.test.ts`, `tests/integration/store/store.test.ts` | Allowlist present in fixture states / default state |

---

## 8. Summary of the dependency chain

```
BlocklistState.allowlist
  ├── persisted store
  ├── CRUD helpers (generic over 'allowlist' | 'blocklist')
  │     ├── addSiteToList / removeSiteFromList
  │     ├── resolveListConflicts  ← "allowlist wins"
  │     └── tag helpers
  ├── DNR path
  │     └── selectActiveRules → buildDnrRules(blocklist, allowlist)
  ├── runtime blocking path
  │     ├── parseStoreSnapshot → StoreSnapshot.allowlist
  │     ├── isDomainBlocked
  │     ├── content overlay
  │     └── background distraction predicate
  ├── messaging payloads (`list: 'allowlist' | 'blocklist'`)
  └── popup UI (second SiteList mount + i18n strings)
```

The most important observation: **no code path gives the allowlist an effect of its own**. Every use is either (a) subtracting entries from the blocklist, or (b) allowing CRUD/tag operations on a second list. Therefore removing it mainly means collapsing two-way list semantics into a single blocklist, simplifying `buildDnrRules`/`isDomainBlocked` signatures, and removing the second UI mount and its protocol/i18n surface.
