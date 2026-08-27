import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const search = new URL(request.url).searchParams.get("q")?.trim();
  const users = await db.user.findMany({ where: search ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] } : undefined, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, name: true, email: true, role: true, disabled: true, createdAt: true, _count: { select: { qrCodes: true, cleanups: true } } } });
  return ok(users);
}
