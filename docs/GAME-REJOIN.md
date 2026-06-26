Active games should eventually preserve player seats.

Right now, leaving an active game removes the player from the lobby/game state. That is acceptable for the MVP only because rejoining is not built yet.

The better long-term behavior is: once a player has joined a game, keep their player card and score slot for the rest of that game. If they leave or disconnect, mark them as disconnected, allow them to rejoin with the same guest identity, and restore control of their existing seat.
