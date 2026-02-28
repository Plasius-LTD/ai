import { describe, expect, it, vi } from "vitest";

import { AICapability, createPixelverseAdapter } from "../src/platform/index.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createPixelverseAdapter", () => {
  it("exposes video and balance capabilities", () => {
    const adapter = createPixelverseAdapter();
    expect(adapter.id).toBe("pixelverse");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([AICapability.Video, AICapability.Balance])
    );
  });

  it("produces a video by uploading, generating, and polling result", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ Resp: { id: 101 } }))
      .mockResolvedValueOnce(jsonResponse({ Resp: { id: 202 } }))
      .mockResolvedValueOnce(jsonResponse({ Resp: { status: 0 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          Resp: { status: 1, url: "https://cdn.pixelverse.ai/video.mp4" },
        })
      );

    const adapter = createPixelverseAdapter({
      fetchFn: fetchMock,
      polling: { maxRetries: 3, delayMs: 0 },
      httpPolicy: {
        maxAttempts: 1,
      },
    });

    const completion = await adapter.produceVideo?.({
      userId: "user-1",
      providerId: "pixelverse",
      apiKey: "pixelverse-key",
      traceId: "trace-1",
      input: "Animate this character",
      image: new URL("https://assets.example.com/input.png"),
      context: "cinematic motion",
      model: "pixelverse-v1",
    });

    expect(completion?.url.toString()).toBe("https://cdn.pixelverse.ai/video.mp4");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("maps provider balance into completion balance", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        Resp: { credit_monthly: 8, credit_package: 12 },
      })
    );

    const adapter = createPixelverseAdapter({
      fetchFn: fetchMock,
      httpPolicy: {
        maxAttempts: 1,
      },
    });

    const completion = await adapter.checkBalance?.({
      userId: "user-1",
      providerId: "pixelverse",
      apiKey: "pixelverse-key",
      traceId: "trace-2",
    });

    expect(completion?.balance).toBe(20);
  });
});
