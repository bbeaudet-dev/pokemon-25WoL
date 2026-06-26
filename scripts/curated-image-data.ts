import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ContentCategory } from "../src/lib/game/types";

export type CuratedImageCategory = Extract<
  ContentCategory,
  "game" | "gym_leader" | "professor" | "type"
>;

export type CuratedImageRef = {
  category: CuratedImageCategory;
  sourceId: string;
};

export type CuratedImageSource = {
  category: CuratedImageCategory;
  provider: "bulbagarden-archives-file" | "fandom-page-image";
  sourceId: string;
} & (
  | {
      provider: "bulbagarden-archives-file";
      fileName: string;
    }
  | {
      provider: "fandom-page-image";
      title: string;
    }
);

export const curatedImageExtensions = ["webp", "png", "jpg", "jpeg"] as const;
export type CuratedImageExtension = (typeof curatedImageExtensions)[number];

export const gymLeaderNames = [
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
];

export const typeImageSources = [
  { name: "Normal", sourceId: "1", fileName: "Normal_icon_SV.png" },
  { name: "Fighting", sourceId: "2", fileName: "Fighting_icon_SV.png" },
  { name: "Flying", sourceId: "3", fileName: "Flying_icon_SV.png" },
  { name: "Poison", sourceId: "4", fileName: "Poison_icon_SV.png" },
  { name: "Ground", sourceId: "5", fileName: "Ground_icon_SV.png" },
  { name: "Rock", sourceId: "6", fileName: "Rock_icon_SV.png" },
  { name: "Bug", sourceId: "7", fileName: "Bug_icon_SV.png" },
  { name: "Ghost", sourceId: "8", fileName: "Ghost_icon_SV.png" },
  { name: "Steel", sourceId: "9", fileName: "Steel_icon_SV.png" },
  { name: "Fire", sourceId: "10", fileName: "Fire_icon_SV.png" },
  { name: "Water", sourceId: "11", fileName: "Water_icon_SV.png" },
  { name: "Grass", sourceId: "12", fileName: "Grass_icon_SV.png" },
  { name: "Electric", sourceId: "13", fileName: "Electric_icon_SV.png" },
  { name: "Psychic", sourceId: "14", fileName: "Psychic_icon_SV.png" },
  { name: "Ice", sourceId: "15", fileName: "Ice_icon_SV.png" },
  { name: "Dragon", sourceId: "16", fileName: "Dragon_icon_SV.png" },
  { name: "Dark", sourceId: "17", fileName: "Dark_icon_SV.png" },
  { name: "Fairy", sourceId: "18", fileName: "Fairy_icon_SV.png" },
  { name: "Stellar", sourceId: "19", fileName: "Stellar_icon_SV.png" },
] as const;

export const gameImageSources = [
  { sourceId: "red", fileName: "Red_EN_boxart.png" },
  { sourceId: "blue", fileName: "Blue_EN_boxart.png" },
  { sourceId: "yellow", fileName: "Yellow_EN_boxart.png" },
  { sourceId: "gold", fileName: "Gold_EN_boxart.png" },
  { sourceId: "silver", fileName: "Silver_EN_boxart.png" },
  { sourceId: "crystal", fileName: "Crystal_EN_boxart.png" },
  { sourceId: "ruby", fileName: "Ruby_EN_boxart.png" },
  { sourceId: "sapphire", fileName: "Sapphire_EN_boxart.png" },
  { sourceId: "emerald", fileName: "Emerald_EN_boxart.jpg" },
  { sourceId: "firered", fileName: "FireRed_EN_boxart.png" },
  { sourceId: "leafgreen", fileName: "LeafGreen_EN_boxart.png" },
  { sourceId: "diamond", fileName: "Diamond_EN_boxart.jpg" },
  { sourceId: "pearl", fileName: "Pearl_EN_boxart.jpg" },
  { sourceId: "platinum", fileName: "Platinum_EN_boxart.png" },
  { sourceId: "heartgold", fileName: "HeartGold_EN_boxart.jpg" },
  { sourceId: "soulsilver", fileName: "SoulSilver_EN_boxart.jpg" },
  { sourceId: "black", fileName: "Black_EN_boxart.png" },
  { sourceId: "white", fileName: "White_EN_boxart.png" },
  { sourceId: "black-2", fileName: "Black_2_EN_boxart.png" },
  { sourceId: "white-2", fileName: "White_2_EN_boxart.png" },
  { sourceId: "x", fileName: "X_EN_boxart.png" },
  { sourceId: "y", fileName: "Y_EN_boxart.png" },
  { sourceId: "omega-ruby", fileName: "Omega_Ruby_EN_boxart.png" },
  { sourceId: "alpha-sapphire", fileName: "Alpha_Sapphire_EN_boxart.png" },
  { sourceId: "sun", fileName: "Sun_EN_boxart.png" },
  { sourceId: "moon", fileName: "Moon_EN_boxart.png" },
  { sourceId: "ultra-sun", fileName: "Ultra_Sun_EN_boxart.png" },
  { sourceId: "ultra-moon", fileName: "Ultra_Moon_EN_boxart.png" },
  { sourceId: "lets-go-pikachu", fileName: "Lets_Go_Pikachu_EN_boxart.png" },
  { sourceId: "lets-go-eevee", fileName: "Lets_Go_Eevee_EN_boxart.png" },
  { sourceId: "sword", fileName: "Sword_EN_boxart.png" },
  { sourceId: "shield", fileName: "Shield_EN_boxart.png" },
  {
    sourceId: "brilliant-diamond",
    fileName: "Brilliant_Diamond_EN_boxart.png",
  },
  { sourceId: "shining-pearl", fileName: "Shining_Pearl_EN_boxart.png" },
  { sourceId: "legends-arceus", fileName: "Legends_Arceus_EN_boxart.png" },
  { sourceId: "scarlet", fileName: "Scarlet_EN_boxart.png" },
  { sourceId: "violet", fileName: "Violet_EN_boxart.png" },
] as const;

