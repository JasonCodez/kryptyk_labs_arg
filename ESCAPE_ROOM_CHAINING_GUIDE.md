# Escape Room Chaining (Designer Wiring)

This project supports **chained escape-room interactions** purely through hotspot `meta` and `ItemDefinition`s.

The core idea is:
- Hotspots **gate** interactions by requiring inventory items.
- A `useEffect` **mutates the shared scene state** and/or **grants new items**.
- Those newly granted items can then be used on later hotspots (a “chain”).

## Inventory items

Inventory is stored as an array of `ItemDefinition.key` strings.

Create an `ItemDefinition` for every item you want to:
- show in inventory (name/image/description)
- require for gating (`requiredItemKey` / `requiresItems`)
- grant as “loot” (`useEffect.grantItemKeys`)

Tip: “instruction” items are just ItemDefinitions with a good `name` + `description`.

## Hotspot wiring fields

Hotspot `meta` (JSON) can contain:

- `requiredItemKey: string`
  - Only that item can be used here.

- `requiresItems: string[]`
  - Inventory must contain **all** keys in this array.
  - The dragged item must be one of them.

- `consumeItemOnUse: boolean` (default `true`)
  - Controls consuming the **dragged** item.

- `useEffect: { ... }`
  - Applies without requiring stage advance.
  - Updates `sceneState` and can grant/consume items.

- `sfx: { ... }`
  - Optional sound effects to play when an interaction succeeds.
  - Sounds are emitted through `escapeActivity` so the whole team hears it (and also returned in the action response as a fallback if sockets aren’t connected).
  - Put audio files under `public/` and reference them by URL (example: `/content/sfx/cha-ching.mp3`).

### `sfx` fields

`sfx` is an object keyed by interaction type. Each value can be either a URL string or an object with `{ url, volume }`.

- `pickup`: played when a pickup succeeds
- `use`: played when a use succeeds
- `loot`: played when loot is granted by `useEffect.grantItemKeys`
- `trigger`: played when a trigger/door succeeds

### SFX file location

Store sound files under:

- `public/content/sfx/`

Then reference them in `meta` by URL:

- `/content/sfx/<filename>`

Example: `/content/sfx/cha-ching.mp3`

### `useEffect` fields

- `hideItemIds: string[]` / `showItemIds: string[]`
  - These refer to **designer scene item ids**: `escapeRoomData.scenes[].items[].id`.
  - Use this to swap “closed register” → “open register”, reveal contents, etc.

- `disableHotspotIds: string[]` / `enableHotspotIds: string[]`
  - These refer to **DB hotspot ids** (the `Hotspot.id` cuid).
  - Use this to disable a hotspot after it’s used, or enable a newly revealed interaction.

- `grantItemKeys: string[]`
  - Adds items to inventory immediately (no separate pickup hotspot required).
  - Keys must exist as `ItemDefinition.key`.

- `consumeItemKeys: string[]`
  - Additional inventory items to consume as part of the interaction.
  - Use this for “combine” mechanics (A + B → C) without adding new UI.

- `consumeRequiredItems: boolean` (default `false`)
  - If `true`, consumes all keys in `requiresItems` (+ `requiredItemKey` if present).

- `strict: boolean` (default `false`)
  - When `true`, the server validates referenced ids/keys and returns clear errors on typos.
  - Great during authoring; you can turn it off after you’re confident.

## Example: key → open register → grant receipt → receipt used elsewhere

Register hotspot `meta`:

```json
{
  "label": "Unlock register",
  "requiredItemKey": "gold-key",
  "consumeItemOnUse": true,
  "sfx": {
    "use": { "url": "/content/sfx/cha-ching.mp3", "volume": 0.9 }
  },
  "useEffect": {
    "strict": true,
    "hideItemIds": ["register_closed"],
    "showItemIds": ["register_open", "receipt_visible"],
    "disableHotspotIds": ["<registerHotspotId>"],
    "grantItemKeys": ["receipt" ]
  }
}
```

Then wire another hotspot (e.g. safe) with:

```json
{ "requiredItemKey": "receipt" }
```

## Example: combine items (battery + device → powered device)

On the “device” hotspot:

```json
{
  "label": "Power the device",
  "requiresItems": ["battery", "device"],
  "useEffect": {
    "strict": true,
    "consumeRequiredItems": true,
    "grantItemKeys": ["powered_device"]
  }
}
```

## Validate wiring (catch typos fast)

Run:

`npm run validate:escape-room -- --puzzleId <PUZZLE_ID>`

This checks:
- `requiredItemKey` / `requiresItems` keys exist as ItemDefinitions
- `useEffect.grantItemKeys` / `consumeItemKeys` keys exist
- `useEffect.showItemIds` / `hideItemIds` point at real designer scene item ids (warning if not)
- `useEffect.enableHotspotIds` / `disableHotspotIds` point at real hotspot ids (error if not)
