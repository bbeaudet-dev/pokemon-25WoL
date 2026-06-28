"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, RotateCcw, Send, SkipForward } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GuestIdentity } from "@/lib/guest";
import { PlayerAvatar } from "@/components/player-avatar";
import { convexApi, type GameRoom } from "@/lib/convex-api";
import {
  canRerollWithinScoringLimit,
  formatCategoryLabel,
  getRerollWordCost,
} from "@/lib/game/rules";
import { Scoreboard } from "./scoreboard";
import { WordImage } from "./word-image";

type GameRoomBoardProps = {
  code: string;
  identity: GuestIdentity;
  room: GameRoom;
  error: string | null;
  onError: (message: string | null) => void;
  onLeave: () => void;
};

export function GameRoomBoard({
  code,
  identity,
  room,
  error,
  onError,
  onLeave,
}: GameRoomBoardProps) {
  const endTurn = useMutation(convexApi.games.endTurn);
  const nextRound = useMutation(convexApi.games.nextRound);
  const skipTurn = useMutation(convexApi.games.skipTurn);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isEndTurnConfirmOpen, setIsEndTurnConfirmOpen] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isLeaveGameConfirmOpen, setIsLeaveGameConfirmOpen] = useState(false);
  // Tracks the round we're announcing with the brief turn-start overlay.
  const [introRoundId, setIntroRoundId] = useState<string | null>(null);
  // Transient popup announcing the hintmaster's latest hint to guessers.
  const [hintToast, setHintToast] = useState<{ id: string; text: string } | null>(
    null,
  );
  const seenHintIdRef = useRef<string | null>(null);
  const hintInitRef = useRef(false);
  const round = room.round;
  const currentPlayer = room.players.find(
    (player) => player.guestId === identity.guestId,
  );
  const isHintmaster = Boolean(
    currentPlayer && round?.hintGiverPlayerId === currentPlayer.id,
  );
  const isHost = Boolean(
    currentPlayer && currentPlayer.id === room.lobby.hostPlayerId,
  );
  const hintmasterName =
    room.players.find((player) => player.id === round?.hintGiverPlayerId)
      ?.displayName ?? "Hintmaster";
  const latestHintId = round?.submittedHints.at(-1)?.id;
  const roundEnded =
    round?.status === "complete" || round?.status === "failed";
  const isLastRound =
    !!room.game &&
    room.game.currentRoundIndex >= room.game.roundOrder.length - 1;

  // Flash a "{name} is up" intro whenever a fresh round becomes active.
  const roundId = round?.id;
  const roundStatus = round?.status;
  useEffect(() => {
    if (!roundId || roundStatus !== "active") {
      return;
    }
    setIntroRoundId(roundId);
    const timer = window.setTimeout(() => setIntroRoundId(null), 3500);
    return () => window.clearTimeout(timer);
  }, [roundId, roundStatus]);

  // Pop a toast for guessers whenever the hintmaster submits a new hint. Skip
  // hints that already existed when this view mounted so we don't flash on load.
  useEffect(() => {
    if (!hintInitRef.current) {
      hintInitRef.current = true;
      seenHintIdRef.current = latestHintId ?? null;
      return;
    }
    if (!latestHintId || latestHintId === seenHintIdRef.current) {
      return;
    }
    seenHintIdRef.current = latestHintId;
    if (isHintmaster) {
      return;
    }
    const text = round?.submittedHints.at(-1)?.text ?? "";
    setHintToast({ id: latestHintId, text });
    const timer = window.setTimeout(() => setHintToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [latestHintId, isHintmaster, round?.submittedHints]);

  async function handleEndTurn() {
    if (!round) {
      return;
    }
    onError(null);
    setIsEndingTurn(true);
    try {
      await endTurn({ roundId: round.id, guestId: identity.guestId });
      setIsEndTurnConfirmOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to end turn.");
    } finally {
      setIsEndingTurn(false);
    }
  }

  async function handleSkipTurn() {
    onError(null);
    setIsSkipping(true);
    try {
      await skipTurn({ lobbyId: room.lobby.id, guestId: identity.guestId });
      setIsSkipConfirmOpen(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to skip turn.");
    } finally {
      setIsSkipping(false);
    }
  }

  async function handleNextRound() {
    onError(null);
    setIsAdvancing(true);
    try {
      await nextRound({ lobbyId: room.lobby.id, guestId: identity.guestId });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to advance.");
    } finally {
      setIsAdvancing(false);
    }
  }

  if (!round || !room.game) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
        <Link className="text-yellow-300" href={`/lobby/${code}`}>
          Back to lobby
        </Link>
        <p className="mt-8">Waiting for the round to start...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-5 pb-12 pt-5">
      {introRoundId === round.id && round.status === "active" ? (
        <TurnIntro
          hintmasterName={hintmasterName}
          hintmaster={room.players.find(
            (player) => player.id === round.hintGiverPlayerId,
          )}
          isHintmaster={isHintmaster}
          round={round}
          onDismiss={() => setIntroRoundId(null)}
        />
      ) : null}
      {hintToast ? (
        <HintToast
          key={hintToast.id}
          hintmasterName={hintmasterName}
          hintmaster={room.players.find(
            (player) => player.id === round.hintGiverPlayerId,
          )}
          text={hintToast.text}
        />
      ) : null}
      {roundEnded ? (
        <RoundEndOverlay
          room={room}
          round={round}
          hintmasterName={hintmasterName}
          isHost={isHost}
          isLastRound={isLastRound}
          isAdvancing={isAdvancing}
          onNext={handleNextRound}
        />
      ) : null}
      {isEndTurnConfirmOpen ? (
        <EndTurnConfirmModal
          isEnding={isEndingTurn}
          onCancel={() => setIsEndTurnConfirmOpen(false)}
          onConfirm={handleEndTurn}
        />
      ) : null}
      {isSkipConfirmOpen ? (
        <SkipTurnConfirmModal
          hintmasterName={hintmasterName}
          isSkipping={isSkipping}
          onCancel={() => setIsSkipConfirmOpen(false)}
          onConfirm={handleSkipTurn}
        />
      ) : null}
      {isLeaveGameConfirmOpen ? (
        <LeaveGameConfirmModal
          onCancel={() => setIsLeaveGameConfirmOpen(false)}
          onConfirm={onLeave}
        />
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
          {error}
        </div>
      ) : null}

      <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
          <CurrentHint
            isHintmaster={isHintmaster}
            round={round}
            settings={room.game.settings}
            guestId={identity.guestId}
            latestHintId={latestHintId}
            currentPlayer={currentPlayer}
            onError={onError}
          />
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(26rem,1.15fr)]">
            <Scoreboard
              room={room}
              hintmasterId={round.hintGiverPlayerId}
              latestHintId={latestHintId}
            />
            <HintWordGrid round={round} settings={room.game.settings} />
          </div>
        </div>

        <TargetRail
          isHintmaster={isHintmaster}
          round={round}
          settings={room.game.settings}
          guestId={identity.guestId}
          players={room.players}
          onError={onError}
        />
      </section>

      <footer className="mb-6 flex flex-col items-start gap-2 px-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
        <span>Lobby {code}</span>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="flex items-center gap-2 text-left text-red-500 transition hover:text-red-400"
            onClick={() => setIsLeaveGameConfirmOpen(true)}
          >
            <ArrowLeft className="h-4 w-4" />
            Leave Game
          </button>
          {isHintmaster && round.status === "active" ? (
            <button
              className="rounded-full border border-yellow-300/40 px-4 py-2 text-yellow-300 transition hover:bg-yellow-300 hover:text-black"
              onClick={() => setIsEndTurnConfirmOpen(true)}
            >
              End my turn
            </button>
          ) : null}
          {isHost && !isHintmaster && round.status === "active" ? (
            <button
              className="flex items-center gap-2 rounded-full border border-orange-300/40 px-4 py-2 text-orange-300 transition hover:bg-orange-300 hover:text-black"
              onClick={() => setIsSkipConfirmOpen(true)}
            >
              <SkipForward className="h-4 w-4" />
              Skip turn
            </button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}

function LeaveGameConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950 p-7 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-300">
          Leave Game
        </p>
        <h2 className="mt-2 text-3xl font-black">Leave this game?</h2>
        <p className="mt-3 text-slate-300">
          For now, leaving removes you from the game. Rejoining and disconnected
          player states are planned but not built yet.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-2xl bg-white/10 px-5 py-4 font-black text-white transition hover:bg-white/15"
            onClick={onCancel}
          >
            Stay
          </button>
          <button
            className="rounded-2xl bg-red-500 px-5 py-4 font-black text-white transition hover:bg-red-400"
            onClick={onConfirm}
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}

function EndTurnConfirmModal({
  isEnding,
  onCancel,
  onConfirm,
}: {
  isEnding: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950 p-7 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          End Turn
        </p>
        <h2 className="mt-2 text-3xl font-black">End your hintmaster turn?</h2>
        <p className="mt-3 text-slate-300">
          Ending early forfeits all of your hintmaster points for this round.
          Guessers keep the points they already earned.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-2xl bg-white/10 px-5 py-4 font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isEnding}
            onClick={onCancel}
          >
            Keep Playing
          </button>
          <button
            className="rounded-2xl bg-red-500 px-5 py-4 font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isEnding}
            onClick={onConfirm}
          >
            {isEnding ? "Ending..." : "End Turn"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkipTurnConfirmModal({
  hintmasterName,
  isSkipping,
  onCancel,
  onConfirm,
}: {
  hintmasterName: string;
  isSkipping: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950 p-7 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-300">
          Skip Turn
        </p>
        <h2 className="mt-2 text-3xl font-black">Skip {hintmasterName}&rsquo;s turn?</h2>
        <p className="mt-3 text-slate-300">
          Use this if a player has left or gone idle. Their turn ends now and
          they forfeit their hintmaster points for this round. Guessers keep what
          they already earned.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-2xl bg-white/10 px-5 py-4 font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSkipping}
            onClick={onCancel}
          >
            Keep Waiting
          </button>
          <button
            className="rounded-2xl bg-orange-500 px-5 py-4 font-black text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSkipping}
            onClick={onConfirm}
          >
            {isSkipping ? "Skipping..." : "Skip Turn"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TurnIntro({
  hintmasterName,
  hintmaster,
  isHintmaster,
  round,
  onDismiss,
}: {
  hintmasterName: string;
  hintmaster?: GameRoom["players"][number];
  isHintmaster: boolean;
  round: NonNullable<GameRoom["round"]>;
  onDismiss: () => void;
}) {
  return (
    <button
      aria-label="Dismiss"
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/75 px-5 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950 p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <PlayerAvatar
            displayName={hintmasterName}
            imageUrl={hintmaster?.imageUrl}
            size="lg"
          />
        </div>
        <h2 className="mt-4 text-4xl font-black">
          {isHintmaster ? "You're up!" : `${hintmasterName} is up`}
        </h2>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          {isHintmaster ? "Your targets" : "Give your best guesses"}
        </p>

        {isHintmaster ? (
          <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
            {round.targetWords.map((target, index) => (
              <div
                className="font-display flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-black text-black"
                key={`${target.contentId}-${index}`}
              >
                <WordImage
                  category={target.category}
                  imageUrl={target.imageUrl}
                  label={target.label}
                />
                <span className="min-w-0 flex-1 truncate">{target.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-slate-500">
          Tap to continue
        </p>
      </div>
    </button>
  );
}

function HintToast({
  hintmasterName,
  hintmaster,
  text,
}: {
  hintmasterName: string;
  hintmaster?: GameRoom["players"][number];
  text: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="hint-pop flex max-w-md items-center gap-3 rounded-3xl border border-yellow-300/40 bg-slate-950/95 px-5 py-3 shadow-2xl">
        <PlayerAvatar
          displayName={hintmasterName}
          imageUrl={hintmaster?.imageUrl}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300">
            {hintmasterName} hinted
          </p>
          <p className="font-display truncate text-lg font-black text-white">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function CurrentHint({
  isHintmaster,
  round,
  settings,
  guestId,
  latestHintId,
  currentPlayer,
  onError,
}: {
  isHintmaster: boolean;
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
  guestId: string;
  latestHintId?: string;
  currentPlayer?: GameRoom["players"][number];
  onError: (message: string | null) => void;
}) {
  const submitHintText = useMutation(convexApi.games.submitHintText);
  const [text, setText] = useState("");
  const latestHint = round.submittedHints.at(-1);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      return;
    }

    onError(null);
    try {
      await submitHintText({ roundId: round.id, guestId, text });
      setText("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to submit hint.");
    }
  }

  async function repeatPreviousHint() {
    if (!latestHint) {
      return;
    }

    onError(null);
    try {
      await submitHintText({
        roundId: round.id,
        guestId,
        text: latestHint.text,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to repeat hint.");
    }
  }

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-4">
      {isHintmaster ? (
        <form className="flex gap-2" onSubmit={submit}>
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
            disabled={round.status !== "active"}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type hint words, then press Enter"
          />
          <button
            aria-label="Repeat previous hint"
            className="font-display rounded-2xl border border-yellow-300/40 bg-black/30 px-4 py-3 font-black text-yellow-300 transition hover:bg-yellow-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            disabled={round.status !== "active" || !latestHint}
            onClick={repeatPreviousHint}
            title="Repeat previous hint"
            type="button"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button className="font-display rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black">
            <Send className="h-5 w-5" />
          </button>
        </form>
      ) : null}
      {!isHintmaster && currentPlayer ? (
        <GuessPanel
          round={round}
          settings={settings}
          guestId={guestId}
          latestHintId={latestHintId}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

function HintWordGrid({
  round,
  settings,
}: {
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
}) {
  return (
    <section className="min-h-0 rounded-4xl border border-white/10 bg-slate-950/70 p-4">
      <div className="grid max-h-112 grid-flow-col grid-rows-10 gap-1.5 overflow-auto">
        {Array.from({ length: settings.hardWordLimit }, (_, index) => {
          const word = round.hintWords[index];
          return (
            <div
              className={`font-display clip-tag flex min-h-9 min-w-40 items-center gap-2 px-3 py-2 text-left text-xs font-black text-black ${
                index < 10
                  ? "bg-green-100"
                  : index < 20
                    ? "bg-yellow-100"
                    : index < settings.scoringWordLimit
                      ? "bg-red-100"
                      : "bg-slate-500 text-white"
              }`}
              key={index}
            >
              <span className="ml-1 rounded bg-yellow-200/70 px-1.5 py-0.5 text-[10px] text-black">
                {index + 1}
              </span>
              <span className="truncate">{word?.text ?? ""}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetRail({
  isHintmaster,
  round,
  settings,
  guestId,
  players,
  onError,
}: {
  isHintmaster: boolean;
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
  guestId: string;
  players: GameRoom["players"];
  onError: (message: string | null) => void;
}) {
  const rerollCurrentTarget = useMutation(convexApi.games.rerollCurrentTarget);
  const [isRerolling, setIsRerolling] = useState(false);
  const { targetWords, currentTargetIndex } = round;
  const nextRerollCost = getRerollWordCost(round.rerollCount + 1);
  const canReroll = canRerollWithinScoringLimit(
    round.hintWords.length,
    nextRerollCost,
    settings,
  );

  async function handleReroll() {
    onError(null);
    setIsRerolling(true);
    try {
      await rerollCurrentTarget({ roundId: round.id, guestId });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to reroll target.");
    } finally {
      setIsRerolling(false);
    }
  }

  return (
    <aside className="rounded-4xl border border-white/10 bg-slate-950/70 p-4">
      <div className="grid gap-2">
        {targetWords.map((target, index) => {
          const solved = target.solvedByPlayerIds.length > 0;
          const visible = isHintmaster || solved;
          const isCurrent = index === currentTargetIndex;
          const showReroll =
            isHintmaster && isCurrent && round.status === "active" && !solved;
          return (
            <div
              className={`font-display clip-score flex items-center gap-2 py-2 pl-3 text-sm font-black text-black ${
                showReroll ? "pr-6" : "px-3"
              } ${
                solved
                  ? "bg-green-200"
                  : isCurrent
                    ? "bg-yellow-300"
                    : "bg-white"
              }`}
              key={`${target.contentId}-${index}`}
            >
              <span className="ml-2 rounded bg-yellow-200 px-2 py-1 text-xs">
                {index + 1}
              </span>
              {visible ? (
                <WordImage
                  category={target.category}
                  imageUrl={target.imageUrl}
                  label={target.label}
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">
                {visible ? target.label : "Hidden"}
              </span>
              {showReroll ? (
                <button
                  aria-label="Reroll current target"
                  className={`font-display flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition disabled:cursor-not-allowed ${
                    !canReroll
                      ? "bg-slate-500 text-white opacity-70"
                      : isRerolling
                        ? "bg-purple-200 text-black"
                        : "bg-purple-500 text-white hover:bg-purple-400"
                  }`}
                  disabled={isRerolling || !canReroll}
                  onClick={handleReroll}
                  title={
                    canReroll
                      ? `Reroll cost: ${
                          nextRerollCost === 0
                            ? "FREE"
                            : `${nextRerollCost} word${nextRerollCost === 1 ? "" : "s"}`
                        }`
                      : "Not enough scoring words to reroll"
                  }
                >
                  <RotateCcw
                    className={`h-3.5 w-3.5 ${isRerolling ? "animate-spin" : ""}`}
                  />
                  <span className="leading-none">
                    {nextRerollCost === 0 ? "FREE" : nextRerollCost}
                  </span>
                </button>
              ) : null}
              {solved ? (
                <span className="flex shrink-0 -space-x-1">
                  {target.solvedByPlayerIds.map((playerId) => {
                    const player = players.find(
                      (player) => player.id === playerId,
                    );
                    const displayName = player?.displayName ?? "Player";
                    return (
                      <PlayerAvatar
                        className="ring-2 ring-green-200"
                        displayName={displayName}
                        imageUrl={player?.imageUrl}
                        key={playerId}
                        size="sm"
                      />
                    );
                  })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function GuessPanel({
  round,
  settings,
  guestId,
  latestHintId,
  onError,
}: {
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
  guestId: string;
  latestHintId?: string;
  onError: (message: string | null) => void;
}) {
  const submitGuess = useMutation(convexApi.games.submitGuess);
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const results = useQuery(
    convexApi.content.search,
    trimmedQuery
      ? {
          query: trimmedQuery,
          categories: settings.categories,
          limit: 8,
        }
      : "skip",
  );

  async function guess(contentId: Id<"content">) {
    if (!latestHintId) {
      onError("Wait for a submitted hint before guessing.");
      return;
    }

    onError(null);
    try {
      await submitGuess({
        roundId: round.id,
        guestId,
        submittedHintId: latestHintId,
        contentId,
      });
      setQuery("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to submit guess.");
    }
  }

  return (
    <div className="mt-3">
      <input
        className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Pokemon, items, towns..."
      />
      <div className="mt-3 grid min-h-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(results ?? []).map((result) => (
          <button
            className="font-display flex items-center gap-3 rounded-2xl bg-black/40 px-3 py-2 text-left font-bold transition hover:bg-yellow-300 hover:text-black"
            key={result.id}
            onClick={() => guess(result.id)}
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
  );
}

function RoundEndOverlay({
  room,
  round,
  hintmasterName,
  isHost,
  isLastRound,
  isAdvancing,
  onNext,
}: {
  room: GameRoom;
  round: NonNullable<GameRoom["round"]>;
  hintmasterName: string;
  isHost: boolean;
  isLastRound: boolean;
  isAdvancing: boolean;
  onNext: () => void;
}) {
  const solvedCount = round.targetWords.filter(
    (target) => target.solvedByPlayerIds.length > 0,
  ).length;
  const scores = room.game?.scores ?? [];
  const roundResults = [...scores]
    .map((score) => ({
      ...score,
      imageUrl: room.players.find((player) => player.id === score.playerId)
        ?.imageUrl,
      displayName:
        room.players.find((player) => player.id === score.playerId)
          ?.displayName ?? "Player",
    }))
    .sort((a, b) => b.roundScore - a.roundScore);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-4xl border border-white/10 bg-slate-950 p-7 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          {round.status === "complete" ? "Round complete" : "Turn ended"}
        </p>
        <h2 className="mt-2 text-3xl font-black">
          {hintmasterName}&rsquo;s turn is over
        </h2>
        <p className="mt-2 text-slate-300">
          {solvedCount} of {round.targetWords.length} target words solved.
        </p>

        <div className="mt-5 grid gap-2">
          {roundResults.map((result) => (
            <div
              className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
              key={result.playerId}
            >
              <span className="flex min-w-0 items-center gap-3 font-bold">
                <PlayerAvatar
                  displayName={result.displayName}
                  imageUrl={result.imageUrl}
                  size="sm"
                />
                <span className="truncate">{result.displayName}</span>
              </span>
              <span className="flex items-center gap-3">
                <span
                  className={`font-display text-sm font-black ${
                    result.roundScore >= 0
                      ? "text-green-300"
                      : "text-red-400"
                  }`}
                >
                  {result.roundScore >= 0 ? "+" : ""}
                  {result.roundScore}
                </span>
                <span className="font-display text-lg font-black">
                  {result.totalScore + result.roundScore}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          {isHost ? (
            <button
              className="w-full rounded-2xl bg-yellow-300 px-5 py-4 font-black text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isAdvancing}
              onClick={onNext}
            >
              {isAdvancing
                ? "Loading..."
                : isLastRound
                  ? "See final results"
                  : "Next round"}
            </button>
          ) : (
            <p className="text-center font-bold text-slate-400">
              Waiting for the host to continue...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

