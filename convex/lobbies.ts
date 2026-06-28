import {
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import {
  defaultGameSettings,
  makeGameSettings,
} from "../src/lib/game/rules";
import { getPlayerAvatarUrl } from "../src/lib/player-avatar";
import {
  beginManualCycleIfReady,
  ensureManualSelectionForPlayer,
  isGameParticipant,
} from "./games";

const contentCategory = v.union(
  v.literal("pokemon"),
  v.literal("type"),
  v.literal("game"),
  v.literal("badge"),
  v.literal("professor"),
  v.literal("item"),
  v.literal("move"),
  v.literal("gym_leader"),
  v.literal("ability"),
  v.literal("town"),
  v.literal("region"),
  v.literal("terminology"),
);

const gameSettingsValidator = v.object({
  mode: v.union(
    v.literal("chill"),
    v.literal("classic"),
    v.literal("advanced"),
    v.literal("custom"),
  ),
  isPrivate: v.boolean(),
  hintGiverTurnsPerPlayer: v.number(),
  targetWordsPerRound: v.number(),
  scoringWordLimit: v.number(),
  hardWordLimit: v.number(),
  pointsPerRemainingWord: v.optional(v.number()),
  pointsPerCorrectGuess: v.number(),
  categories: v.array(contentCategory),
  targetSelection: v.union(v.literal("random"), v.literal("manual")),
});

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeLobbyCode() {
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

async function createUniqueLobbyCode(ctx: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = makeLobbyCode();
    const existing = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .unique();

    if (!existing) {
      return code;
    }
  }

  throw new Error("Unable to create a unique lobby code.");
}

async function upsertGuestPlayer(
  ctx: any,
  guestId: string,
  displayName: string,
) {
  const now = Date.now();
  const cleanName = displayName.trim().slice(0, 24) || "Guest";
  const imageUrl = getPlayerAvatarUrl(cleanName);
  const existing = await ctx.db
    .query("players")
    .withIndex("by_guestId", (q: any) => q.eq("guestId", guestId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      displayName: cleanName,
      imageUrl,
      lastSeenAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("players", {
    guestId,
    displayName: cleanName,
    imageUrl,
    createdAt: now,
    lastSeenAt: now,
  });
}

async function getLobbyPlayers(ctx: any, lobbyId: string) {
  const memberships = await ctx.db
    .query("lobbyPlayers")
    .withIndex("by_lobby", (q: any) => q.eq("lobbyId", lobbyId))
    .collect();

  const players = await Promise.all(
    memberships.map(async (membership: any) => {
      const player = await ctx.db.get(membership.playerId);
      return {
        id: membership.playerId,
        guestId: player?.guestId ?? "",
        displayName: player?.displayName ?? "Unknown Player",
        imageUrl: player?.imageUrl,
        isHost: membership.isHost,
        isReady: membership.isReady,
        joinedAt: membership.joinedAt,
      };
    }),
  );

  return players.sort((a, b) => a.joinedAt - b.joinedAt);
}

async function recordEvent(ctx: any, event: Record<string, unknown>) {
  await ctx.db.insert("events", {
    ...event,
    createdAt: Date.now(),
  });
}

// A player counts as "active" until this long after their last heartbeat (or
// their join time, if they never sent one). The cron reaper uses the same
// window to decide a membership has gone stale.
export const PRESENCE_TIMEOUT_MS = 15 * 60 * 1000;

// Mark an in-progress lobby/game as abandoned once everyone has left. We keep
// the records (rather than deleting them) so abandoned games stay distinct from
// games that reached a natural finish.
async function abandonLobby(ctx: any, lobby: any) {
  const now = Date.now();

  const game = lobby.currentGameId
    ? await ctx.db.get(lobby.currentGameId)
    : null;

  if (game && game.status === "in_progress") {
    await ctx.db.patch(game._id, {
      status: "abandoned",
      completedAt: now,
      updatedAt: now,
    });

    if (game.currentRoundId) {
      const round = await ctx.db.get(game.currentRoundId);
      if (round && round.status === "active") {
        await ctx.db.patch(round._id, { status: "failed", completedAt: now });
      }
    }
  }

  await ctx.db.patch(lobby._id, { status: "abandoned", updatedAt: now });

  await recordEvent(ctx, {
    lobbyId: lobby._id,
    gameId: game?._id,
    type: "lobby.abandoned",
    payload: {},
  });
}

// Shared cleanup run whenever a player leaves or is reaped. Handles deleting
// empty open lobbies, abandoning empty in-progress games, and transferring the
// host crown to the next remaining player.
async function reconcileLobbyAfterDeparture(ctx: any, lobbyId: string) {
  const lobby = await ctx.db.get(lobbyId);
  if (!lobby) {
    return;
  }

  const remaining = await ctx.db
    .query("lobbyPlayers")
    .withIndex("by_lobby", (q: any) => q.eq("lobbyId", lobbyId))
    .collect();

  if (remaining.length === 0) {
    if (lobby.status === "in_progress") {
      await abandonLobby(ctx, lobby);
    } else if (lobby.status !== "abandoned") {
      // Open or completed lobbies hold nothing worth keeping once empty.
      await ctx.db.delete(lobby._id);
    }
    return;
  }

  const hostStillPresent = remaining.some(
    (membership: any) => membership.playerId === lobby.hostPlayerId,
  );

  if (!hostStillPresent) {
    const nextHost = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt)[0];
    await ctx.db.patch(nextHost._id, { isHost: true });
    await ctx.db.patch(lobby._id, {
      hostPlayerId: nextHost.playerId,
      updatedAt: Date.now(),
    });
    await recordEvent(ctx, {
      lobbyId: lobby._id,
      playerId: nextHost.playerId,
      type: "lobby.host_transferred",
      payload: {},
    });
  }

  // If a player leaves (or is reaped) mid-pick during a manual game, drop their
  // selection entry so the "everyone locked in" check doesn't wait forever, and
  // start the cycle if the remaining players were the only holdouts.
  const game = lobby.currentGameId
    ? await ctx.db.get(lobby.currentGameId)
    : null;
  if (game && game.phase === "manual_selection") {
    const remainingIds = new Set(
      remaining.map((membership: any) => String(membership.playerId)),
    );
    const prunedSelections = (game.manualSelections ?? []).filter(
      (entry: any) => remainingIds.has(String(entry.playerId)),
    );
    if (prunedSelections.length !== (game.manualSelections ?? []).length) {
      await ctx.db.patch(game._id, {
        manualSelections: prunedSelections,
        updatedAt: Date.now(),
      });
    }
    const refreshedGame = await ctx.db.get(game._id);
    await beginManualCycleIfReady(ctx, refreshedGame);
  }
}

export const listOpen = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const [openLobbies, inProgressLobbies, completedLobbies] =
      await Promise.all([
        ctx.db
          .query("lobbies")
          .withIndex("by_status_visibility", (q) =>
            q.eq("status", "open"),
          )
          .order("desc")
          .collect(),
        ctx.db
          .query("lobbies")
          .withIndex("by_status_visibility", (q) =>
            q.eq("status", "in_progress"),
          )
          .collect(),
        ctx.db
          .query("lobbies")
          .withIndex("by_status_visibility", (q) => q.eq("status", "complete"))
          .collect(),
      ]);
    const joinableLobbies = openLobbies
      .filter((lobby) => lobby.visibility === "public")
      .slice(0, 25);
    const privateOpenCount = openLobbies.filter(
      (lobby) => lobby.visibility === "private",
    ).length;

    const joinable = await Promise.all(
      joinableLobbies.map(async (lobby) => {
        const players = await getLobbyPlayers(ctx, lobby._id);
        const host = players.find((player) => player.isHost);

        return {
          id: lobby._id,
          code: lobby.code,
          visibility: lobby.visibility,
          status: lobby.status,
          mode: lobby.settings.mode,
          playerCount: players.length,
          maxPlayers: lobby.maxPlayers,
          hostName: host?.displayName ?? "Unknown Host",
          createdAt: lobby.createdAt,
        };
      }),
    );

    return {
      joinable,
      stats: {
        completedCount: completedLobbies.length,
        inProgressCount: inProgressLobbies.length,
        privateCount: privateOpenCount,
      },
    };
  },
});

