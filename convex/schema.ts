import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

const gameMode = v.union(
  v.literal("chill"),
  v.literal("classic"),
  v.literal("advanced"),
  v.literal("custom"),
);

const lobbyStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("complete"),
);

const gameSettings = v.object({
  mode: gameMode,
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

const contentWord = v.object({
  contentId: v.id("content"),
  label: v.string(),
  normalizedLabel: v.string(),
  category: contentCategory,
  imageUrl: v.optional(v.string()),
  source: v.union(v.literal("pokeapi"), v.literal("curated")),
  sourceId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
});

const targetWord = v.object({
  contentId: v.id("content"),
  label: v.string(),
  normalizedLabel: v.string(),
  category: contentCategory,
  imageUrl: v.optional(v.string()),
  source: v.union(v.literal("pokeapi"), v.literal("curated")),
  sourceId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  solvedByPlayerIds: v.array(v.id("players")),
  solvedAt: v.optional(v.number()),
});

const hintWord = v.object({
  id: v.string(),
  text: v.string(),
  normalizedText: v.string(),
  createdAt: v.number(),
  cost: v.number(),
});

const submittedHint = v.object({
  id: v.string(),
  hintWordIds: v.array(v.string()),
  text: v.string(),
  createdAt: v.number(),
  targetIndex: v.number(),
});

const scoreEntry = v.object({
  playerId: v.id("players"),
  totalScore: v.number(),
  roundScore: v.number(),
});

export default defineSchema({
  players: defineTable({
    guestId: v.string(),
    displayName: v.string(),
    imageUrl: v.optional(v.string()),
    authSubject: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_guestId", ["guestId"]),

  lobbies: defineTable({
    code: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    status: lobbyStatus,
    hostPlayerId: v.id("players"),
    settings: gameSettings,
    maxPlayers: v.number(),
    currentGameId: v.optional(v.id("games")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status_visibility", ["status", "visibility"]),

  lobbyPlayers: defineTable({
    lobbyId: v.id("lobbies"),
    playerId: v.id("players"),
    isHost: v.boolean(),
    isReady: v.boolean(),
    joinedAt: v.number(),
  })
    .index("by_lobby", ["lobbyId"])
    .index("by_lobby_player", ["lobbyId", "playerId"])
    .index("by_player", ["playerId"]),

  games: defineTable({
    lobbyId: v.id("lobbies"),
    settings: gameSettings,
    status: lobbyStatus,
    roundOrder: v.array(v.id("players")),
    currentRoundIndex: v.optional(v.number()),
    currentRoundId: v.optional(v.id("rounds")),
    scores: v.array(scoreEntry),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_lobby", ["lobbyId"]),

  rounds: defineTable({
    gameId: v.id("games"),
    lobbyId: v.id("lobbies"),
    hintGiverPlayerId: v.id("players"),
    status: v.union(
      v.literal("setup"),
      v.literal("active"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    targetWords: v.array(targetWord),
    currentTargetIndex: v.number(),
    hintWords: v.array(hintWord),
    submittedHints: v.array(submittedHint),
    rerollCount: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_lobby", ["lobbyId"]),

  guesses: defineTable({
    roundId: v.id("rounds"),
    gameId: v.id("games"),
    lobbyId: v.id("lobbies"),
    playerId: v.id("players"),
    submittedHintId: v.string(),
    guessedWord: contentWord,
    targetIndex: v.number(),
    isCorrect: v.boolean(),
    pointsAwarded: v.number(),
    penaltyApplied: v.number(),
    createdAt: v.number(),
  })
    .index("by_round", ["roundId"])
    .index("by_game", ["gameId"])
    .index("by_hint_player", ["submittedHintId", "playerId"]),

  content: defineTable({
    label: v.string(),
    normalizedLabel: v.string(),
    category: contentCategory,
    searchText: v.string(),
    imageUrl: v.optional(v.string()),
    source: v.union(v.literal("pokeapi"), v.literal("curated")),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedLabel", ["normalizedLabel"])
    .index("by_category", ["category"])
    .index("by_category_normalizedLabel", ["category", "normalizedLabel"])
    .searchIndex("search_label", {
      searchField: "searchText",
      filterFields: ["category"],
    }),

  events: defineTable({
    lobbyId: v.optional(v.id("lobbies")),
    gameId: v.optional(v.id("games")),
    roundId: v.optional(v.id("rounds")),
    playerId: v.optional(v.id("players")),
    type: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_lobby", ["lobbyId"])
    .index("by_game", ["gameId"])
    .index("by_round", ["roundId"]),
});
