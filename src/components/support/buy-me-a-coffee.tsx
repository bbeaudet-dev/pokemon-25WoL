import { Coffee } from "lucide-react";

const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/benbeaudet";

export function BuyMeACoffee({ className = "" }: { className?: string }) {
  return (
    <a
      className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 underline-offset-4 transition hover:text-[#FFDD00] hover:underline ${className}`}
      href={BUY_ME_A_COFFEE_URL}
      rel="noreferrer"
      target="_blank"
    >
      <Coffee className="h-3.5 w-3.5" />
      Buy me a coffee
    </a>
  );
}
