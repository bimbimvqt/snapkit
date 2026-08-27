import { cookies } from "next/headers";
import { z } from "zod";
import { apiError, fail, ok } from "@/lib/api";
import { refreshCookie, rotateRefreshToken, setAuthCookies } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = z.object({ refreshToken: z.string().optional() }).parse(body);
    const token = parsed.refreshToken ?? (await cookies()).get(refreshCookie)?.value;
    if (!token) return fail("Thiếu refresh token", 401, "UNAUTHORIZED");
    const result = await rotateRefreshToken(token);
    if (!result) return fail("Phiên đăng nhập đã hết hạn", 401, "SESSION_EXPIRED");
    await setAuthCookies(result.accessToken, result.refreshToken);
    return ok({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (error) { return apiError(error); }
}

