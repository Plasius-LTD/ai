import { describe, expect, it, vi } from "vitest";

import {
  createVideoProviderPlatform,
  type VideoProviderAdapter,
} from "../src/platform/index.js";

function createAdapter(overrides: Partial<VideoProviderAdapter> = {}): VideoProviderAdapter {
  return {
    uploadImage: async () => ({ imageId: 11 }),
    generateVideo: async () => ({ videoId: 22 }),
    getVideoResult: async () => ({
      state: "completed",
      videoUrl: "https://cdn.example.com/video.mp4",
    }),
    getBalance: async () => ({
      monthlyCredit: 3,
      packageCredit: 4,
    }),
    ...overrides,
  };
}

describe("createVideoProviderPlatform", () => {
  it("rejects empty api keys", async () => {
    await expect(
      createVideoProviderPlatform("user-1", {
        apiKey: "   ",
        adapter: createAdapter(),
      })
    ).rejects.toThrow("apiKey is required");
  });

  it("builds a platform with provider-backed balance and successful video production", async () => {
    const uploadImage = vi.fn<VideoProviderAdapter["uploadImage"]>().mockResolvedValue({
      imageId: 101,
    });
    const generateVideo = vi
      .fn<VideoProviderAdapter["generateVideo"]>()
      .mockResolvedValue({ videoId: 202 });
    const getVideoResult = vi
      .fn<VideoProviderAdapter["getVideoResult"]>()
      .mockResolvedValue({ state: "completed", videoUrl: "https://cdn.example.com/out.mp4" });
    const getBalance = vi
      .fn<NonNullable<VideoProviderAdapter["getBalance"]>>()
      .mockResolvedValue({ monthlyCredit: 8, packageCredit: 5 });

    const platform = await createVideoProviderPlatform("user-1", {
      apiKey: "video-key",
      adapter: createAdapter({
        uploadImage,
        generateVideo,
        getVideoResult,
        getBalance,
      }),
      polling: { maxRetries: 3, delayMs: 0 },
      defaultVideoRequest: {
        durationSeconds: 9,
        quality: "1080p",
      },
    });

    expect(platform.currentBalance).toBe(13);

    const completion = await platform.produceVideo(
      "user-1",
      "cinematic ocean shot",
      new URL("https://example.com/input.png"),
      "context",
      "provider-model-v1"
    );

    expect(uploadImage).toHaveBeenCalledWith(
      new URL("https://example.com/input.png"),
      expect.objectContaining({
        apiKey: "video-key",
        traceId: expect.any(String),
      })
    );
    expect(generateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: 101,
        prompt: "cinematic ocean shot",
        durationSeconds: 9,
        quality: "1080p",
      }),
      expect.objectContaining({
        apiKey: "video-key",
        traceId: expect.any(String),
      })
    );
    expect(getVideoResult).toHaveBeenCalledWith(
      202,
      expect.objectContaining({
        apiKey: "video-key",
        traceId: expect.any(String),
      })
    );
    expect(completion.url.toString()).toBe("https://cdn.example.com/out.mp4");
    expect(completion.type).toBe("video");
    expect(completion.model).toBe("provider-model-v1");
    expect(completion.partitionKey).toBe("user-1");
  });

  it("falls back to zero balance when adapter does not expose getBalance", async () => {
    const platform = await createVideoProviderPlatform("user-2", {
      apiKey: "video-key",
      adapter: createAdapter({
        getBalance: undefined,
      }),
      polling: { maxRetries: 1, delayMs: 0 },
    });

    expect(platform.currentBalance).toBe(0);
    const balance = await platform.checkBalance("user-2");
    expect(balance.balance).toBe(0);
    expect(balance.type).toBe("balanceCompletion");
  });

  it("exposes only the video platform capability surface", async () => {
    const platform = await createVideoProviderPlatform("user-3", {
      apiKey: "video-key",
      adapter: createAdapter(),
      polling: { maxRetries: 1, delayMs: 0 },
    });

    expect(typeof platform.produceVideo).toBe("function");
    expect(typeof platform.checkBalance).toBe("function");
    expect(typeof platform.currentBalance).toBe("number");
    expect("chatWithAI" in platform).toBe(false);
    expect("synthesizeSpeech" in platform).toBe(false);
    expect("transcribeSpeech" in platform).toBe(false);
    expect("generateImage" in platform).toBe(false);
    expect("generateModel" in platform).toBe(false);
    expect("canHandle" in platform).toBe(false);
  });

  it("fails when provider reports failed state", async () => {
    const platform = await createVideoProviderPlatform("user-4", {
      apiKey: "video-key",
      adapter: createAdapter({
        getVideoResult: async () => ({ state: "failed" }),
      }),
      polling: { maxRetries: 2, delayMs: 0 },
    });

    await expect(
      platform.produceVideo(
        "user-4",
        "prompt",
        new URL("https://example.com/in.png"),
        "",
        "model"
      )
    ).rejects.toThrow("Video generation failed in provider adapter.");
  });

  it("times out when provider never reaches completed state", async () => {
    const platform = await createVideoProviderPlatform("user-5", {
      apiKey: "video-key",
      adapter: createAdapter({
        getVideoResult: async () => ({ state: "pending" }),
      }),
      polling: { maxRetries: 2, delayMs: 0 },
    });

    await expect(
      platform.produceVideo(
        "user-5",
        "prompt",
        new URL("https://example.com/in.png"),
        "",
        "model"
      )
    ).rejects.toThrow("Timed out waiting for provider video completion.");
  });
});
