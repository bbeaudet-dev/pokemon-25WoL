import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { ContentCategory, WordSource } from "../src/lib/game/types";

type SeedWord = {
  label: string;
  category: ContentCategory;
  imageUrl?: string;
  source: WordSource;
  sourceId?: string;
};

type NamedResourceList = {
  results: Array<{
    name: string;
    url: string;
  }>;
};

const upsertMany = makeFunctionReference<
  "mutation",
  { words: SeedWord[] },
  { count: number }
>("content:upsertMany");

const endpointConfigs: Array<{
  endpoint: string;
  category: ContentCategory;
  limit: number;
}> = [
  { endpoint: "pokemon", category: "pokemon", limit: 151 },
  { endpoint: "item", category: "item", limit: 80 },
  { endpoint: "type", category: "type", limit: 30 },
  { endpoint: "move", category: "move", limit: 120 },
  { endpoint: "ability", category: "ability", limit: 80 },
  { endpoint: "region", category: "region", limit: 20 },
  { endpoint: "location", category: "town", limit: 80 },
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

function imageUrlFor(category: ContentCategory, sourceId?: string) {
  if (category !== "pokemon" || !sourceId) {
    return undefined;
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${sourceId}.png`;
}

async function fetchEndpoint(endpoint: string, limit: number) {
  const response = await fetch(
    `https://pokeapi.co/api/v2/${endpoint}?limit=${limit}`,
  );

  if (!response.ok) {
    throw new Error(`PokeAPI ${endpoint} request failed: ${response.status}`);
  }

  return (await response.json()) as NamedResourceList;
}

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Set NEXT_PUBLIC_CONVEX_URL before running seed:content.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const wordsByKey = new Map<string, SeedWord>();

  for (const config of endpointConfigs) {
    const list = await fetchEndpoint(config.endpoint, config.limit);

    for (const result of list.results) {
      const sourceId = idFromUrl(result.url);
      const word: SeedWord = {
        label: titleCase(result.name),
        category: config.category,
        imageUrl: imageUrlFor(config.category, sourceId),
        source: "pokeapi",
        sourceId,
      };
      wordsByKey.set(`${word.category}:${word.label.toLowerCase()}`, word);
    }
  }

  const words = Array.from(wordsByKey.values());
  const result = await client.mutation(upsertMany, { words });
  console.log(`Seeded ${result.count} content words.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
