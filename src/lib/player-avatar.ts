const generatedNamePokemonSpriteIds: Record<string, number> = {
  Charizard: 6,
  Garchomp: 445,
  Hitmontop: 237,
  Hoopa: 720,
  Lucario: 448,
  Lugia: 249,
  Magby: 240,
  Mamoswine: 473,
  Munchlax: 446,
  Pikachu: 25,
  Snorlax: 143,
  Solgaleo: 791,
};

export function getPlayerAvatarUrl(displayName: string) {
  const normalizedName = displayName.replace(/\s+/g, "");
  const matchedPokemon = Object.keys(generatedNamePokemonSpriteIds).find((pokemon) =>
    normalizedName.toLowerCase().endsWith(pokemon.toLowerCase()),
  );

  if (!matchedPokemon) {
    return undefined;
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${generatedNamePokemonSpriteIds[matchedPokemon]}.png`;
}
