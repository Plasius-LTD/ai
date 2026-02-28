import { describe, expect, it, vi } from "vitest";

import { createHttpVideoProviderAdapter } from "../src/platform/index.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createHttpVideoProviderAdapter resilience", () => {
  it("retries transient provider failures for video generation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "busy",
          },
          503
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          Resp: { id: 77 },
        })
      );

    const adapter = createHttpVideoProviderAdapter({
      uploadImagePath: "https://video.provider/upload",
      generateVideoPath: "https://video.provider/generate",
      getVideoResultPath: (videoId) => `https://video.provider/result/${videoId}`,
      httpPolicy: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
      },
    });

    const result = await adapter.generateVideo(
      {
        imageId: 1,
        prompt: "Generate",
      },
      {
        apiKey: "video-key",
        traceId: "trace-video-1",
        fetchFn: fetchMock,
      }
    );

    expect(result.videoId).toBe(77);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable client errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: "bad request",
        },
        400
      )
    );

    const adapter = createHttpVideoProviderAdapter({
      uploadImagePath: "https://video.provider/upload",
      generateVideoPath: "https://video.provider/generate",
      getVideoResultPath: (videoId) => `https://video.provider/result/${videoId}`,
      httpPolicy: {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
      },
    });

    await expect(
      adapter.generateVideo(
        {
          imageId: 1,
          prompt: "Generate",
        },
        {
          apiKey: "video-key",
          traceId: "trace-video-2",
          fetchFn: fetchMock,
        }
      )
    ).rejects.toThrow(/Provider request failed/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
