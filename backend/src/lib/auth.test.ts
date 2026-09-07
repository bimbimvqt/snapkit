import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(), refreshFind: vi.fn(), refreshConsume: vi.fn(), refreshCreate: vi.fn(),
  cookieGet: vi.fn(), headerGet: vi.fn(), transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
  headers: async () => ({ get: mocks.headerGet }),
}));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: mocks.userFind },
  $transaction: mocks.transaction,
} }));

import { getSession, requireAdmin, rotateRefreshToken, signAccessToken, verifyAccessToken } from "@/lib/auth";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback({
    refreshToken: { findUnique: mocks.refreshFind, updateMany: mocks.refreshConsume, create: mocks.refreshCreate },
  }));
});

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

describe("live session authorization", () => {
  it("rejects a disabled user even while their signed token is valid", async () => {
    mocks.headerGet.mockReturnValue(`Bearer ${await signAccessToken({ id: "u1", role: "ADMIN", email: null })}`);
    mocks.userFind.mockResolvedValue({ id: "u1", role: "ADMIN", disabled: true });
    await expect(getSession()).resolves.toBeNull();
  });

  it("applies role demotion immediately instead of trusting the JWT role", async () => {
    mocks.headerGet.mockReturnValue(`Bearer ${await signAccessToken({ id: "u1", role: "ADMIN", email: null })}`);
    mocks.userFind.mockResolvedValue({ id: "u1", role: "USER", email: "new@example.com", disabled: false });
    await expect(requireAdmin()).resolves.toBeNull();
    await expect(getSession()).resolves.toEqual({ userId: "u1", role: "USER", email: "new@example.com" });
  });

  it("rejects deleted users and does not query users for invalid tokens", async () => {
    mocks.headerGet.mockReturnValue("Bearer invalid");
    await expect(getSession()).resolves.toBeNull();
    expect(mocks.userFind).not.toHaveBeenCalled();
    mocks.headerGet.mockReturnValue(`Bearer ${await signAccessToken({ id: "deleted", role: "USER", email: null })}`);
    mocks.userFind.mockResolvedValue(null);
    await expect(getSession()).resolves.toBeNull();
  });
});

describe("refresh token rotation", () => {
  beforeEach(() => {
    mocks.refreshFind.mockResolvedValue({
      id: "refresh-1", userId: "u1", revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", role: "USER", email: null, disabled: false },
    });
    mocks.refreshCreate.mockResolvedValue({});
  });

  it("issues only one replacement when the same token is consumed concurrently", async () => {
    let consumed = false;
    mocks.refreshConsume.mockImplementation(async () => {
      if (consumed) return { count: 0 };
      consumed = true;
      return { count: 1 };
    });
    const results = await Promise.all([rotateRefreshToken("same-token"), rotateRefreshToken("same-token")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(mocks.refreshCreate).toHaveBeenCalledTimes(1);
    expect(mocks.refreshConsume).toHaveBeenCalledWith({
      where: { id: "refresh-1", revokedAt: null, expiresAt: { gt: expect.any(Date) }, user: { disabled: false } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("does not mint a replacement for an expired token", async () => {
    mocks.refreshFind.mockResolvedValue({ expiresAt: new Date(0), user: { disabled: false } });
    await expect(rotateRefreshToken("expired")).resolves.toBeNull();
    expect(mocks.refreshConsume).not.toHaveBeenCalled();
    expect(mocks.refreshCreate).not.toHaveBeenCalled();
  });
});
