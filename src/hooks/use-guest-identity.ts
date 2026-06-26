"use client";

import { useEffect, useState } from "react";
import {
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

  return {
    identity,
    updateDisplayName,
    isReady: Boolean(identity.guestId),
  };
}
