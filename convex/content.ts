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

const showcaseCategories = [
  { category: "pokemon", weight: 20 },
  { category: "item", weight: 24 },
  { category: "badge", weight: 1 },
] as const;

// Returns a deterministic, weighted pool of image-backed showcase content. Keeping this
// query deterministic lets Convex cache it and share one result across every
// visitor; the client shuffles and samples this pool so the wheel still looks
// fresh on each page load without re-reading the table per visit.
export const showcase = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 300, 1), 600);
    const totalWeight = showcaseCategories.reduce(
      (sum, config) => sum + config.weight,
      0,
    );
    const scanWindow = 500;

    const pools = await Promise.all(
      showcaseCategories.map((config) =>
        ctx.db
          .query("content")
          .withIndex("by_category", (q) => q.eq("category", config.category))
          .take(scanWindow),
      ),
    );

    return pools.flatMap((pool, index) =>
      pool
        .filter((word) => Boolean(word.imageUrl))
        .slice(
          0,
          Math.ceil((limit * showcaseCategories[index].weight) / totalWeight),
        )
        .map((word) => ({
          id: word._id,
          label: word.label,
          category: word.category,
          imageUrl: word.imageUrl,
        })),
    );
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

export const removeManyBySourceIds = mutationGeneric({
  args: {
    category: contentCategory,
    source: v.union(v.literal("pokeapi"), v.literal("curated")),
    sourceIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const sourceIds = new Set(args.sourceIds);
    const words = await ctx.db
      .query("content")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    const removable = words.filter(
      (word) =>
        word.source === args.source &&
        word.sourceId &&
        sourceIds.has(word.sourceId),
    );

    await Promise.all(removable.map((word) => ctx.db.delete(word._id)));

    await ctx.db.insert("events", {
      type: "content.removed",
      payload: {
        count: removable.length,
        category: args.category,
        source: args.source,
      },
      createdAt: Date.now(),
    });

    return { count: removable.length };
  },
});

export const removeManyByCategoryLabels = mutationGeneric({
  args: {
    category: contentCategory,
    source: v.union(v.literal("pokeapi"), v.literal("curated")),
    labels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedLabels = new Set(args.labels.map(normalizeWord));
    const words = await ctx.db
      .query("content")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    const removable = words.filter(
      (word) =>
        word.source === args.source && normalizedLabels.has(word.normalizedLabel),
    );

    await Promise.all(removable.map((word) => ctx.db.delete(word._id)));

    await ctx.db.insert("events", {
      type: "content.removed",
      payload: {
        count: removable.length,
        category: args.category,
        source: args.source,
      },
      createdAt: Date.now(),
    });

    return { count: removable.length };
  },
});
