# Ideas

Remove crown icon from game over, or move it so it doesn't move icon/name
Display name, icon, and redo should be on same row on mobile

## Manual Target Word Selection

The picker UI is done: target cards are tappable and open an inline search
(results styled like the guesser search), and the redundant "slot" buttons are
gone.

Remaining (see MANUAL-TARGET-SELECTION.md): in a Manual game, every player
should pick their target words simultaneously during a shared pre-game setup,
instead of waiting for each hintmaster to choose at the start of their own
round. This needs per-player target selections persisted on the game (we
currently only store the active round's targets), a shared "everyone is
picking" step, and starting round 1 only once everyone has locked in.
Randomized is unaffected since those targets are generated when a player
becomes the hintmaster.

## Hintmaster Scoring Control

Let the hintmaster manually mark who guessed a target correctly.

Stretch: keep the microphone active during a turn and analyze speech to
auto-detect correct guesses (and maybe auto-advance targets).

## Content Categories & Sub-categories

Split broad PokeAPI categories into individually toggleable sub-categories. For
example, "Items" currently lumps together held items, consumable items, Poke
Balls, evolution items, berries, TMs/HMs, key items, and more. Breaking these
out would make Custom mode far more granular and make per-category avatars more
meaningful (it is hard to pick one image that represents all of "Items"). Likely
needs new category values plus a seed/import pass that maps PokeAPI item
categories onto ours.

## Beyond Pokemon (other themes)

Extend the engine to non-Pokemon content packs, each with its own database and
categories. The game logic is theme-agnostic, so this is mostly a theme
selector plus separate seeded databases.

- Theatre (most wanted next): musicals, plays, people, songs, venues, awards
- Music: songs, albums, artists, awards, genres

## Lobby Management

Host migration now reassigns the host to the next player when the host leaves,
and lobbies persist until empty. Still worth verifying the host-leaves-mid-game
case.

## Fanmade Games

Light Platinum, Radical Red, Emerald Kaizo
Pokemon Uranium (Nuclear type, Nuclear Ball)

## Display Names & Profile Avatars

Lobby joins should check for duplicate display names and reroll or suffix the
generated name when needed.

Players should be able to select a new avatar from a grid, either from the
curated list or from a search-bar style interface like there is within the game
for guessers.

## Content Ideas

Add Elite Four members, champions, rivals, and other notable trainers as a
future content category or curated trainer set.
Mom, rivals, playable characters

## Content Database Explorer

Add a browsable content database page where players can freely explore all
seeded content words outside of a game. Useful filters could include category,
source, image availability, and text search, with detail cards showing artwork,
source links, and whether the word is eligible for Classic, Advanced, or Custom
modes.

Would also give me a place to review which content is missing images or needs
updated labels.
