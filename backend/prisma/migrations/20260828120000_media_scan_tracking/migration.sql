-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaAssetCategory" AS ENUM ('SIMILAR', 'SCREENSHOT', 'LARGE_VIDEO', 'OTHER');

-- CreateTable
CREATE TABLE "MediaScan" (
    "id" TEXT NOT NULL,
    "clientScanId" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT NOT NULL,
    "scannedCount" INTEGER NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "screenshotCount" INTEGER NOT NULL,
    "largeVideoCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "maxScanAssets" INTEGER NOT NULL,
    "similarImageLimit" INTEGER NOT NULL,
    "largeVideoThresholdMb" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaScanAsset" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "deviceAssetKey" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "categories" "MediaAssetCategory"[],
    "bytes" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "thumbnail" BYTEA,
    "thumbnailMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaScanAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaScan_deviceId_clientScanId_key" ON "MediaScan"("deviceId", "clientScanId");
CREATE INDEX "MediaScan_createdAt_idx" ON "MediaScan"("createdAt");
CREATE INDEX "MediaScan_userId_createdAt_idx" ON "MediaScan"("userId", "createdAt");
CREATE UNIQUE INDEX "MediaScanAsset_scanId_deviceAssetKey_key" ON "MediaScanAsset"("scanId", "deviceAssetKey");
CREATE INDEX "MediaScanAsset_scanId_createdAt_idx" ON "MediaScanAsset"("scanId", "createdAt");
CREATE INDEX "MediaScanAsset_type_createdAt_idx" ON "MediaScanAsset"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaScan" ADD CONSTRAINT "MediaScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaScanAsset" ADD CONSTRAINT "MediaScanAsset_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "MediaScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
