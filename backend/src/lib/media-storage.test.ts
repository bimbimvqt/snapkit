import { describe, expect, it } from "vitest";
import { parseByteRange, storageKeyFor } from "./media-storage";

describe("media preview storage", () => {
  it("creates an opaque server-owned path", () => {
    expect(storageKeyFor("asset-123", "video/mp4")).toBe("23/asset-123.mp4");
    expect(storageKeyFor("asset-456", "image/jpeg")).toBe("56/asset-456.jpg");
  });

  it("parses seek and suffix byte ranges", () => {
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("rejects invalid and multi-part ranges", () => {
    expect(parseByteRange("bytes=1000-1001", 1000)).toBe(false);
    expect(parseByteRange("bytes=0-1,4-5", 1000)).toBe(false);
  });
});
