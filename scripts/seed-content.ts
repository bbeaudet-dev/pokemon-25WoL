import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getContentIdentityKey } from "../src/lib/content/identity";
import type { ContentCategory, WordSource } from "../src/lib/game/types";

type SeedWord = {
  label: string;
  category: ContentCategory;
  imageUrl?: string;
  source: WordSource;
  sourceId?: string;
  sourceUrl?: string;
};

type NamedResourceList = {
  count: number;
  results: Array<{
    name: string;
    url: string;
  }>;
};

type ItemDetail = {
  category: {
    name: string;
  };
  sprites: {
    default: string | null;
  };
};

type ItemSeedData = {
  excludedCategory?: string;
  imageUrl?: string;
};

type CuratedImageSource = {
  provider: "fandom-page-image";
  title: string;
};

const upsertMany = makeFunctionReference<
  "mutation",
  { words: SeedWord[] },
  { count: number }
>("content:upsertMany");

const removeManyBySourceIds = makeFunctionReference<
  "mutation",
  { category: ContentCategory; source: WordSource; sourceIds: string[] },
  { count: number }
>("content:removeManyBySourceIds");

const endpointConfigs: Array<{
  endpoint: string;
  category: ContentCategory;
  labelPrefix?: string;
  labelSuffix?: string;
  filter?: (resource: NamedResourceList["results"][number]) => boolean;
}> = [
  { endpoint: "pokemon-species", category: "pokemon" },
  { endpoint: "item", category: "item" },
  {
    endpoint: "type",
    category: "type",
    labelSuffix: "Type",
    filter: (resource) => !["unknown", "shadow"].includes(resource.name),
  },
  { endpoint: "move", category: "move" },
  { endpoint: "ability", category: "ability", labelSuffix: "(Ability)" },
  { endpoint: "region", category: "region", labelSuffix: "Region" },
  { endpoint: "location", category: "town" },
  { endpoint: "version", category: "game", labelPrefix: "Pokemon" },
];

const batchSize = 100;
const detailFetchConcurrency = 20;
const maxMutationAttempts = 3;
const excludedItemCategories = new Set([
  "all-machines",
  "data-cards",
  "dynamax-crystals",
  "picnic",
  "tm-materials",
  "unused",
]);

const curatedImageSources: Record<string, CuratedImageSource> = {
  "professor-oak": { provider: "fandom-page-image", title: "Professor Oak" },
  "professor-elm": { provider: "fandom-page-image", title: "Professor Elm" },
  "professor-birch": { provider: "fandom-page-image", title: "Professor Birch" },
  "professor-rowan": { provider: "fandom-page-image", title: "Professor Rowan" },
  "professor-juniper": {
    provider: "fandom-page-image",
    title: "Professor Juniper",
  },
  "professor-sycamore": {
    provider: "fandom-page-image",
    title: "Professor Sycamore",
  },
  "professor-kukui": { provider: "fandom-page-image", title: "Professor Kukui" },
  "professor-magnolia": {
    provider: "fandom-page-image",
    title: "Professor Magnolia",
  },
  "professor-sonia": { provider: "fandom-page-image", title: "Sonia" },
  "professor-laventon": {
    provider: "fandom-page-image",
    title: "Professor Laventon",
  },
  "professor-sada": { provider: "fandom-page-image", title: "Professor Sada" },
  "professor-turo": { provider: "fandom-page-image", title: "Professor Turo" },
  "professor-krane": { provider: "fandom-page-image", title: "Professor Krane" },
};

function curatedWord(
  label: string,
  category: ContentCategory,
  sourceId: string,
  sourceUrl: string,
  imageUrl?: string,
): SeedWord {
  return {
    label,
    category,
    imageUrl,
    source: "curated",
    sourceId,
    sourceUrl,
  };
}

