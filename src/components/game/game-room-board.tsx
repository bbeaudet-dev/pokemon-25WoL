"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Crown, Send } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GuestIdentity } from "@/lib/guest";
import { convexApi, type GameRoom } from "@/lib/convex-api";
import { formatCategoryLabel } from "@/lib/game/rules";
import { Scoreboard } from "./scoreboard";
import { TargetConfirmModal } from "./target-confirm-modal";
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
  const [isAdvancing, setIsAdvancing] = useState(false);
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

  async function handleEndTurn() {
    if (!round) {
      return;
    }
    onError(null);
    try {
      await endTurn({ roundId: round.id, guestId: identity.guestId });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to end turn.");
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
      {round.status === "setup" ? (
        <TargetConfirmModal
          isHintmaster={isHintmaster}
          round={round}
          settings={room.game.settings}
          guestId={identity.guestId}
          onError={onError}
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
      {error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <CurrentHint
            isHintmaster={isHintmaster}
            round={round}
            hintmasterName={hintmasterName}
            guestId={identity.guestId}
            onError={onError}
          />
          {!isHintmaster && currentPlayer ? (
            <GuessPanel
              round={round}
              settings={room.game.settings}
              guestId={identity.guestId}
              latestHintId={latestHintId}
              onError={onError}
            />
          ) : null}
          <Scoreboard
            room={room}
            hintmasterId={round.hintGiverPlayerId}
            latestHintId={latestHintId}
          />
        </div>

        <TargetRail
          isHintmaster={isHintmaster}
          targetWords={round.targetWords}
          currentTargetIndex={round.currentTargetIndex}
          players={room.players}
        />
      </section>

      <HintWordGrid
        round={round}
        settings={room.game.settings}
      />

      <footer className="mb-6 flex flex-wrap items-center justify-between gap-3 px-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
        <span>Lobby {code}</span>
        <div className="flex items-center gap-4">
          {isHintmaster && round.status === "active" ? (
            <button
              className="rounded-full border border-yellow-300/40 px-4 py-2 text-yellow-300 transition hover:bg-yellow-300 hover:text-black"
              onClick={handleEndTurn}
            >
              End my turn
            </button>
          ) : null}
          <button
            className="flex items-center gap-2 text-left text-red-500 transition hover:text-red-400"
            onClick={onLeave}
          >
            <ArrowLeft className="h-4 w-4" />
            Leave
          </button>
        </div>
      </footer>
    </main>
  );
}

function CurrentHint({
  isHintmaster,
  round,
  hintmasterName,
  guestId,
  onError,
}: {
  isHintmaster: boolean;
  round: NonNullable<GameRoom["round"]>;
  hintmasterName: string;
  guestId: string;
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

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-4">
      <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-black/30 px-4 py-3">
        <p className="font-display min-w-0 flex-1 truncate text-xl">
          {latestHint ? (
            <>
              <span className="font-black text-yellow-300">
                <Crown className="mr-1 inline h-4 w-4 align-[-2px]" />
                {hintmasterName}:
              </span>{" "}
              <span>{latestHint.text}</span>
            </>
          ) : (
            <span className="text-slate-300">No hint yet</span>
          )}
        </p>
      </div>
      {isHintmaster ? (
        <form className="mt-3 flex gap-2" onSubmit={submit}>
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
            disabled={round.status !== "active"}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type hint words, then press Enter"
          />
          <button className="font-display rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black">
            <Send className="h-5 w-5" />
          </button>
        </form>
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
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4">
      <div className="grid grid-flow-col grid-rows-10 gap-1.5 overflow-x-auto">
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
  targetWords,
  currentTargetIndex,
  players,
}: {
  isHintmaster: boolean;
  targetWords: NonNullable<GameRoom["round"]>["targetWords"];
  currentTargetIndex: number;
  players: GameRoom["players"];
}) {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4">
      <div className="grid gap-2">
        {targetWords.map((target, index) => {
          const solved = target.solvedByPlayerIds.length > 0;
          const visible = isHintmaster || solved;
          return (
            <div
              className={`font-display clip-score flex items-center gap-2 px-3 py-2 text-sm font-black text-black ${
                solved
                  ? "bg-green-200"
                  : index === currentTargetIndex
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
              {solved ? (
                <span className="text-xs">
                  {target.solvedByPlayerIds
                    .map(
                      (playerId) =>
                        players.find((player) => player.id === playerId)
                          ?.displayName ?? "Player",
                    )
                    .join(", ")}
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
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-3">
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
    </section>
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
      displayName:
        room.players.find((player) => player.id === score.playerId)
          ?.displayName ?? "Player",
    }))
    .sort((a, b) => b.roundScore - a.roundScore);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950 p-7 shadow-2xl">
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
              <span className="font-bold">{result.displayName}</span>
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

