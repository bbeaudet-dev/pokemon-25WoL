import { describe, expect, it } from "vitest";
import {
  calculateHintGiverScore,
  getTotalRerollWordCost,
  hintViolatesTargetWords,
  makeGameSettings,
  normalizeWord,
  scoreGuess,
  selectRandomItems,
  selectTargetCandidates,
} from "./rules";
import type { ContentWord, TargetWord } from "./types";

const targets: TargetWord[] = [
  {
    id: "poke-ball",
    label: "Poke Ball",
    normalizedLabel: "poke ball",
    category: "item",
    source: "pokeapi",
    solvedByPlayerIds: [],
  },
  {
    id: "mr-mime",
    label: "Mr. Mime",
    normalizedLabel: "mr mime",
    category: "pokemon",
    source: "pokeapi",
    solvedByPlayerIds: [],
  },
];

describe("normalizeWord", () => {
  it("normalizes casing, punctuation, and whitespace", () => {
    expect(normalizeWord("  Mr. Mime's   BALL!! ")).toBe("mr mimes ball");
  });
});

describe("makeGameSettings", () => {
  it("keeps the hard word limit at least as high as the scoring limit", () => {
    expect(
      makeGameSettings({ scoringWordLimit: 25, hardWordLimit: 20 })
        .hardWordLimit,
    ).toBe(25);
  });
});

describe("reroll costs", () => {
  it("gives one free reroll before triangular costs begin", () => {
    expect(getTotalRerollWordCost(1)).toBe(0);
    expect(getTotalRerollWordCost(2)).toBe(1);
    expect(getTotalRerollWordCost(3)).toBe(3);
  });
});

describe("calculateHintGiverScore", () => {
  it("awards positive, zero, and negative scores based on words used", () => {
    const settings = { scoringWordLimit: 25, hardWordLimit: 40 };

    expect(calculateHintGiverScore(5, settings)).toBe(20);
    expect(calculateHintGiverScore(25, settings)).toBe(0);
    expect(calculateHintGiverScore(27, settings)).toBe(-2);
  });

  it("applies the points per remaining word setting", () => {
    const settings = {
      scoringWordLimit: 25,
      hardWordLimit: 40,
      pointsPerRemainingWord: 2,
    };

    expect(calculateHintGiverScore(5, settings)).toBe(40);
    expect(calculateHintGiverScore(27, settings)).toBe(-4);
  });
});

describe("scoreGuess", () => {
  it("penalizes second and later guesses on the same submitted hint", () => {
    expect(
      scoreGuess({
        isCorrect: true,
        previousGuessCountForHint: 1,
        pointsPerCorrectGuess: 1,
      }),
    ).toEqual({ penaltyApplied: 1, pointsAwarded: 1, netPoints: 0 });
  });
});

describe("selectRandomItems", () => {
  it("can sample beyond the old 100-record category cap without mutating input", () => {
    const items = Array.from({ length: 200 }, (_, index) => index + 1);
    const selected = selectRandomItems(items, 150, () => 0.999999);

    expect(selected).toHaveLength(150);
    expect(selected).toContain(150);
    expect(items.at(-1)).toBe(200);
  });
});

describe("selectTargetCandidates", () => {
  const makeWord = (category: ContentWord["category"], label: string) => ({
    id: `${category}-${label}`,
    label,
    normalizedLabel: label.toLowerCase(),
    category,
    source: "curated" as const,
  });

  it("puts a pokemon first when pokemon are available", () => {
    const selected = selectTargetCandidates(
      [
        makeWord("item", "Mental Herb"),
        makeWord("region", "Kanto"),
        makeWord("pokemon", "Sceptile"),
      ],
      3,
      () => 0,
    );

    expect(selected[0].category).toBe("pokemon");
  });

  it("can reserve enabled anchor categories before filling the rest", () => {
    const selected = selectTargetCandidates(
      [
        makeWord("pokemon", "Sceptile"),
        makeWord("region", "Kanto"),
        makeWord("game", "Pokemon Scarlet"),
        makeWord("type", "Fire"),
        makeWord("move", "Thunderbolt"),
        makeWord("ability", "Static"),
        makeWord("item", "Potion"),
      ],
      6,
      () => 0,
    );

    expect(selected.map((word) => word.category)).toEqual([
      "pokemon",
      "region",
      "game",
      "type",
      "move",
      "ability",
    ]);
  });

  it("soft caps items while enough non-item content exists", () => {
    const selected = selectTargetCandidates(
      [
        makeWord("pokemon", "Sceptile"),
        makeWord("item", "Potion"),
        makeWord("item", "X Attack"),
        makeWord("item", "Noodles"),
        makeWord("region", "Kanto"),
        makeWord("game", "Pokemon Scarlet"),
        makeWord("type", "Fire"),
        makeWord("move", "Thunderbolt"),
        makeWord("ability", "Static"),
        makeWord("town", "Pallet Town"),
        makeWord("professor", "Professor Oak"),
      ],
      10,
      () => 0,
    );

    expect(selected.filter((word) => word.category === "item")).toHaveLength(2);
  });
});

describe("hintViolatesTargetWords", () => {
  it("blocks full target labels and full target tokens", () => {
    expect(hintViolatesTargetWords("Poke Ball", targets)).toBe(true);
    expect(hintViolatesTargetWords("ball", targets)).toBe(true);
    expect(hintViolatesTargetWords("mime", targets)).toBe(true);
  });

  it("does not block unrelated normalized words", () => {
    expect(hintViolatesTargetWords("capture", targets)).toBe(false);
  });
});