function badgeWord(label: string, badgeId: number, sourceLabel = label): SeedWord {
  return curatedWord(
    `${label} Badge`,
    "badge",
    `badge-${badgeId}`,
    `https://bulbapedia.bulbagarden.net/wiki/${sourceLabel.replaceAll(" ", "_")}_Badge`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${badgeId}.png`,
  );
}

const curatedContentWords: SeedWord[] = [
  {
    label: "Professor Oak",
    category: "professor",
    source: "curated",
    sourceId: "professor-oak",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Oak",
  },
  {
    label: "Professor Elm",
    category: "professor",
    source: "curated",
    sourceId: "professor-elm",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Elm",
  },
  {
    label: "Professor Birch",
    category: "professor",
    source: "curated",
    sourceId: "professor-birch",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Birch",
  },
  {
    label: "Professor Rowan",
    category: "professor",
    source: "curated",
    sourceId: "professor-rowan",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Rowan",
  },
  {
    label: "Professor Juniper",
    category: "professor",
    source: "curated",
    sourceId: "professor-juniper",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Juniper",
  },
  {
    label: "Professor Sycamore",
    category: "professor",
    source: "curated",
    sourceId: "professor-sycamore",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Sycamore",
  },
  {
    label: "Professor Kukui",
    category: "professor",
    source: "curated",
    sourceId: "professor-kukui",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Kukui",
  },
  {
    label: "Professor Magnolia",
    category: "professor",
    source: "curated",
    sourceId: "professor-magnolia",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Magnolia",
  },
  {
    label: "Professor Sonia",
    category: "professor",
    source: "curated",
    sourceId: "professor-sonia",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Sonia",
  },
  {
    label: "Professor Laventon",
    category: "professor",
    source: "curated",
    sourceId: "professor-laventon",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Laventon",
  },
  {
    label: "Professor Sada",
    category: "professor",
    source: "curated",
    sourceId: "professor-sada",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Sada",
  },
  {
    label: "Professor Turo",
    category: "professor",
    source: "curated",
    sourceId: "professor-turo",
    sourceUrl: "https://bulbapedia.bulbagarden.net/wiki/Professor_Turo",
  },
  curatedWord(
    "Professor Krane",
    "professor",
    "professor-krane",
    "https://bulbapedia.bulbagarden.net/wiki/Professor_Krane",
  ),
  ...[
    "Brock",
    "Misty",
    "Lt. Surge",
    "Erika",
    "Koga",
    "Sabrina",
    "Blaine",
    "Giovanni",
    "Blue",
    "Falkner",
    "Bugsy",
    "Whitney",
    "Morty",
    "Chuck",
    "Jasmine",
    "Pryce",
    "Clair",
    "Roxanne",
    "Brawly",
    "Wattson",
    "Flannery",
    "Norman",
    "Winona",
    "Tate and Liza",
    "Wallace",
    "Juan",
    "Roark",
    "Gardenia",
    "Maylene",
    "Crasher Wake",
    "Fantina",
    "Byron",
    "Candice",
    "Volkner",
    "Cilan",
    "Chili",
    "Cress",
    "Lenora",
    "Burgh",
    "Elesa",
    "Clay",
    "Skyla",
    "Brycen",
    "Drayden",
    "Iris",
    "Cheren",
    "Roxie",
    "Marlon",
    "Viola",
    "Grant",
    "Korrina",
    "Ramos",
    "Clemont",
    "Valerie",
    "Olympia",
    "Wulfric",
    "Milo",
    "Nessa",
    "Kabu",
    "Bea",
    "Allister",
    "Opal",
    "Gordie",
    "Melony",
    "Piers",
    "Raihan",
    "Katy",
    "Brassius",
    "Iono",
    "Kofu",
    "Larry",
    "Ryme",
    "Tulip",
    "Grusha",
  ].map((leader) =>
    curatedWord(
      leader,
      "gym_leader",
      `gym-leader-${leader.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      `https://bulbapedia.bulbagarden.net/wiki/${leader.replaceAll(" ", "_")}`,
    ),
  ),
  ...[
    badgeWord("Boulder", 1),
    badgeWord("Cascade", 2),
    badgeWord("Thunder", 3),
    badgeWord("Rainbow", 4),
    badgeWord("Soul", 5),
    badgeWord("Marsh", 6),
    badgeWord("Volcano", 7),
    badgeWord("Earth", 8),
    badgeWord("Zephyr", 9),
    badgeWord("Hive", 10),
    badgeWord("Plain", 11),
    badgeWord("Fog", 12),
    badgeWord("Storm", 13),
    badgeWord("Mineral", 14),
    badgeWord("Glacier", 15),
    badgeWord("Rising", 16),
    badgeWord("Stone", 17),
    badgeWord("Knuckle", 18),
    badgeWord("Dynamo", 19),
    badgeWord("Heat", 20),
    badgeWord("Balance", 21),
    badgeWord("Feather", 22),
    badgeWord("Mind", 23),
    badgeWord("Rain", 24),
    badgeWord("Coal", 25),
    badgeWord("Forest", 26),
    badgeWord("Cobble", 27),
    badgeWord("Fen", 28),
    badgeWord("Relic", 29),
    badgeWord("Mine", 30),
    badgeWord("Icicle", 31),
    badgeWord("Beacon", 32),
    badgeWord("Trio", 33),
    badgeWord("Basic", 34),
    badgeWord("Insect", 35),
    badgeWord("Bolt", 36),
    badgeWord("Quake", 37),
    badgeWord("Jet", 38),
    badgeWord("Freeze", 39),
    badgeWord("Legend", 40),
    badgeWord("Bug", 41),
    badgeWord("Cliff", 42),
    badgeWord("Rumble", 43),
    badgeWord("Plant", 44),
    badgeWord("Voltage", 45),
    badgeWord("Fairy", 46),
    badgeWord("Psychic", 47),
    badgeWord("Iceberg", 48),
    badgeWord("Galar Grass", 49, "Grass"),
    badgeWord("Galar Water", 50, "Water"),
    badgeWord("Galar Fire", 51, "Fire"),
    badgeWord("Galar Fighting", 52, "Fighting"),
    badgeWord("Galar Ghost", 53, "Ghost"),
    badgeWord("Galar Fairy", 54, "Fairy"),
    badgeWord("Galar Rock", 55, "Rock"),
    badgeWord("Galar Ice", 56, "Ice"),
    badgeWord("Galar Dark", 57, "Dark"),
    badgeWord("Galar Dragon", 58, "Dragon"),
  ],
];

