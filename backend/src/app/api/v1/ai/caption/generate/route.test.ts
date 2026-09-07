import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  generateSocialCaptions: vi.fn(),
  getAICaptionConfig: vi.fn(),
  mediaStorageEntitlement: vi.fn(),
  usageCount: vi.fn(),
  usageCreate: vi.fn(),
  usageDelete: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));

vi.mock("@/lib/caption-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/caption-ai")>();
  return {
    ...actual,
    generateSocialCaptions: mocks.generateSocialCaptions,
    getAICaptionConfig: mocks.getAICaptionConfig,
  };
});

vi.mock("@/lib/media-subscription", () => ({ mediaStorageEntitlement: mocks.mediaStorageEntitlement }));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    usageEvent: {
      count: mocks.usageCount,
      create: mocks.usageCreate,
      delete: mocks.usageDelete,
    },
  },
}));

import { POST } from "./route";
import { AICaptionProviderError } from "@/lib/caption-ai";

const validImage = "data:image/jpeg;base64,bW9ja0Jhc2U2NEltYWdlRGF0YTEyMzQ1Njc4OTA=";
const generatedResult = {
  detectedTags: ["Cặp đôi", "Hài hước"],
  vibeSummary: "Cặp đôi bắt chước meme",
  variants: [
    {
      id: "v1",
      hookHeadline: "Dừng lại 2 giây để xem Match My Freak!",
      body: "Yêu nhau là cùng vui...",
      oneLiner: "Một câu chốt ngắn.",
      suggestedAudio: "Âm thanh vui nhộn",
      viralScore: 92,
    },
  ],
  hashtags: {
    trending: ["#MatchMyFreak"],
    topic: ["#MemeDoiThuong"],
    community: ["#SnapkitAI"],
  },
};

function requestWith(body: unknown) {
  return new Request("http://localhost/api/v1/ai/caption/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/ai/caption/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.getAICaptionConfig.mockResolvedValue({
      enabled: true,
      openaiApiKey: "configured-for-test",
      freeDailyLimit: 3,
      proDailyLimit: 30,
    });
    mocks.mediaStorageEntitlement.mockResolvedValue({ isPro: false });
    mocks.usageCount.mockResolvedValue(0);
    mocks.usageCreate.mockResolvedValue({ id: "usage-1" });
    mocks.usageDelete.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({
      $queryRaw: mocks.lock,
      usageEvent: { count: mocks.usageCount, create: mocks.usageCreate },
    }));
    mocks.generateSocialCaptions.mockResolvedValue(generatedResult);
  });

  it("requires an authenticated user", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await POST(requestWith({ images: [validImage] }));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    expect(mocks.generateSocialCaptions).not.toHaveBeenCalled();
  });

  it("rejects an empty image array", async () => {
    const response = await POST(requestWith({ images: [], tone: "meme" }));

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("generates captions and returns the updated daily usage", async () => {
    mocks.usageCount.mockResolvedValue(1);

    const response = await POST(
      requestWith({ images: [validImage], tone: "meme", platform: "instagram", language: "vi" })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.variants[0].hookHeadline).toContain("Match My Freak");
    expect(json.data.usage).toEqual({ used: 2, limit: 3 });
    expect(mocks.usageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        name: "ai_caption_generated",
        metadata: expect.objectContaining({ imageCount: 1, plan: "free" }),
      }),
    });
  });

  it("blocks generation after the daily free limit", async () => {
    mocks.usageCount.mockResolvedValue(3);

    const response = await POST(requestWith({ images: [validImage] }));

    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("AI_DAILY_LIMIT");
    expect(mocks.generateSocialCaptions).not.toHaveBeenCalled();
    expect(mocks.usageCreate).not.toHaveBeenCalled();
  });

  it("reserves the last available request before the provider returns", async () => {
    let used = 2;
    mocks.usageCount.mockImplementation(async () => used);
    mocks.usageCreate.mockImplementation(async () => ({ id: `usage-${++used}` }));
    let releaseProvider!: () => void;
    const providerPending = new Promise<void>((resolve) => { releaseProvider = resolve; });
    let signalProvider!: () => void;
    const providerStarted = new Promise<void>((resolve) => { signalProvider = resolve; });
    mocks.generateSocialCaptions.mockImplementationOnce(async () => {
      signalProvider();
      await providerPending;
      return generatedResult;
    });

    const firstRequest = POST(requestWith({ images: [validImage] }));
    await providerStarted;
    const secondResponse = await POST(requestWith({ images: [validImage] }));
    releaseProvider();
    expect(secondResponse.status).toBe(429);
    expect((await firstRequest).status).toBe(200);
    expect(mocks.generateSocialCaptions).toHaveBeenCalledTimes(1);
    expect(mocks.lock).toHaveBeenCalledTimes(2);
  });

  it("releases the reservation when generation fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateSocialCaptions.mockRejectedValueOnce(new Error("Provider unavailable"));
    const response = await POST(requestWith({ images: [validImage] }));
    expect(response.status).toBe(500);
    expect(mocks.usageDelete).toHaveBeenCalledWith({ where: { id: "usage-1" } });
    logged.mockRestore();
  });

  it("reports invalid provider output as an upstream error and restores usage", async () => {
    mocks.generateSocialCaptions.mockRejectedValueOnce(new AICaptionProviderError(new SyntaxError("bad upstream JSON")));
    const response = await POST(requestWith({ images: [validImage] }));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("AI_PROVIDER_ERROR");
    expect(mocks.usageDelete).toHaveBeenCalledWith({ where: { id: "usage-1" } });
  });
});
