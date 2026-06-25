import { describe, expect, it } from "vitest";
import { getContentIdentityKey } from "./identity";

describe("getContentIdentityKey", () => {
  it("keeps normalized labels scoped to their content category", () => {
    expect(getContentIdentityKey("item", "Premier Ball")).toBe(
      "item:premier ball",
    );
    expect(getContentIdentityKey("town", "Premier Ball")).toBe(
      "town:premier ball",
    );
  });
});
