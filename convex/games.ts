import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  canRerollWithinScoringLimit,
  calculateHintGiverScore,
  getPreviousGuessCountForHint,
  getRerollWordCost,
  isGuessCorrect,
  makeGameSettings,
  normalizeWord,
  scoreGuess,
  selectTargetCandidates,
} from "../src/lib/game/rules";

async function getPlayerByGuestId(ctx: any, guestId: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_guestId", (q: any) => q.eq("guestId", guestId))
    .unique();
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

function toTargetWord(word: any) {
  return {
    contentId: word._id,
    label: word.label,
    normalizedLabel: word.normalizedLabel,
    category: word.category,
    imageUrl: word.imageUrl,
    source: word.source,
    sourceId: word.sourceId,
    sourceUrl: word.sourceUrl,
    solvedByPlayerIds: [],
  };
}

// A content doc -> the stored `contentWord` shape (no solve fields). Used for a
// player's persisted manual selections.
function toContentWord(word: any) {
  return {
    contentId: word._id,
    label: word.label,
    normalizedLabel: word.normalizedLabel,
    category: word.category,
    imageUrl: word.imageUrl,
    source: word.source,
    sourceId: word.sourceId,
    sourceUrl: word.sourceUrl,
  };
}

// A stored `contentWord` (from manualSelections) -> a fresh round `targetWord`.
function toTargetWordFromContent(word: any) {
  return {
    contentId: word.contentId,
    label: word.label,
    normalizedLabel: word.normalizedLabel,
    category: word.category,
    imageUrl: word.imageUrl,
    source: word.source,
    sourceId: word.sourceId,
    sourceUrl: word.sourceUrl,
    solvedByPlayerIds: [],
  };
}

async function fetchCategoryContent(ctx: any, settings: any) {
  const contentByCategory = await Promise.all(
    settings.categories.map((category: string) =>
      ctx.db
        .query("content")
        .withIndex("by_category", (q: any) => q.eq("category", category))
        .collect(),
    ),
  );
  return contentByCategory.flat();
}

async function selectTargetWords(ctx: any, settings: any) {
  const content = await fetchCategoryContent(ctx, settings);

  if (content.length < settings.targetWordsPerRound) {
    throw new Error(
      "Not enough content has been seeded for these game settings.",
    );
  }

  const targetWords = selectTargetCandidates(
    content,
    settings.targetWordsPerRound,
    Math.random,
  ).map(toTargetWord);

  if (targetWords.length < settings.targetWordsPerRound) {
    throw new Error(
      "Not enough content has been seeded for these category limits.",
    );
  }

  return targetWords;
}

// Random suggestions in the stored `contentWord` shape, used to pre-fill each
// player's slots at the start of a manual-selection cycle.
async function selectContentWords(ctx: any, settings: any) {
  const content = await fetchCategoryContent(ctx, settings);

  if (content.length < settings.targetWordsPerRound) {
    throw new Error(
      "Not enough content has been seeded for these game settings.",
    );
  }

  const words = selectTargetCandidates(
    content,
    settings.targetWordsPerRound,
    Math.random,
  ).map(toContentWord);

  if (words.length < settings.targetWordsPerRound) {
    throw new Error(
      "Not enough content has been seeded for these category limits.",
    );
  }

  return words;
}

// One prefilled, unlocked manualSelections entry per current lobby player.
async function initManualSelections(ctx: any, settings: any, players: any[]) {
  const now = Date.now();
  return Promise.all(
    players.map(async (player: any) => ({
      playerId: player.id,
      targets: await selectContentWords(ctx, settings),
      lockedIn: false,
      updatedAt: now,
    })),
  );
}

// How many rounds make up one full hintmaster cycle (every player once).
function getCycleSize(game: any) {
  const turns = game.settings.hintGiverTurnsPerPlayer || 1;
  return Math.max(1, Math.round(game.roundOrder.length / turns));
}

async function selectReplacementTarget(
  ctx: any,
  settings: any,
  existingTargets: any[],
  targetIndex: number,
) {
  const replaced = existingTargets[targetIndex];
  const existingIds = new Set(
    existingTargets.map((target) => String(target.contentId)),
  );

  // Prefer a replacement from the same category to keep the round's mix intact,
  // then fall back to any enabled category if that pool is exhausted.
  const sameCategory = await ctx.db
    .query("content")
    .withIndex("by_category", (q: any) => q.eq("category", replaced.category))
    .collect();
  let pool = sameCategory.filter(
    (word: any) => !existingIds.has(String(word._id)),
  );

  if (pool.length === 0) {
    const byCategory = await Promise.all(
      settings.categories.map((category: string) =>
        ctx.db
          .query("content")
          .withIndex("by_category", (q: any) => q.eq("category", category))
          .collect(),
      ),
    );
    pool = byCategory
      .flat()
      .filter((word: any) => !existingIds.has(String(word._id)));
  }

  if (pool.length === 0) {
    throw new Error("No replacement target is available to reroll.");
  }

  const choice = pool[Math.floor(Math.random() * pool.length)];
  return toTargetWord(choice);
}

async function createRound(ctx: any, game: any, hintGiverPlayerId: string) {
  const now = Date.now();

  // Manual games pull the hintmaster's pre-chosen targets for this cycle. Fall
  // back to random if a selection is somehow missing (e.g. a ghost turn left by
  // a departed player). Random games always generate fresh targets.
  let targetWords;
  if (game.settings.targetSelection === "manual") {
    const selection = (game.manualSelections ?? []).find(
      (entry: any) => String(entry.playerId) === String(hintGiverPlayerId),
    );
    if (
      selection &&
      selection.targets.length >= game.settings.targetWordsPerRound
    ) {
      targetWords = selection.targets
        .slice(0, game.settings.targetWordsPerRound)
        .map(toTargetWordFromContent);
    } else {
      targetWords = await selectTargetWords(ctx, game.settings);
    }
  } else {
    targetWords = await selectTargetWords(ctx, game.settings);
  }

  const roundId = await ctx.db.insert("rounds", {
    gameId: game._id,
    lobbyId: game.lobbyId,
    hintGiverPlayerId,
    status: "active",
    targetWords,
    currentTargetIndex: 0,
    hintWords: [],
    submittedHints: [],
    rerollCount: 0,
    startedAt: now,
  });

  await ctx.db.patch(game._id, {
    currentRoundId: roundId,
    updatedAt: now,
  });

  await recordEvent(ctx, {
    lobbyId: game.lobbyId,
    gameId: game._id,
    roundId,
    playerId: hintGiverPlayerId,
    type: "round.started",
    payload: { targetCount: targetWords.length },
  });

  return roundId;
}

// When every player in the current manual-selection cycle has locked in, flip
// the game to "playing" and start the cycle's first round from stored picks.
// Exported so the lobby-departure reconciler can also trigger a start when a
// straggler leaves. Returns true if a cycle was started.
export async function beginManualCycleIfReady(ctx: any, game: any) {
  if (!game || game.phase !== "manual_selection") {
    return false;
  }

  const selections = game.manualSelections ?? [];
  if (selections.length === 0 || !selections.every((s: any) => s.lockedIn)) {
    return false;
  }

  await ctx.db.patch(game._id, { phase: "playing", updatedAt: Date.now() });

  const refreshed = await ctx.db.get(game._id);
  await createRound(
    ctx,
    refreshed,
    refreshed.roundOrder[refreshed.currentRoundIndex ?? 0],
  );

  return true;
}

// Give a (re)joining player a fresh, unlocked selection entry if a manual cycle
// is mid-pick and they don't have one yet. Used when a participant rejoins
// during the selection phase so they can pick their words like everyone else.
export async function ensureManualSelectionForPlayer(
  ctx: any,
  game: any,
  playerId: string,
) {
  if (!game || game.phase !== "manual_selection") {
    return;
  }

  const selections = game.manualSelections ?? [];
  if (
    selections.some((entry: any) => String(entry.playerId) === String(playerId))
  ) {
    return;
  }

  const entry = {
    playerId,
    targets: await selectContentWords(ctx, game.settings),
    lockedIn: false,
    updatedAt: Date.now(),
  };

  await ctx.db.patch(game._id, {
    manualSelections: [...selections, entry],
    updatedAt: Date.now(),
  });
}

function toScoreMap(scores: any[]) {
  return new Map(scores.map((score) => [score.playerId, { ...score }]));
}

// Whether a player is part of an in-progress game (kept in the round order or
// score table even after their lobby membership was removed).
export function isGameParticipant(game: any, playerId: string) {
  if (!game) {
    return false;
  }
  return (
    game.roundOrder.some((id: any) => String(id) === String(playerId)) ||
    (game.scores ?? []).some(
      (score: any) => String(score.playerId) === String(playerId),
    )
  );
}

export const getRoom = queryGeneric({
  args: { lobbyId: v.id("lobbies"), guestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    if (!lobby) {
      return null;
    }

    const players = await getLobbyPlayers(ctx, args.lobbyId);
    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
    const caller = args.guestId
      ? await getPlayerByGuestId(ctx, args.guestId)
      : null;

    // Lock progress is public (names + locked flag); each player's chosen words
    // are secret, so we only expose the caller's own selection.
    const manualLockProgress = (game?.manualSelections ?? []).map(
      (entry: any) => ({ playerId: entry.playerId, lockedIn: entry.lockedIn }),
    );
    let manualSelection: {
      targets: any[];
      lockedIn: boolean;
    } | null = null;
    if (game && caller) {
      const entry = (game.manualSelections ?? []).find(
        (s: any) => String(s.playerId) === String(caller._id),
      );
      if (entry) {
        manualSelection = { targets: entry.targets, lockedIn: entry.lockedIn };
      }
    }

    // Lets the client offer a seamless rejoin to a participant whose lobby
    // membership was dropped (left, closed tab, or reaped) mid-game.
    const callerIsParticipant = Boolean(
      game && caller && isGameParticipant(game, caller._id),
    );
    const round = game?.currentRoundId
      ? await ctx.db.get(game.currentRoundId)
      : null;
    const guesses = round
      ? await ctx.db
          .query("guesses")
          .withIndex("by_round", (q) => q.eq("roundId", round._id))
          .collect()
      : [];

    return {
      lobby: {
        id: lobby._id,
        code: lobby.code,
        visibility: lobby.visibility,
        status: lobby.status,
        settings: lobby.settings,
        maxPlayers: lobby.maxPlayers,
        hostPlayerId: lobby.hostPlayerId,
      },
      players,
      game: game
        ? {
            id: game._id,
            status: game.status,
            phase: game.phase,
            settings: game.settings,
            scores: game.scores,
            roundOrder: game.roundOrder,
            currentRoundIndex: game.currentRoundIndex ?? 0,
            completedAt: game.completedAt,
            manualSelection,
            manualLockProgress,
            callerIsParticipant,
          }
        : null,
      round: round
        ? {
            id: round._id,
            status: round.status,
            hintGiverPlayerId: round.hintGiverPlayerId,
            targetWords: round.targetWords,
            currentTargetIndex: round.currentTargetIndex,
            hintWords: round.hintWords,
            submittedHints: round.submittedHints,
            rerollCount: round.rerollCount,
            startedAt: round.startedAt,
            completedAt: round.completedAt,
          }
        : null,
      guesses,
    };
  },
});

export const start = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!lobby || !player || lobby.hostPlayerId !== player._id) {
      throw new Error("Only the host can start the game.");
    }

    if (lobby.status !== "open") {
      throw new Error("This lobby has already started.");
    }

    const players = await getLobbyPlayers(ctx, lobby._id);
    if (players.some((lobbyPlayer) => !lobbyPlayer.isReady)) {
      throw new Error("All players must ready up before starting.");
    }

    const now = Date.now();
    const settings = makeGameSettings(lobby.settings);
    const baseOrder = players.map((lobbyPlayer) => lobbyPlayer.id);
    const roundOrder = Array.from(
      { length: settings.hintGiverTurnsPerPlayer },
      () => baseOrder,
    ).flat();
    const isManual = settings.targetSelection === "manual";

    // Prefill before inserting the game so a "not enough content" error aborts
    // without leaving a half-created game record behind.
    const manualSelections = isManual
      ? await initManualSelections(ctx, settings, players)
      : undefined;

    const gameId = await ctx.db.insert("games", {
      lobbyId: lobby._id,
      settings,
      status: "in_progress",
      phase: isManual ? "manual_selection" : "playing",
      roundOrder,
      currentRoundIndex: 0,
      scores: players.map((lobbyPlayer) => ({
        playerId: lobbyPlayer.id,
        totalScore: 0,
        roundScore: 0,
      })),
      manualSelections,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(lobby._id, {
      status: "in_progress",
      currentGameId: gameId,
      updatedAt: now,
    });

    // Manual games wait in the selection phase until everyone locks in; random
    // games jump straight into round 1.
    if (!isManual) {
      const game = await ctx.db.get(gameId);
      await createRound(ctx, game, roundOrder[0]);
    }
    await recordEvent(ctx, {
      lobbyId: lobby._id,
      gameId,
      playerId: player._id,
      type: "game.started",
      payload: { playerCount: players.length },
    });

    return { gameId };
  },
});

