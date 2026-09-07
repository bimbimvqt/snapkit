import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { createRefreshToken, getSession, setAuthCookies, signAccessToken } from "@/lib/auth";
import {
  GoogleAuthConfigurationError,
  InvalidGoogleIdTokenError,
  verifyGoogleIdToken,
} from "@/lib/google-auth";
import { mediaStorageEntitlement } from "@/lib/media-subscription";

const schema = z.object({
  idToken: z.string().min(100).max(16_384),
  deviceId: z.uuid().optional(),
});

class GoogleAccountConflictError extends Error {}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const identity = await verifyGoogleIdToken(input.idToken);
    const session = input.deviceId ? await getSession() : null;
    const user = await db.$transaction(async (transaction) => {
      const bySubject = await transaction.user.findUnique({ where: { googleSubject: identity.subject } });
      if (bySubject) {
        const emailOwner = await transaction.user.findUnique({ where: { email: identity.email } });
        if (emailOwner && emailOwner.id !== bySubject.id) throw new GoogleAccountConflictError();
        return transaction.user.update({
          where: { id: bySubject.id },
          data: {
            email: identity.email,
            name: identity.name ?? bySubject.name,
            avatarUrl: identity.avatarUrl ?? bySubject.avatarUrl,
          },
        });
      }

      const byEmail = await transaction.user.findUnique({ where: { email: identity.email } });
      if (byEmail) {
        if (byEmail.googleSubject && byEmail.googleSubject !== identity.subject) throw new GoogleAccountConflictError();
        return transaction.user.update({
          where: { id: byEmail.id },
          data: {
            googleSubject: identity.subject,
            name: identity.name ?? byEmail.name,
            avatarUrl: identity.avatarUrl ?? byEmail.avatarUrl,
          },
        });
      }

      const anonymousUser = input.deviceId && session
        ? await transaction.user.findUnique({ where: { anonymousId: input.deviceId } })
        : null;
      if (anonymousUser && anonymousUser.id === session?.userId && !anonymousUser.disabled &&
          anonymousUser.role === "USER" && !anonymousUser.email && !anonymousUser.googleSubject && !anonymousUser.passwordHash) {
        return transaction.user.update({
          where: { id: anonymousUser.id },
          data: {
            email: identity.email,
            googleSubject: identity.subject,
            name: identity.name ?? anonymousUser.name,
            avatarUrl: identity.avatarUrl ?? anonymousUser.avatarUrl,
          },
        });
      }

      return transaction.user.create({
        data: {
          email: identity.email,
          googleSubject: identity.subject,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
        },
      });
    });

    if (user.disabled) return fail("Tài khoản đã bị vô hiệu hóa", 403, "ACCOUNT_DISABLED");
    const entitlement = await mediaStorageEntitlement(user.id);
    const accessToken = await signAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    await setAuthCookies(accessToken, refreshToken);
    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isPro: entitlement.isPro,
        planId: entitlement.planId,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof GoogleAuthConfigurationError) {
      return fail("Đăng nhập Google chưa được cấu hình trên máy chủ", 503, "GOOGLE_AUTH_NOT_CONFIGURED");
    }
    if (error instanceof InvalidGoogleIdTokenError) {
      return fail("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn", 401, "INVALID_GOOGLE_TOKEN");
    }
    if (error instanceof GoogleAccountConflictError) {
      return fail("Email này đã được liên kết với một tài khoản Google khác", 409, "GOOGLE_ACCOUNT_CONFLICT");
    }
    return apiError(error);
  }
}
