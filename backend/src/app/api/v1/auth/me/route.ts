import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { mediaStorageEntitlement } from "@/lib/media-subscription";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Chưa đăng nhập", 401, "UNAUTHORIZED");
  const [user, entitlement] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true },
    }),
    mediaStorageEntitlement(session.userId),
  ]);
  return user
    ? ok({ ...user, isPro: entitlement.isPro, planId: entitlement.planId })
    : fail("Không tìm thấy tài khoản", 404, "NOT_FOUND");
}