export const rerollCurrentTarget = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const game = round ? await ctx.db.get(round.gameId) : null;

    if (!round || !game || !player || round.hintGiverPlayerId !== player._id) {
      throw new Error("Unable to reroll this target.");
    }

    if (round.status !== "active") {
      throw new Error("You can only reroll while your turn is active.");
    }

    const currentTarget = round.targetWords[round.currentTargetIndex];
    if (!currentTarget) {
      throw new Error("There is no current target to reroll.");
    }

    if (currentTarget.solvedByPlayerIds.length > 0) {
      throw new Error("This target has already been solved.");
    }

    // Reroll penalties are cumulative per round (not per target), so we keep
    // incrementing the round-level reroll count and its triangular cost.
    const nextReroll = round.rerollCount + 1;
    const cost = getRerollWordCost(nextReroll);

    if (
      !canRerollWithinScoringLimit(round.hintWords.length, cost, game.settings)
    ) {
      throw new Error("Rerolling would use your remaining scoring words.");
    }

    const rerollWords = Array.from({ length: cost }, (_, index) => {
      const text =
        cost === 1
          ? `reroll ${nextReroll}`
          : `reroll ${nextReroll}${String.fromCharCode(97 + index)}`;

      return {
        id: crypto.randomUUID(),
        text,
        normalizedText: normalizeWord(text),
        createdAt: Date.now(),
        cost: 1,
      };
    });

    const replacement = await selectReplacementTarget(
      ctx,
      game.settings,
      round.targetWords,
      round.currentTargetIndex,
    );
    const targetWords = [...round.targetWords];
    targetWords[round.currentTargetIndex] = replacement;

    await ctx.db.patch(round._id, {
      targetWords,
      rerollCount: nextReroll,
      hintWords: [...round.hintWords, ...rerollWords],
    });

    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "round.target_rerolled",
      payload: {
        cost,
        targetIndex: round.currentTargetIndex,
        label: replacement.label,
      },
    });

    return { label: replacement.label, cost };
  },
});

