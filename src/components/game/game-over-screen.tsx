"use client";

import { useQuery } from "convex/react";
import {
  Coffee,
  Crown,
  Home,
  MessageSquareHeart,
  Trophy,
} from "lucide-react";
import { convexApi, type GameRoom } from "@/lib/convex-api";

const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/benbeaudet";
const GITHUB_URL = "https://github.com/bbeaudet-dev/pokemon-25WoL";
const FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScTsZ4dWwLgLwfDaOZYTmbj6t6GScRlnrMcs7TKB5fpbOkrIw/viewform";

type GameOverScreenProps = {
  code: string;
  room: GameRoom;
  onLeave: () => void;
};

export function GameOverScreen({
  code,
  room,
  onLeave,
}: GameOverScreenProps) {
  const summary = useQuery(convexApi.games.getSummary, {
    lobbyId: room.lobby.id,
  });

  if (summary === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="text-slate-300">Tallying the final scores...</p>
      </main>
    );
  }

  if (summary === null) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="text-slate-300">No game results to show.</p>
      </main>
    );
  }

  const winners = summary.standings.filter((entry) =>
    summary.winnerIds.includes(entry.playerId),
  );
  const winnerNames = winners.map((winner) => winner.displayName);
  const isTie = winners.length > 1;
  const topCorrect = Math.max(
    0,
    ...summary.standings.map((entry) => entry.correctGuesses),
  );
  const sharpestGuessers = summary.standings.filter(
    (entry) => topCorrect > 0 && entry.correctGuesses === topCorrect,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-12">
      <header className="text-center">
        <Trophy className="mx-auto h-14 w-14 text-yellow-300" />
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.4em] text-yellow-300">
          Game Over
        </p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">
          {winnerNames.length === 0
            ? "It's a wrap!"
            : isTie
              ? `${winnerNames.join(" & ")} tie for the win!`
              : `${winnerNames[0]} wins!`}
        </h1>
      </header>

      <section className="rounded-4xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-black">Final Standings</h2>
        <div className="mt-4 grid gap-2">
          {summary.standings.map((entry, index) => {
            const isWinner = summary.winnerIds.includes(entry.playerId);
            return (
              <div
                className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                  isWinner ? "bg-yellow-300/15 ring-1 ring-yellow-300/40" : "bg-white/5"
                }`}
                key={entry.playerId}
              >
                <span className="flex items-center gap-3 font-bold">
                  <span className="w-6 text-center font-black text-slate-400">
                    {index + 1}
                  </span>
                  {isWinner ? (
                    <Crown className="h-4 w-4 text-yellow-300" />
                  ) : null}
                  {entry.displayName}
                </span>
                <span className="font-display text-2xl font-black">
                  {entry.totalScore}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Rounds played" value={String(summary.stats.roundsPlayed)} />
        <StatCard
          label="Words guessed"
          value={String(summary.stats.totalCorrectGuesses)}
        />
        <StatCard
          label="Sharpest guesser"
          value={
            sharpestGuessers.length
              ? sharpestGuessers.map((g) => g.displayName).join(", ")
              : "Nobody"
          }
        />
      </section>

      <div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-300 px-5 py-4 font-black text-black transition hover:bg-yellow-200"
          onClick={onLeave}
        >
          <Home className="h-5 w-5" />
          Back to Home
        </button>
      </div>

      <section className="rounded-4xl border border-yellow-300/20 bg-yellow-300/5 p-6 text-center">
        <MessageSquareHeart className="mx-auto h-7 w-7 text-yellow-300" />
        <h2 className="mt-3 text-xl font-black">How was your experience?</h2>
        <p className="mt-1 text-sm text-slate-300">
          This is a one-person passion project, and I genuinely read everything.
          Got a bug, an idea, or just a thought? I&rsquo;m listening.
        </p>
        <a
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black text-white transition hover:bg-white/10"
          href={FEEDBACK_URL}
          rel="noreferrer"
          target="_blank"
        >
          Share feedback
        </a>
      </section>

      <footer className="mt-4 flex flex-col items-center gap-5 border-t border-white/10 pt-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">
          Thanks for playing
        </p>
        <a
          className="inline-flex items-center gap-2 rounded-full bg-[#FFDD00] px-6 py-3 font-black text-black shadow-lg transition hover:brightness-105"
          href={BUY_ME_A_COFFEE_URL}
          rel="noreferrer"
          target="_blank"
        >
          <Coffee className="h-5 w-5" />
          Buy me a coffee
        </a>
        <p className="max-w-md text-xs leading-relaxed text-slate-500">
          A fan project built on the idea{" "}
          <a
            className="font-bold text-slate-300 underline-offset-4 hover:underline"
            href="https://www.youtube.com/watch?v=10x-S7t1Tq0&t=1550s"
            rel="noreferrer"
            target="_blank"
          >
            ZaneGames
          </a>{" "}
          set free into the world. Source on{" "}
          <a
            className="font-bold text-slate-300 underline-offset-4 hover:underline"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          .
        </p>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-600">
          Lobby {code}
        </p>
      </footer>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}
