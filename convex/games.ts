import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  calculateHintGiverScore,
  getPreviousGuessCountForHint,
  getRerollWordCost,
  hintViolatesTargetWords,
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

async function selectTargetWords(ctx: any, settings: any) {
  const contentByCategory = await Promise.all(
    settings.categories.map((category: string) =>
      ctx.db
        .query("content")
        .withIndex("by_category", (q: any) => q.eq("category", category))
        .collect(),
    ),
  );
  const content = contentByCategory.flat();

  if (content.length < settings.targetWordsPerRound) {
    throw new Error(
      "Not enough content has been seeded for these game settings.",
    );
  }

  return selectTargetCandidates(content, settings.targetWordsPerRound).map(
    toTargetWord,
  );
}

async function createRound(ctx: any, game: any, hintGiverPlayerId: string) {
  const now = Date.now();
  const targetWords = await selectTargetWords(ctx, game.settings);

  const roundId = await ctx.db.insert("rounds", {
    gameId: game._id,
    lobbyId: game.lobbyId,
    hintGiverPlayerId,
    status: "setup",
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

function toScoreMap(scores: any[]) {
  return new Map(scores.map((score) => [score.playerId, { ...score }]));
}

export const getRoom = queryGeneric({
  args: { lobbyId: v.id("lobbies") },
  handler: async (ctx, args) => {
    const lobby = await ctx.db.get(args.lobbyId);
    if (!lobby) {
      return null;
    }

    const players = await getLobbyPlayers(ctx, args.lobbyId);
    const game = lobby.currentGameId
      ? await ctx.db.get(lobby.currentGameId)
      : null;
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
            settings: game.settings,
            scores: game.scores,
            roundOrder: game.roundOrder,
            currentRoundIndex: game.currentRoundIndex ?? 0,
            completedAt: game.completedAt,
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

    const gameId = await ctx.db.insert("games", {
      lobbyId: lobby._id,
      settings,
      status: "in_progress",
      roundOrder,
      currentRoundIndex: 0,
      scores: players.map((lobbyPlayer) => ({
        playerId: lobbyPlayer.id,
        totalScore: 0,
        roundScore: 0,
      })),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(lobby._id, {
      status: "in_progress",
      currentGameId: gameId,
      updatedAt: now,
    });

    const game = await ctx.db.get(gameId);
    await createRound(ctx, game, roundOrder[0]);
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

export const rerollTargets = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const game = round ? await ctx.db.get(round.gameId) : null;

    if (!round || !game || !player || round.hintGiverPlayerId !== player._id) {
      throw new Error("Unable to reroll targets.");
    }

    if (round.status !== "setup") {
      throw new Error("The round has already started.");
    }

    const nextReroll = round.rerollCount + 1;
    const cost = getRerollWordCost(nextReroll);
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
    const targetWords = await selectTargetWords(ctx, game.settings);

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
      type: "round.rerolled",
      payload: { cost },
    });
  },
});

export const setManualTarget = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
    targetIndex: v.number(),
    contentId: v.id("content"),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);
    const content = await ctx.db.get(args.contentId);

    if (!round || !player || !content || round.hintGiverPlayerId !== player._id) {
      throw new Error("Unable to set target.");
    }

    if (round.status !== "setup") {
      throw new Error("Targets have already been confirmed.");
    }

    if (
      args.targetIndex < 0 ||
      args.targetIndex >= round.targetWords.length ||
      !Number.isInteger(args.targetIndex)
    ) {
      throw new Error("Target slot not found.");
    }

    const targetWords = [...round.targetWords];
    targetWords[args.targetIndex] = toTargetWord(content);

    await ctx.db.patch(round._id, { targetWords });
    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "round.target_set",
      payload: { targetIndex: args.targetIndex, label: content.label },
    });
  },
});

export const confirmTargets = mutationGeneric({
  args: {
    roundId: v.id("rounds"),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    const player = await getPlayerByGuestId(ctx, args.guestId);

    if (!round || !player || round.hintGiverPlayerId !== player._id) {
      throw new Error("Unable to confirm targets.");
    }

    await ctx.db.patch(round._id, { status: "active" });
    await recordEvent(ctx, {
      lobbyId: round.lobbyId,
      gameId: round.gameId,
      roundId: round._id,
      playerId: player._id,
      type: "round.targets_confirmed",
      payload: {},
    });
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
      throw new Error("Confirm targets before giving hints.");
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

      if (hintViolatesTargetWords(text, round.targetWords)) {
        throw new Error("Hint words cannot match a target word or its tokens.");
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

    const hintGiverScore = calculateHintGiverScore(
      round.hintWords.length,
      game.settings,
    );
    const scores = toScoreMap(game.scores);
    const hintGiverScoreEntry = scores.get(round.hintGiverPlayerId) ?? {
      playerId: round.hintGiverPlayerId,
      totalScore: 0,
      roundScore: 0,
    };
    hintGiverScoreEntry.roundScore += hintGiverScore;
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
      payload: { wordsUsed: round.hintWords.length, hintGiverScore },
    });

    return { hintGiverScore };
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
    await createRound(ctx, refreshedGame, game.roundOrder[nextIndex]);

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
