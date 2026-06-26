import { normalizeWord } from "../game/rules";
import type { ContentCategory, WordSource } from "../game/types";

export type InitialContentWord = {
  label: string;
  category: ContentCategory;
  imageUrl?: string;
  source: WordSource;
  sourceId?: string;
  sourceUrl?: string;
};

export const initialContentWords: InitialContentWord[] = [
  {
    label: "Bulbasaur",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
    source: "pokeapi",
    sourceId: "1",
  },
  {
    label: "Charmander",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
    source: "pokeapi",
    sourceId: "4",
  },
  {
    label: "Squirtle",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png",
    source: "pokeapi",
    sourceId: "7",
  },
  {
    label: "Pikachu",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    source: "pokeapi",
    sourceId: "25",
  },
  {
    label: "Eevee",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png",
    source: "pokeapi",
    sourceId: "133",
  },
  {
    label: "Mewtwo",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
    source: "pokeapi",
    sourceId: "150",
  },
  {
    label: "Lucario",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png",
    source: "pokeapi",
    sourceId: "448",
  },
  {
    label: "Greninja",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/658.png",
    source: "pokeapi",
    sourceId: "658",
  },
  {
    label: "Sprigatito",
    category: "pokemon",
    imageUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/906.png",
    source: "pokeapi",
    sourceId: "906",
  },
  {
    label: "Premier Ball",
    category: "item",
    source: "pokeapi",
    sourceId: "12",
  },
  { label: "Fire Type", category: "type", source: "pokeapi", sourceId: "10" },
  { label: "Water Type", category: "type", source: "pokeapi", sourceId: "11" },
  { label: "Grass Type", category: "type", source: "pokeapi", sourceId: "12" },
  { label: "Kanto Region", category: "region", source: "pokeapi", sourceId: "1" },
  { label: "Pallet Town", category: "town", source: "pokeapi" },
  { label: "Brock", category: "gym_leader", source: "curated" },
  { label: "Professor Oak", category: "professor", source: "curated" },
  { label: "Boulder Badge", category: "badge", source: "curated" },
  { label: "Critical Hit", category: "terminology", source: "curated" },
  { label: "Pokemon Scarlet", category: "game", source: "curated" },
];

export function toSeedRecord(word: InitialContentWord) {
  const normalizedLabel = normalizeWord(word.label);

  return {
    ...word,
    normalizedLabel,
    searchText: `${normalizedLabel} ${word.category.replace("_", " ")}`,
  };
}
