"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Crown, LogOut, RotateCcw, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GuestIdentity } from "@/lib/guest";
import { convexApi, type GameRoom } from "@/lib/convex-api";

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
  const round = room.round;
  const currentPlayer = room.players.find(
    (player) => player.guestId === identity.guestId,
  );
  const isHintmaster = Boolean(
    currentPlayer && round?.hintGiverPlayerId === currentPlayer.id,
  );

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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-5 py-6">
      {round.status === "setup" ? (
        <TargetConfirmModal
          isHintmaster={isHintmaster}
          round={round}
          guestId={identity.guestId}
          onError={onError}
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
            guestId={identity.guestId}
            onError={onError}
          />
          <HintWordGrid
            round={round}
            settings={room.game.settings}
          />
        </div>

        <TargetRail
          isHintmaster={isHintmaster}
          targetWords={round.targetWords}
          currentTargetIndex={round.currentTargetIndex}
          players={room.players}
        />
      </section>

      {!isHintmaster && currentPlayer ? (
        <GuessPanel
          round={round}
          settings={room.game.settings}
          guestId={identity.guestId}
          latestHintId={round.submittedHints.at(-1)?.id}
          onError={onError}
        />
      ) : null}

      <Scoreboard room={room} hintmasterId={round.hintGiverPlayerId} />

      <footer className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
        <span>Lobby {code}</span>
        <button className="flex items-center gap-2 text-yellow-300" onClick={onLeave}>
          <LogOut className="h-4 w-4" />
          Leave
        </button>
      </footer>
    </main>
  );
}

