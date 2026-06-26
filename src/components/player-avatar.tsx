type PlayerAvatarProps = {
  displayName: string;
  imageUrl?: string;
  size?: "sm" | "md";
  className?: string;
};

export function PlayerAvatar({
  displayName,
  imageUrl,
  size = "md",
  className = "",
}: PlayerAvatarProps) {
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-base";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${displayName} avatar`}
        className={`${sizeClass} shrink-0 rounded-full bg-white object-contain ${className}`}
        src={imageUrl}
      />
    );
  }

  return (
    <span
      className={`font-display grid ${sizeClass} shrink-0 place-items-center rounded-full bg-slate-950 font-black text-white ${className}`}
    >
      {displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}
