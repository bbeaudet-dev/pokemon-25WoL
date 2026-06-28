# Manual Target Selection — Simultaneous Pre-Game Picking

## Goal

In a **Manual** game, every player should choose their own target words **at the
same time**, during a shared pre-game setup step, before round 1 begins. Each
player's chosen list is then used when it becomes that player's turn to be the
hintmaster.

This removes the current pain: today the manual picker only opens for the round's
hintmaster at the start of their own round, so everyone else sits and waits while
each hintmaster picks, round after round.

**Randomized games are unaffected.** Their targets are generated automatically
when a player becomes the hintmaster (current behavior), so there is no shared
picking step.

## Status

- **Done:** the picker UI (tappable cards + inline search), now living in
  `src/components/game/manual-selection-screen.tsx` (the old
  `target-confirm-modal.tsx` per-round flow was removed).
- **Done:** simultaneous picking. Manual games have a `games.phase`
  (`manual_selection` | `playing`) and per-player `games.manualSelections`
  (current cycle only). All players pick at once, lock in, and the cycle's first
  round auto-starts when the last player locks (`beginManualCycleIfReady`).
- **Done:** per-cycle picking. With `hintGiverTurnsPerPlayer > 1`, a fresh
  selection phase re-opens at the start of each cycle (`nextRound` detects the
  cycle boundary via `getCycleSize`).
- **Done:** a brief turn-start overlay (`TurnIntro`) announces each hintmaster
  and shows the hintmaster their own targets.
- **Done:** a host-only "Skip turn" button (`games.skipTurn`) to clear a
  stuck/AFK/ghost hintmaster's active round.
- **Follow-up (not done):** auto-skipping ghost turns and auto-failing the
  active round when the current hintmaster leaves (host handles via Skip turn
  for now).

## Current behavior (what exists today)

- Game settings carry `targetSelection: "random" | "manual"` (see
  `src/lib/game/types.ts` and `convex/schema.ts`).
- `convex/games.ts`:
  - `start` creates the game and the first round via `createRound`.
  - `createRound` always pre-fills random targets via `selectTargetWords`, then
    sets the round `status` to `"setup"` for manual games and `"active"` for
    random games (random skips the confirm step).
  - `setManualTarget({ roundId, guestId, targetIndex, contentId })` swaps one
    target on the **current round** (hintmaster only, `status === "setup"`).
  - `confirmTargets({ roundId, guestId })` flips the current round from
    `"setup"` to `"active"`.
  - `nextRound` advances `currentRoundIndex` and calls `createRound` for the next
    hintmaster.
