"use client";

import { useEffect, useState } from "react";
import {
  createGuestIdentity,
  type GuestIdentity,
  loadGuestIdentity,
  saveGuestIdentity,
} from "@/lib/guest";
import { getPlayerAvatarUrl } from "@/lib/player-avatar";

export function useGuestIdentity() {
  const [identity, setIdentity] = useState<GuestIdentity>({
    guestId: "",
    displayName: "",
  });

  useEffect(() => {
    queueMicrotask(() => setIdentity(loadGuestIdentity()));
  }, []);

  function updateDisplayName(displayName: string) {
    setIdentity((current) => {
      const next = {
        ...current,
        displayName,
        imageUrl: getPlayerAvatarUrl(displayName),
      };
      saveGuestIdentity(next);
      return next;
    });
  }

  function rerollIdentity() {
    const next = createGuestIdentity();
    saveGuestIdentity(next);
    setIdentity(next);
    return next;
  }

  return {
    identity,
    rerollIdentity,
    updateDisplayName,
    isReady: Boolean(identity.guestId),
  };
}
