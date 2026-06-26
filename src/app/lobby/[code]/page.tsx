"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Clipboard, Crown, Play, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameRoomBoard } from "@/components/game/game-room-board";
import { useGuestIdentity } from "@/hooks/use-guest-identity";
import { convexApi } from "@/lib/convex-api";
import {
  advancedCategories,
  classicCategories,
  formatCategoryLabel,
  makeGameSettings,
} from "@/lib/game/rules";
import type { ContentCategory, GameMode } from "@/lib/game/types";

const customCategoryOptions = advancedCategories;

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
  const updateDisplayNameMutation = useMutation(
    convexApi.lobbies.updateDisplayName,
  );
  const updateSettings = useMutation(convexApi.lobbies.updateSettings);
  const startGame = useMutation(convexApi.games.start);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(
    identity.displayName,
  );
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
      isLeaving ||
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
    isLeaving,
  ]);

  useEffect(() => {
    const nextDisplayName = currentPlayer?.displayName ?? identity.displayName;

    queueMicrotask(() => {
      setDraftDisplayName(nextDisplayName);
    });
  }, [currentPlayer?.displayName, identity.displayName]);

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

  async function handleDisplayNameSave() {
    await runAction(async () => {
      await updateDisplayNameMutation({
        guestId: identity.guestId,
        displayName: draftDisplayName,
      });
      updateDisplayName(draftDisplayName);
    });
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

  async function handleTargetWordsPerRoundChange(value: number) {
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
          mode: "custom",
          targetWordsPerRound: value,
        }),
      }),
    );
  }

  async function handleTargetSelectionChange(
    targetSelection: "random" | "manual",
  ) {
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
          targetSelection,
        }),
      }),
    );
  }

  async function handleScoringWordLimitChange(value: number) {
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
          scoringWordLimit: value,
        }),
      }),
    );
  }

  async function handleHardWordLimitChange(value: number) {
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
          hardWordLimit: value,
        }),
      }),
    );
  }

  async function handlePointsPerRemainingWordChange(value: number) {
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
          pointsPerRemainingWord: value,
        }),
      }),
    );
  }

  async function handleModeChange(mode: GameMode) {
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
          mode,
          categories:
            mode === "custom"
              ? lobby.settings.categories.length
                ? lobby.settings.categories
                : advancedCategories
              : mode === "advanced"
                ? advancedCategories
                : classicCategories,
        }),
      }),
    );
  }

  async function handleCategoryToggle(category: ContentCategory) {
    if (!lobby) {
      return;
    }

    const categorySet = new Set(lobby.settings.categories);

    if (categorySet.has(category)) {
      categorySet.delete(category);
    } else {
      categorySet.add(category);
    }

    const categories = customCategoryOptions.filter((option) =>
      categorySet.has(option),
    );

    if (categories.length === 0) {
      setError("Custom mode needs at least one content category.");
      return;
    }

    await runAction(() =>
      updateSettings({
        lobbyId: lobby.id,
        guestId: identity.guestId,
        visibility: lobby.visibility,
        settings: makeGameSettings({
          ...lobby.settings,
          mode: "custom",
          categories,
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
    hasAttemptedAutoJoin.current = true;
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
                {isHost ? (
                  <VisibilityToggle
                    isPrivate={lobby.visibility === "private"}
                    onChange={handleVisibilityChange}
                  />
                ) : (
                  <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-black capitalize text-slate-200">
                    {lobby.visibility}
                  </span>
                )}
              </div>
            </div>

            {currentPlayer ? (
              <div className={`grid gap-3 ${isHost ? "sm:grid-cols-2" : ""}`}>
                <button
                  className={`rounded-2xl px-5 py-4 font-black text-black transition ${
                    currentPlayer.isReady
                      ? "bg-orange-500 hover:bg-orange-400"
                      : "animate-pulse bg-orange-400 hover:bg-orange-300"
                  }`}
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
                {isHost ? (
                  <button
                    className="animate-pulse rounded-2xl bg-green-300 px-5 py-4 font-black text-black transition hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-green-300"
                    disabled={!allReady}
                    onClick={() =>
                      runAction(() =>
                        startGame({
                          lobbyId: lobby.id,
                          guestId: identity.guestId,
                        }),
                      )
                    }
                  >
                    <Play className="mr-2 inline h-5 w-5" />
                    Start Game
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-yellow-300" />
            <h2 className="text-2xl font-black">Players</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {lobby.players.map((player) => {
              const isCurrentPlayer = player.guestId === identity.guestId;
              const canSaveName =
                isCurrentPlayer &&
                draftDisplayName.trim() &&
                draftDisplayName.trim() !== currentPlayer?.displayName;

              return (
              <div
                className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                key={player.id}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 font-bold">
                  {player.isHost ? (
                    <Crown className="h-4 w-4 text-yellow-300" />
                  ) : null}
                  {isCurrentPlayer ? (
                    <input
                      className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-2 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                      maxLength={24}
                      value={draftDisplayName}
                      onChange={(event) =>
                        setDraftDisplayName(event.currentTarget.value)
                      }
                    />
                  ) : (
                    player.displayName
                  )}
                </span>
                {canSaveName ? (
                  <button
                    className="ml-3 rounded-xl bg-yellow-300 px-3 py-2 text-sm font-black text-black"
                    onClick={handleDisplayNameSave}
                  >
                    Save
                  </button>
                ) : (
                  <span
                    className={
                      player.isReady ? "ml-3 text-green-300" : "ml-3 text-slate-400"
                    }
                  >
                    {player.isReady ? "Ready" : "Not ready"}
                  </span>
                )}
              </div>
            );
            })}
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-black/30 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Game Settings</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Mode
            </p>
            {isHost ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["classic", "advanced", "custom"] as const).map((mode) => (
                  <button
                    className={`min-w-24 rounded-xl px-3 py-2 font-black capitalize ${
                      lobby.settings.mode === mode
                        ? "bg-yellow-300 text-black"
                        : "bg-black/30 text-slate-200"
                    }`}
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xl font-black capitalize">
                {lobby.settings.mode}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Targets
            </p>
            {isHost && lobby.settings.mode === "custom" ? (
              <label className="mt-3 flex items-center gap-3 text-sm font-bold text-slate-200">
                <input
                  aria-label="Target words per round"
                  className="w-16 rounded-xl bg-black/30 px-3 py-2 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                  min={1}
                  max={25}
                  type="number"
                  value={lobby.settings.targetWordsPerRound}
                  onChange={(event) =>
                    handleTargetWordsPerRoundChange(
                      Number(event.currentTarget.value),
                    )
                  }
                />
                <span>words</span>
              </label>
            ) : (
              <p className="mt-2 text-xl font-black">
                {lobby.settings.targetWordsPerRound} words
              </p>
            )}
            {isHost ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["random", "manual"] as const).map((selection) => (
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-black capitalize transition ${
                      lobby.settings.targetSelection === selection
                        ? "bg-yellow-300 text-black hover:bg-yellow-400"
                        : "bg-black/30 text-slate-300 hover:bg-yellow-200 hover:text-black"
                    }`}
                    key={selection}
                    onClick={() => handleTargetSelectionChange(selection)}
                  >
                    {selection}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold capitalize text-slate-400">
                {lobby.settings.targetSelection} selection
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Hint Limits
            </p>
            {isHost ? (
              <div className="mt-3">
                <p className="text-sm font-bold leading-9 text-slate-200">
                  <input
                    aria-label="Scoring word limit"
                    className="mx-1 inline w-14 rounded-xl bg-black/30 px-2 py-1 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                    min={1}
                    max={50}
                    type="number"
                    value={lobby.settings.scoringWordLimit}
                    onChange={(event) =>
                      handleScoringWordLimitChange(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  words,
                  <input
                    aria-label="Points per remaining word"
                    className="mx-1 inline w-12 rounded-xl bg-black/30 px-2 py-1 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                    min={1}
                    max={10}
                    type="number"
                    value={lobby.settings.pointsPerRemainingWord ?? 1}
                    onChange={(event) =>
                      handlePointsPerRemainingWordChange(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  {(lobby.settings.pointsPerRemainingWord ?? 1) === 1
                    ? " point"
                    : " points"}{" "}
                  for each remaining,
                  <input
                    aria-label="Maximum word limit"
                    className="mx-1 inline w-14 rounded-xl bg-black/30 px-2 py-1 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                    min={lobby.settings.scoringWordLimit}
                    max={50}
                    type="number"
                    value={lobby.settings.hardWordLimit}
                    onChange={(event) =>
                      handleHardWordLimitChange(Number(event.currentTarget.value))
                    }
                  />
                  maximum words
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
                {lobby.settings.scoringWordLimit} words,{" "}
                {lobby.settings.pointsPerRemainingWord ?? 1}{" "}
                {(lobby.settings.pointsPerRemainingWord ?? 1) === 1
                  ? "point"
                  : "points"}{" "}
                for each remaining,{" "}
                {lobby.settings.hardWordLimit} maximum words
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Hintmaster Turns
            </p>
            {isHost ? (
              <label className="mt-3 flex items-center gap-3 text-sm font-bold text-slate-200">
                <input
                  aria-label="Times each player is Hintmaster"
                  className="w-16 rounded-xl bg-black/30 px-3 py-2 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                  min={1}
                  max={5}
                  type="number"
                  value={lobby.settings.hintGiverTurnsPerPlayer}
                  onChange={(event) =>
                    handleTurnsChange(Number(event.currentTarget.value))
                  }
                />
                <span>per player</span>
              </label>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-slate-200">
                {lobby.settings.hintGiverTurnsPerPlayer} per player
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Categories
            </p>
            {lobby.settings.mode !== "custom" ? (
              <p className="text-xs font-bold text-slate-500">
                Switch to Custom to edit
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {customCategoryOptions.map((category) => {
              const isSelected = lobby.settings.categories.includes(category);
              const canEdit = isHost && lobby.settings.mode === "custom";

              return (
                <button
                  className={`rounded-full px-3 py-2 text-sm font-black transition ${
                    isSelected
                      ? "bg-yellow-300 text-black ring-2 ring-yellow-100/70 hover:ring-4"
                      : "bg-black/30 text-slate-300"
                  } ${
                    canEdit
                      ? isSelected
                        ? ""
                        : "hover:bg-white/15 hover:text-white"
                      : "cursor-not-allowed opacity-60"
                  }`}
                  disabled={!canEdit}
                  key={category}
                  onClick={() => handleCategoryToggle(category)}
                >
                  {formatCategoryLabel(category)}
                </button>
              );
            })}
          </div>
        </div>
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
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-red-500 transition hover:text-red-400 disabled:opacity-60"
          disabled={isLeaving}
          onClick={onLeave}
        >
          <ArrowLeft className="h-4 w-4" />
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

function VisibilityToggle({
  isPrivate,
  onChange,
}: {
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-black/40 p-1">
      <button
        className={`h-10 min-w-24 rounded-full px-4 text-sm font-black transition ${
          isPrivate ? "bg-yellow-300 text-black" : "text-slate-300"
        }`}
        onClick={() => onChange(true)}
      >
        Private
      </button>
      <button
        className={`h-10 min-w-24 rounded-full px-4 text-sm font-black transition ${
          !isPrivate ? "bg-yellow-300 text-black" : "text-slate-300"
        }`}
        onClick={() => onChange(false)}
      >
        Public
      </button>
    </div>
  );
}

