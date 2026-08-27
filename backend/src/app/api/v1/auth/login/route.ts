import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { createRefreshToken, setAuthCookies, signAccessToken } from "@/lib/auth";

const schema = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1).max(72) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user?.passwordHash || user.disabled || !(await compare(input.password, user.passwordHash))) return fail("Email hoặc mật khẩu không đúng", 401, "INVALID_CREDENTIALS");
    const accessToken = await signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    await setAuthCookies(accessToken, refreshToken);
    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken });
  } catch (error) { return apiError(error); }
}