export const setPlayerTarget = mutationGeneric({
  args: {
    gameId: v.id("games"),
    guestId: v.string(),
    targetIndex: v.number(),
    contentId: v.id("content"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const content = await ctx.db.get(args.contentId);

    if (!game || !player || !content) {
      throw new Error("Unable to set target.");
    }

    if (game.phase !== "manual_selection") {
      throw new Error("Target selection is closed.");
    }

    const selections = game.manualSelections ?? [];
    const index = selections.findIndex(
      (entry: any) => String(entry.playerId) === String(player._id),
    );
    if (index === -1) {
      throw new Error("You are not selecting targets in this game.");
    }

    const entry = selections[index];
    if (entry.lockedIn) {
      throw new Error("Unlock your targets before changing them.");
    }

    if (
      args.targetIndex < 0 ||
      args.targetIndex >= game.settings.targetWordsPerRound ||
      !Number.isInteger(args.targetIndex)
    ) {
      throw new Error("Target slot not found.");
    }

    if (!game.settings.categories.includes(content.category)) {
      throw new Error("That word is not in the enabled categories.");
    }

    if (
      entry.targets.some(
        (target: any, i: number) =>
          i !== args.targetIndex &&
          String(target.contentId) === String(content._id),
      )
    ) {
      throw new Error("You already picked that word.");
    }

    const targets = [...entry.targets];
    targets[args.targetIndex] = toContentWord(content);
    const updated = [...selections];
    updated[index] = { ...entry, targets, updatedAt: Date.now() };

    await ctx.db.patch(game._id, {
      manualSelections: updated,
      updatedAt: Date.now(),
    });
    await recordEvent(ctx, {
      lobbyId: game.lobbyId,
      gameId: game._id,
      playerId: player._id,
      type: "manual.target_set",
      payload: { targetIndex: args.targetIndex, label: content.label },
    });
  },
});

export const setPlayerLock = mutationGeneric({
  args: {
    gameId: v.id("games"),
    guestId: v.string(),
    lockedIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!game || !player) {
      throw new Error("Unable to update lock state.");
    }

    if (game.phase !== "manual_selection") {
      throw new Error("Target selection is closed.");
    }

    const selections = game.manualSelections ?? [];
    const index = selections.findIndex(
      (entry: any) => String(entry.playerId) === String(player._id),
    );
    if (index === -1) {
      throw new Error("You are not selecting targets in this game.");
    }

    const entry = selections[index];
    if (args.lockedIn) {
      const targets = entry.targets.slice(0, game.settings.targetWordsPerRound);
      const isFull =
        targets.length >= game.settings.targetWordsPerRound &&
        targets.every((target: any) => Boolean(target?.contentId));
      if (!isFull) {
        throw new Error("Pick all of your targets before locking in.");
      }
    }

    const updated = [...selections];
    updated[index] = { ...entry, lockedIn: args.lockedIn, updatedAt: Date.now() };

    await ctx.db.patch(game._id, {
      manualSelections: updated,
      updatedAt: Date.now(),
    });
    await recordEvent(ctx, {
      lobbyId: game.lobbyId,
      gameId: game._id,
      playerId: player._id,
      type: args.lockedIn ? "manual.locked" : "manual.unlocked",
      payload: {},
    });

    // Last player to lock auto-starts the cycle.
    const refreshed = await ctx.db.get(game._id);
    await beginManualCycleIfReady(ctx, refreshed);
  },
});

