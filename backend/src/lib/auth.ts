import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Prisma, Role, User } from "@prisma/client";
import { db } from "@/lib/db";

const accessCookie = "snapkit_access";
const refreshCookie = "snapkit_refresh";
let cachedSecret: Uint8Array | undefined;

function jwtSecret() {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.JWT_SECRET;
  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

  if (!configured && isProduction) {
    throw new Error("JWT_SECRET is required in production");
  }

  const value = configured ?? "development-only-secret-change-before-prod-123";
  if (value.length < 32) throw new Error("JWT_SECRET must have at least 32 characters");
  cachedSecret = new TextEncoder().encode(value);
  return cachedSecret;
}

export type Session = { userId: string; role: Role; email?: string | null };

export async function signAccessToken(user: Pick<User, "id" | "role" | "email">) {
  return new SignJWT({ role: user.role, email: user.email }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("15m").sign(jwtSecret());
}

export async function verifyAccessToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || (payload.role !== "ADMIN" && payload.role !== "USER")) return null;
    return { userId: payload.sub, role: payload.role, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}

export async function createRefreshToken(userId: string, client: Pick<Prisma.TransactionClient, "refreshToken"> = db) {
  const token = randomBytes(48).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await client.refreshToken.create({ data: { userId, tokenHash, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  return token;
}

export async function rotateRefreshToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return db.$transaction(async (transaction) => {
    const now = new Date();
    const stored = await transaction.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt <= now || stored.user.disabled) return null;
    // Only one concurrent request may consume this token. Minting and revocation
    // commit together so a failed rotation leaves the old session usable.
    const consumed = await transaction.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null, expiresAt: { gt: now }, user: { disabled: false } },
      data: { revokedAt: now },
    });
    if (consumed.count !== 1) return null;
    const next = await createRefreshToken(stored.userId, transaction);
    return { user: stored.user, refreshToken: next, accessToken: await signAccessToken(stored.user) };
  });
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieToken = (await cookies()).get(accessCookie)?.value;
  const authorization = (await headers()).get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : cookieToken;
  const session = token ? await verifyAccessToken(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, email: true, disabled: true },
  });
  if (!user || user.disabled) return null;
  return { userId: user.id, role: user.role, email: user.email };
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  jar.set(accessCookie, accessToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 15 * 60 });
  jar.set(refreshCookie, refreshToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(accessCookie);
  jar.delete(refreshCookie);
}

export async function requireAdmin() {
  const session = await getSession();
  return session?.role === "ADMIN" ? session : null;
}

export { accessCookie, refreshCookie };
