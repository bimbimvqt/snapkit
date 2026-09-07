import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captionRequestSchema,
  AICaptionProviderError,
  generateSocialCaptions,
  publicAICaptionConfig,
  type AICaptionConfig,
} from "./caption-ai";

const config: AICaptionConfig = {
  enabled: true,
  provider: "openai",
  openaiBaseUrl: "https://ai.example.com/v1",
  openaiApiKey: "configured-for-test",
  model: "vision-model",
  temperature: 0.8,
  maxTokens: 1200,
  defaultTone: "meme",
  freeDailyLimit: 3,
  proDailyLimit: 30,
};

describe("AI caption validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never exposes the API key in public configuration", () => {
    const publicConfig = publicAICaptionConfig(config);

    expect(publicConfig.apiKeyConfigured).toBe(true);
    expect(publicConfig).not.toHaveProperty("openaiApiKey");
  });

  it("rejects unsupported image payloads and more than four images", () => {
    expect(() => captionRequestSchema.parse({ images: ["data:image/svg+xml;base64,PHN2Zz4="] })).toThrow();
    const image = "data:image/jpeg;base64,bW9ja0ltYWdlRGF0YTEyMzQ1Njc4OTA=";
    expect(() => captionRequestSchema.parse({ images: Array(5).fill(image) })).toThrow();
  });

  it("rejects malformed provider output instead of casting it as a valid result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ variants: [{ body: "" }] }) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(
      generateSocialCaptions(
        {
          images: ["data:image/jpeg;base64,bW9ja0ltYWdlRGF0YTEyMzQ1Njc4OTA="],
          tone: "meme",
          platform: "instagram",
          language: "vi",
        },
        config
      )
    ).rejects.toThrow(AICaptionProviderError);
  });
});