export const skipTurn = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!lobby || !player || lobby.hostPlayerId !== player._id) {
      throw new Error("Only the host can skip a turn.");
    }

    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
    const round = game?.currentRoundId
      ? await ctx.db.get(game.currentRoundId)
      : null;

    if (!game || !round) {
      throw new Error("There is no active turn to skip.");
    }

    if (round.status !== "active") {
      throw new Error("This turn cannot be skipped right now.");
    }

    // Skipping forfeits the hintmaster's round points (mirrors endTurn), but is
    // host-initiated so it works even when the hintmaster has left or is idle.
    const scores = toScoreMap(game.scores);
    const hintGiverScoreEntry = scores.get(round.hintGiverPlayerId) ?? {
      playerId: round.hintGiverPlayerId,
      totalScore: 0,
      roundScore: 0,
    };
    hintGiverScoreEntry.roundScore = 0;
    scores.set(round.hintGiverPlayerId, hintGiverScoreEntry);

    await ctx.db.patch(round._id, {
      status: "failed",
      completedAt: Date.now(),
    });
    await ctx.db.patch(game._id, {
      scores: Array.from(scores.values()),
      updatedAt: Date.now(),
    });

    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "round.skipped",
      payload: { skippedHintGiver: round.hintGiverPlayerId },
    });

    return { skipped: true };
  },
});