// In-progress games the caller is still part of, so the home screen can offer a
// "Rejoin" entry (covers both still-members and players already reaped/left).
export const listRejoinable = queryGeneric({
  args: { guestId: v.string() },
  handler: async (ctx, args) => {
    if (!args.guestId) {
      return [];
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();
    if (!player) {
      return [];
    }

    const inProgress = await ctx.db
      .query("lobbies")
      .withIndex("by_status_visibility", (q) => q.eq("status", "in_progress"))
      .collect();

    const rejoinable = [];
    for (const lobby of inProgress) {
      const game = lobby.currentGameId
        ? await ctx.db.get(lobby.currentGameId)
        : null;
      if (!game || !isGameParticipant(game, player._id)) {
        continue;
      }

      const players = await getLobbyPlayers(ctx, lobby._id);
      const host = players.find((p) => p.isHost);
      rejoinable.push({
        id: lobby._id,
        code: lobby.code,
        mode: lobby.settings.mode,
        playerCount: players.length,
        maxPlayers: lobby.maxPlayers,
        hostName: host?.displayName ?? "Unknown Host",
      });
    }

    return rejoinable;
  },
});

export const getByCode = queryGeneric({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const lobby = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();

    if (!lobby) {
      return null;
    }

    return {
      id: lobby._id,
      code: lobby.code,
      visibility: lobby.visibility,
      status: lobby.status,
      settings: lobby.settings,
      maxPlayers: lobby.maxPlayers,
      currentGameId: lobby.currentGameId,
      hostPlayerId: lobby.hostPlayerId,
      players: await getLobbyPlayers(ctx, lobby._id),
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    };
  },
});

