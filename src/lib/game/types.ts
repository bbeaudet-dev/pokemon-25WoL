export type GameMode = "chill" | "classic" | "advanced" | "custom";

export type LobbyVisibility = "public" | "private";

export type LobbyStatus = "open" | "in_progress" | "complete";

export type RoundStatus = "active" | "complete" | "failed";

export type ContentCategory =
  | "pokemon"
  | "type"
  | "game"
  | "badge"
  | "professor"
  | "item"
  | "move"
  | "gym_leader"
  | "ability"
  | "town"
  | "region"
  | "terminology";

export type WordSource = "pokeapi" | "curated";

export type GameSettings = {
  mode: GameMode;
  isPrivate: boolean;
  hintGiverTurnsPerPlayer: number;
  targetWordsPerRound: number;
  scoringWordLimit: number;
  hardWordLimit: number;
  pointsPerRemainingWord: number;
  pointsPerCorrectGuess: number;
  categories: ContentCategory[];
  targetSelection: "random" | "manual";
};

export type Player = {
  id: string;
  guestId: string;
  displayName: string;
  imageUrl?: string;
};

export type LobbyPlayer = Player & {
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
};

export type LobbySummary = {
  id: string;
  code: string;
  visibility: LobbyVisibility;
  status: LobbyStatus;
  mode: GameMode;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  createdAt: number;
};

export type ContentWord = {
  id: string;
  label: string;
  normalizedLabel: string;
  category: ContentCategory;
  imageUrl?: string;
  source: WordSource;
  sourceId?: string;
  sourceUrl?: string;
};

export type TargetWord = ContentWord & {
  solvedByPlayerIds: string[];
  solvedAt?: number;
};

export type HintWord = {
  id: string;
  text: string;
  normalizedText: string;
  createdAt: number;
  cost: number;
};

export type SubmittedHint = {
  id: string;
  hintWordIds: string[];
  text: string;
  createdAt: number;
  targetIndex: number;
};

export type Guess = {
  id: string;
  playerId: string;
  submittedHintId: string;
  contentWordId: string;
  label: string;
  targetIndex: number;
  isCorrect: boolean;
  pointsAwarded: number;
  penaltyApplied: number;
  createdAt: number;
};

export type ScoreEntry = {
  playerId: string;
  totalScore: number;
  roundScore: number;
};

export type RoundState = {
  id: string;
  gameId: string;
  hintGiverPlayerId: string;
  status: RoundStatus;
  targetWords: TargetWord[];
  currentTargetIndex: number;
  hintWords: HintWord[];
  submittedHints: SubmittedHint[];
  guesses: Guess[];
  rerollCount: number;
  startedAt: number;
  completedAt?: number;
};

export type GameState = {
  id: string;
  lobbyId: string;
  settings: GameSettings;
  status: LobbyStatus;
  players: LobbyPlayer[];
  currentRound?: RoundState;
  scores: ScoreEntry[];
  roundOrder: string[];
};
