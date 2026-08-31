import { afterEach, describe, expect, it } from "vitest";
import {
  isR2Reference,
  mediaR2Reference,
  r2ConfigurationStatus,
  r2ObjectKey,
  r2Reference,
} from "./r2-storage";

describe("Cloudflare R2 storage references", () => {
  afterEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
    delete process.env.R2_MEDIA_PREFIX;
  });

  it("creates private user-scoped object references", () => {
    process.env.R2_MEDIA_PREFIX = "snapkit-prod";
    const reference = mediaR2Reference("user-1", "asset-1", "original", "mov");
    expect(reference).toBe("r2:snapkit-prod/users/user-1/assets/asset-1/original.mov");
    expect(isR2Reference(reference)).toBe(true);
    expect(r2ObjectKey(reference)).toBe("snapkit-prod/users/user-1/assets/asset-1/original.mov");
  });

  it("rejects unsafe object keys and reports incomplete configuration", () => {
    expect(() => r2Reference("../private")).toThrow("INVALID_R2_KEY");
    expect(r2ConfigurationStatus()).toEqual({ required: false, configured: false });
  });
});