export const create = mutationGeneric({
  args: {
    guestId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const playerId = await upsertGuestPlayer(
      ctx,
      args.guestId,
      args.displayName,
    );
    const code = await createUniqueLobbyCode(ctx);
    const settings = makeGameSettings(defaultGameSettings);

    const lobbyId = await ctx.db.insert("lobbies", {
      code,
      visibility: "public",
      status: "open",
      hostPlayerId: playerId,
      settings,
      maxPlayers: 8,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("lobbyPlayers", {
      lobbyId,
      playerId,
      isHost: true,
      isReady: false,
      joinedAt: now,
      lastSeenAt: now,
    });

    await recordEvent(ctx, {
      lobbyId,
      playerId,
      type: "lobby.created",
      payload: { code },
    });

    return { lobbyId, code };
  },
});

export const join = mutationGeneric({
  args: {
    code: v.string(),
    guestId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();

    if (!lobby) {
      throw new Error("Lobby not found.");
    }

    if (lobby.status !== "open") {
      throw new Error("This lobby is already in progress.");
    }

    const players = await getLobbyPlayers(ctx, lobby._id);
    if (players.length >= lobby.maxPlayers) {
      throw new Error("This lobby is full.");
    }

    const playerId = await upsertGuestPlayer(
      ctx,
      args.guestId,
      args.displayName,
    );
    const existingMembership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", lobby._id).eq("playerId", playerId),
      )
      .unique();

    const now = Date.now();
    if (!existingMembership) {
      await ctx.db.insert("lobbyPlayers", {
        lobbyId: lobby._id,
        playerId,
        isHost: false,
        isReady: false,
        joinedAt: now,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.patch(existingMembership._id, { lastSeenAt: now });
    }

    await recordEvent(ctx, {
      lobbyId: lobby._id,
      playerId,
      type: "lobby.joined",
      payload: {},
    });

    return { lobbyId: lobby._id, code: lobby.code };
  },
});

// Re-enter an in-progress game after leaving / disconnecting. Unlike join, this
// is allowed while the lobby is in_progress, but ONLY for players who are still
// part of the running game (kept in its round order / scores). It restores a
// lobby membership and, during a manual pick phase, re-grants a selection slot.
export const rejoin = mutationGeneric({
  args: {
    code: v.string(),
    guestId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db
      .query("lobbies")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .unique();

    if (!lobby) {
      throw new Error("Lobby not found.");
    }

    if (lobby.status !== "in_progress") {
      throw new Error("This game is not in progress.");
    }

    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
    if (!game) {
      throw new Error("This game is no longer available.");
    }

    const playerId = await upsertGuestPlayer(
      ctx,
      args.guestId,
      args.displayName,
    );

    if (!isGameParticipant(game, playerId)) {
      throw new Error("You are not part of this game.");
    }

    const now = Date.now();
    const existingMembership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", lobby._id).eq("playerId", playerId),
      )
      .unique();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("lobbyPlayers", {
        lobbyId: lobby._id,
        playerId,
        isHost: false,
        isReady: false,
        joinedAt: now,
        lastSeenAt: now,
      });
      await recordEvent(ctx, {
        lobbyId: lobby._id,
        playerId,
        type: "lobby.rejoined",
        payload: {},
      });
    }

    // If a manual game is still mid-pick, make sure the rejoiner has a slot.
    const refreshedGame = await ctx.db.get(game._id);
    await ensureManualSelectionForPlayer(ctx, refreshedGame, playerId);

    return { lobbyId: lobby._id, code: lobby.code };
  },
});

export const leave = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!lobby || !player) {
      return;
    }

    const membership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", args.lobbyId).eq("playerId", player._id),
      )
      .unique();

    if (!membership) {
      return;
    }

    await ctx.db.delete(membership._id);

    await recordEvent(ctx, {
      lobbyId: args.lobbyId,
      playerId: player._id,
      type: "lobby.left",
      payload: {},
    });

    await reconcileLobbyAfterDeparture(ctx, args.lobbyId);
  },
});

