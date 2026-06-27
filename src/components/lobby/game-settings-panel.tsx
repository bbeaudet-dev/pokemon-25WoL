"use client";

import { useQuery } from "convex/react";
import { Info } from "lucide-react";
import { useState } from "react";
import { WordImage } from "@/components/game/word-image";
import { convexApi, type LobbyDetails } from "@/lib/convex-api";
import {
  advancedCategories,
  categoryDifficultyOrder,
  chillCategories,
  classicCategories,
  formatCategoryLabel,
  makeGameSettings,
} from "@/lib/game/rules";
import type { ContentCategory, GameMode } from "@/lib/game/types";

const settingInfo = {
  mode: "Classic mode is closest to what is featured on ZaneGames' channel. Chill mode has more of a focus on just Pokemon, while Advanced mode expands the potential wordbank to include everything from items, characters, moves, abilities, game locations, and more. Custom mode allows you to customize every aspect of the game to your liking.",
  targets:
    "Set the amount of target words to be guessed each round. Manual targets allows each player to choose their own words for the other players to guess, while Randomized does this automatically.",
  hints:
    "Set how many points are awarded for each remaining hint at the end of a round - these apply to the first limit (25 by default). Additional hints past this first limit will start to incur negative points up until the second limit (40 by default) is reached.",
  rounds:
    "A single Round consists of one player becoming the hintmaster and either successfully having all their target words guessed, or failing to do so within the hint limits. Here you can set how many times each player will become the hintmaster.",
} as const;

function SettingHeader({
  title,
  info,
}: {
  title: string;
  info: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <InfoBubble label={title} text={info} />
    </div>
  );
}

function InfoBubble({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        aria-expanded={open}
        aria-label={`More info about ${label}`}
        className="grid h-4 w-4 place-items-center rounded-full text-slate-500 transition hover:text-yellow-300"
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        type="button"
      >
        <Info className="h-4 w-4" />
      </button>
      {open ? (
        <span className="absolute left-1/2 top-6 z-30 w-64 max-w-[80vw] -translate-x-1/2 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-medium normal-case leading-relaxed tracking-normal text-slate-200 shadow-xl">
          {text}
        </span>
      ) : null}
    </span>
  );
}

const modeOptions: GameMode[] = ["chill", "classic", "advanced", "custom"];
const modeButtonClasses: Record<GameMode, { active: string; inactive: string }> = {
  chill: {
    active: "bg-lime-200 text-black",
    inactive: "bg-lime-200/10 text-lime-100",
  },
  classic: {
    active: "bg-yellow-300 text-black",
    inactive: "bg-yellow-300/10 text-yellow-100",
  },
  advanced: {
    active: "bg-orange-500 text-black",
    inactive: "bg-orange-500/10 text-orange-100",
  },
  custom: {
    active: "bg-purple-300 text-black",
    inactive: "bg-purple-300/10 text-purple-100",
  },
};
const customCategoryOptions = categoryDifficultyOrder;

type UpdateSettings = (args: {
  lobbyId: LobbyDetails["id"];
  guestId: string;
  visibility: LobbyDetails["visibility"];
  settings: LobbyDetails["settings"];
}) => Promise<unknown>;

type GameSettingsPanelProps = {
  lobby: LobbyDetails;
  isHost: boolean;
  guestId: string;
  onError: (message: string | null) => void;
  updateSettings: UpdateSettings;
};