export const submitHintText = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!round || !player || round.hintGiverPlayerId !== player._id) {
      throw new Error("Unable to submit hint.");
    }

    if (round.status !== "active") {
      throw new Error("This turn is not active right now.");
    }

    const rawWords = args.text
      .trim()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (rawWords.length === 0) {
      throw new Error("Type at least one hint word.");
    }

    const now = Date.now();
    const hintWords = [...round.hintWords];
    const hintWordIds: string[] = [];

    for (const rawWord of rawWords) {
      const text = rawWord.slice(0, 48);
      const normalizedText = normalizeWord(text);

      if (!normalizedText) {
        continue;
      }

      const existing = hintWords.find(
        (word: any) => word.normalizedText === normalizedText,
      );

      if (existing) {
        hintWordIds.push(existing.id);
        continue;
      }

      const hintWord = {
        id: crypto.randomUUID(),
        text,
        normalizedText,
        createdAt: now,
        cost: 1,
      };
      hintWords.push(hintWord);
      hintWordIds.push(hintWord.id);
    }

    if (hintWordIds.length === 0) {
      throw new Error("Type at least one hint word.");
    }

    const submittedHint = {
      id: crypto.randomUUID(),
      hintWordIds,
      text: hintWordIds
        .map((id) => hintWords.find((word: any) => word.id === id)?.text)
        .filter((word): word is string => Boolean(word))
        .join(" "),
      createdAt: now,
      targetIndex: round.currentTargetIndex,
    };

    await ctx.db.patch(round._id, {
      hintWords,
      submittedHints: [...round.submittedHints, submittedHint],
    });

    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "hint.submitted",
      payload: { text: submittedHint.text },
    });

    return submittedHint;
  },
});

