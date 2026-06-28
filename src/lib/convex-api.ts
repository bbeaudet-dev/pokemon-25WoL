export { api as convexApi } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";
import type { ContentWord, GameSettings } from "@/lib/game/types";

export type LobbyDetails = {
  id: Id<"lobbies">;
  code: string;
  visibility: "public" | "private";
  status: "open" | "in_progress" | "complete" | "abandoned";
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
    status: "open" | "in_progress" | "complete" | "abandoned";
    settings: GameSettings;
    maxPlayers: number;
    hostPlayerId: Id<"players">;
  };
  players: LobbyDetails["players"];
  game: null | {
    id: Id<"games">;
    status: "open" | "in_progress" | "complete" | "abandoned";
    phase: "manual_selection" | "playing";
    settings: GameSettings;
    scores: Array<{
      playerId: Id<"players">;
      totalScore: number;
      roundScore: number;
    }>;
    roundOrder: Id<"players">[];
    currentRoundIndex: number;
    completedAt?: number;
    // The caller's own picks. Only returned to that player (other players never
    // receive these), and null unless getRoom was passed their guestId.
    manualSelection: null | {
      targets: Array<ContentWord & { contentId: Id<"content"> }>;
      lockedIn: boolean;
    };
    // Who has locked in. Safe to show everyone (no words, just the flag).
    manualLockProgress: Array<{
      playerId: Id<"players">;
      lockedIn: boolean;
    }>;
    // True when the caller (by guestId) is part of this game but may have lost
    // their lobby membership — used to offer a seamless rejoin.
    callerIsParticipant: boolean;
  };
  round: null | {
    id: Id<"rounds">;
    status: "active" | "complete" | "failed";
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
