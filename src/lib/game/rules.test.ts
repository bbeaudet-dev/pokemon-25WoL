import { describe, expect, it } from "vitest";
import {
  canRerollWithinScoringLimit,
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

  it("sets target counts for fixed modes", () => {
    expect(makeGameSettings({ mode: "chill" }).targetWordsPerRound).toBe(8);
    expect(makeGameSettings({ mode: "classic" }).targetWordsPerRound).toBe(10);
    expect(makeGameSettings({ mode: "advanced" }).targetWordsPerRound).toBe(12);
  });
});

describe("reroll costs", () => {
  it("gives one free reroll before triangular costs begin", () => {
    expect(getTotalRerollWordCost(1)).toBe(0);
    expect(getTotalRerollWordCost(2)).toBe(1);
    expect(getTotalRerollWordCost(3)).toBe(3);
  });

  it("blocks rerolls that would exhaust the scoring word limit", () => {
    const settings = { scoringWordLimit: 25 };

    expect(canRerollWithinScoringLimit(12, 12, settings)).toBe(true);
    expect(canRerollWithinScoringLimit(13, 12, settings)).toBe(false);
    expect(canRerollWithinScoringLimit(20, 0, settings)).toBe(true);
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

  it("can reserve enabled anchor categories without fixing their slots", () => {
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

    expect(selected[0].category).toBe("pokemon");
    expect(selected).toHaveLength(6);
    expect(
      selected.filter((word) => ["region", "game"].includes(word.category)),
    ).toHaveLength(1);
    expect(selected.map((word) => word.category)).not.toEqual([
      "pokemon",
      "region",
      "type",
      "item",
      "professor",
      "badge",
    ]);
  });

  it("caps randomized categories while enough pokemon exist to fill", () => {
    const selected = selectTargetCandidates(
      [
        makeWord("pokemon", "Sceptile"),
        makeWord("pokemon", "Raichu"),
        makeWord("pokemon", "Lapras"),
        makeWord("pokemon", "Dragonite"),
        makeWord("pokemon", "Gengar"),
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
        makeWord("gym_leader", "Brock"),
        makeWord("badge", "Boulder Badge"),
      ],
      12,
      () => 0,
    );

    expect(selected).toHaveLength(12);
    expect(selected.filter((word) => word.category === "item").length).toBeLessThanOrEqual(2);
    expect(selected.filter((word) => word.category === "move")).toHaveLength(1);
    expect(selected.filter((word) => word.category === "town")).toHaveLength(1);
    expect(selected.filter((word) => word.category === "ability")).toHaveLength(1);
    expect(
      selected.filter((word) => ["region", "game"].includes(word.category)),
    ).toHaveLength(1);
    expect(selected.filter((word) => word.category === "type")).toHaveLength(1);
    expect(
      selected.filter((word) =>
        ["professor", "gym_leader"].includes(word.category),
      ),
    ).toHaveLength(1);
    expect(selected.filter((word) => word.category === "badge")).toHaveLength(1);
  });

  it("fills with pokemon after capped classic categories are exhausted", () => {
    const selected = selectTargetCandidates(
      [
        makeWord("pokemon", "Sceptile"),
        makeWord("pokemon", "Raichu"),
        makeWord("pokemon", "Lapras"),
        makeWord("pokemon", "Dragonite"),
        makeWord("pokemon", "Gengar"),
        makeWord("region", "Kanto Region"),
        makeWord("game", "Pokemon Scarlet"),
        makeWord("type", "Fire Type"),
        makeWord("item", "Potion"),
        makeWord("item", "X Attack"),
        makeWord("item", "Noodles"),
        makeWord("professor", "Professor Oak"),
        makeWord("gym_leader", "Brock"),
      ],
      10,
      () => 0,
    );

    expect(selected.filter((word) => word.category === "pokemon")).toHaveLength(5);
    expect(
      selected.filter((word) => ["region", "game"].includes(word.category)),
    ).toHaveLength(1);
    expect(
      selected.filter((word) =>
        ["professor", "gym_leader"].includes(word.category),
      ),
    ).toHaveLength(1);
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
