"use client";

import { useMutation, useQuery } from "convex/react";
import { Crown, RotateCcw, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { GuestIdentity } from "@/lib/guest";
import { convexApi, type GameRoom } from "@/lib/convex-api";

type GameRoomBoardProps = {
  code: string;
  identity: GuestIdentity;
  room: GameRoom;
  error: string | null;
  onError: (message: string | null) => void;
};

export function GameRoomBoard({
  code,
  identity,
  room,
  error,
  onError,
}: GameRoomBoardProps) {
  const round = room.round;
  const currentPlayer = room.players.find(
    (player) => player.guestId === identity.guestId,
  );
  const isHintGiver = Boolean(
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
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/10 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
            Lobby {code}
          </p>
          <h1 className="text-4xl font-black">Round Board</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 font-bold">
          <Crown className="h-5 w-5 text-yellow-300" />
          Hint giver:{" "}
          {room.players.find((player) => player.id === round.hintGiverPlayerId)
            ?.displayName ?? "Unknown"}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-red-100">
          {error}
        </div>
      ) : null}

      <Scoreboard room={room} />

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <HintWordGrid
            isHintGiver={isHintGiver}
            round={round}
            settings={room.game.settings}
            guestId={identity.guestId}
            onError={onError}
          />
          <SubmittedHints
            round={round}
            isHintGiver={isHintGiver}
            guestId={identity.guestId}
            onError={onError}
          />
        </div>

        <TargetRail
          isHintGiver={isHintGiver}
          targetWords={round.targetWords}
          currentTargetIndex={round.currentTargetIndex}
          players={room.players}
        />
      </section>

      {!isHintGiver && currentPlayer ? (
        <GuessPanel
          round={round}
          settings={room.game.settings}
          guestId={identity.guestId}
          latestHintId={round.submittedHints.at(-1)?.id}
          onError={onError}
        />
      ) : null}

      <GuessHistory room={room} />
    </main>
  );
}

