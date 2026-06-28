"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Pencil, Search } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContentWheel } from "@/components/home/content-wheel";
import { PlayerAvatar } from "@/components/player-avatar";
import { convexApi, type GameRoom } from "@/lib/convex-api";
import { formatCategoryLabel } from "@/lib/game/rules";
import type { GuestIdentity } from "@/lib/guest";
import { WordImage } from "./word-image";

type ManualSelectionScreenProps = {
  code: string;
  identity: GuestIdentity;
  room: GameRoom;
  error: string | null;
  onError: (message: string | null) => void;
  onLeave: () => void;
};

export function ManualSelectionScreen({
  code,
  identity,
  room,
  error,
  onError,
  onLeave,
}: ManualSelectionScreenProps) {
  const game = room.game!;
  const settings = game.settings;
  const selection = game.manualSelection;
  const lockedIn = Boolean(selection?.lockedIn);
  const targets = selection?.targets ?? [];

  const setPlayerTarget = useMutation(convexApi.games.setPlayerTarget);
  const setPlayerLock = useMutation(convexApi.games.setPlayerLock);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const trimmedQuery = targetQuery.trim();
  const targetResults = useQuery(
    convexApi.content.search,
    activeIndex !== null && trimmedQuery
      ? { query: trimmedQuery, categories: settings.categories, limit: 8 }
      : "skip",
  );

  const lockProgress = game.manualLockProgress;
  const readyCount = lockProgress.filter((entry) => entry.lockedIn).length;
  const totalCount = lockProgress.length;
  const lockedByPlayer = new Map(
    lockProgress.map((entry) => [String(entry.playerId), entry.lockedIn]),
  );

  const turnsPerPlayer = Math.max(1, settings.hintGiverTurnsPerPlayer);
  const cycleSize = Math.max(
    1,
    Math.round(game.roundOrder.length / turnsPerPlayer),
  );
  const currentCycle = Math.floor(game.currentRoundIndex / cycleSize) + 1;

  function openSlot(index: number) {
    if (lockedIn) {
      return;
    }
    setActiveIndex(index);
    setTargetQuery("");
  }

  function closeSlot() {
    setActiveIndex(null);
    setTargetQuery("");
  }

  async function chooseTarget(contentId: Id<"content">) {
    if (activeIndex === null) {
      return;
    }
    onError(null);
    setIsUpdating(true);
    try {
      await setPlayerTarget({
        gameId: game.id,
        guestId: identity.guestId,
        targetIndex: activeIndex,
        contentId,
      });
      closeSlot();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to set target.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function toggleLock(next: boolean) {
    onError(null);
    setIsLocking(true);
    try {
      await setPlayerLock({
        gameId: game.id,
        guestId: identity.guestId,
        lockedIn: next,
      });
      if (next) {
        closeSlot();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to update lock.");
    } finally {
      setIsLocking(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <ContentWheel rows={5} className="opacity-40" />
        <div className="absolute inset-0 bg-slate-950/70" />
      </div>
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-1">
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
            Manual selection
            {turnsPerPlayer > 1
              ? ` - Round ${currentCycle} of ${turnsPerPlayer}`
              : null}
          </p>
          <h1 className="text-4xl font-black">Pick your target words</h1>
          <p className="text-slate-300">
            Everyone chooses at the same time. Tap a card to search for a
            replacement, then lock in when you&rsquo;re happy. The round starts
            once all {totalCount} players are ready.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-4xl border border-white/10 bg-white/10 p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs font-bold uppercase tracking-widest text-slate-300">
                Your {targets.length} targets
              </p>
              {lockedIn ? (
                <span className="font-display inline-flex items-center gap-1 rounded-full bg-green-400/20 px-3 py-1 text-xs font-black text-green-200">
                  <Check className="h-4 w-4" />
                  Locked in
                </span>
              ) : null}
            </div>

            {selection ? (
              <>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {targets.map((target, index) => {
                    if (!lockedIn && activeIndex === index) {
                      return (
                        <div
                          className="flex items-center gap-2 rounded-2xl border border-yellow-300/60 bg-black/50 px-3 ring-4 ring-yellow-300/30"
                          key={`${target.contentId}-${index}`}
                        >
                          <Search className="h-4 w-4 shrink-0 text-yellow-300" />
                          <input
                            autoFocus
                            className="font-display min-w-0 flex-1 bg-transparent py-3 text-white outline-none"
                            onChange={(event) =>
                              setTargetQuery(event.currentTarget.value)
                            }
                            placeholder={`Search target ${index + 1}...`}
                            value={targetQuery}
                          />
                        </div>
                      );
                    }

                    return (
                      <button
                        className={`font-display clip-score flex items-center gap-3 bg-white px-4 py-3 text-left font-black text-black transition ${
                          lockedIn
                            ? "cursor-default opacity-80"
                            : "hover:bg-yellow-200"
                        }`}
                        disabled={lockedIn}
                        key={`${target.contentId}-${index}`}
                        onClick={() => openSlot(index)}
                      >
                        <span className="rounded bg-yellow-200 px-2 py-1 text-xs">
                          {index + 1}
                        </span>
                        <WordImage
                          category={target.category}
                          imageUrl={target.imageUrl}
                          label={target.label}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {target.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!lockedIn && activeIndex !== null ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xs font-bold uppercase tracking-widest text-slate-300">
                        Replacing target {activeIndex + 1}
                      </p>
                      <button
                        className="text-xs font-bold text-slate-400 transition hover:text-white"
                        onClick={closeSlot}
                      >
                        Cancel
                      </button>
                    </div>
                    {trimmedQuery ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {(targetResults ?? []).map((result) => (
                          <button
                            className="font-display flex items-center gap-3 rounded-2xl bg-black/40 px-3 py-2 text-left font-bold transition hover:bg-yellow-300 hover:text-black disabled:cursor-wait disabled:opacity-60"
                            disabled={isUpdating}
                            key={result.id}
                            onClick={() => chooseTarget(result.id)}
                          >
                            <WordImage
                              category={result.category}
                              imageUrl={result.imageUrl}
                              label={result.label}
                            />
                            <span>
                              {result.label}
                              <span className="block text-xs opacity-70">
                                {formatCategoryLabel(result.category)}
                              </span>
                            </span>
                          </button>
                        ))}
                        {targetResults && targetResults.length === 0 ? (
                          <p className="text-sm text-slate-400">
                            No matches in the enabled categories.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        Start typing to search for a replacement target.
                      </p>
                    )}
                  </div>
                ) : null}

                <div className="mt-6">
                  {lockedIn ? (
                    <button
                      className="font-display inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
                      disabled={isLocking}
                      onClick={() => toggleLock(false)}
                    >
                      <Pencil className="h-5 w-5" />
                      {isLocking ? "Unlocking..." : "Edit my picks"}
                    </button>
                  ) : (
                    <button
                      className="font-display inline-flex items-center gap-2 rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black transition hover:bg-yellow-200 disabled:cursor-wait disabled:opacity-60"
                      disabled={isLocking}
                      onClick={() => toggleLock(true)}
                    >
                      <Check className="h-5 w-5" />
                      {isLocking ? "Locking in..." : "Lock in"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-slate-300">Preparing your targets...</p>
            )}
          </div>

          <aside className="rounded-4xl border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-black">Ready</h2>
              <span className="font-display text-sm font-black text-yellow-300">
                {readyCount} / {totalCount}
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {room.players.map((player) => {
                const playerLocked =
                  lockedByPlayer.get(String(player.id)) ?? false;
                return (
                  <div
                    className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2"
                    key={player.id}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-bold">
                      <PlayerAvatar
                        displayName={player.displayName}
                        imageUrl={player.imageUrl}
                        size="sm"
                      />
                      <span className="truncate">{player.displayName}</span>
                    </span>
                    <span
                      className={`font-display text-xs font-black ${
                        playerLocked ? "text-green-300" : "text-slate-400"
                      }`}
                    >
                      {playerLocked ? "Ready" : "Picking..."}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <footer className="mt-auto flex flex-col items-start gap-2 px-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
          <span>Lobby {code}</span>
          <button
            className="flex items-center gap-2 text-left text-red-500 transition hover:text-red-400"
            onClick={onLeave}
          >
            <ArrowLeft className="h-4 w-4" />
            Leave Game
          </button>
        </footer>
      </main>
    </>
  );
}
