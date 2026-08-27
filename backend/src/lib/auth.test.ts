import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/lib/auth";

describe("access tokens", () => {
  it("round-trips the minimum session claims", async () => {
    const token = await signAccessToken({ id: "user_test", role: "USER", email: "user@example.com" });
    const session = await verifyAccessToken(token);
    expect(session).toMatchObject({ userId: "user_test", role: "USER", email: "user@example.com" });
  });

  it("rejects malformed tokens", async () => {
    await expect(verifyAccessToken("not-a-jwt")).resolves.toBeNull();
  });
});
