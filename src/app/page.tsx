"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { convexApi } from "@/lib/convex-api";
import { useGuestIdentity } from "@/hooks/use-guest-identity";

export default function HomePage() {
  const router = useRouter();
  const { identity, updateDisplayName, isReady } = useGuestIdentity();
  const lobbies = useQuery(convexApi.lobbies.listOpen, {});
  const createLobby = useMutation(convexApi.lobbies.create);
  const joinLobby = useMutation(convexApi.lobbies.join);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningLobbyCode, setJoiningLobbyCode] = useState<string | null>(null);

  async function handleCreateLobby() {
    if (!isReady) {
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      const result = await createLobby({
        guestId: identity.guestId,
        displayName: identity.displayName,
      });
      router.push(`/lobby/${result.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create lobby.");
    }
  }

  async function handleJoinLobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCode.trim()) {
      return;
    }

    await joinByCode(joinCode.trim());
  }

  async function joinByCode(code: string) {
    setError(null);
    setJoiningLobbyCode(code.toUpperCase());
    try {
      const result = await joinLobby({
        code,
        guestId: identity.guestId,
        displayName: identity.displayName,
      });
      router.push(`/lobby/${result.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join lobby.");
      setJoiningLobbyCode(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex max-w-3xl items-center gap-4 text-5xl font-black tracking-tight md:text-7xl">
              <PokeballMark />
              <span>25 Words or Less: Pokemon Edition!</span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-200">
              Help your friends guess your{" "}
              <span className="font-black text-yellow-300">target words</span>{" "}
              with as few hints as possible.
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Inspired by{" "}
              <a
                className="font-bold text-yellow-300 underline-offset-4 hover:underline"
                href="https://www.youtube.com/watch?v=10x-S7t1Tq0&t=1550s"
                rel="noreferrer"
                target="_blank"
              >
                ZaneGames
              </a>
            </p>
          </div>
        </div>
      </section>

      {isCreating || joiningLobbyCode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-yellow-300 border-t-transparent" />
            <p className="text-2xl font-black">
              {isCreating ? "Creating lobby..." : "Joining lobby..."}
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">Open Lobbies</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 bg-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-300">
              <span>Mode</span>
              <span>Host</span>
              <span>Players</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-white/10">
              {lobbies === undefined ? (
                <p className="px-4 py-6 text-slate-300">Loading lobbies...</p>
              ) : lobbies.length === 0 ? (
                <p className="px-4 py-6 text-slate-300">
                  No public lobbies yet. Create the first room.
                </p>
              ) : (
                lobbies.map((lobby) => (
                  <div
                    key={lobby.id}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3"
                  >
                    <span className="capitalize">{lobby.mode}</span>
                    <span>{lobby.hostName}</span>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-yellow-300" />
                      {lobby.playerCount}/{lobby.maxPlayers}
                    </span>
                    <button
                      className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-black transition hover:bg-yellow-200"
                      disabled={joiningLobbyCode === lobby.code}
                      onClick={() => joinByCode(lobby.code)}
                    >
                      {joiningLobbyCode === lobby.code ? "Joining..." : "Join"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="grid gap-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5">
            <h2 className="text-2xl font-black">Start Playing</h2>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-200">
              Display name
              <input
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                value={identity.displayName}
                maxLength={24}
                onChange={(event) => updateDisplayName(event.target.value)}
                placeholder="Trainer name"
              />
            </label>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-300 px-5 py-4 font-black text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isReady || isCreating}
              onClick={handleCreateLobby}
            >
              <Plus className="h-5 w-5" />
              {isCreating ? "Creating..." : "Create New Lobby"}
            </button>

            <form className="mt-4 flex gap-2" onSubmit={handleJoinLobby}>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 uppercase text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                disabled={Boolean(joiningLobbyCode)}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="ABC123"
              />
              <button
                className="rounded-2xl bg-purple-400 px-4 py-3 font-black text-black transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(joiningLobbyCode) || !joinCode.trim()}
                type="submit"
              >
                Join by Code
              </button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PokeballMark() {
  return (
    <span
      aria-hidden="true"
      className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg sm:inline-block"
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-red-500" />
      <span className="absolute inset-x-0 top-1/2 h-1 bg-slate-950" />
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-950 bg-white" />
    </span>
  );
}
