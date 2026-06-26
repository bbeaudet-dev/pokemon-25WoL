import { getPlayerAvatarUrl, namePokemon } from "./player-avatar";

export type GuestIdentity = {
  guestId: string;
  displayName: string;
  imageUrl?: string;
};

const guestStorageKey = "pokemon-25-guest";

const nameAdjectives = [
  "Hungry",
  "Sleepy",
  "Comfy",
  "Energized",
  "Slaphappy",
  "Brave",
  "Goofy",
  "Cozy",
  "Spicy",
  "Wiggly",
  "Bouncy",
  "Sneaky",
  "Mighty",
  "Jolly",
  "Snazzy",
  "Zippy",
  "Cheeky",
  "Fluffy",
  "Dapper",
  "Peppy",
  "Sassy",
  "Mellow",
  "Frosty",
  "Sparkly",
  "Shiny",
  "Feral",
  "Snuggly",
  "Bubbly",
  "Zesty",
  "Nimble",
  "Fierce",
  "Radiant",
  "Cosmic",
  "Grumpy",
  "Dizzy",
  "Chunky",
];

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createDisplayName() {
  const adjective =
    nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
  const pokemon = namePokemon[Math.floor(Math.random() * namePokemon.length)];

  return `${adjective}${pokemon}`;
}

export function loadGuestIdentity(): GuestIdentity {
  if (typeof window === "undefined") {
    return { guestId: "", displayName: "" };
  }

  const saved = window.localStorage.getItem(guestStorageKey);
  if (saved) {
    const identity = JSON.parse(saved) as GuestIdentity;
    const imageUrl = getPlayerAvatarUrl(identity.displayName);
    if (identity.imageUrl !== imageUrl) {
      const nextIdentity = { ...identity, imageUrl };
      saveGuestIdentity(nextIdentity);
      return nextIdentity;
    }

    return identity;
  }

  const displayName = createDisplayName();
  const identity = {
    guestId: createGuestId(),
    displayName,
    imageUrl: getPlayerAvatarUrl(displayName),
  };
  saveGuestIdentity(identity);
  return identity;
}

export function saveGuestIdentity(identity: GuestIdentity) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(guestStorageKey, JSON.stringify(identity));
}
