export { api as convexApi } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import type { ContentWord, GameSettings } from "@/lib/game/types";

export type LobbyDetails = {
  id: Id<"lobbies">;
  code: string;
  visibility: "public" | "private";
  status: "open" | "in_progress" | "complete";
  settings: GameSettings;
  maxPlayers: number;
  currentGameId?: Id<"games">;
  hostPlayerId: Id<"players">;
  players: Array<{
    id: Id<"players">;
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
    id: Id<"lobbies">;
    code: string;
    visibility: "public" | "private";
    status: "open" | "in_progress" | "complete";
    settings: GameSettings;
    maxPlayers: number;
    hostPlayerId: Id<"players">;
  };
  players: LobbyDetails["players"];
  game: null | {
    id: Id<"games">;
    status: "open" | "in_progress" | "complete";
    settings: GameSettings;
    scores: Array<{
      playerId: Id<"players">;
      totalScore: number;
      roundScore: number;
    }>;
    roundOrder: Id<"players">[];
    currentRoundIndex: number;
    completedAt?: number;
  };
  round: null | {
    id: Id<"rounds">;
    status: "setup" | "active" | "complete" | "failed";
    hintGiverPlayerId: Id<"players">;
    targetWords: Array<ContentWord & {
      contentId: Id<"content">;
      solvedByPlayerIds: Id<"players">[];
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
    playerId: Id<"players">;
    submittedHintId: string;
    guessedWord: ContentWord & { contentId: Id<"content"> };
    targetIndex: number;
    isCorrect: boolean;
    pointsAwarded: number;
    penaltyApplied: number;
    createdAt: number;
  }>;
};
