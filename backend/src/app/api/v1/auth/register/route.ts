import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { createRefreshToken, setAuthCookies, signAccessToken } from "@/lib/auth";

const schema = z.object({ name: z.string().trim().min(2).max(60), email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(8).max(72) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (await db.user.findUnique({ where: { email: input.email } })) return fail("Email đã được sử dụng", 409, "EMAIL_EXISTS");
    const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await hash(input.password, 12) } });
    const accessToken = await signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    await setAuthCookies(accessToken, refreshToken);
    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken }, { status: 201 });
  } catch (error) { return apiError(error); }
}

