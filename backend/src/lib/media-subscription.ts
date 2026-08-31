import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  defaultSubscriptionConfig,
  parseSubscriptionConfig,
  type SubscriptionConfig,
} from "@/lib/subscription-plans";

const subscriptionConfigKey = "subscription_plans";

export type MediaStorageEntitlement = {
  planId: string;
  productId: string | null;
  isPro: boolean;
  policy: SubscriptionConfig["freeStorage"];
};

export async function mediaStorageEntitlement(userId: string): Promise<MediaStorageEntitlement> {
  const now = new Date();
  const [storedConfig, subscription] = await Promise.all([
    db.appConfig.findUnique({ where: { key: subscriptionConfigKey }, select: { value: true } }),
    db.subscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "GRACE_PERIOD"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: "desc" }, { updatedAt: "desc" }],
      select: { productId: true },
    }),
  ]);
  const config = storedConfig ? parseSubscriptionConfig(storedConfig.value) : defaultSubscriptionConfig;
  const plan = subscription
    ? config.plans.find((candidate) => candidate.enabled && candidate.productId === subscription.productId)
    : undefined;
  if (!plan) {
    return { planId: "free", productId: subscription?.productId ?? null, isPro: false, policy: config.freeStorage };
  }
  return { planId: plan.id, productId: plan.productId, isPro: true, policy: plan.storage };
}

type StoredBytesRow = { bytes: bigint };

export async function userMediaStorageBytes(userId: string) {
  const rows = await db.$queryRaw<StoredBytesRow[]>(Prisma.sql`
    SELECT COALESCE(SUM(objects.bytes), 0)::bigint AS bytes
    FROM (
      SELECT storage_key, MAX(bytes)::bigint AS bytes
      FROM (
        SELECT a."previewStorageKey" AS storage_key, a."previewBytes" AS bytes
        FROM "MediaScanAsset" a
        INNER JOIN "MediaScan" s ON s.id = a."scanId"
        WHERE s."userId" = ${userId} AND a."previewStorageKey" IS NOT NULL
        UNION ALL
        SELECT a."originalStorageKey" AS storage_key, a."originalBytes" AS bytes
        FROM "MediaScanAsset" a
        INNER JOIN "MediaScan" s ON s.id = a."scanId"
        WHERE s."userId" = ${userId} AND a."originalStorageKey" IS NOT NULL
        UNION ALL
        SELECT a."pendingStorageKey" AS storage_key, a."pendingBytes" AS bytes
        FROM "MediaScanAsset" a
        INNER JOIN "MediaScan" s ON s.id = a."scanId"
        WHERE s."userId" = ${userId}
          AND a."pendingStorageKey" IS NOT NULL
          AND a."pendingExpiresAt" > NOW()
      ) stored_objects
      GROUP BY storage_key
    ) objects
  `);
  return Number(rows[0]?.bytes ?? BigInt(0));
}

export async function totalMediaStorageBytes() {
  const rows = await db.$queryRaw<StoredBytesRow[]>(Prisma.sql`
    SELECT COALESCE(SUM(objects.bytes), 0)::bigint AS bytes
    FROM (
      SELECT storage_key, MAX(bytes)::bigint AS bytes
      FROM (
        SELECT "previewStorageKey" AS storage_key, "previewBytes" AS bytes
        FROM "MediaScanAsset"
        WHERE "previewStorageKey" IS NOT NULL
        UNION ALL
        SELECT "originalStorageKey" AS storage_key, "originalBytes" AS bytes
        FROM "MediaScanAsset"
        WHERE "originalStorageKey" IS NOT NULL
        UNION ALL
        SELECT "pendingStorageKey" AS storage_key, "pendingBytes" AS bytes
        FROM "MediaScanAsset"
        WHERE "pendingStorageKey" IS NOT NULL AND "pendingExpiresAt" > NOW()
      ) stored_objects
      GROUP BY storage_key
    ) objects
  `);
  return Number(rows[0]?.bytes ?? BigInt(0));
}

export function retentionDate(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 86_400_000);
}