export const submitGuess = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
    submittedHintId: v.string(),
    contentId: v.id("content"),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const game = round ? await ctx.db.get(round.gameId) : null;
    const guessedWord = await ctx.db.get(args.contentId);

    if (!round || !game || !player || !guessedWord) {
      throw new Error("Unable to submit guess.");
    }

    if (round.hintGiverPlayerId === player._id) {
      throw new Error("The hintmaster cannot guess.");
    }

    const submittedHint = round.submittedHints.find(
      (hint: any) => hint.id === args.submittedHintId,
    );
    if (!submittedHint) {
      throw new Error("Hint not found.");
    }

    const target = round.targetWords[round.currentTargetIndex];
    const isCorrect = isGuessCorrect(guessedWord, target);
    const previousGuessCountForHint = await ctx.db
      .query("guesses")
      .withIndex("by_hint_player", (q) =>
        (q as any)
          .eq("submittedHintId", args.submittedHintId)
          .eq("playerId", player._id),
      )
      .collect()
      .then((guesses) =>
        getPreviousGuessCountForHint(
          guesses.map((guess: any) => ({
            playerId: guess.playerId,
            submittedHintId: guess.submittedHintId,
          })),
          player._id,
          args.submittedHintId,
        ),
      );

    const scoredGuess = scoreGuess({
      isCorrect,
      previousGuessCountForHint,
      pointsPerCorrectGuess: game.settings.pointsPerCorrectGuess,
    });

    await ctx.db.insert("guesses", {
      roundId: round._id,
      gameId: round.gameId,
      lobbyId: round.lobbyId,
      playerId: player._id,
      submittedHintId: args.submittedHintId,
      guessedWord: {
        contentId: guessedWord._id,
        label: guessedWord.label,
        normalizedLabel: guessedWord.normalizedLabel,
        category: guessedWord.category,
        imageUrl: guessedWord.imageUrl,
        source: guessedWord.source,
        sourceId: guessedWord.sourceId,
        sourceUrl: guessedWord.sourceUrl,
      },
      targetIndex: round.currentTargetIndex,
      isCorrect,
      pointsAwarded: scoredGuess.pointsAwarded,
      penaltyApplied: scoredGuess.penaltyApplied,
      createdAt: Date.now(),
    });

    const scores = toScoreMap(game.scores);
    const playerScore = scores.get(player._id) ?? {
      playerId: player._id,
      totalScore: 0,
      roundScore: 0,
    };
    playerScore.roundScore += scoredGuess.netPoints;
    scores.set(player._id, playerScore);

    let nextRoundPatch: Record<string, unknown> = {};
    if (isCorrect) {
      const targetWords = [...round.targetWords];
      targetWords[round.currentTargetIndex] = {
        ...target,
        solvedByPlayerIds: [...target.solvedByPlayerIds, player._id],
        solvedAt: Date.now(),
      };

      const solvedAllTargets =
        round.currentTargetIndex >= round.targetWords.length - 1;

      nextRoundPatch = {
        targetWords,
        currentTargetIndex: solvedAllTargets
          ? round.currentTargetIndex
          : round.currentTargetIndex + 1,
        status: solvedAllTargets ? "complete" : round.status,
        completedAt: solvedAllTargets ? Date.now() : round.completedAt,
      };

      if (solvedAllTargets) {
        const hintGiverScore = calculateHintGiverScore(
          round.hintWords.length,
          game.settings,
        );
        const hintGiverScoreEntry = scores.get(round.hintGiverPlayerId) ?? {
          playerId: round.hintGiverPlayerId,
          totalScore: 0,
          roundScore: 0,
        };
        hintGiverScoreEntry.roundScore += hintGiverScore;
        scores.set(round.hintGiverPlayerId, hintGiverScoreEntry);
      }
    }

    const updatedScores = Array.from(scores.values());
    await ctx.db.patch(round._id, nextRoundPatch);
    await ctx.db.patch(game._id, {
      scores: updatedScores,
      updatedAt: Date.now(),
    });

    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "guess.submitted",
      payload: {
        label: guessedWord.label,
        isCorrect,
        netPoints: scoredGuess.netPoints,
      },
    });

    return { isCorrect, ...scoredGuess };
  },
});