function titleCase(name: string) {
  return name
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function idFromUrl(url: string) {
  return url.split("/").filter(Boolean).at(-1);
}

async function imageUrlFor(
  category: ContentCategory,
  sourceId?: string,
) {
  if (category === "pokemon" && sourceId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${sourceId}.png`;
  }

  if (category === "type" && sourceId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-viii/sword-shield/${sourceId}.png`;
  }

  return undefined;
}

async function curatedImageUrlFor(word: SeedWord) {
  if (!word.sourceId) {
    return undefined;
  }

  const source =
    curatedImageSources[word.sourceId] ??
    (word.category === "gym_leader"
      ? ({ provider: "fandom-page-image", title: word.label } as const)
      : undefined);

  if (!source) {
    return undefined;
  }

  if (source.provider === "fandom-page-image") {
    const params = new URLSearchParams({
      action: "query",
      titles: source.title,
      prop: "pageimages",
      format: "json",
      pithumbsize: "500",
    });
    const response = await fetchJson<{
      query?: {
        pages?: Record<
          string,
          { thumbnail?: { source?: string; width?: number; height?: number } }
        >;
      };
    }>(`https://pokemon.fandom.com/api.php?${params.toString()}`);

    return Object.values(response.query?.pages ?? {}).find(
      (page) => page.thumbnail?.source,
    )?.thumbnail?.source;
  }

  return undefined;
}

async function getItemSeedData(sourceUrl: string): Promise<ItemSeedData> {
  const item = await fetchJson<ItemDetail>(sourceUrl);

  if (excludedItemCategories.has(item.category.name)) {
    return { excludedCategory: item.category.name };
  }

  return { imageUrl: item.sprites.default ?? undefined };
}

function labelFor(name: string, labelPrefix?: string, labelSuffix?: string) {
  const label = titleCase(name);
  const prefixedLabel = labelPrefix ? `${labelPrefix} ${label}` : label;
  return labelSuffix ? `${prefixedLabel} ${labelSuffix}` : prefixedLabel;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function countByCategory(words: SeedWord[]) {
  return words.reduce<Record<string, number>>((counts, word) => {
    counts[word.category] = (counts[word.category] ?? 0) + 1;
    return counts;
  }, {});
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
) {
  const results: U[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function upsertBatchWithRetry(
  client: ConvexHttpClient,
  words: SeedWord[],
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxMutationAttempts; attempt += 1) {
    try {
      return await client.mutation(upsertMany, { words });
    } catch (error) {
      lastError = error;
      if (attempt === maxMutationAttempts) {
        break;
      }

      const delayMs = attempt * 1000;
      console.warn(
        `Batch mutation failed on attempt ${attempt}; retrying in ${delayMs}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${url} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchEndpoint(endpoint: string) {
  return await fetchJson<NamedResourceList>(
    `https://pokeapi.co/api/v2/${endpoint}?limit=100000&offset=0`,
  );
}

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL before running seed:content.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const wordsByKey = new Map<string, SeedWord>();
  const skipped: string[] = [];
  const duplicates: string[] = [];
  const missingImages = new Map<ContentCategory, number>();
  const removedSourceIds = new Map<ContentCategory, Set<string>>();

  for (const config of endpointConfigs) {
    const list = await fetchEndpoint(config.endpoint);
    const accepted = config.filter
      ? list.results.filter(config.filter)
      : list.results;

    const endpointWords = await mapWithConcurrency(
      list.results,
      detailFetchConcurrency,
      async (result) => {
        if (config.filter && !config.filter(result)) {
          skipped.push(`${config.endpoint}:${result.name}`);
          return null;
        }

        const sourceId = idFromUrl(result.url);
        const itemSeedData =
          config.category === "item" ? await getItemSeedData(result.url) : {};

        if (itemSeedData.excludedCategory) {
          skipped.push(
            `${config.endpoint}:${result.name} (${itemSeedData.excludedCategory})`,
          );

          if (sourceId) {
            const categoryIds =
              removedSourceIds.get(config.category) ?? new Set<string>();
            categoryIds.add(sourceId);
            removedSourceIds.set(config.category, categoryIds);
          }

          return null;
        }

        const word: SeedWord = {
          label: labelFor(result.name, config.labelPrefix, config.labelSuffix),
          category: config.category,
          imageUrl:
            itemSeedData.imageUrl ??
            (await imageUrlFor(config.category, sourceId)),
          source: "pokeapi",
          sourceId,
          sourceUrl: result.url,
        };

        return word;
      },
    );

    for (const word of endpointWords) {
      if (!word) {
        continue;
      }

      const key = getContentIdentityKey(word.category, word.label);

      if (wordsByKey.has(key)) {
        duplicates.push(key);
        continue;
      }

      if (!word.imageUrl) {
        missingImages.set(
          word.category,
          (missingImages.get(word.category) ?? 0) + 1,
        );
      }

      wordsByKey.set(key, word);
    }

    console.log(
      `${config.endpoint}: accepted ${accepted.length} of ${list.count} ${config.category} records.`,
    );
  }

  for (const word of curatedContentWords) {
    let imageUrl = word.imageUrl;
    if (!imageUrl) {
      try {
        imageUrl = await curatedImageUrlFor(word);
      } catch (error) {
        console.warn(
          `Unable to fetch curated image for ${word.sourceId ?? word.label}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const wordWithImage = imageUrl ? { ...word, imageUrl } : word;
    const key = getContentIdentityKey(word.category, word.label);

    if (wordsByKey.has(key)) {
      duplicates.push(key);
      continue;
    }

    if (!wordWithImage.imageUrl) {
      missingImages.set(
        word.category,
        (missingImages.get(word.category) ?? 0) + 1,
      );
    }

    wordsByKey.set(key, wordWithImage);
  }
  console.log(`curated: accepted ${curatedContentWords.length} records.`);

  const words = Array.from(wordsByKey.values());
  let seededCount = 0;

  for (const [index, batch] of chunk(words, batchSize).entries()) {
    const result = await upsertBatchWithRetry(client, batch);
    seededCount += result.count;
    console.log(
      `Batch ${index + 1}: seeded ${result.count} records (${seededCount}/${words.length}).`,
    );
  }

  console.log("Seed complete.");
  console.log(`Seeded ${seededCount} content words.`);
  console.log("Counts by category:", countByCategory(words));
  console.log(`Skipped records: ${skipped.length}`);
  console.log(`Duplicate category/label records: ${duplicates.length}`);
  console.log("Missing images by category:", Object.fromEntries(missingImages));

  for (const [category, sourceIds] of removedSourceIds) {
    const result = await client.mutation(removeManyBySourceIds, {
      category,
      source: "pokeapi",
      sourceIds: Array.from(sourceIds),
    });
    console.log(`Removed ${result.count} excluded ${category} records.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
