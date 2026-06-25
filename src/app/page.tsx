"use client";

import { useMutation, useQuery } from "convex/react";
import { Play, Plus, Users } from "lucide-react";
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
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
              Pokemon party game
            </p>
            <h1 className="mt-3 text-5xl font-black tracking-tight md:text-7xl">
              25 Words or Less
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-200">
              Create a lobby, ready up, and race through Pokemon-flavored
              target words with live hints, guesses, and scores.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-bold text-slate-200">
            Display name
            <input
              className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4 md:w-72"
              value={identity.displayName}
              maxLength={24}
              onChange={(event) => updateDisplayName(event.target.value)}
              placeholder="Trainer name"
            />
          </label>
        </div>
      </section>

      {isCreating || joiningLobbyCode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-yellow-300 border-t-transparent" />
            <p className="text-2xl font-black">
              {isCreating ? "Creating lobby..." : "Joining lobby..."}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Syncing with Convex realtime state.
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
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">
              Public games
            </span>
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
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-300 px-5 py-4 font-black text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isReady || isCreating}
              onClick={handleCreateLobby}
            >
              <Plus className="h-5 w-5" />
              {isCreating ? "Creating..." : "Create New Lobby"}
            </button>
          </div>

          <form
            className="rounded-[2rem] border border-white/10 bg-white/10 p-5"
            onSubmit={handleJoinLobby}
          >
            <h2 className="text-2xl font-black">Join By Code</h2>
            <div className="mt-4 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 uppercase text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                disabled={Boolean(joiningLobbyCode)}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="ABC123"
              />
              <button
                className="rounded-2xl bg-purple-400 px-4 py-3 font-black text-black transition hover:bg-purple-300"
                disabled={Boolean(joiningLobbyCode)}
                type="submit"
              >
                <Play className="h-5 w-5" />
              </button>
            </div>
          </form>

        </aside>
      </section>
    </main>
  );
}
