import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const [totalCreated, totalScanned, latest] = await Promise.all([
    db.qrCode.count(),
    db.usageEvent.count({ where: { name: "qr_scanned" } }),
    db.qrCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, kind: true, content: true, style: true, createdAt: true },
    }),
  ]);

  return ok({ totalCreated, totalScanned, latest });
}