export function sourceIdForGymLeader(leader: string) {
  return `gym-leader-${leader
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export const curatedImageSources: Record<string, CuratedImageSource> = {
  "professor-oak": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-oak",
    title: "Professor Oak",
  },
  "professor-elm": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-elm",
    title: "Professor Elm",
  },
  "professor-birch": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-birch",
    title: "Professor Birch",
  },
  "professor-rowan": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-rowan",
    title: "Professor Rowan",
  },
  "professor-juniper": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-juniper",
    title: "Professor Juniper",
  },
  "professor-sycamore": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-sycamore",
    title: "Professor Sycamore",
  },
  "professor-kukui": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-kukui",
    title: "Professor Kukui",
  },
  "professor-magnolia": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-magnolia",
    title: "Professor Magnolia",
  },
  "professor-sonia": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-sonia",
    title: "Sonia",
  },
  "professor-laventon": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-laventon",
    title: "Professor Laventon",
  },
  "professor-sada": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-sada",
    title: "Professor Sada",
  },
  "professor-turo": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-turo",
    title: "Professor Turo",
  },
  "professor-krane": {
    category: "professor",
    provider: "fandom-page-image",
    sourceId: "professor-krane",
    title: "Professor Krane",
  },
  ...Object.fromEntries(
    gymLeaderNames.map((leader) => {
      const sourceId = sourceIdForGymLeader(leader);
      return [
        sourceId,
        {
          category: "gym_leader",
          provider: "fandom-page-image",
          sourceId,
          title: leader,
        } satisfies CuratedImageSource,
      ];
    }),
  ),
  ...Object.fromEntries(
    typeImageSources.map((source) => [
      `type-${source.sourceId}`,
      {
        category: "type",
        provider: "bulbagarden-archives-file",
        sourceId: source.sourceId,
        fileName: source.fileName,
      } satisfies CuratedImageSource,
    ]),
  ),
  ...Object.fromEntries(
    gameImageSources.map((source) => [
      `game-${source.sourceId}`,
      {
        category: "game",
        provider: "bulbagarden-archives-file",
        sourceId: source.sourceId,
        fileName: source.fileName,
      } satisfies CuratedImageSource,
    ]),
  ),
};

export function gameSourceIdFromLabel(label: string) {
  return label
    .replace(/^Pokemon /, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function curatedImageFolder(category: CuratedImageCategory) {
  switch (category) {
    case "game":
      return "games";
    case "gym_leader":
      return "gym-leaders";
    case "professor":
      return "professors";
    case "type":
      return "types";
  }
}

export function curatedImagePublicUrl(
  source: CuratedImageRef,
  extension: CuratedImageExtension,
) {
  return `/content/curated/${curatedImageFolder(source.category)}/${source.sourceId}.${extension}`;
}

export function curatedImageFilePath(
  workspaceRoot: string,
  source: CuratedImageRef,
  extension: CuratedImageExtension,
) {
  return join(
    workspaceRoot,
    "public",
    "content",
    "curated",
    curatedImageFolder(source.category),
    `${source.sourceId}.${extension}`,
  );
}

export function findLocalCuratedImageUrl(
  workspaceRoot: string,
  source: CuratedImageRef,
) {
  for (const extension of curatedImageExtensions) {
    if (existsSync(curatedImageFilePath(workspaceRoot, source, extension))) {
      return curatedImagePublicUrl(source, extension);
    }
  }

  return undefined;
}
