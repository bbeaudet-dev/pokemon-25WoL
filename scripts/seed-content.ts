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
  sprites: {
    default: string | null;
  };
};

const upsertMany = makeFunctionReference<
  "mutation",
  { words: SeedWord[] },
  { count: number }
>("content:upsertMany");

const endpointConfigs: Array<{
  endpoint: string;
  category: ContentCategory;
  labelPrefix?: string;
  filter?: (resource: NamedResourceList["results"][number]) => boolean;
}> = [
  { endpoint: "pokemon-species", category: "pokemon" },
  { endpoint: "item", category: "item" },
  {
    endpoint: "type",
    category: "type",
    filter: (resource) => !["unknown", "shadow"].includes(resource.name),
  },
  { endpoint: "move", category: "move" },
  { endpoint: "ability", category: "ability" },
  { endpoint: "region", category: "region" },
  { endpoint: "location", category: "town" },
  { endpoint: "version", category: "game", labelPrefix: "Pokemon" },
];

const batchSize = 100;
const detailFetchConcurrency = 20;
const maxMutationAttempts = 3;

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
  sourceUrl?: string,
) {
  if (category === "pokemon" && sourceId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${sourceId}.png`;
  }

  if (category === "item" && sourceUrl) {
    const item = await fetchJson<ItemDetail>(sourceUrl);
    return item.sprites.default ?? undefined;
  }

  return undefined;
}

function labelFor(name: string, labelPrefix?: string) {
  const label = titleCase(name);
  return labelPrefix ? `${labelPrefix} ${label}` : label;
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
    throw new Error(`PokeAPI request failed: ${url} returned ${response.status}`);
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
        const word: SeedWord = {
          label: labelFor(result.name, config.labelPrefix),
          category: config.category,
          imageUrl: await imageUrlFor(
            config.category,
            sourceId,
            result.url,
          ),
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