export function GameSettingsPanel({
  lobby,
  isHost,
  guestId,
  onError,
  updateSettings,
}: GameSettingsPanelProps) {
  const categoryAvatars = useQuery(convexApi.content.categoryAvatars);
  const totalRounds =
    lobby.settings.hintGiverTurnsPerPlayer * Math.max(lobby.players.length, 1);

  async function runSettingsAction(action: () => Promise<unknown>) {
    onError(null);
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function updateGameSettings(
    settings: Partial<LobbyDetails["settings"]>,
  ) {
    await runSettingsAction(() =>
      updateSettings({
        lobbyId: lobby.id,
        guestId,
        visibility: lobby.visibility,
        settings: makeGameSettings({
          ...lobby.settings,
          ...settings,
        }),
      }),
    );
  }

  async function handleModeChange(mode: GameMode) {
    await updateGameSettings({
      mode,
      categories:
        mode === "custom"
          ? lobby.settings.categories.length
            ? lobby.settings.categories
            : advancedCategories
          : mode === "advanced"
            ? advancedCategories
            : mode === "classic"
              ? classicCategories
              : chillCategories,
    });
  }

  async function handleCategoryToggle(category: ContentCategory) {
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
      onError("Custom mode needs at least one content category.");
      return;
    }

    await updateGameSettings({
      mode: "custom",
      categories,
    });
  }

  return (
    <section className="mt-6 rounded-4xl border border-white/10 bg-black/30 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Game Settings</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <SettingHeader title="Mode" info={settingInfo.mode} />
          {isHost ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {modeOptions.map((mode) => {
                const isSelected = lobby.settings.mode === mode;
                const classes = modeButtonClasses[mode];

                return (
                  <button
                    className={`min-w-24 rounded-xl px-3 py-2 font-black capitalize transition ${
                      isSelected ? classes.active : classes.inactive
                    }`}
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xl font-black capitalize">
              {lobby.settings.mode}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <SettingHeader title="Targets" info={settingInfo.targets} />
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
                  updateGameSettings({
                    mode: "custom",
                    targetWordsPerRound: Number(event.currentTarget.value),
                  })
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
                  className={`min-w-24 rounded-xl px-3 py-2 font-black capitalize ${
                    lobby.settings.targetSelection === selection
                      ? "bg-yellow-300 text-black"
                      : "bg-black/30 text-slate-200"
                  }`}
                  key={selection}
                  onClick={() =>
                    updateGameSettings({
                      targetSelection: selection,
                    })
                  }
                >
                  {selection === "random" ? "Randomized" : "Manual"}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-bold capitalize text-slate-400">
              {lobby.settings.targetSelection === "random"
                ? "Randomized"
                : "Manual"}{" "}
              selection
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <SettingHeader title="Hints" info={settingInfo.hints} />
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
                    updateGameSettings({
                      scoringWordLimit: Number(event.currentTarget.value),
                    })
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
                    updateGameSettings({
                      pointsPerRemainingWord: Number(event.currentTarget.value),
                    })
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
                    updateGameSettings({
                      hardWordLimit: Number(event.currentTarget.value),
                    })
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
              for each remaining, {lobby.settings.hardWordLimit} maximum words
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <SettingHeader title="Rounds" info={settingInfo.rounds} />
          {isHost ? (
            <div className="mt-3">
              <label className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-200">
                <span>Each player becomes hintmaster</span>
                <input
                  aria-label="Times each player is Hintmaster"
                  className="w-16 rounded-xl bg-black/30 px-3 py-2 text-center font-black text-white outline-none ring-yellow-300/0 transition focus:ring-4"
                  min={1}
                  max={5}
                  type="number"
                  value={lobby.settings.hintGiverTurnsPerPlayer}
                  onChange={(event) =>
                    updateGameSettings({
                      hintGiverTurnsPerPlayer: Number(event.currentTarget.value),
                    })
                  }
                />
                <span>times</span>
              </label>
              <p className="mt-2 text-xs font-bold text-slate-500">
                ({totalRounds} total round{totalRounds === 1 ? "" : "s"})
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-bold leading-6 text-slate-200">
                Each player becomes hintmaster{" "}
                {lobby.settings.hintGiverTurnsPerPlayer} time
                {lobby.settings.hintGiverTurnsPerPlayer === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                ({totalRounds} total round{totalRounds === 1 ? "" : "s"})
              </p>
            </div>
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
                className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-black transition ${
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
                <WordImage
                  category={category}
                  imageUrl={categoryAvatars?.[category]}
                  label={formatCategoryLabel(category)}
                  size="sm"
                />
                {formatCategoryLabel(category)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
