import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { createRefreshToken, signAccessToken } from "@/lib/auth";

const schema = z.object({ deviceId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const { deviceId } = schema.parse(await request.json());
    const user = await db.user.upsert({ where: { anonymousId: deviceId }, update: {}, create: { anonymousId: deviceId, name: "Anonymous user" } });
    const accessToken = await signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    return ok({ user: { id: user.id, role: user.role }, accessToken, refreshToken });
  } catch (error) { return apiError(error); }
}
