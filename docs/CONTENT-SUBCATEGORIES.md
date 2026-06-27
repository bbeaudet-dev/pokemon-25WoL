# Content Sub-categories (splitting "Items" and beyond)

## Goal

Break broad content categories — primarily **Items** — into smaller,
individually toggleable sub-categories so Custom mode can include/exclude them
independently, and so each category badge can have a meaningful representative
image. Today everything from Poké Balls to berries to evolution stones to key
items is lumped into one `item` category, which is hard to represent with a
single avatar and too coarse for Custom mode.

This is mostly **mechanical breadth** (adding category values in several places
plus a seed mapping), not tricky logic. The hardest part is choosing a good
sub-category taxonomy and re-seeding cleanly.

## Background: how categories work today

A content category is a string literal used in many places. There are
**duplicated** category unions that must all be kept in sync:

- `src/lib/game/types.ts` — `ContentCategory` (the canonical TS type).
- `convex/schema.ts` — `const contentCategory = v.union(...)`.
- `convex/lobbies.ts` — another `const contentCategory = v.union(...)`.
- `convex/content.ts` — another `const contentCategory = v.union(...)`.

Category metadata lives in `src/lib/game/rules.ts`:

- `categoryDifficultyOrder` — master ordered list; the Custom-mode category
  picker (`src/components/lobby/game-settings-panel.tsx`,
  `customCategoryOptions = categoryDifficultyOrder`) renders from this, so adding
  a category here automatically surfaces it in the UI.
- `categoryLabels` — display label per category (e.g. `item: "Items"`).
- `chillCategories`, `classicCategories`, `advancedCategories` — which categories
  each mode enables.
