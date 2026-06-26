"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { convexApi, type GameRoom } from "@/lib/convex-api";
import {
  canRerollWithinScoringLimit,
  formatCategoryLabel,
} from "@/lib/game/rules";
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
  const rerollTargets = useMutation(convexApi.games.rerollTargets);
  const confirmTargets = useMutation(convexApi.games.confirmTargets);
  const setManualTarget = useMutation(convexApi.games.setManualTarget);
  const nextRerollCost = Math.max(0, round.rerollCount);
  const [pendingAction, setPendingAction] = useState<"reroll" | "confirm" | null>(
    null,
  );
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [targetQuery, setTargetQuery] = useState("");
  const isRerolling = pendingAction === "reroll";
  const isConfirming = pendingAction === "confirm";
  const isManualSelection = settings.targetSelection === "manual";
  const canReroll = canRerollWithinScoringLimit(
    round.hintWords.length,
    nextRerollCost,
    settings,
  );
  const targetResults = useQuery(
    convexApi.content.search,
    isManualSelection && targetQuery.trim()
      ? {
          query: targetQuery.trim(),
          limit: 10,
        }
      : "skip",
  );

  async function run(
    actionName: "reroll" | "confirm",
    action: () => Promise<unknown>,
  ) {
    onError(null);
    setPendingAction(actionName);
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function chooseManualTarget(contentId: Id<"content">) {
    onError(null);
    setPendingAction("reroll");
    try {
      await setManualTarget({
        roundId: round.id,
        guestId,
        targetIndex: selectedTargetIndex,
        contentId,
      });
      setTargetQuery("");
      setSelectedTargetIndex((currentIndex) =>
        Math.min(currentIndex + 1, round.targetWords.length - 1),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to set target.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          {isHintmaster
            ? isManualSelection
              ? "Choose your targets"
              : "Confirm your targets"
            : "Targets are being confirmed"}
        </p>
        <div
          aria-busy={isRerolling}
          className={`mt-5 grid gap-2 sm:grid-cols-2 ${
            isRerolling ? "animate-pulse opacity-70" : ""
          }`}
        >
          {round.targetWords.map((target, index) => (
            <div
              className="font-display clip-score flex items-center gap-3 bg-white px-4 py-3 font-black text-black"
              key={target.contentId}
            >
              <span className="mr-3 rounded bg-yellow-200 px-2 py-1 text-xs">
                {index + 1}
              </span>
              {isHintmaster ? (
                <WordImage
                  category={target.category}
                  imageUrl={target.imageUrl}
                  label={target.label}
                />
              ) : null}
              {isHintmaster ? target.label : "Hidden"}
            </div>
          ))}
        </div>
        {isRerolling ? (
          <p className="mt-3 text-sm font-bold text-purple-200">
            {isManualSelection ? "Updating target..." : "Rerolling targets..."}
          </p>
        ) : null}
        {isHintmaster && isManualSelection ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="flex flex-wrap gap-2">
              {round.targetWords.map((target, index) => (
                <button
                  className={`rounded-full px-3 py-2 text-sm font-black ${
                    selectedTargetIndex === index
                      ? "bg-yellow-300 text-black"
                      : "bg-black/30 text-slate-200"
                  }`}
                  key={`${target.contentId}-${index}`}
                  onClick={() => setSelectedTargetIndex(index)}
                >
                  Slot {index + 1}
                </button>
              ))}
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
              value={targetQuery}
              onChange={(event) => setTargetQuery(event.currentTarget.value)}
              placeholder={`Search replacement for target ${selectedTargetIndex + 1}`}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(targetResults ?? []).map((result) => (
                <button
                  className="font-display flex items-center gap-3 rounded-2xl bg-black/40 px-3 py-2 text-left font-bold transition hover:bg-yellow-300 hover:text-black disabled:cursor-wait disabled:opacity-60"
                  disabled={Boolean(pendingAction)}
                  key={result.id}
                  onClick={() => chooseManualTarget(result.id)}
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
            </div>
          </div>
        ) : null}
        {isHintmaster ? (
          <div className="mt-6 flex justify-end gap-3">
            {!isManualSelection ? (
              <button
                className={`font-display rounded-2xl px-5 py-3 font-black leading-tight text-black transition ${
                  isRerolling
                    ? "scale-95 bg-purple-200"
                    : !canReroll
                      ? "bg-slate-400"
                      : "bg-purple-400 hover:bg-purple-300"
                } disabled:cursor-not-allowed disabled:opacity-80`}
                disabled={Boolean(pendingAction) || !canReroll}
                onClick={() =>
                  run("reroll", () => rerollTargets({ roundId: round.id, guestId }))
                }
              >
                <RotateCcw
                  className={`mr-2 inline h-5 w-5 ${isRerolling ? "animate-spin" : ""}`}
                />
                {isRerolling ? "Rerolling..." : "Reroll"}
                <span className="block text-xs">
                  {!canReroll
                    ? "Not enough scoring words"
                    : `Cost: ${nextRerollCost === 0 ? "FREE" : `${nextRerollCost} word${nextRerollCost === 1 ? "" : "s"}`}`}
                </span>
              </button>
            ) : null}
            <button
              className="font-display rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black transition hover:bg-yellow-200 disabled:cursor-wait disabled:opacity-70"
              disabled={Boolean(pendingAction)}
              onClick={() =>
                run("confirm", () => confirmTargets({ roundId: round.id, guestId }))
              }
            >
              <Check className="mr-2 inline h-5 w-5" />
              {isConfirming ? "Confirming..." : "Confirm"}
            </button>
          </div>
        ) : (
          <p className="mt-5 text-slate-300">Waiting for the hintmaster...</p>
        )}
      </div>
    </div>
  );
}
