import { statfs } from "node:fs/promises";
import { hostname } from "node:os";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaStorageRoot } from "@/lib/media-storage";

type DailyCount = { day: string; count: number };
type NamedCount = { name: string; count: number };

const dayMs = 86_400_000;

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function dailyMap(rows: DailyCount[]) {
  return new Map(rows.map((row) => [row.day, row.count]));
}

async function readDiskUsage() {
  let target = mediaStorageRoot();
  const read = (path: string) => statfs(/* turbopackIgnore: true */ path, { bigint: true });
  let details: Awaited<ReturnType<typeof read>>;
  try {
    details = await read(target);
  } catch {
    target = process.cwd();
    details = await read(target);
  }
  const totalBytes = details.blocks * details.bsize;
  const freeBytes = details.bavail * details.bsize;
  const usedBytes = totalBytes - freeBytes;
  return {
    sourceHost: process.env.STORAGE_SERVER_LABEL?.trim() || hostname(),
    totalBytes: Number(totalBytes),
    usedBytes: Number(usedBytes),
    freeBytes: Number(freeBytes),
    usedPercent: totalBytes === BigInt(0) ? 0 : Math.round((Number(usedBytes) / Number(totalBytes)) * 1000) / 10,
  };
}

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - 29 * dayMs);
  const previousSince = new Date(since.getTime() - 30 * dayMs);

  const [
    totalUsers,
    newUsers,
    previousNewUsers,
    activeSubscriptions,
    totalEvents,
    previousEvents,
    activeAudienceRows,
    qrCreated,
    previousQrCreated,
    cleanupSummary,
    previousCleanups,
    scanSummary,
    totalPreviewAssets,
    previewReadyAssets,
    events,
    platforms,
    eventDaily,
    userDaily,
    qrDaily,
    cleanupDaily,
    scanDaily,
    diskUsage,
    previewStorage,
    databaseSizeRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.user.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.usageEvent.count({ where: { createdAt: { gte: since } } }),
    db.usageEvent.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT COALESCE("userId", "deviceId"))::int AS "count"
      FROM "UsageEvent"
      WHERE "createdAt" >= ${since}
    `,
    db.qrCode.count({ where: { createdAt: { gte: since } } }),
    db.qrCode.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    db.mediaCleanup.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { bytesFreed: true, removedCount: true, scannedCount: true },
    }),
    db.mediaCleanup.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    db.mediaScan.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: {
        scannedCount: true,
        imageCount: true,
        videoCount: true,
        duplicateCount: true,
        screenshotCount: true,
        largeVideoCount: true,
        durationMs: true,
      },
    }),
    db.mediaScanAsset.count({ where: { createdAt: { gte: since } } }),
    db.mediaScanAsset.count({ where: { createdAt: { gte: since }, previewStorageKey: { not: null } } }),
    db.$queryRaw<NamedCount[]>`
      SELECT "name", COUNT(*)::int AS "count"
      FROM "UsageEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY "name"
      ORDER BY "count" DESC
      LIMIT 8
    `,
    db.$queryRaw<NamedCount[]>`
      SELECT COALESCE("platform", 'unknown') AS "name", COUNT(*)::int AS "count"
      FROM "UsageEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY COALESCE("platform", 'unknown')
      ORDER BY "count" DESC
    `,
    db.$queryRaw<DailyCount[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "UsageEvent"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt")
    `,
    db.$queryRaw<DailyCount[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt")
    `,
    db.$queryRaw<DailyCount[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "QrCode"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt")
    `,
    db.$queryRaw<DailyCount[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "MediaCleanup"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt")
    `,
    db.$queryRaw<DailyCount[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
      FROM "MediaScan"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY DATE_TRUNC('day', "createdAt")
    `,
    readDiskUsage(),
    db.mediaScanAsset.aggregate({ _sum: { previewBytes: true } }),
    db.$queryRaw<Array<{ bytes: string }>>`
      SELECT PG_DATABASE_SIZE(CURRENT_DATABASE())::text AS "bytes"
    `,
  ]);

  const eventByDay = dailyMap(eventDaily);
  const userByDay = dailyMap(userDaily);
  const qrByDay = dailyMap(qrDaily);
  const cleanupByDay = dailyMap(cleanupDaily);
  const scanByDay = dailyMap(scanDaily);
  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(since.getTime() + index * dayMs).toISOString().slice(0, 10);
    return {
      date,
      events: eventByDay.get(date) ?? 0,
      newUsers: userByDay.get(date) ?? 0,
      qrCreated: qrByDay.get(date) ?? 0,
      cleanups: cleanupByDay.get(date) ?? 0,
      mediaScans: scanByDay.get(date) ?? 0,
    };
  });

  const cleanups = cleanupSummary._count._all;
  const mediaScans = scanSummary._count._all;
  const scanDurationMs = scanSummary._sum.durationMs ?? 0;
  const databaseBytes = Number(databaseSizeRows[0]?.bytes ?? 0);
  const previewBytes = Number(previewStorage._sum.previewBytes ?? BigInt(0));

  return ok({
    period: { days: 30, start: since.toISOString(), end: new Date().toISOString() },
    audience: {
      totalUsers,
      newUsers,
      previousNewUsers,
      newUsersChange: percentageChange(newUsers, previousNewUsers),
      activeUsers: activeAudienceRows[0]?.count ?? 0,
      activeSubscriptions,
      proConversion: totalUsers === 0 ? 0 : Math.round((activeSubscriptions / totalUsers) * 1000) / 10,
    },
    engagement: {
      totalEvents,
      previousEvents,
      eventsChange: percentageChange(totalEvents, previousEvents),
      events,
      platforms,
    },
    productivity: {
      qrCreated,
      previousQrCreated,
      qrChange: percentageChange(qrCreated, previousQrCreated),
      cleanups,
      previousCleanups,
      cleanupChange: percentageChange(cleanups, previousCleanups),
      scannedForCleanup: cleanupSummary._sum.scannedCount ?? 0,
      removedItems: cleanupSummary._sum.removedCount ?? 0,
      bytesFreed: Number(cleanupSummary._sum.bytesFreed ?? BigInt(0)),
    },
    media: {
      scans: mediaScans,
      scannedAssets: scanSummary._sum.scannedCount ?? 0,
      images: scanSummary._sum.imageCount ?? 0,
      videos: scanSummary._sum.videoCount ?? 0,
      duplicates: scanSummary._sum.duplicateCount ?? 0,
      screenshots: scanSummary._sum.screenshotCount ?? 0,
      largeVideos: scanSummary._sum.largeVideoCount ?? 0,
      averageScanSeconds: mediaScans === 0 ? 0 : Math.round(scanDurationMs / mediaScans / 100) / 10,
      totalPreviewAssets,
      previewReadyAssets,
      previewCoverage: totalPreviewAssets === 0 ? 0 : Math.round((previewReadyAssets / totalPreviewAssets) * 1000) / 10,
    },
    storage: {
      ...diskUsage,
      databaseBytes,
      previewBytes,
    },
    trend,
  });
}