- `targetAnchorCategories`, `targetCategoryCaps`, `targetCategoryGroups`,
  `targetCategoryChances` — control round target sampling balance (so a round
  isn't all items, etc.). New sub-categories should get sensible caps/chances.

Per-category avatars: `convex/content.ts` `categoryRepresentativeLabels` maps a
category to a preferred representative word for the lobby avatar; missing entries
fall back to the first image-backed word, then to `WordImage`'s
`categoryFallbackImages` (`src/components/game/word-image.tsx`).

Seeding: `scripts/seed-content.ts` pulls from PokeAPI. Crucially, item details
are already fetched and the **PokeAPI item category is already read**:

```ts
// getItemSeedData(sourceUrl) currently reads item.category.name only to EXCLUDE some
type ItemDetail = { category: { name: string }; sprites: { default: string | null } };
```

So the data needed to sub-categorize items is already in hand at seed time — it's
currently only used by `excludedItemCategories`.

## Proposed item sub-category taxonomy

Replace the single `item` with the following (keep `item` itself as a generic
fallback bucket — see Migration & compatibility):

| New category    | Label              | PokeAPI `item.category.name` values (starting map) |
|-----------------|--------------------|----------------------------------------------------|
| `pokeball`      | Poké Balls         | `standard-balls`, `special-balls`, `apricorn-balls` |
| `medicine`      | Medicine           | `medicine`, `healing`, `pp-recovery`, `revival`, `status-cures`, `vitamins`, `in-a-pinch`, `picky-healing` |
| `berry`         | Berries            | `effort-drop`, `medicine`-tagged berries — easiest to detect by label ending in "Berry" (see note) |
| `evolution_item`| Evolution Items    | `evolution` |
| `held_item`     | Held Items         | `held-items`, `bad-held-items`, `choice`, `type-enhancement`, `type-protection`, `scarves`, `plates`, `mega-stones`, `jewels`, `memories`, `species-specific`, `effort-training`, `training` |
| `battle_item`   | Battle Items       | `stat-boosts`, `flutes` |
| `treasure`      | Treasures          | `collectibles`, `loot`, `mulch`, `dex-completion` |
| `key_item`      | Key Items          | `gameplay`, `plot-advancement`, `event-items`, `spelunking`, `apricorn-box`, `all-mail`, `other` |
| `item`          | Items (other)      | anything unmapped (fallback bucket) |

Notes:
- **Pull the live taxonomy first.** Fetch `https://pokeapi.co/api/v2/item-category?limit=1000`
  and print the full list before finalizing the map; PokeAPI category names change
  across generations and the table above is a starting point, not exhaustive.
- **Berries** are awkward: their item categories overlap with medicine. Most
  reliable detection is `label.endsWith("Berry")` (or the dedicated `berry`
  endpoint). Decide one approach and apply it before the category-name map.
- **TMs/HMs** currently come through `all-machines`, which is in
  `excludedItemCategories` (skipped). If you want a `tm` category, that's a
  separate effort using the PokeAPI `machine` endpoint to map machine -> move;
  treat as a follow-up, not part of the first pass.
- Keep the existing `excludedItemCategories` / `excludedItemNamePatterns`
  filtering — exclusions run before mapping.

## Implementation steps

### 1. Add the category literals (keep them in sync everywhere)

Add each new value to all four unions:
- `src/lib/game/types.ts` `ContentCategory`
- `convex/schema.ts` `contentCategory`
- `convex/lobbies.ts` `contentCategory`
- `convex/content.ts` `contentCategory`

(Consider refactoring these four into a single shared source to avoid future
drift, but that's optional.)

### 2. Update category metadata (`src/lib/game/rules.ts`)

- Add the new categories to `categoryDifficultyOrder` (this drives the Custom
  picker order). Place item sub-categories where they make sense by difficulty.
- Add `categoryLabels` entries for each.
- Update `chillCategories` / `classicCategories` / `advancedCategories`. Suggested:
  - Classic previously had `item`. Replace with the "easy" item subs (e.g.
    `pokeball`, `medicine`, `evolution_item`, `berry`).
  - Advanced gets the rest (`held_item`, `battle_item`, `treasure`, `key_item`).
- Add `targetCategoryCaps` for the new subs (small caps, e.g. 1–2 each) so a
  round doesn't fill with items. Consider a `targetCategoryGroups` entry that
  groups all item subs together if you want a combined cap on "itemy" words.
- Add `targetCategoryChances` where you want a sub to appear less often.

### 3. Seed mapping (`scripts/seed-content.ts`)

- Add a `Record<string, ContentCategory>` mapping PokeAPI `item.category.name`
  to the new category (the table above).
- In the item branch (where `getItemSeedData` runs and the `word` is built with
  `category: config.category`), compute the real category:
  `const itemCategory = berry?  "berry" : (itemCategoryMap[item.category.name] ?? "item")`
  and use it as the word's `category` instead of the endpoint's `"item"`.
- `getItemSeedData` already returns the sprite; also return `item.category.name`
  so the mapping can use it.
- Keep image handling as-is (item sprites come from `sprites.default`).

### 4. Avatars & fallbacks

- Add `categoryRepresentativeLabels` entries in `convex/content.ts` for each new
  sub (e.g. `pokeball: "Poke Ball"`, `medicine: "Potion"`, `berry: "Oran Berry"`,
  `evolution_item: "Fire Stone"`, `held_item: "Leftovers"`,
  `battle_item: "X Attack"`, `treasure: "Nugget"`, `key_item: "Bicycle"`).
- Optionally add local `categoryFallbackImages` in `word-image.tsx` for any sub
  that often lacks images.
- Optionally add the new subs to `showcaseCategories` weights in `content.ts`.

### 5. Migration & re-seed

The content identity key is `category:normalizedLabel`
(`src/lib/content/identity.ts`), so moving an item to a new category creates a
**new** row; the old `item` rows are not auto-updated.

- Simplest: clear existing `item` rows, then re-seed. The seed script's removal
  helpers (`removeManyBySourceIds`, `removeManyByCategoryLabels`) are keyed by
  category; add a one-time cleanup that removes all old `pokeapi` `item` rows, or
  wipe the `content` table in the Convex dashboard before re-seeding.
- Run `npm run seed:content` (needs `NEXT_PUBLIC_CONVEX_URL`). Verify the printed
  "Counts by category" includes the new subs and that `item` (fallback) is small.

### 6. Backward compatibility (important)

Existing lobbies/games persist `settings.categories` which may contain `"item"`.

- **Keep `item` in all unions** as the generic fallback bucket so old stored
  settings remain valid and don't fail schema validation.
- `makeGameSettings` (`rules.ts`) rebuilds categories for non-custom modes from
  the mode, so Classic/Chill/Advanced lobbies self-heal. Only **custom** lobbies
  could carry a stale `item`; that's fine since `item` still exists.
- If you ever fully remove `item`, you must migrate stored settings first.

## Acceptance criteria

- Custom mode shows the new item sub-categories as individually toggleable badges
  with sensible avatars.
- Seeding distributes PokeAPI items across the new categories; the generic `item`
  bucket only holds genuinely unmapped items.
- Classic/Chill/Advanced still produce balanced rounds (items don't dominate).
- Existing lobbies/games keep working (no schema validation failures from stored
  `item`).

## Stretch / future

- Apply the same pattern to other broad categories (e.g. `town` already mixes
  cities/routes/landmarks — could split city vs. landmark).
- TMs/HMs as their own category via the PokeAPI `machine` endpoint.
- This sub-category framework is also the natural foundation for the
  "Beyond Pokemon" themes (Theatre, Music) in IDEAS.md — a theme is just a
  different namespace of categories over the same engine.
