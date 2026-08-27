import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, activeSubscriptions, qrCreated, cleanups, freed, events] = await Promise.all([
    db.user.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.qrCode.count({ where: { createdAt: { gte: since } } }),
    db.mediaCleanup.count({ where: { createdAt: { gte: since } } }),
    db.mediaCleanup.aggregate({ where: { createdAt: { gte: since } }, _sum: { bytesFreed: true } }),
    db.usageEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { name: "desc" } }, take: 8 }),
  ]);
  return ok({ users, activeSubscriptions, qrCreated, cleanups, bytesFreed: Number(freed._sum.bytesFreed ?? BigInt(0)), events: events.map((item) => ({ name: item.name, count: item._count._all })) });
}
