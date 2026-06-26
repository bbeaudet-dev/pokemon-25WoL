// Curated roster of popular, cute, funny, and iconic Pokemon used for both
// auto-generated guest display names and their matching profile pictures.
// The key is the Pokemon name (also used as a display-name suffix) and the
// value is its National Pokedex number, which doubles as the sprite id.
const generatedNamePokemonSpriteIds: Record<string, number> = {
  Bulbasaur: 1,
  Venusaur: 3,
  Charmander: 4,
  Charizard: 6,
  Squirtle: 7,
  Blastoise: 9,
  Pikachu: 25,
  Vulpix: 37,
  Jigglypuff: 39,
  Psyduck: 54,
  Arcanine: 59,
  Machamp: 68,
  Gengar: 94,
  Magikarp: 129,
  Gyarados: 130,
  Lapras: 131,
  Ditto: 132,
  Eevee: 133,
  Vaporeon: 134,
  Jolteon: 135,
  Flareon: 136,
  Snorlax: 143,
  Articuno: 144,
  Zapdos: 145,
  Moltres: 146,
  Dragonite: 149,
  Mewtwo: 150,
  Mew: 151,
  Chikorita: 152,
  Cyndaquil: 155,
  Totodile: 158,
  Pichu: 172,
  Togepi: 175,
  Marill: 183,
  Azumarill: 184,
  Espeon: 196,
  Umbreon: 197,
  Wobbuffet: 202,
  Scizor: 212,
  Heracross: 214,
  Hitmontop: 237,
  Magby: 240,
  Tyranitar: 248,
  Lugia: 249,
  Celebi: 251,
  Treecko: 252,
  Torchic: 255,
  Mudkip: 258,
  Gardevoir: 282,
  Slaking: 289,
  Milotic: 350,
  Absol: 359,
  Salamence: 373,
  Metagross: 376,
  Kyogre: 382,
  Groudon: 383,
  Rayquaza: 384,
  Jirachi: 385,
  Turtwig: 387,
  Chimchar: 390,
  Piplup: 393,
  Bidoof: 399,
  Lopunny: 428,
  Garchomp: 445,
  Munchlax: 446,
  Lucario: 448,
  Mamoswine: 473,
  Gallade: 475,
  Dialga: 483,
  Palkia: 484,
  Giratina: 487,
  Zoroark: 571,
  Chandelure: 609,
  Hydreigon: 635,
  Volcarona: 637,
  Greninja: 658,
  Aegislash: 681,
  Sylveon: 700,
  Dedenne: 702,
  Goodra: 706,
  Hoopa: 720,
  Rowlet: 722,
  Litten: 725,
  Popplio: 728,
  Lycanroc: 745,
  Mimikyu: 778,
  Solgaleo: 791,
  Grookey: 810,
  Cinderace: 815,
  Sobble: 816,
  Wooloo: 831,
  Yamper: 835,
  Toxtricity: 849,
  Morpeko: 877,
  Dreepy: 885,
  Dragapult: 887,
  Zacian: 888,
  Zamazenta: 889,
  Sprigatito: 906,
  Fuecoco: 909,
  Quaxly: 912,
  Lechonk: 915,
  Baxcalibur: 998,
  Gholdengo: 1000,
  Koraidon: 1007,
  Miraidon: 1008,
};

export const namePokemon = Object.keys(generatedNamePokemonSpriteIds);

export function getPlayerAvatarUrl(displayName: string) {
  const normalizedName = displayName.replace(/\s+/g, "").toLowerCase();

  // Prefer the longest matching suffix so overlapping names resolve correctly
  // (for example "Azumarill" should win over "Marill").
  let matchedPokemon: string | undefined;
  for (const pokemon of namePokemon) {
    if (
      normalizedName.endsWith(pokemon.toLowerCase()) &&
      (matchedPokemon === undefined || pokemon.length > matchedPokemon.length)
    ) {
      matchedPokemon = pokemon;
    }
  }

  if (!matchedPokemon) {
    return undefined;
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${generatedNamePokemonSpriteIds[matchedPokemon]}.png`;
}
