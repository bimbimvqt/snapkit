import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { createRefreshToken, getSession, signAccessToken } from "@/lib/auth";

const schema = z.object({ deviceId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const { deviceId } = schema.parse(await request.json());
    const existing = await db.user.findUnique({ where: { anonymousId: deviceId } });
    if (existing && (await getSession())?.userId !== existing.id) {
      return fail("Vui lòng đăng nhập lại để khôi phục phiên khách", 401, "SIGN_IN_REQUIRED");
    }
    const user = existing ?? await db.user.create({ data: { anonymousId: deviceId, name: "Anonymous user" } });
    if (user.disabled) return fail("Tài khoản đã bị vô hiệu hóa", 403, "ACCOUNT_DISABLED");
    if (user.email || user.googleSubject || user.passwordHash || user.role !== "USER") {
      return fail("Vui lòng đăng nhập lại vào tài khoản đã liên kết", 401, "SIGN_IN_REQUIRED");
    }
    const accessToken = await signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    return ok({ user: { id: user.id, role: user.role }, accessToken, refreshToken });
  } catch (error) { return apiError(error); }
}
