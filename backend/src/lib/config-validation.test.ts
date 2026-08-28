import { describe, expect, it } from "vitest";
import { cleanerSchema, themeSchema } from "@/app/api/admin/config/route";
import { mediaScanBatchSchema } from "@/app/api/v1/media-scans/route";
import { qrStyleSchema } from "@/app/api/v1/qr/route";

describe("mobile appearance config", () => {
  it("accepts a supported remote theme", () => {
    expect(
      themeSchema.parse({
        preset: "ocean_cyan",
        mode: "system",
        navigationStyle: "glass",
      }),
    ).toMatchObject({ preset: "ocean_cyan", navigationStyle: "glass" });
  });

  it("accepts the Threads-inspired monochrome preset", () => {
    expect(
      themeSchema.parse({
        preset: "threads_mono",
        mode: "dark",
        navigationStyle: "glass",
      }),
    ).toMatchObject({ preset: "threads_mono", navigationStyle: "glass" });
  });

  it("rejects unknown presets and navigation styles", () => {
    expect(() =>
      themeSchema.parse({ preset: "custom", mode: "dark", navigationStyle: "legacy" }),
    ).toThrow();
  });
});

describe("media cleaner config", () => {
  it("accepts bounded scan and sync settings", () => {
    expect(
      cleanerSchema.parse({
        maxScanAssets: 800,
        similarImageLimit: 240,
        largeVideoThresholdMb: 150,
        adminSyncEnabled: true,
        adminSyncLimit: 500,
      }),
    ).toMatchObject({ maxScanAssets: 800, adminSyncLimit: 500 });
  });

  it("rejects unsafe scan limits", () => {
    expect(() =>
      cleanerSchema.parse({
        maxScanAssets: 50_000,
        similarImageLimit: 10,
        largeVideoThresholdMb: 1,
        adminSyncEnabled: true,
        adminSyncLimit: 50_000,
      }),
    ).toThrow();
  });
});

describe("media scan batch validation", () => {
  it("accepts a privacy-safe thumbnail batch", () => {
    expect(
      mediaScanBatchSchema.parse({
        clientScanId: "123e4567-e89b-42d3-a456-426614174000",
        deviceId: "device-12345678",
        scannedCount: 1,
        imageCount: 1,
        videoCount: 0,
        duplicateCount: 1,
        screenshotCount: 0,
        largeVideoCount: 0,
        durationMs: 250,
        maxScanAssets: 500,
        similarImageLimit: 180,
        largeVideoThresholdMb: 100,
        assets: [
          {
            assetId: "private-device-id",
            type: "IMAGE",
            categories: ["SIMILAR"],
            bytes: 2048,
            width: 1200,
            height: 900,
            thumbnailBase64: "YWJj",
          },
        ],
      }),
    ).toMatchObject({ scannedCount: 1 });
  });
});

describe("QR style validation", () => {
  it("accepts the complete customization payload", () => {
    expect(
      qrStyleSchema.parse({
        foreground: "#102019",
        background: "#F2F8F5",
        frameColor: "#55D6A7",
        frameSecondaryColor: "#EC4899",
        frameBackground: "#FFFFFF",
        iconColor: "#102019",
        logoBackground: "#FFFFFF",
        borderWidth: 4,
        cornerRadius: 24,
        framePadding: 20,
        logoScale: 0.22,
        eyeShape: "circle",
        moduleShape: "square",
        frameStyle: "floral",
        frameShape: "ticket",
        frameShadow: "glow",
        frameLabel: "SCAN WITH CAMERA",
        icon: "custom",
        logoShape: "circle",
      }),
    ).toMatchObject({ frameStyle: "floral", frameShape: "ticket", icon: "custom" });
  });

  it("rejects unsafe colors and out-of-range borders", () => {
    expect(() =>
      qrStyleSchema.parse({
        foreground: "red",
        background: "#FFFFFF",
        borderWidth: 40,
      }),
    ).toThrow();
  });

  it("accepts the rainbow frame while rejecting oversized labels and logos", () => {
    expect(
      qrStyleSchema.parse({
        foreground: "#102019",
        background: "#FFFFFF",
        frameStyle: "rainbow",
        frameShape: "rounded",
        frameLabel: "SCAN ME",
      }),
    ).toMatchObject({ frameStyle: "rainbow", frameLabel: "SCAN ME" });

    expect(() =>
      qrStyleSchema.parse({
        foreground: "#102019",
        background: "#FFFFFF",
        frameLabel: "x".repeat(33),
        logoScale: 0.5,
      }),
    ).toThrow();
  });
});
