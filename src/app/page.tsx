"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { convexApi } from "@/lib/convex-api";
import { useGuestIdentity } from "@/hooks/use-guest-identity";
import { ContentWheel } from "@/components/home/content-wheel";
import { BuyMeACoffee } from "@/components/support/buy-me-a-coffee";

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
  const [draftDisplayName, setDraftDisplayName] = useState(
    identity.displayName,
  );
  const canSaveDisplayName =
    draftDisplayName.trim() &&
    draftDisplayName.trim() !== identity.displayName;

  useEffect(() => {
    queueMicrotask(() => {
      setDraftDisplayName(identity.displayName);
    });
  }, [identity.displayName]);

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
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <ContentWheel rows={5} className="opacity-70" />
        <div className="absolute inset-0 bg-slate-950/35" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-8">
      <section className="relative overflow-hidden rounded-4xl border border-white/10 bg-slate-950/15 p-8 shadow-2xl [text-shadow:0_2px_12px_rgba(0,0,0,0.9)]">
        <div>
          <h1 className="flex max-w-none items-center gap-3 text-3xl font-black tracking-tight md:text-4xl lg:text-5xl">
            <PokeballMark />
            <span>
              25 Words or Less:{" "}
              <span className="text-yellow-300">Pokemon Edition!</span>
            </span>
          </h1>
          <p className="mt-4 max-w-4xl text-lg text-slate-200">
            Get your friends to guess your target words with as few hints as
            possible.
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
        <div className="mt-6 flex justify-end">
          <a
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-4 py-3 text-sm font-black text-white transition hover:bg-black"
            href="https://github.com/bbeaudet-dev/pokemon-25WoL"
            rel="noreferrer"
            target="_blank"
          >
            <GithubMark />
            View on GitHub
          </a>
        </div>
      </section>

      {isCreating || joiningLobbyCode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="rounded-4xl border border-white/10 bg-slate-950 p-8 text-center shadow-2xl">
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
        <div className="rounded-4xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">Active Lobbies</h2>
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
                  No active lobbies yet. Go create one!
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
                    {lobby.status === "in_progress" ? (
                      <button
                        className="rounded-full bg-slate-700 px-4 py-2 text-sm font-black text-slate-300"
                        disabled
                      >
                        In Progress
                      </button>
                    ) : lobby.visibility === "private" ? (
                      <button
                        className="rounded-full bg-slate-700 px-4 py-2 text-sm font-black text-slate-300"
                        disabled
                      >
                        Private
                      </button>
                    ) : (
                      <button
                        className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-black transition hover:bg-yellow-200"
                        disabled={joiningLobbyCode === lobby.code}
                        onClick={() => joinByCode(lobby.code)}
                      >
                        {joiningLobbyCode === lobby.code ? "Joining..." : "Join"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="grid gap-5">
          <div className="rounded-4xl border border-white/10 bg-white/10 p-5">
            <h2 className="text-2xl font-black">Start Playing</h2>
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
            <label className="mt-4 flex flex-col gap-2 text-sm font-bold text-slate-200 sm:flex-row sm:items-center">
              <span className="shrink-0">Display Name</span>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                value={draftDisplayName}
                maxLength={24}
                onChange={(event) => setDraftDisplayName(event.target.value)}
                placeholder="Trainer name"
              />
              {canSaveDisplayName ? (
                <button
                  className="rounded-xl bg-yellow-300 px-3 py-2 text-sm font-black text-black"
                  onClick={() => updateDisplayName(draftDisplayName.trim())}
                  type="button"
                >
                  Save
                </button>
              ) : null}
            </label>
          </div>
        </aside>
      </section>

      <footer className="mt-auto flex flex-col items-center gap-3 pt-8">
        <p className="text-center text-[11px] italic leading-relaxed text-slate-500">
          &ldquo;I give full permission to anybody out there to turn this into a
          website in their free time.&rdquo;
          <br />
          &mdash; ZaneGames
        </p>
        <BuyMeACoffee />
      </footer>
      </main>
    </>
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

function GithubMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}
