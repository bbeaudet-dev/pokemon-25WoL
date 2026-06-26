"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { ContentCategory } from "@/lib/game/types";

const categoryFallbackImages: Partial<Record<ContentCategory, string>> = {
  ability: "/content-fallbacks/ability.png",
  game: "/content-fallbacks/game.png",
  move: "/content-fallbacks/move.png",
  region: "/content-fallbacks/region.jpg",
  town: "/content-fallbacks/town.webp",
  type: "/content-fallbacks/types.webp",
};

export function WordImage({
  category,
  imageUrl,
  label,
  size = "md",
}: {
  category?: ContentCategory;
  imageUrl?: string;
  label: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const fallbackImageUrl = category && categoryFallbackImages[category];
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayImageUrl =
    imageUrl && imageUrl !== failedImageUrl
      ? imageUrl
      : fallbackImageUrl && fallbackImageUrl !== failedImageUrl
        ? fallbackImageUrl
        : undefined;

  if (!displayImageUrl) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-white/80 text-slate-900`}
      >
        <Sparkles className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center overflow-hidden rounded-full bg-white`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={label}
        className="max-h-full max-w-full object-contain"
        decoding="async"
        loading="lazy"
        onError={() => setFailedImageUrl(displayImageUrl)}
        src={displayImageUrl}
      />
    </span>
  );
}
