import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  defaultGameSettings,
  makeGameSettings,
} from "../src/lib/game/rules";

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
  const existing = await ctx.db
    .query("players")
    .withIndex("by_guestId", (q: any) => q.eq("guestId", guestId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      displayName: cleanName,
      lastSeenAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("players", {
    guestId,
    displayName: cleanName,
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

export const listOpen = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const lobbies = await ctx.db
      .query("lobbies")
      .order("desc")
      .take(50);

    const activeLobbies = lobbies
      .filter((lobby) => lobby.status !== "complete")
      .slice(0, 25);

    return await Promise.all(
      activeLobbies.map(async (lobby) => {
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

    if (!existingMembership) {
      await ctx.db.insert("lobbyPlayers", {
        lobbyId: lobby._id,
        playerId,
        isHost: false,
        isReady: false,
        joinedAt: Date.now(),
      });
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

    const remaining = await ctx.db
      .query("lobbyPlayers")
      .withIndex("by_lobby", (q) => q.eq("lobbyId", args.lobbyId))
      .collect();

    if (remaining.length === 0 && lobby.status === "open") {
      await ctx.db.delete(lobby._id);
    } else if (membership.isHost && remaining.length > 0) {
      const nextHost = remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      await ctx.db.patch(nextHost._id, { isHost: true });
      await ctx.db.patch(lobby._id, {
        hostPlayerId: nextHost.playerId,
        updatedAt: Date.now(),
      });
    }

    await recordEvent(ctx, {
      lobbyId: args.lobbyId,
      playerId: player._id,
      type: "lobby.left",
      payload: {},
    });
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
