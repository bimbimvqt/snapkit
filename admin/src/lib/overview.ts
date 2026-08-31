import type { Overview } from "@/lib/backend";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function counts(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const entry = record(item);
        return typeof entry.name === "string" ? [{ name: entry.name, count: number(entry.count) }] : [];
      })
    : [];
}

function trend(value: unknown): Overview["trend"] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const point = record(item);
        if (typeof point.date !== "string") return [];
        return [{
          date: point.date,
          events: number(point.events),
          newUsers: number(point.newUsers),
          qrCreated: number(point.qrCreated),
          cleanups: number(point.cleanups),
          mediaScans: number(point.mediaScans),
        }];
      })
    : [];
}

export function normalizeOverview(input: unknown, now = new Date()): Overview {
  const source = record(input);
  const audience = record(source.audience);
  const engagement = record(source.engagement);
  const productivity = record(source.productivity);
  const media = record(source.media);
  const period = record(source.period);
  const storage = record(source.storage);
  const r2 = record(storage.r2);
  const currentShape = Object.keys(audience).length > 0 && Object.keys(productivity).length > 0;
  const legacyEvents = counts(source.events);
  const events = counts(engagement.events);
  const end = typeof period.end === "string" ? period.end : now.toISOString();
  const start = typeof period.start === "string" ? period.start : new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const totalUsers = currentShape ? number(audience.totalUsers) : number(source.users);
  const activeSubscriptions = currentShape ? number(audience.activeSubscriptions) : number(source.activeSubscriptions);
  const selectedEvents = currentShape ? events : legacyEvents;

  return {
    apiVersion: currentShape ? "analytics_v2" : "legacy",
    period: { days: number(period.days) || 30, start, end },
    audience: {
      totalUsers,
      newUsers: number(audience.newUsers),
      previousNewUsers: number(audience.previousNewUsers),
      newUsersChange: nullableNumber(audience.newUsersChange),
      activeUsers: currentShape ? number(audience.activeUsers) : totalUsers,
      activeSubscriptions,
      proConversion: currentShape
        ? number(audience.proConversion)
        : totalUsers === 0 ? 0 : Math.round((activeSubscriptions / totalUsers) * 1000) / 10,
    },
    engagement: {
      totalEvents: currentShape ? number(engagement.totalEvents) : selectedEvents.reduce((sum, item) => sum + item.count, 0),
      previousEvents: number(engagement.previousEvents),
      eventsChange: nullableNumber(engagement.eventsChange),
      events: selectedEvents,
      platforms: counts(engagement.platforms),
    },
    productivity: {
      qrCreated: currentShape ? number(productivity.qrCreated) : number(source.qrCreated),
      previousQrCreated: number(productivity.previousQrCreated),
      qrChange: nullableNumber(productivity.qrChange),
      cleanups: currentShape ? number(productivity.cleanups) : number(source.cleanups),
      previousCleanups: number(productivity.previousCleanups),
      cleanupChange: nullableNumber(productivity.cleanupChange),
      scannedForCleanup: number(productivity.scannedForCleanup),
      removedItems: number(productivity.removedItems),
      bytesFreed: currentShape ? number(productivity.bytesFreed) : number(source.bytesFreed),
    },
    media: {
      scans: number(media.scans),
      scannedAssets: number(media.scannedAssets),
      images: number(media.images),
      videos: number(media.videos),
      duplicates: number(media.duplicates),
      screenshots: number(media.screenshots),
      largeVideos: number(media.largeVideos),
      averageScanSeconds: number(media.averageScanSeconds),
      totalPreviewAssets: number(media.totalPreviewAssets),
      previewReadyAssets: number(media.previewReadyAssets),
      previewCoverage: number(media.previewCoverage),
    },
    storage: Object.keys(storage).length > 0 ? {
      sourceHost: typeof storage.sourceHost === "string" ? storage.sourceHost : undefined,
      totalBytes: number(storage.totalBytes),
      usedBytes: number(storage.usedBytes),
      freeBytes: number(storage.freeBytes),
      usedPercent: number(storage.usedPercent),
      databaseBytes: number(storage.databaseBytes),
      previewBytes: number(storage.previewBytes),
      mediaProvider: typeof storage.mediaProvider === "string" ? storage.mediaProvider : undefined,
      r2: Object.keys(r2).length > 0 ? {
        bucket: typeof r2.bucket === "string" ? r2.bucket : "",
        prefix: typeof r2.prefix === "string" ? r2.prefix : "",
        usedBytes: number(r2.usedBytes),
        objectCount: nullableNumber(r2.objectCount),
        measuredAt: typeof r2.measuredAt === "string" ? r2.measuredAt : null,
        source: r2.source === "bucket" ? "bucket" : "database",
      } : null,
    } : null,
    trend: trend(source.trend),
  };
}