export const heartbeat = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!player) {
      return;
    }

    const membership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", args.lobbyId).eq("playerId", player._id),
      )
      .unique();

    if (!membership) {
      return;
    }

    const now = Date.now();
    await ctx.db.patch(membership._id, { lastSeenAt: now });
    await ctx.db.patch(player._id, { lastSeenAt: now });
  },
});

// Cron-driven backstop: remove memberships whose heartbeat has gone stale, then
// reconcile each affected lobby (delete empty open lobbies, abandon empty
// in-progress games, transfer host). This is what catches players who close
// the tab or disconnect without calling `leave`.
export const reapStaleMembers = internalMutationGeneric({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - PRESENCE_TIMEOUT_MS;

    const memberships = await ctx.db.query("lobbyPlayers").collect();
    const affectedLobbyIds = new Set<string>();
    let reaped = 0;

    for (const membership of memberships) {
      const lastActive = membership.lastSeenAt ?? membership.joinedAt;
      if (lastActive < cutoff) {
        await ctx.db.delete(membership._id);
        affectedLobbyIds.add(String(membership.lobbyId));
        reaped += 1;
      }
    }

    // Also catch lobbies that are already empty but still marked open or
    // in-progress (e.g. orphaned by older leave logic that never cleaned up
    // in-progress games). reconcile is a no-op when players remain.
    const liveLobbies = await Promise.all([
      ctx.db
        .query("lobbies")
        .withIndex("by_status_visibility", (q: any) => q.eq("status", "open"))
        .collect(),
      ctx.db
        .query("lobbies")
        .withIndex("by_status_visibility", (q: any) =>
          q.eq("status", "in_progress"),
        )
        .collect(),
    ]).then((groups) => groups.flat());

    for (const lobby of liveLobbies) {
      affectedLobbyIds.add(String(lobby._id));
    }

    for (const lobbyId of affectedLobbyIds) {
      await reconcileLobbyAfterDeparture(ctx, lobbyId as any);
    }

    return { reaped, lobbiesReconciled: affectedLobbyIds.size };
  },
});

export const setReady = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
    isReady: v.boolean(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!player) {
      throw new Error("Player not found.");
    }

    const membership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", args.lobbyId).eq("playerId", player._id),
      )
      .unique();

    if (!membership) {
      throw new Error("You are not in this lobby.");
    }

    await ctx.db.patch(membership._id, { isReady: args.isReady });
    await recordEvent(ctx, {
      lobbyId: args.lobbyId,
      playerId: player._id,
      type: args.isReady ? "lobby.ready" : "lobby.unready",
      payload: {},
    });
  },
});

export const returnToLobby = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!lobby || !player) {
      throw new Error("Lobby not found.");
    }

    const membership = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby_player", (q) =>
        (q as any).eq("lobbyId", args.lobbyId).eq("playerId", player._id),
      )
      .unique();

    if (!membership) {
      throw new Error("You are not in this lobby.");
    }

    if (lobby.status !== "complete") {
      return { reset: false };
    }

    await ctx.db.patch(lobby._id, {
      status: "open",
      currentGameId: undefined,
      updatedAt: Date.now(),
    });

    const memberships = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id))
      .collect();

    await Promise.all(
      memberships.map((m) => ctx.db.patch(m._id, { isReady: false })),
    );

    await recordEvent(ctx, {
      lobbyId: lobby._id,
      playerId: player._id,
      type: "lobby.returned",
      payload: {},
    });

    return { reset: true };
  },
});

export const updateDisplayName = mutationGeneric({
  args: {
    guestId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!player) {
      throw new Error("Player not found.");
    }

    const displayName = args.displayName.trim().slice(0, 24) || "Guest";
    await ctx.db.patch(player._id, {
      displayName,
      imageUrl: getPlayerAvatarUrl(displayName),
      lastSeenAt: Date.now(),
    });
  },
});

export const updateSettings = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
    settings: gameSettingsValidator,
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await ctx.db
      .query("players")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (!lobby || !player || lobby.hostPlayerId !== player._id) {
      throw new Error("Only the host can update lobby settings.");
    }

    const settings = makeGameSettings(args.settings);
    await ctx.db.patch(lobby._id, {
      settings,
      visibility: args.visibility,
      updatedAt: Date.now(),
    });

    const memberships = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby", (q) => q.eq("lobbyId", lobby._id))
      .collect();

    await Promise.all(
      memberships.map((membership) =>
        ctx.db.patch(membership._id, { isReady: false }),
      ),
    );

    await recordEvent(ctx, {
      lobbyId: lobby._id,
      playerId: player._id,
      type: "lobby.settings_updated",
      payload: { settings, visibility: args.visibility },
    });
  },
});
