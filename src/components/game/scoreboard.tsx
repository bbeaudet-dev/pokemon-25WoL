import { Crown } from "lucide-react";
import type { GameRoom } from "@/lib/convex-api";
import { PlayerAvatar } from "@/components/player-avatar";
import { WordImage } from "./word-image";

export function Scoreboard({
  room,
  hintmasterId,
  latestHintId,
}: {
  room: GameRoom;
  hintmasterId: GameRoom["players"][number]["id"];
  latestHintId?: string;
}) {
  const scores = room.game?.scores ?? [];
  const projectedHintmasterScore =
    room.round && room.game
      ? Math.max(
          (room.game.settings.scoringWordLimit - room.round.hintWords.length) *
            (room.game.settings.pointsPerRemainingWord ?? 1),
          (room.game.settings.scoringWordLimit - room.game.settings.hardWordLimit) *
            (room.game.settings.pointsPerRemainingWord ?? 1),
        )
      : 0;
  const guessesByPlayer = new Map(
    room.players.map((player) => [
      player.id,
      [...room.guesses]
        .reverse()
        .find(
          (guess) =>
            guess.playerId === player.id &&
            (!latestHintId || guess.submittedHintId === latestHintId),
        ),
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
    <section className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
      {room.players.map((player) => {
        const score = scores.find((entry) => entry.playerId === player.id);
        const totals = guessTotals.get(player.id) ?? { earned: 0, penalties: 0 };
        const isHintmaster = player.id === hintmasterId;
        const netRoundScore =
          isHintmaster
            ? projectedHintmasterScore
            : score?.roundScore ?? 0;
        const latestGuess = guessesByPlayer.get(player.id);
        const roundScoreClass =
          netRoundScore < 0
            ? "text-red-600"
            : netRoundScore === 0
              ? "text-yellow-600"
              : "text-green-600";
        const cardResultClass = latestGuess
          ? latestGuess.isCorrect
            ? "bg-green-100"
            : "bg-red-100"
          : "bg-white";
        return (
          <div className="relative" key={player.id}>
            <div
              className={`clip-score relative flex min-h-24 items-center gap-3 px-4 py-3 pt-5 text-black shadow-lg ${cardResultClass}`}
            >
              {player.id === hintmasterId ? (
                <div className="font-display absolute left-6 right-8 top-0 flex items-center justify-center gap-1 rounded-b-xl bg-yellow-300 px-3 py-1 text-center text-[10px] font-black uppercase tracking-widest text-black">
                  <Crown className="h-3 w-3" />
                  <span>Hintmaster</span>
                </div>
              ) : null}
              <PlayerAvatar
                className="ml-1"
                displayName={player.displayName}
                imageUrl={player.imageUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display truncate font-black">
                  {player.displayName}
                </p>
                {latestGuess ? (
                  <div className="mt-1 flex min-w-0 items-center gap-2 rounded-xl bg-black/10 px-2 py-1 text-xs font-bold">
                    <WordImage
                      category={latestGuess.guessedWord.category}
                      imageUrl={latestGuess.guessedWord.imageUrl}
                      label={latestGuess.guessedWord.label}
                      size="sm"
                    />
                    <span className="font-display min-w-0 truncate">
                      {latestGuess.guessedWord.label}
                    </span>
                    <span
                      className={
                        latestGuess.isCorrect
                          ? "font-display text-green-700"
                          : "font-display text-slate-500"
                      }
                    >
                      {latestGuess.isCorrect ? "Correct" : "Miss"}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <p className={`font-display text-sm font-black ${roundScoreClass}`}>
                  {isHintmaster ? (
                    projectedHintmasterScore >= 0 ? (
                      `+${projectedHintmasterScore}`
                    ) : (
                      projectedHintmasterScore
                    )
                  ) : (
                    <>
                      +{totals.earned}
                      {totals.penalties ? (
                        <span className="ml-2 text-red-600">
                          -{totals.penalties}
                        </span>
                      ) : null}
                    </>
                  )}
                </p>
                <p className="font-display text-2xl font-black">
                  {score?.totalScore ?? 0}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
