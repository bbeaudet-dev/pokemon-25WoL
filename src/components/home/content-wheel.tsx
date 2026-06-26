"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { convexApi } from "@/lib/convex-api";
import type { ContentCategory } from "@/lib/game/types";

type ShowcaseItem = {
  id: string;
  label: string;
  category: Extract<
    ContentCategory,
    "badge" | "game" | "gym_leader" | "item" | "pokemon" | "professor" | "type"
  >;
  imageUrl?: string;
};

type MarqueeRowProps = {
  items: ShowcaseItem[];
  direction: "left" | "right";
  durationSeconds: number;
  onImageError: (imageUrl: string) => void;
};

const marqueeStyles = `
@keyframes content-wheel-left {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@keyframes content-wheel-right {
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
}
.content-wheel-track {
  animation-duration: var(--marquee-duration, 60s);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
.content-wheel-track-left { animation-name: content-wheel-left; }
.content-wheel-track-right { animation-name: content-wheel-right; }
.content-wheel-mask {
  -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .content-wheel-track { animation: none; }
}
`;

const itemsPerRow = 26;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function ContentWheel({
  rows = 2,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  // Request more than we display so the client can sample a fresh subset of
  // the (cached, deterministic) server pool on each page load.
  const showcase = useQuery(convexApi.content.showcase, {
    limit: rows * itemsPerRow * 2,
  });
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const handleImageError = (imageUrl: string) => {
    setBrokenImages((previous) => {
      if (previous.has(imageUrl)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(imageUrl);
      return next;
    });
  };

  // Shuffle + bucket once per mount. Intentionally excludes brokenImages so a
  // failed image only drops that one card (filtered below) instead of
  // reshuffling the whole wheel.
  const rowSelection = useMemo(() => {
    if (!showcase) {
      return null;
    }

    const pool: ShowcaseItem[] = showcase.map((item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      imageUrl: item.imageUrl,
    }));

    const sampled = shuffle(pool).slice(0, rows * itemsPerRow);
    const buckets: ShowcaseItem[][] = Array.from({ length: rows }, () => []);
    sampled.forEach((item, index) => {
      buckets[index % rows].push(item);
    });
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcase, rows]);

  if (!rowSelection) {
    return null;
  }

  const rowItems = rowSelection.map((items) =>
    items.filter(
      (item) => item.imageUrl && !brokenImages.has(item.imageUrl),
    ),
  );

  if (rowItems.every((row) => row.length === 0)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`content-wheel-mask flex h-full w-full flex-col justify-between gap-6 overflow-hidden ${className}`}
    >
      <style>{marqueeStyles}</style>
      {rowItems.map((items, index) =>
        items.length > 0 ? (
          <MarqueeRow
            key={index}
            items={items}
            direction={index % 2 === 0 ? "left" : "right"}
            durationSeconds={68 + index * 9}
            onImageError={handleImageError}
          />
        ) : null,
      )}
    </div>
  );
}

function MarqueeRow({
  items,
  direction,
  durationSeconds,
  onImageError,
}: MarqueeRowProps) {
  const loop = [...items, ...items];
  const trackClass =
    direction === "left"
      ? "content-wheel-track-left"
      : "content-wheel-track-right";

  return (
    <div
      className={`content-wheel-track ${trackClass} flex w-max flex-nowrap items-start gap-4 px-2`}
      style={{ ["--marquee-duration" as string]: `${durationSeconds}s` }}
    >
      {loop.map((item, index) => (
        <WheelCard
          key={`${item.id}-${index}`}
          item={item}
          onImageError={onImageError}
        />
      ))}
    </div>
  );
}

function WheelCard({
  item,
  onImageError,
}: {
  item: ShowcaseItem;
  onImageError: (imageUrl: string) => void;
}) {
  const accent =
    item.category === "pokemon"
      ? "from-yellow-300/20 to-yellow-300/0"
      : item.category === "badge"
        ? "from-sky-300/25 to-sky-300/0"
        : item.category === "type"
          ? "from-emerald-300/25 to-emerald-300/0"
          : item.category === "game"
            ? "from-red-300/25 to-red-300/0"
            : item.category === "gym_leader" || item.category === "professor"
              ? "from-orange-300/25 to-orange-300/0"
              : "from-purple-400/20 to-purple-400/0";

  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-2">
      <div
        className={`grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-linear-to-b ${accent} p-2`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="max-h-full max-w-full object-contain"
          decoding="async"
          src={item.imageUrl}
          onError={() => item.imageUrl && onImageError(item.imageUrl)}
        />
      </div>
      <span className="line-clamp-1 max-w-full text-center text-[11px] font-semibold text-slate-300">
        {item.label}
      </span>
    </div>
  );
}
