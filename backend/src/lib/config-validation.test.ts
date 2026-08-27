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
        iconColor: "#102019",
        borderWidth: 4,
        cornerRadius: 24,
        eyeShape: "circle",
        moduleShape: "square",
        frameStyle: "badge",
        icon: "shield",
      }),
    ).toMatchObject({ frameStyle: "badge", icon: "shield" });
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
});
