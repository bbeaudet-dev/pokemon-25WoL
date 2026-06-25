"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Clipboard, Crown, LogOut, Play, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameRoomBoard } from "@/components/game/game-room-board";
import { useGuestIdentity } from "@/hooks/use-guest-identity";
import { convexApi } from "@/lib/convex-api";
import { makeGameSettings } from "@/lib/game/rules";

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();
  const { identity, updateDisplayName, isReady } = useGuestIdentity();
  const lobby = useQuery(convexApi.lobbies.getByCode, { code });
  const room = useQuery(
    convexApi.games.getRoom,
    lobby ? ({ lobbyId: lobby.id } as any) : "skip",
  );
  const joinLobby = useMutation(convexApi.lobbies.join);
  const leaveLobby = useMutation(convexApi.lobbies.leave);
  const setReady = useMutation(convexApi.lobbies.setReady);
  const updateSettings = useMutation(convexApi.lobbies.updateSettings);
  const startGame = useMutation(convexApi.games.start);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const hasAttemptedAutoJoin = useRef(false);

  const currentPlayer = useMemo(
    () => lobby?.players.find((player) => player.guestId === identity.guestId),
    [identity.guestId, lobby?.players],
  );
  const isHost = Boolean(currentPlayer?.isHost);
  const allReady = Boolean(
    lobby?.players.length && lobby.players.every((player) => player.isReady),
  );

  useEffect(() => {
    if (
      !lobby ||
      currentPlayer ||
      !isReady ||
      isJoining ||
      hasAttemptedAutoJoin.current ||
      lobby.status !== "open"
    ) {
      return;
    }

    hasAttemptedAutoJoin.current = true;
    queueMicrotask(() => {
      setIsJoining(true);
      joinLobby({
        code,
        guestId: identity.guestId,
        displayName: identity.displayName,
      })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Unable to join lobby."),
        )
        .finally(() => setIsJoining(false));
    });
  }, [
    code,
    currentPlayer,
    identity,
    isJoining,
    isReady,
    joinLobby,
    lobby,
  ]);

  async function runAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function handleVisibilityChange(isPrivate: boolean) {
    if (!lobby) {
      return;
    }

    await runAction(() =>
      updateSettings({
        lobbyId: lobby.id,
        guestId: identity.guestId,
        visibility: isPrivate ? "private" : "public",
        settings: makeGameSettings({
          ...lobby.settings,
          isPrivate,
        }),
      }),
    );
  }

  async function handleTurnsChange(value: number) {
    if (!lobby) {
      return;
    }

    await runAction(() =>
      updateSettings({
        lobbyId: lobby.id,
        guestId: identity.guestId,
        visibility: lobby.visibility,
        settings: makeGameSettings({
          ...lobby.settings,
          hintGiverTurnsPerPlayer: value,
        }),
      }),
    );
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/lobby/${code}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1200);
  }

  async function handleLeave() {
    if (!lobby || !currentPlayer) {
      router.push("/");
      return;
    }

    setIsLeaving(true);
    await runAction(() =>
      leaveLobby({ lobbyId: lobby.id, guestId: identity.guestId }),
    );
    router.push("/");
  }

  if (lobby === undefined) {
    return <Shell>Loading lobby...</Shell>;
  }

  if (lobby === null) {
    return (
      <Shell>
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8">
          <h1 className="text-3xl font-black">Lobby not found</h1>
          <Link className="mt-5 inline-block text-yellow-300" href="/">
            Back to lobby browser
          </Link>
        </div>
      </Shell>
    );
  }

  if (room?.lobby.status === "in_progress" && room.round) {
    return (
      <GameRoomBoard
        code={code}
        identity={identity}
        room={room}
        onError={setError}
        error={error}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <Shell onLeave={currentPlayer ? handleLeave : undefined} isLeaving={isLeaving}>
      {isJoining ? (
        <div className="mb-5 rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-4 py-3 font-bold text-yellow-100">
          Joining lobby...
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
          {error}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-6">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
                Lobby
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-5xl font-black">{lobby.code}</h1>
                <button
                  aria-label="Copy invite link"
                  className="grid h-11 w-11 place-items-center rounded-full bg-yellow-300 text-black transition hover:bg-yellow-200"
                  onClick={copyInvite}
                >
                  {copiedInvite ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Clipboard className="h-5 w-5" />
                  )}
                </button>
                <button
                  className="relative flex h-11 w-32 items-center rounded-full bg-black/40 p-1 text-sm font-black"
                  disabled={!isHost}
                  onClick={() => handleVisibilityChange(lobby.visibility !== "private")}
                >
                  <span
                    className={`absolute top-1 h-9 w-[58px] rounded-full bg-yellow-300 transition ${
                      lobby.visibility === "public" ? "left-[66px]" : "left-1"
                    }`}
                  />
                  <span className="relative z-10 flex-1 text-center text-black">
                    Private
                  </span>
                  <span className="relative z-10 flex-1 text-center text-white">
                    Public
                  </span>
                </button>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-200">
              Display name
              <input
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                value={identity.displayName}
                maxLength={24}
                onChange={(event) => updateDisplayName(event.target.value)}
              />
            </label>

            {currentPlayer ? (
              <button
                className="rounded-2xl bg-yellow-300 px-5 py-4 font-black text-black"
                onClick={() =>
                  runAction(() =>
                    setReady({
                      lobbyId: lobby.id,
                      guestId: identity.guestId,
                      isReady: !currentPlayer.isReady,
                    }),
                  )
                }
              >
                {currentPlayer.isReady ? "Unready" : "Ready Up"}
              </button>
            ) : null}
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-yellow-300" />
            <h2 className="text-2xl font-black">Players</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {lobby.players.map((player) => (
              <div
                className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                key={player.id}
              >
                <span className="flex items-center gap-2 font-bold">
                  {player.isHost ? (
                    <Crown className="h-4 w-4 text-yellow-300" />
                  ) : null}
                  {player.displayName}
                </span>
                <span
                  className={
                    player.isReady ? "text-green-300" : "text-slate-400"
                  }
                >
                  {player.isReady ? "Ready" : "Not ready"}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-black/30 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Game Settings</h2>
            <p className="mt-2 text-slate-300">
              Classic mode is wired first. Changing settings resets ready
              states.
            </p>
          </div>
          {isHost ? (
            <button
              className="rounded-2xl bg-green-300 px-5 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!allReady}
              onClick={() =>
                runAction(() =>
                  startGame({ lobbyId: lobby.id, guestId: identity.guestId }),
                )
              }
            >
              <Play className="mr-2 inline h-5 w-5" />
              Start Game
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SettingCard label="Mode" value={lobby.settings.mode} />
          <SettingCard
            label="Targets"
            value={`${lobby.settings.targetWordsPerRound} words`}
          />
          <SettingCard
            label="Word limits"
            value={`${lobby.settings.scoringWordLimit}/${lobby.settings.hardWordLimit}`}
          />
        </div>

        {isHost ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 rounded-2xl bg-white/10 px-4 py-3 font-bold">
              Times each player is Hintmaster
              <input
                className="rounded-xl bg-black/30 px-3 py-2"
                min={1}
                max={5}
                type="number"
                value={lobby.settings.hintGiverTurnsPerPlayer}
                onChange={(event) =>
                  handleTurnsChange(Number(event.currentTarget.value))
                }
              />
            </label>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}

function Shell({
  children,
  onLeave,
  isLeaving,
}: {
  children: React.ReactNode;
  onLeave?: () => void;
  isLeaving?: boolean;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      {onLeave ? (
        <button
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-yellow-300"
          disabled={isLeaving}
          onClick={onLeave}
        >
          <LogOut className="h-4 w-4" />
          {isLeaving ? "Leaving..." : "Leave Lobby"}
        </button>
      ) : (
        <Link className="mb-6 inline-block text-sm font-bold text-yellow-300" href="/">
          Back to lobbies
        </Link>
      )}
      {children}
    </main>
  );
}

function SettingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black capitalize">{value}</p>
    </div>
  );
}
