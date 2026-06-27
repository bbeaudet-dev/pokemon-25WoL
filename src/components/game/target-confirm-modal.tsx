"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { convexApi, type GameRoom } from "@/lib/convex-api";
import { formatCategoryLabel } from "@/lib/game/rules";
import { WordImage } from "./word-image";

export function TargetConfirmModal({
  isHintmaster,
  round,
  settings,
  guestId,
  onError,
}: {
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
  isHintmaster: boolean;
  guestId: string;
  onError: (message: string | null) => void;
}) {
  const confirmTargets = useMutation(convexApi.games.confirmTargets);
  const setManualTarget = useMutation(convexApi.games.setManualTarget);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const trimmedQuery = targetQuery.trim();
  const targetResults = useQuery(
    convexApi.content.search,
    activeIndex !== null && trimmedQuery
      ? {
          query: trimmedQuery,
          categories: settings.categories,
          limit: 8,
        }
      : "skip",
  );

  function openSlot(index: number) {
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
      await setManualTarget({
        roundId: round.id,
        guestId,
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

  async function handleConfirm() {
    onError(null);
    setIsConfirming(true);
    try {
      await confirmTargets({ roundId: round.id, guestId });
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Unable to confirm targets.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          {isHintmaster ? "Choose your targets" : "Targets are being chosen"}
        </p>
        {isHintmaster ? (
          <p className="mt-2 text-sm text-slate-400">
            Tap any target to search for a replacement, then confirm to start
            your turn.
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {round.targetWords.map((target, index) => {
            const isActive = activeIndex === index;

            if (isHintmaster && isActive) {
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
                  isHintmaster
                    ? "hover:bg-yellow-200"
                    : "cursor-default opacity-90"
                }`}
                disabled={!isHintmaster}
                key={`${target.contentId}-${index}`}
                onClick={() => openSlot(index)}
              >
                {isHintmaster ? (
                  <WordImage
                    category={target.category}
                    imageUrl={target.imageUrl}
                    label={target.label}
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">
                  {isHintmaster ? target.label : "Hidden"}
                </span>
              </button>
            );
          })}
        </div>

        {isHintmaster && activeIndex !== null ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4">
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

        {isHintmaster ? (
          <div className="mt-6 flex justify-end">
            <button
              className="font-display rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black transition hover:bg-yellow-200 disabled:cursor-wait disabled:opacity-70"
              disabled={isConfirming}
              onClick={handleConfirm}
            >
              <Check className="mr-2 inline h-5 w-5" />
              {isConfirming ? "Starting..." : "Confirm & Start"}
            </button>
          </div>
        ) : (
          <p className="mt-5 text-slate-300">Waiting for the hintmaster...</p>
        )}
      </div>
    </div>
  );
}
