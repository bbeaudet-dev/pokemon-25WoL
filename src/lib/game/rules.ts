import type {
  ContentCategory,
  ContentWord,
  GameSettings,
  Guess,
  TargetWord,
} from "./types";

export const categoryDifficultyOrder: ContentCategory[] = [
  "pokemon",
  "game",
  "type",
  "item",
  "region",
  "professor",
  "gym_leader",
  "badge",
  "town",
  "move",
  "ability",
];

export const chillCategories: ContentCategory[] = [
  "pokemon",
  "game",
  "type",
];

export const classicCategories: ContentCategory[] = [
  ...chillCategories,
  "item",
  "region",
  "professor",
  "gym_leader",
];

export const advancedCategories: ContentCategory[] = [
  ...classicCategories,
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
  town: "Locations/Routes",
  type: "Types",
};

export function formatCategoryLabel(category: ContentCategory) {
  return categoryLabels[category];
}

export const defaultGameSettings: GameSettings = {
  mode: "chill",
  isPrivate: false,
  hintGiverTurnsPerPlayer: 1,
  targetWordsPerRound: 8,
  scoringWordLimit: 25,
  hardWordLimit: 40,
  pointsPerRemainingWord: 1,
  pointsPerCorrectGuess: 1,
  categories: chillCategories,
  targetSelection: "random",
};

export const targetWordsByMode = {
  chill: 8,
  classic: 10,
  advanced: 12,
} as const;

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

  if (settings.mode !== "custom") {
    settings.targetWordsPerRound = targetWordsByMode[settings.mode];
    settings.categories =
      settings.mode === "advanced"
        ? advancedCategories
        : settings.mode === "classic"
          ? classicCategories
          : chillCategories;
  }

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

export function canRerollWithinScoringLimit(
  usedWordCount: number,
  nextRerollCost: number,
  settings: Pick<GameSettings, "scoringWordLimit">,
) {
  if (nextRerollCost <= 0) {
    return true;
  }

  return settings.scoringWordLimit - usedWordCount - nextRerollCost > 0;
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

export const targetAnchorCategories: ContentCategory[] = [
  "region",
  "game",
  "type",
  "item",
  "professor",
  "gym_leader",
  "badge",
  "town",
  "move",
  "ability",
];

const targetCategoryCaps: Partial<Record<ContentCategory, number>> = {
  ability: 1,
  badge: 1,
  game: 1,
  gym_leader: 1,
  item: 2,
  move: 1,
  professor: 1,
  region: 1,
  town: 1,
  type: 1,
};

const targetCategoryChances: Partial<Record<ContentCategory, number>> = {
  ability: 0.5,
  badge: 0.5,
  move: 0.5,
  town: 0.5,
};

function getTargetCategoryChance(category: ContentCategory) {
  return targetCategoryChances[category] ?? 0.7;
}

export function selectTargetCandidates<T extends Pick<ContentWord, "category">>(
  items: T[],
  count: number,
  random: () => number = Math.random,
) {
  const selected: T[] = [];
  const remaining = [...items];
  const enabledCategories = new Set<ContentCategory>(["pokemon"]);

  function selectedCategoryCount(category: ContentCategory) {
    return selected.filter((item) => item.category === category).length;
  }

  function canSelectCategory(category: ContentCategory) {
    const cap = targetCategoryCaps[category];
    return cap === undefined || selectedCategoryCount(category) < cap;
  }

  function takeRandomFromCategory(category: ContentCategory) {
    if (!canSelectCategory(category)) {
      return undefined;
    }

    const candidates = remaining
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.category === category);

    if (candidates.length === 0) {
      return undefined;
    }

    const candidate = candidates[Math.floor(random() * candidates.length)];
    remaining.splice(candidate.index, 1);
    selected.push(candidate.item);
    return candidate.item;
  }

  if (count <= 0) {
    return [];
  }

  takeRandomFromCategory("pokemon");

  for (const category of targetAnchorCategories) {
    if (selected.length >= count) {
      break;
    }

    if (random() <= getTargetCategoryChance(category)) {
      enabledCategories.add(category);
      takeRandomFromCategory(category);
    }
  }

  const shuffledRemaining = selectRandomItems(remaining, remaining.length, random);
  for (const item of shuffledRemaining) {
    if (selected.length >= count) {
      break;
    }

    if (!enabledCategories.has(item.category) || !canSelectCategory(item.category)) {
      continue;
    }

    selected.push(item);
  }

  if (selected.length < count) {
    const selectedSet = new Set(selected);
    for (const item of shuffledRemaining) {
      if (selected.length >= count) {
        break;
      }

      if (
        selectedSet.has(item) ||
        !enabledCategories.has(item.category) ||
        !canSelectCategory(item.category)
      ) {
        continue;
      }

      selected.push(item);
      selectedSet.add(item);
    }
  }

  const [firstTarget, ...otherTargets] = selected.slice(0, count);

  if (firstTarget?.category === "pokemon") {
    return [
      firstTarget,
      ...selectRandomItems(otherTargets, otherTargets.length, random),
    ];
  }

  return selectRandomItems(selected, count, random);
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
