export type GuestIdentity = {
  guestId: string;
  displayName: string;
};

const guestStorageKey = "pokemon-25-guest";

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    displayName: `Trainer ${Math.floor(Math.random() * 900 + 100)}`,
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
