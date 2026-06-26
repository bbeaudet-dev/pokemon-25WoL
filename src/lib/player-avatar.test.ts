import { describe, expect, it } from "vitest";
import { getPlayerAvatarUrl } from "./player-avatar";

describe("getPlayerAvatarUrl", () => {
  it("uses the Pokemon suffix from generated display names", () => {
    expect(getPlayerAvatarUrl("EnergizedMunchlax")).toContain("/446.png");
    expect(getPlayerAvatarUrl("Energized Munchlax")).toContain("/446.png");
  });

  it("returns undefined when the name does not include a generated Pokemon", () => {
    expect(getPlayerAvatarUrl("Guest")).toBeUndefined();
  });
});
