import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Chưa đăng nhập", 401, "UNAUTHORIZED");
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, role: true, createdAt: true, subscriptions: { where: { status: "ACTIVE" }, take: 1 } } });
  return user ? ok(user) : fail("Không tìm thấy tài khoản", 404, "NOT_FOUND");
}

