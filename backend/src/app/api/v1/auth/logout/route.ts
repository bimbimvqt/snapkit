import { cookies } from "next/headers";
import { clearAuthCookies, refreshCookie, revokeRefreshToken } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const bodyToken = typeof body?.refreshToken === "string" ? body.refreshToken : null;
  const token = bodyToken ?? (await cookies()).get(refreshCookie)?.value;

  if (token) await revokeRefreshToken(token);
  await clearAuthCookies();
  return ok({ success: true });
}