- `src/components/game/target-confirm-modal.tsx` is the picker UI. It already has
  the good UX: tappable target cards open an inline search (results styled like
  the guesser search in `game-room-board.tsx`'s `GuessPanel`). It is shown by
  `GameRoomBoard` only while `round.status === "setup"`.
- Targets live **only on the active round** (`rounds.targetWords`). There is no
  persistence of a player's chosen words across rounds. This is the core gap.

## Required behavior

1. When a Manual game starts, show the picker to **all players simultaneously**.
   Each player selects their full target list (count = `targetWordsPerRound`).
2. Each player has a per-player "locked in" state. A player can edit until they
   lock. Show everyone's lock progress (e.g. "3 / 5 players ready").
3. Round 1 begins **only after every player has locked in**. (Decide host-driven
   start vs. auto-start; see Open Questions.)
4. When a round starts for player X, the round's `targetWords` are populated from
   X's pre-chosen list (not random, not re-picked).
5. During play, mid-round rerolls still work and still mutate only the active
   round's `targetWords` (no change needed there). Rerolls do not need to write
   back to the stored pre-game selection.

## Suggested implementation

### Data model (`convex/schema.ts`)

Add per-player manual selections to the `games` table. Store the selected
content as the same shape used elsewhere (`targetWord` validator, minus solve
fields, or reuse `contentWord`). Example:

```ts
// in the games table definition
manualSelections: v.optional(
  v.array(
    v.object({
      playerId: v.id("players"),
      targets: v.array(contentWord), // contentId, label, normalizedLabel, category, imageUrl, source, sourceId, sourceUrl
      lockedIn: v.boolean(),
      updatedAt: v.number(),
    }),
  ),
),
```

Also add a game-level phase so the client knows to show the shared picker before
round 1. Either:

- add `setupPhase: v.optional(v.union(v.literal("manual_selection"), v.literal("done")))` to `games`, or
- reuse `lobby.status`/`game.status` plus the absence of a started round.

Recommended: an explicit `games.setupPhase` is clearest.

### Mutations (`convex/games.ts`)

- **`start`**: for manual games, do **not** create round 1 yet. Instead:
  - create the game with `setupPhase: "manual_selection"`,
  - initialize `manualSelections` with one entry per player (empty `targets`,
    `lockedIn: false`), optionally pre-filled with random suggestions so a player
    who does nothing still has a valid list,
  - leave `currentRoundId` unset.
  - For random games, keep current behavior (create round 1 immediately).

- **`setPlayerTarget({ gameId, guestId, targetIndex, contentId })`**: upsert one
  slot in the calling player's `manualSelections` entry. Reject if that player is
  already `lockedIn`. Validate `contentId` exists and (recommended) that its
  category is in `settings.categories`. Validate `targetIndex` within
  `[0, settings.targetWordsPerRound)`.

- **`setPlayerLock({ gameId, guestId, lockedIn })`**: set the player's lock flag.
  Require a full target list (no empty slots) before allowing `lockedIn: true`.

- **`beginManualGame({ gameId, guestId })`** (or auto-trigger): allowed only when
  every player is `lockedIn`. Sets `setupPhase: "done"` and creates round 1 via a
  modified `createRound` that pulls targets from the first hintmaster's stored
  selection.

- **`createRound`**: add a branch — if the game is manual and the hintmaster has
  a stored `manualSelections` entry, build `targetWords` from it (map each stored
  word through `toTargetWord`, resetting `solvedByPlayerIds: []`) instead of
  calling `selectTargetWords`. Manual rounds created this way should start
  `status: "active"` (the picking already happened) — i.e. manual rounds no
  longer use the per-round `"setup"` step. Keep `selectTargetWords` as the
  fallback if a selection is somehow missing.

- **`nextRound`**: no major change; it calls `createRound`, which now reads the
  next hintmaster's stored selection.

- Consider removing or repurposing the now-unused per-round `setManualTarget` /
  `confirmTargets` path for manual games (they were the old per-round flow). If
  random games never use them either, they can be deleted.

### Query (`convex/games.ts` `getRoom`)

Expose what the client needs during the shared picking phase:

- `game.setupPhase`
- the caller's own `manualSelections` entry (their targets + lock state)
- a lightweight roster of lock progress for all players (playerId + lockedIn)

Do **not** leak other players' chosen words to everyone (they are secret
targets). Only return the requesting player's own targets; for others return just
their `lockedIn` flag and name.

### Client

- `src/app/lobby/[code]/page.tsx` decides which screen to render. Add: if
  `room.game?.setupPhase === "manual_selection"`, render a new shared picker
  screen/component for all players (not just the hintmaster).
- Build the shared picker by adapting `target-confirm-modal.tsx`:
  - It already supports tappable cards + inline search; reuse that.
  - Wire it to the new `setPlayerTarget` / `setPlayerLock` mutations instead of
    `setManualTarget` / `confirmTargets`.
  - Show a roster of players with ready/locked badges, and a "Lock in" button.
  - Host (or auto) triggers `beginManualGame` once all are locked.
- `GameRoomBoard` keeps rendering the active round normally. Manual rounds now
  arrive already `active`, so the per-round setup modal is no longer shown for
  manual games.

## Edge cases

- **Player joins/leaves during picking**: a late joiner needs a
  `manualSelections` entry; a leaver's entry should be dropped and the
  all-locked check recomputed. (Joining mid-game may already be disallowed —
  confirm against lobby join rules.)
- **Not enough content** for a category set: keep the `selectTargetWords`
  "not enough content" guard logic available for validation/fallback.
- **Duplicate targets** within one player's list: decide whether to allow; the
  current per-round swap allows overwriting, so enforce uniqueness here if
  desired.
- **Reroll vs stored selection**: mid-round rerolls change the live round only;
  do not write back to `manualSelections` (the stored list is the player's
  original pick).
- **Settings change after lock**: changing `targetWordsPerRound` or categories
  while players are locked should reset locks / selections. Settings already
  reset ready state on change (`convex/lobbies.ts updateSettings`); mirror that.

## Open questions for the implementer

- Auto-start round 1 when the last player locks, or require the host to press
  "Start"? (Recommend host-press for parity with the lobby Start button.)
- Pre-fill each player's slots with random suggestions (so locking is one tap) or
  start empty?
- Should players be able to see their own previously chosen list on later turns
  (read-only) for reference?

## Acceptance criteria

- Starting a Manual game shows the picker to every player at once with live lock
  progress.
- Round 1 cannot begin until all players are locked in.
- Each player's turn uses the exact targets they chose pre-game.
- No player can see another player's secret target words.
- Randomized games behave exactly as before.
