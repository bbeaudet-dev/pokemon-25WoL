import { normalizeWord } from "../game/rules";
import type { ContentCategory } from "../game/types";

export function getContentIdentityKey(
  category: ContentCategory,
  label: string,
) {
  return `${category}:${normalizeWord(label)}`;
}
