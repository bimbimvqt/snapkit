import { describe, expect, it } from "vitest";
import { mediaScanAdminQuerySchema } from "./route";

describe("admin media scan pagination", () => {
  it("uses safe pagination defaults", () => {
    expect(mediaScanAdminQuerySchema.parse({})).toEqual({ page: 1, pageSize: 24, type: "ALL" });
  });

  it("accepts bounded filters", () => {
    expect(
      mediaScanAdminQuerySchema.parse({ group: "user:user-123", page: "3", pageSize: "48", type: "VIDEO" }),
    ).toEqual({ group: "user:user-123", page: 3, pageSize: 48, type: "VIDEO" });
  });

  it("rejects unsafe pagination and unknown media types", () => {
    expect(() => mediaScanAdminQuerySchema.parse({ page: "0", pageSize: "500", type: "FILE" })).toThrow();
  });
});
