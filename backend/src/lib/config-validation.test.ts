import { describe, expect, it } from "vitest";
import { themeSchema } from "@/app/api/admin/config/route";
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
