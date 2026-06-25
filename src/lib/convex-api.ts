import { makeFunctionReference } from "convex/server";
import type { ContentCategory, ContentWord, GameSettings, LobbySummary } from "@/lib/game/types";

export type LobbyDetails = {
  id: string;
  code: string;
  visibility: "public" | "private";
  status: "open" | "in_progress" | "complete";
  settings: GameSettings;
  maxPlayers: number;
  currentGameId?: string;
  hostPlayerId: string;
  players: Array<{
    id: string;
    guestId: string;
    displayName: string;
    imageUrl?: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
  }>;
  createdAt: number;
  updatedAt: number;
};

export type GameRoom = {
  lobby: {
    id: string;
    code: string;
    visibility: "public" | "private";
    status: "open" | "in_progress" | "complete";
    settings: GameSettings;
    maxPlayers: number;
    hostPlayerId: string;
  };
  players: LobbyDetails["players"];
  game: null | {
    id: string;
    status: "open" | "in_progress" | "complete";
    settings: GameSettings;
    scores: Array<{
      playerId: string;
      totalScore: number;
      roundScore: number;
    }>;
    roundOrder: string[];
  };
  round: null | {
    id: string;
    status: "setup" | "active" | "complete" | "failed";
    hintGiverPlayerId: string;
    targetWords: Array<ContentWord & {
      contentId: string;
      solvedByPlayerIds: string[];
      solvedAt?: number;
    }>;
    currentTargetIndex: number;
    hintWords: Array<{
      id: string;
      text: string;
      normalizedText: string;
      createdAt: number;
      cost: number;
    }>;
    submittedHints: Array<{
      id: string;
      hintWordIds: string[];
      text: string;
      createdAt: number;
      targetIndex: number;
    }>;
    rerollCount: number;
    startedAt: number;
    completedAt?: number;
  };
  guesses: Array<{
    _id: string;
    playerId: string;
    submittedHintId: string;
    guessedWord: ContentWord & { contentId: string };
    targetIndex: number;
    isCorrect: boolean;
    pointsAwarded: number;
    penaltyApplied: number;
    createdAt: number;
  }>;
};

export const convexApi = {
  lobbies: {
    listOpen: makeFunctionReference<"query", Record<string, never>, LobbySummary[]>(
      "lobbies:listOpen",
    ),
    getByCode: makeFunctionReference<"query", { code: string }, LobbyDetails | null>(
      "lobbies:getByCode",
    ),
    create: makeFunctionReference<
      "mutation",
      { guestId: string; displayName: string },
      { lobbyId: string; code: string }
    >("lobbies:create"),
    join: makeFunctionReference<
      "mutation",
      { code: string; guestId: string; displayName: string },
      { lobbyId: string; code: string }
    >("lobbies:join"),
    setReady: makeFunctionReference<
      "mutation",
      { lobbyId: string; guestId: string; isReady: boolean },
      null
    >("lobbies:setReady"),
    updateSettings: makeFunctionReference<
      "mutation",
      {
        lobbyId: string;
        guestId: string;
        settings: GameSettings;
        visibility: "public" | "private";
      },
      null
    >("lobbies:updateSettings"),
  },
  games: {
    getRoom: makeFunctionReference<"query", { lobbyId: string }, GameRoom | null>(
      "games:getRoom",
    ),
    start: makeFunctionReference<
      "mutation",
      { lobbyId: string; guestId: string },
      { gameId: string }
    >("games:start"),
    rerollTargets: makeFunctionReference<
      "mutation",
      { roundId: string; guestId: string },
      null
    >("games:rerollTargets"),
    addHintWord: makeFunctionReference<
      "mutation",
      { roundId: string; guestId: string; text: string },
      { id: string; text: string; normalizedText: string; createdAt: number; cost: number }
    >("games:addHintWord"),
    submitHint: makeFunctionReference<
      "mutation",
      { roundId: string; guestId: string; hintWordIds: string[] },
      { id: string; hintWordIds: string[]; text: string; createdAt: number; targetIndex: number }
    >("games:submitHint"),
    submitGuess: makeFunctionReference<
      "mutation",
      {
        roundId: string;
        guestId: string;
        submittedHintId: string;
        contentId: string;
      },
      { isCorrect: boolean; penaltyApplied: number; pointsAwarded: number; netPoints: number }
    >("games:submitGuess"),
  },
  content: {
    search: makeFunctionReference<
      "query",
      { query: string; categories?: ContentCategory[]; limit?: number },
      ContentWord[]
    >("content:search"),
    seedInitial: makeFunctionReference<"mutation", Record<string, never>, { count: number }>(
      "content:seedInitial",
    ),
  },
};
