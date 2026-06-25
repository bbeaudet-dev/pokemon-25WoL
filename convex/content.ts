import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { initialContentWords, toSeedRecord } from "../src/lib/content/initial-content";
import { normalizeWord } from "../src/lib/game/rules";

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

const seedWord = v.object({
  label: v.string(),
  category: contentCategory,
  imageUrl: v.optional(v.string()),
  source: v.union(v.literal("pokeapi"), v.literal("curated")),
  sourceId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
});

async function upsertContentWord(ctx: any, word: any) {
  const now = Date.now();
  const normalizedLabel = normalizeWord(word.label);
  const existing = await ctx.db
    .query("content")
    .withIndex("by_category_normalizedLabel", (q: any) =>
      q.eq("category", word.category).eq("normalizedLabel", normalizedLabel),
    )
    .unique();

  const patch = {
    label: word.label,
    normalizedLabel,
    category: word.category,
    searchText: `${normalizedLabel} ${word.category.replace("_", " ")}`,
    imageUrl: word.imageUrl,
    source: word.source,
    sourceId: word.sourceId,
    sourceUrl: word.sourceUrl,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("content", {
    ...patch,
    createdAt: now,
  });
}

export const search = queryGeneric({
  args: {
    query: v.string(),
    categories: v.optional(v.array(contentCategory)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 25);
    const categories = args.categories ?? [];
    const normalizedQuery = normalizeWord(args.query);

    if (!normalizedQuery) {
      const categoryWords = categories.length
        ? await Promise.all(
            categories.map((category) =>
              ctx.db
                .query("content")
                .withIndex("by_category", (q) => q.eq("category", category))
                .take(limit),
            ),
          )
        : [await ctx.db.query("content").take(limit)];

      return categoryWords
        .flat()
        .slice(0, limit)
        .map((word) => ({
          id: word._id,
          label: word.label,
          normalizedLabel: word.normalizedLabel,
          category: word.category,
          imageUrl: word.imageUrl,
          source: word.source,
          sourceId: word.sourceId,
          sourceUrl: word.sourceUrl,
        }));
    }

    const searched = await ctx.db
      .query("content")
      .withSearchIndex("search_label", (q) =>
        q.search("searchText", normalizedQuery),
      )
      .take(limit * 2);

    return searched
      .filter(
        (word) => categories.length === 0 || categories.includes(word.category),
      )
      .slice(0, limit)
      .map((word) => ({
        id: word._id,
        label: word.label,
        normalizedLabel: word.normalizedLabel,
        category: word.category,
        imageUrl: word.imageUrl,
        source: word.source,
        sourceId: word.sourceId,
        sourceUrl: word.sourceUrl,
      }));
  },
});

export const seedInitial = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const ids = await Promise.all(
      initialContentWords.map((word) => upsertContentWord(ctx, toSeedRecord(word))),
    );

    await ctx.db.insert("events", {
      type: "content.seeded",
      payload: { count: ids.length },
      createdAt: Date.now(),
    });

    return { count: ids.length };
  },
});

export const upsertMany = mutationGeneric({
  args: {
    words: v.array(seedWord),
  },
  handler: async (ctx, args) => {
    const ids = await Promise.all(
      args.words.map((word) => upsertContentWord(ctx, word)),
    );

    const categories = args.words.reduce<Record<string, number>>((counts, word) => {
      counts[word.category] = (counts[word.category] ?? 0) + 1;
      return counts;
    }, {});

    await ctx.db.insert("events", {
      type: "content.upserted",
      payload: { count: ids.length, categories },
      createdAt: Date.now(),
    });

    return { count: ids.length };
  },
});
