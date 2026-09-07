import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUniqueConfig: vi.fn(),
  findUniqueFlag: vi.fn(),
  upsertConfig: vi.fn(),
  upsertFlag: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/db", () => ({
  db: {
    appConfig: {
      findUnique: mocks.findUniqueConfig,
      upsert: mocks.upsertConfig,
    },
    featureFlag: {
      findUnique: mocks.findUniqueFlag,
      upsert: mocks.upsertFlag,
    },
    auditLog: {
      create: mocks.createAudit,
    },
  },
}));

import { GET, PATCH } from "./route";

describe("Admin AI Caption Management API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks non-admin access", async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("returns AI caption configuration for admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ userId: "admin-1" });
    mocks.findUniqueConfig.mockResolvedValue({
      key: "ai_caption",
      value: {
        enabled: true,
        provider: "openai",
        openaiBaseUrl: "https://api.skytruong.com/v1",
        model: "gpt-5.4-mini",
        freeDailyLimit: 3,
        proDailyLimit: 30,
      },
    });
    mocks.findUniqueFlag.mockResolvedValue({
      key: "ai_caption_studio",
      enabled: true,
      description: "AI Caption Studio",
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.config.openaiBaseUrl).toBe(process.env.OPENAI_BASE_URL || "https://api.skytruong.com/v1");
    expect(json.data.config.model).toBe("gpt-5.4-mini");
    expect(json.data.config.apiKeyConfigured).toBe(Boolean(process.env.OPENAI_API_KEY?.trim()));
    expect(json.data.config).not.toHaveProperty("openaiApiKey");
    expect(json.data.flag.enabled).toBe(true);
  });

  it("updates AI caption configuration and writes audit log", async () => {
    mocks.requireAdmin.mockResolvedValue({ userId: "admin-1" });
    mocks.findUniqueConfig.mockResolvedValue(null);
    mocks.upsertConfig.mockResolvedValue({
      key: "ai_caption",
      value: {
        enabled: true,
        openaiBaseUrl: "https://api.skytruong.com/v1",
        model: "gpt-5.4",
        freeDailyLimit: 3,
        proDailyLimit: 30,
      },
      updatedAt: new Date(),
    });
    mocks.upsertFlag.mockResolvedValue({});
    mocks.createAudit.mockResolvedValue({});

    const request = new Request("http://localhost/api/admin/ai-caption", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.4",
        freeDailyLimit: 3,
        proDailyLimit: 30,
        openaiBaseUrl: "https://untrusted.example.com/v1",
      }),
    });

    const res = await PATCH(request);
    expect(res.status).toBe(200);
    expect(mocks.upsertConfig).toHaveBeenCalled();
    const storedValue = mocks.upsertConfig.mock.calls[0]?.[0]?.update?.value;
    expect(storedValue).not.toHaveProperty("openaiApiKey");
    expect(storedValue.openaiBaseUrl).not.toBe("https://untrusted.example.com/v1");
    expect(mocks.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ai_caption.config_update",
          actorId: "admin-1",
        }),
      })
    );
    const auditData = mocks.createAudit.mock.calls[0]?.[0]?.data;
    expect(auditData.before).not.toHaveProperty("openaiApiKey");
    expect(auditData.after).not.toHaveProperty("openaiApiKey");
  });
});
