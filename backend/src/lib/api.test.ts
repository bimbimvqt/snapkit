import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { apiError } from "./api";

describe("API input errors", () => {
  it("returns a client error for malformed JSON", async () => {
    const error = await new Request("http://localhost", { method: "POST", body: "{" }).json().catch((error) => error);
    const response = apiError(error);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("returns a conflict for concurrent duplicate writes without leaking database details", async () => {
    const response = apiError(new Prisma.PrismaClientKnownRequestError("Private column values", {
      code: "P2002", clientVersion: "6.19.0",
    }));
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("Private column");
  });
});
