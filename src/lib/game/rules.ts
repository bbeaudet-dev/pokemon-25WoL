import type {
  ContentCategory,
  ContentWord,
  GameSettings,
  Guess,
  TargetWord,
} from "./types";

export const classicCategories: ContentCategory[] = [
  "pokemon",
  "game",
  "professor",
  "item",
  "gym_leader",
  "region",
];

export const advancedCategories: ContentCategory[] = [
  ...classicCategories,
  "type",
  "badge",
  "town",
  "move",
  "ability",
];

export const categoryLabels: Record<ContentCategory, string> = {
  ability: "Abilities",
  badge: "Badges",
  game: "Games",
  gym_leader: "Gym Leaders",
  item: "Items",
  move: "Moves",
  pokemon: "Pokemon",
  professor: "Professors",
  region: "Regions",
  terminology: "Terminology",
  town: "Towns",
  type: "Types",
};

export function formatCategoryLabel(category: ContentCategory) {
  return categoryLabels[category];
}

export const defaultGameSettings: GameSettings = {
  mode: "classic",
  isPrivate: true,
  hintGiverTurnsPerPlayer: 1,
  targetWordsPerRound: 10,
  scoringWordLimit: 25,
  hardWordLimit: 40,
  pointsPerRemainingWord: 1,
  pointsPerCorrectGuess: 1,
  categories: classicCategories,
  targetSelection: "random",
};

export function normalizeWord(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWordTokens(value: string) {
  return normalizeWord(value).split(" ").filter(Boolean);
}

export function makeGameSettings(
  overrides: Partial<GameSettings> = {},
): GameSettings {
  const settings = {
    ...defaultGameSettings,
    ...overrides,
  };

  if (settings.hardWordLimit < settings.scoringWordLimit) {
    settings.hardWordLimit = settings.scoringWordLimit;
  }

  return settings;
}

export function getRerollWordCost(nextRerollNumber: number) {
  return Math.max(0, nextRerollNumber - 1);
}

export function getTotalRerollWordCost(rerollCount: number) {
  return (rerollCount * (rerollCount - 1)) / 2;
}

export function calculateHintGiverScore(
  usedWordCount: number,
  settings: Pick<GameSettings, "scoringWordLimit" | "hardWordLimit"> &
    Partial<Pick<GameSettings, "pointsPerRemainingWord">>,
) {
  const cappedWordCount = Math.min(usedWordCount, settings.hardWordLimit);
  return (
    (settings.scoringWordLimit - cappedWordCount) *
    (settings.pointsPerRemainingWord ?? 1)
  );
}

export function isRoundOutOfWords(
  usedWordCount: number,
  settings: Pick<GameSettings, "hardWordLimit">,
) {
  return usedWordCount >= settings.hardWordLimit;
}

export function isGuessCorrect(
  guess: Pick<ContentWord, "normalizedLabel">,
  target: Pick<TargetWord, "normalizedLabel">,
) {
  return guess.normalizedLabel === target.normalizedLabel;
}

export function scoreGuess(params: {
  isCorrect: boolean;
  previousGuessCountForHint: number;
  pointsPerCorrectGuess: number;
}) {
  const penaltyApplied = params.previousGuessCountForHint > 0 ? 1 : 0;
  const pointsAwarded = params.isCorrect ? params.pointsPerCorrectGuess : 0;

  return {
    penaltyApplied,
    pointsAwarded,
    netPoints: pointsAwarded - penaltyApplied,
  };
}

export function selectRandomItems<T>(
  items: T[],
  count: number,
  random: () => number = Math.random,
) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count);
}

export function hintViolatesTargetWords(
  hintText: string,
  targets: Pick<TargetWord, "label" | "normalizedLabel">[],
) {
  const normalizedHint = normalizeWord(hintText);

  if (!normalizedHint) {
    return false;
  }

  return targets.some((target) => {
    if (normalizedHint === target.normalizedLabel) {
      return true;
    }

    return getWordTokens(target.label).includes(normalizedHint);
  });
}

export function getCurrentTarget(targets: TargetWord[], currentTargetIndex: number) {
  return targets[currentTargetIndex];
}

export function getPreviousGuessCountForHint(
  guesses: Pick<Guess, "playerId" | "submittedHintId">[],
  playerId: string,
  submittedHintId: string,
) {
  return guesses.filter(
    (guess) =>
      guess.playerId === playerId && guess.submittedHintId === submittedHintId,
  ).length;
}