function Scoreboard({
  room,
  hintmasterId,
}: {
  room: GameRoom;
  hintmasterId: GameRoom["players"][number]["id"];
}) {
  const scores = room.game?.scores ?? [];
  const guessesByPlayer = new Map(
    room.players.map((player) => [
      player.id,
      [...room.guesses]
        .reverse()
        .find((guess) => guess.playerId === player.id),
    ]),
  );
  const guessTotals = new Map(
    room.players.map((player) => {
      const guesses = room.guesses.filter((guess) => guess.playerId === player.id);
      return [
        player.id,
        {
          earned: guesses.reduce((sum, guess) => sum + guess.pointsAwarded, 0),
          penalties: guesses.reduce((sum, guess) => sum + guess.penaltyApplied, 0),
        },
      ];
    }),
  );

  return (
    <section className="grid gap-3 md:grid-cols-4">
      {room.players.map((player, index) => {
        const score = scores.find((entry) => entry.playerId === player.id);
        const totals = guessTotals.get(player.id) ?? { earned: 0, penalties: 0 };
        const netRoundScore = score?.roundScore ?? 0;
        const latestGuess = guessesByPlayer.get(player.id);
        const roundScoreClass =
          netRoundScore < 0
            ? "text-red-600"
            : netRoundScore === 0
              ? "text-yellow-600"
              : "text-green-600";
        return (
          <div className="grid gap-2" key={player.id}>
            <div className="min-h-12 rounded-2xl bg-black/30 px-4 py-2 text-sm font-bold">
              {latestGuess ? (
                <span>
                  {latestGuess.guessedWord.label}
                  <span
                    className={
                      latestGuess.isCorrect ? "ml-2 text-green-300" : "ml-2 text-slate-400"
                    }
                  >
                    {latestGuess.isCorrect ? "Correct" : "Miss"}
                  </span>
                </span>
              ) : null}
            </div>
            <div className="clip-score flex items-center gap-4 bg-white px-5 py-4 text-black shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 font-black text-white">
                {player.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">
                  {player.displayName}
                  {player.id === hintmasterId ? (
                    <Crown className="ml-2 inline h-4 w-4 text-yellow-500" />
                  ) : null}
                </p>
                <p className="text-xs font-bold text-slate-500">P{index + 1}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-black ${roundScoreClass}`}>
                  +{totals.earned}
                  {totals.penalties ? (
                    <span className="ml-2 text-red-600">-{totals.penalties}</span>
                  ) : null}
                </p>
                <p className="text-2xl font-black">{score?.totalScore ?? 0}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function TargetConfirmModal({
  isHintmaster,
  round,
  guestId,
  onError,
}: {
  round: NonNullable<GameRoom["round"]>;
  isHintmaster: boolean;
  guestId: string;
  onError: (message: string | null) => void;
}) {
  const rerollTargets = useMutation(convexApi.games.rerollTargets);
  const confirmTargets = useMutation(convexApi.games.confirmTargets);

  async function run(action: () => Promise<unknown>) {
    onError(null);
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-5 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
          {isHintmaster ? "Confirm your targets" : "Targets are being confirmed"}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {round.targetWords.map((target, index) => (
            <div className="clip-score bg-white px-4 py-3 font-black text-black" key={target.contentId}>
              <span className="mr-3 rounded bg-yellow-200 px-2 py-1 text-xs">
                {index + 1}
              </span>
              {isHintmaster ? target.label : "Hidden"}
            </div>
          ))}
        </div>
        {isHintmaster ? (
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="rounded-2xl bg-purple-400 px-5 py-3 font-black text-black"
              onClick={() => run(() => rerollTargets({ roundId: round.id, guestId }))}
            >
              <RotateCcw className="mr-2 inline h-5 w-5" />
              Reroll
            </button>
            <button
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black"
              onClick={() => run(() => confirmTargets({ roundId: round.id, guestId }))}
            >
              <Check className="mr-2 inline h-5 w-5" />
              Confirm
            </button>
          </div>
        ) : (
          <p className="mt-5 text-slate-300">Waiting for the hintmaster...</p>
        )}
      </div>
    </div>
  );
}

function CurrentHint({
  isHintmaster,
  round,
  guestId,
  onError,
}: {
  isHintmaster: boolean;
  round: NonNullable<GameRoom["round"]>;
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
        <p className="min-w-0 flex-1 truncate text-2xl font-black">
          {latestHint?.text ?? "No hint yet"}
        </p>
        {latestHint ? (
          <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-black">
            New guess
          </span>
        ) : null}
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
          <button className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black">
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
              className={`clip-tag flex min-h-9 min-w-40 items-center gap-2 px-3 py-2 text-left text-xs font-black text-black ${
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
              <span className="rounded bg-yellow-200/70 px-1.5 py-0.5 text-[10px] text-black">
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
    <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
      <div className="grid gap-3">
        {targetWords.map((target, index) => {
          const solved = target.solvedByPlayerIds.length > 0;
          const visible = isHintmaster || solved;
          return (
            <div
              className={`clip-score flex items-center gap-3 px-4 py-3 font-black text-black ${
                solved
                  ? "bg-green-200"
                  : index === currentTargetIndex
                    ? "bg-yellow-300"
                    : "bg-white"
              }`}
              key={`${target.contentId}-${index}`}
            >
              <span className="rounded bg-yellow-200 px-2 py-1 text-xs">
                {index + 1}
              </span>
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
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-5">
      <input
        className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Pokemon, items, towns..."
      />
      <div className="mt-3 grid min-h-0 gap-2 md:grid-cols-4">
        {(results ?? []).map((result) => (
          <button
            className="flex items-center gap-3 rounded-2xl bg-black/40 px-3 py-2 text-left font-bold transition hover:bg-yellow-300 hover:text-black"
            key={result.id}
            onClick={() => guess(result.id)}
          >
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-10 w-10 rounded-full bg-white object-contain"
                src={result.imageUrl}
              />
            ) : (
              <Sparkles className="h-8 w-8 text-yellow-300" />
            )}
            <span>
              {result.label}
              <span className="block text-xs capitalize opacity-70">
                {result.category.replace("_", " ")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
