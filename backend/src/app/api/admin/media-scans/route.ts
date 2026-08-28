import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const [totalScans, totalAssets, duplicateAssets, latest] = await Promise.all([
    db.mediaScan.count(),
    db.mediaScanAsset.count(),
    db.mediaScanAsset.count({ where: { categories: { has: "SIMILAR" } } }),
    db.mediaScan.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        deviceId: true,
        scannedCount: true,
        imageCount: true,
        videoCount: true,
        duplicateCount: true,
        screenshotCount: true,
        largeVideoCount: true,
        durationMs: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        assets: {
          orderBy: { createdAt: "asc" },
          take: 120,
          select: {
            id: true,
            type: true,
            categories: true,
            bytes: true,
            width: true,
            height: true,
            durationSeconds: true,
            capturedAt: true,
            thumbnail: true,
          },
        },
        _count: { select: { assets: true } },
      },
    }),
  ]);

  return ok({
    totalScans,
    totalAssets,
    duplicateAssets,
    latest: latest.map((scan) => ({
      ...scan,
      deviceId: `${scan.deviceId.slice(0, 8)}…`,
      assets: scan.assets.map(({ thumbnail, bytes, ...asset }) => ({
        ...asset,
        bytes: Number(bytes),
        hasThumbnail: thumbnail !== null,
      })),
    })),
  });
}