function Scoreboard({ room }: { room: GameRoom }) {
  const scores = room.game?.scores ?? [];

  return (
    <section className="grid gap-3 md:grid-cols-4">
      {room.players.map((player, index) => {
        const score = scores.find((entry) => entry.playerId === player.id);
        return (
          <div
            className="clip-score flex items-center gap-4 bg-white px-5 py-4 text-black shadow-lg"
            key={player.id}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 font-black text-white">
              {player.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{player.displayName}</p>
              <p className="text-xs font-bold text-slate-500">P{index + 1}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{score?.totalScore ?? 0}</p>
              <p className="text-sm font-black text-green-600">
                {score?.roundScore ? `${score.roundScore > 0 ? "+" : ""}${score.roundScore}` : "+0"}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function HintWordGrid({
  isHintGiver,
  round,
  settings,
  guestId,
  onError,
}: {
  isHintGiver: boolean;
  round: NonNullable<GameRoom["round"]>;
  settings: NonNullable<GameRoom["game"]>["settings"];
  guestId: string;
  onError: (message: string | null) => void;
}) {
  const addHintWord = useMutation(convexApi.games.addHintWord);
  const rerollTargets = useMutation(convexApi.games.rerollTargets);
  const [hintText, setHintText] = useState("");

  async function handleAddHint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    try {
      await addHintWord({ roundId: round.id, guestId, text: hintText });
      setHintText("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to add hint word.");
    }
  }

  async function handleReroll() {
    onError(null);
    try {
      await rerollTargets({ roundId: round.id, guestId });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to reroll.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Hint Words</h2>
          <p className="text-sm text-slate-400">
            {round.hintWords.length}/{settings.hardWordLimit} used. Scoring
            crosses zero after {settings.scoringWordLimit}.
          </p>
        </div>
        {isHintGiver ? (
          <button
            className="rounded-2xl bg-purple-400 px-4 py-3 font-black text-black disabled:opacity-50"
            disabled={round.hintWords.length > 0 || round.submittedHints.length > 0}
            onClick={handleReroll}
          >
            <RotateCcw className="mr-2 inline h-5 w-5" />
            Reroll
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: settings.hardWordLimit }, (_, index) => {
          const word = round.hintWords[index];
          return (
            <div
              className={`clip-tag min-h-12 px-4 py-3 text-center text-sm font-black text-black ${
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
              <span className="mr-2 rounded bg-yellow-300 px-2 text-black">
                {index + 1}
              </span>
              {word?.text ?? ""}
            </div>
          );
        })}
      </div>

      {isHintGiver ? (
        <form className="mt-5 flex gap-2" onSubmit={handleAddHint}>
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
            value={hintText}
            onChange={(event) => setHintText(event.target.value)}
            placeholder="Add one hint word"
          />
          <button className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black">
            Add
          </button>
        </form>
      ) : null}
    </section>
  );
}

function SubmittedHints({
  round,
  isHintGiver,
  guestId,
  onError,
}: {
  round: NonNullable<GameRoom["round"]>;
  isHintGiver: boolean;
  guestId: string;
  onError: (message: string | null) => void;
}) {
  const submitHint = useMutation(convexApi.games.submitHint);
  const [selectedHintWordIds, setSelectedHintWordIds] = useState<string[]>([]);

  function toggleHintWord(id: string) {
    setSelectedHintWordIds((current) =>
      current.includes(id)
        ? current.filter((hintWordId) => hintWordId !== id)
        : [...current, id],
    );
  }

  async function handleSubmitHint() {
    onError(null);
    try {
      await submitHint({
        roundId: round.id,
        guestId,
        hintWordIds: selectedHintWordIds,
      });
      setSelectedHintWordIds([]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to submit hint.");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/10 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Submitted Hints</h2>
          <p className="text-sm text-slate-300">
            Combine any used words, including repeats in later turns.
          </p>
        </div>
        {isHintGiver ? (
          <button
            className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black disabled:opacity-50"
            disabled={selectedHintWordIds.length === 0}
            onClick={handleSubmitHint}
          >
            <Send className="mr-2 inline h-5 w-5" />
            Submit Hint
          </button>
        ) : null}
      </div>

      {isHintGiver ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {round.hintWords.map((word) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-black ${
                selectedHintWordIds.includes(word.id)
                  ? "bg-yellow-300 text-black"
                  : "bg-black/40 text-white"
              }`}
              key={word.id}
              onClick={() => toggleHintWord(word.id)}
            >
              {word.text}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {round.submittedHints.length === 0 ? (
          <p className="text-slate-300">No submitted hints yet.</p>
        ) : (
          round.submittedHints.map((hint) => (
            <div className="rounded-2xl bg-black/30 px-4 py-3" key={hint.id}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Target {hint.targetIndex + 1}
              </p>
              <p className="mt-1 text-xl font-black">{hint.text}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TargetRail({
  isHintGiver,
  targetWords,
  currentTargetIndex,
  players,
}: {
  isHintGiver: boolean;
  targetWords: NonNullable<GameRoom["round"]>["targetWords"];
  currentTargetIndex: number;
  players: GameRoom["players"];
}) {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5">
      <h2 className="text-2xl font-black">Targets</h2>
      <div className="mt-4 grid gap-3">
        {targetWords.map((target, index) => {
          const solved = target.solvedByPlayerIds.length > 0;
          const visible = isHintGiver || solved || index === currentTargetIndex;
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
              <span>{index + 1}</span>
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
  const results = useQuery(convexApi.content.search, {
    query,
    categories: settings.categories,
    limit: 8,
  });

  async function guess(contentId: string) {
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
      <h2 className="text-2xl font-black">Submit a Guess</h2>
      <p className="mt-1 text-sm text-slate-300">
        Multiple guesses on the same hint cost a point after your first try.
      </p>
      <input
        className="mt-4 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none ring-yellow-300/0 transition focus:ring-4"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Pokemon, items, towns..."
      />
      <div className="mt-3 grid gap-2 md:grid-cols-4">
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

function GuessHistory({ room }: { room: GameRoom }) {
  const byPlayerId = new Map(
    room.players.map((player) => [player.id, player.displayName]),
  );

  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
      <h2 className="text-2xl font-black">Live Guesses</h2>
      <div className="mt-4 grid gap-2">
        {room.guesses.length === 0 ? (
          <p className="text-slate-300">No guesses yet.</p>
        ) : (
          [...room.guesses].reverse().map((guess) => (
            <div
              className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
              key={guess._id}
            >
              <span>
                <strong>{byPlayerId.get(guess.playerId) ?? "Player"}</strong>{" "}
                guessed <strong>{guess.guessedWord.label}</strong>
              </span>
              <span
                className={guess.isCorrect ? "text-green-300" : "text-slate-300"}
              >
                {guess.isCorrect ? "Correct" : "Miss"}
                {guess.penaltyApplied ? `, -${guess.penaltyApplied}` : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