export const endTurn = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const game = round ? await ctx.db.get(round.gameId) : null;

    if (!round || !game || !player || round.hintGiverPlayerId !== player._id) {
      throw new Error("Only the hintmaster can end this turn.");
    }

    if (round.status !== "active") {
      throw new Error("This turn cannot be ended right now.");
    }

    // Ending a turn early forfeits the hintmaster's points for this round.
    // Guessers keep whatever they already earned this round.
    const scores = toScoreMap(game.scores);
    const hintGiverScoreEntry = scores.get(round.hintGiverPlayerId) ?? {
      playerId: round.hintGiverPlayerId,
      totalScore: 0,
      roundScore: 0,
    };
    hintGiverScoreEntry.roundScore = 0;
    scores.set(round.hintGiverPlayerId, hintGiverScoreEntry);

    await ctx.db.patch(round._id, {
      status: "failed",
      completedAt: Date.now(),
    });
    await ctx.db.patch(game._id, {
      scores: Array.from(scores.values()),
      updatedAt: Date.now(),
    });

    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "round.ended_early",
      payload: { wordsUsed: round.hintWords.length, forfeited: true },
    });

    return { forfeited: true };
  },
});

export const nextRound = mutationGeneric({
  args: {
    lobbyId: v.id("lobbies"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!lobby || !player || lobby.hostPlayerId !== player._id) {
      throw new Error("Only the host can advance the game.");
    }

    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
    const round = game?.currentRoundId
      ? await ctx.db.get(game.currentRoundId)
      : null;

    if (!game || !round) {
      throw new Error("There is no active round to advance.");
    }

    if (round.status !== "complete" && round.status !== "failed") {
      throw new Error("The current round is still in progress.");
    }

    const now = Date.now();
    const committedScores = game.scores.map((score: any) => ({
      playerId: score.playerId,
      totalScore: score.totalScore + score.roundScore,
      roundScore: 0,
    }));

    const nextIndex = (game.currentRoundIndex ?? 0) + 1;
    const isGameOver = nextIndex >= game.roundOrder.length;

    if (isGameOver) {
      await ctx.db.patch(game._id, {
        scores: committedScores,
        currentRoundIndex: nextIndex,
        status: "complete",
        completedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(lobby._id, {
        status: "complete",
        updatedAt: now,
      });
      await recordEvent(ctx, {
        lobbyId: lobby._id,
        gameId: game._id,
        playerId: player._id,
        type: "game.completed",
        payload: { rounds: game.roundOrder.length },
      });

      return { gameOver: true };
    }

    await ctx.db.patch(game._id, {
      scores: committedScores,
      currentRoundIndex: nextIndex,
      updatedAt: now,
    });

    const refreshedGame = await ctx.db.get(game._id);

    // Manual games re-open a fresh simultaneous selection phase at the start of
    // each new hintmaster cycle instead of creating the next round directly.
    const isManual = game.settings.targetSelection === "manual";
    const startsNewCycle = isManual && nextIndex % getCycleSize(game) === 0;

    if (startsNewCycle) {
      const cyclePlayers = await getLobbyPlayers(ctx, game.lobbyId);
      const manualSelections = await initManualSelections(
        ctx,
        game.settings,
        cyclePlayers,
      );
      await ctx.db.patch(refreshedGame._id, {
        phase: "manual_selection",
        manualSelections,
        updatedAt: Date.now(),
      });
    } else {
      await createRound(ctx, refreshedGame, game.roundOrder[nextIndex]);
    }

    return { gameOver: false };
  },
});

export const getSummary = queryGeneric({
  args: { lobbyId: v.id("lobbies") },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    if (!lobby) {
      return null;
    }

    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
    if (!game) {
      return null;
    }

    const players = await getLobbyPlayers(ctx, args.lobbyId);
    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    const correctByPlayer = new Map<string, number>();
    for (const guess of guesses) {
      if (guess.isCorrect) {
        correctByPlayer.set(
          guess.playerId,
          (correctByPlayer.get(guess.playerId) ?? 0) + 1,
        );
      }
    }

    const scoreByPlayer = new Map(
      game.scores.map((score: any) => [score.playerId, score.totalScore]),
    );

    const standings = players
      .map((player) => ({
        playerId: player.id,
        displayName: player.displayName,
        imageUrl: player.imageUrl,
        totalScore: (scoreByPlayer.get(player.id) as number) ?? 0,
        correctGuesses: correctByPlayer.get(player.id) ?? 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    const topScore = standings.length
      ? Math.max(...standings.map((entry) => entry.totalScore))
      : 0;
    const winnerIds =
      game.status === "complete"
        ? standings
            .filter((entry) => entry.totalScore === topScore)
            .map((entry) => entry.playerId)
        : [];

    const totalCorrectGuesses = guesses.filter(
      (guess) => guess.isCorrect,
    ).length;

    return {
      status: game.status,
      settings: game.settings,
      standings,
      winnerIds,
      stats: {
        roundsPlayed: rounds.filter(
          (round) => round.status === "complete" || round.status === "failed",
        ).length,
        totalCorrectGuesses,
      },
    };
  },
});
