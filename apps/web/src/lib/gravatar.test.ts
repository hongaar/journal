import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getGravatarUrl } from "./gravatar";

describe("getGravatarUrl", () => {
  it("returns null for blank email", async () => {
    expect(await getGravatarUrl("   ")).toBeNull();
    expect(await getGravatarUrl("")).toBeNull();
  });

  it("matches Gravatar SHA-256 example (trim + lowercase)", async () => {
    const url = await getGravatarUrl("MyEmailAddress@example.com");
    const expectedHex = createHash("sha256")
      .update("myemailaddress@example.com")
      .digest("hex");
    expect(url).toContain(expectedHex);
    expect(url).toContain("d=404");
  });
});
