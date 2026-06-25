export type GuestIdentity = {
  guestId: string;
  displayName: string;
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
];

const namePokemon = [
  "Munchlax",
  "Garchomp",
  "Pikachu",
  "Charizard",
  "Hoopa",
  "Snorlax",
  "Solgaleo",
  "Lugia",
  "Lucario",
  "Mamoswine",
  "Magby",
  "Hitmontop",
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
    return JSON.parse(saved) as GuestIdentity;
  }

  const identity = {
    guestId: createGuestId(),
    displayName: createDisplayName(),
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
