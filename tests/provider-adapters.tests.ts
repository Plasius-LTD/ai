import { describe, expect, it, vi } from "vitest";

import {
  AICapability,
  createGeminiAdapter,
  createGrokAdapter,
  createMetaAIAdapter,
  createOpenAIAdapter,
} from "../src/platform/index.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("built-in provider adapters", () => {
  it("creates an OpenAI adapter with expected capabilities", () => {
    const adapter = createOpenAIAdapter();
    expect(adapter.id).toBe("openai");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([
        AICapability.Chat,
        AICapability.Speech,
        AICapability.Image,
        AICapability.Model,
      ])
    );
  });

  it("OpenAI chat adapter maps provider payload to ChatCompletion", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello from OpenAI",
            },
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 7,
          total_tokens: 12,
        },
      })
    );

    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });
    const completion = await adapter.chatWithAI?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-1",
      input: "hello",
      context: "be concise",
      model: "gpt-4.1-mini",
    });

    expect(completion?.message).toBe("Hello from OpenAI");
    expect(completion?.usage?.totalTokens).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer openai-key"
    );
  });

  it("OpenAI adapter retries transient rate-limit failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "retry-after": "0",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Recovered reply",
              },
            },
          ],
        })
      );

    const adapter = createOpenAIAdapter({
      fetchFn: fetchMock,
      httpPolicy: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
      },
    });

    const completion = await adapter.chatWithAI?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-retry-openai",
      input: "hello",
      context: "",
      model: "gpt-4.1-mini",
    });

    expect(completion?.message).toBe("Recovered reply");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("OpenAI model adapter parses JSON model output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content:
                '{"modelId":"avatar-bot-v2","artifactUrl":"https://example.com/model.glb"}',
            },
          },
        ],
      })
    );

    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });
    const completion = await adapter.generateModel?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-2",
      input: "Build an avatar model",
      context: "Output schema",
      model: "gpt-4.1-mini",
    });

    expect(completion?.modelId).toBe("avatar-bot-v2");
    expect(completion?.artifactUrl?.toString()).toBe("https://example.com/model.glb");
  });

  it("OpenAI image adapter supports base64 image payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "aGVsbG8=" }],
      })
    );

    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });
    const completion = await adapter.generateImage?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-3",
      input: "Draw mountains",
      context: "",
      model: "gpt-image-1",
    });

    expect(completion?.url.toString()).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("creates a Gemini adapter with expected capabilities", () => {
    const adapter = createGeminiAdapter();
    expect(adapter.id).toBe("gemini");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([AICapability.Chat, AICapability.Image, AICapability.Model])
    );
  });

  it("Gemini chat adapter maps generateContent payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Hello from Gemini" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 4,
          totalTokenCount: 7,
        },
      })
    );

    const adapter = createGeminiAdapter({ fetchFn: fetchMock });
    const completion = await adapter.chatWithAI?.({
      userId: "user-2",
      providerId: "gemini",
      apiKey: "gemini-key",
      traceId: "trace-4",
      input: "hello",
      context: "be concise",
      model: "gemini-2.0-flash",
    });

    expect(completion?.message).toBe("Hello from Gemini");
    expect(completion?.usage?.totalTokens).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(typeof url).toBe("string");
    expect(url as string).toContain("/models/gemini-2.0-flash:generateContent");
    expect(url as string).toContain("key=gemini-key");
  });

  it("Gemini adapter retries transient network failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: "Recovered Gemini reply" }],
              },
            },
          ],
        })
      );

    const adapter = createGeminiAdapter({
      fetchFn: fetchMock,
      httpPolicy: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
      },
    });

    const completion = await adapter.chatWithAI?.({
      userId: "user-2",
      providerId: "gemini",
      apiKey: "gemini-key",
      traceId: "trace-retry-gemini",
      input: "hello",
      context: "",
      model: "gemini-2.0-flash",
    });

    expect(completion?.message).toBe("Recovered Gemini reply");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Gemini image adapter maps prediction bytes to data URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        predictions: [
          {
            bytesBase64Encoded: "dGVzdA==",
            mimeType: "image/png",
          },
        ],
      })
    );

    const adapter = createGeminiAdapter({ fetchFn: fetchMock });
    const completion = await adapter.generateImage?.({
      userId: "user-2",
      providerId: "gemini",
      apiKey: "gemini-key",
      traceId: "trace-5",
      input: "Neon skyline",
      context: "",
      model: "imagen-3.0-generate-002",
    });

    expect(completion?.url.toString()).toBe("data:image/png;base64,dGVzdA==");
  });

  it("Gemini model adapter parses JSON text output", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"modelId":"video-agent-v1","artifactUrl":"https://example.com/video-agent.json"}',
                },
              ],
            },
          },
        ],
      })
    );

    const adapter = createGeminiAdapter({ fetchFn: fetchMock });
    const completion = await adapter.generateModel?.({
      userId: "user-2",
      providerId: "gemini",
      apiKey: "gemini-key",
      traceId: "trace-6",
      input: "Build a video workflow model",
      context: "JSON only",
      model: "gemini-2.0-flash",
    });

    expect(completion?.modelId).toBe("video-agent-v1");
    expect(completion?.artifactUrl?.toString()).toBe(
      "https://example.com/video-agent.json"
    );
  });

  it("creates a Grok adapter with expected capabilities", () => {
    const adapter = createGrokAdapter();
    expect(adapter.id).toBe("grok");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([AICapability.Chat, AICapability.Image, AICapability.Model])
    );
  });

  it("Grok adapter uses xAI OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello from Grok",
            },
          },
        ],
      })
    );

    const adapter = createGrokAdapter({ fetchFn: fetchMock });
    const completion = await adapter.chatWithAI?.({
      userId: "user-3",
      providerId: "grok",
      apiKey: "grok-key",
      traceId: "trace-grok-1",
      input: "hello",
      context: "",
      model: "grok-3-mini",
    });

    expect(completion?.message).toBe("Hello from Grok");

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
  });

  it("creates a Meta AI adapter with expected capabilities", () => {
    const adapter = createMetaAIAdapter();
    expect(adapter.id).toBe("meta-ai");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([AICapability.Chat, AICapability.Model])
    );
  });

  it("Meta AI adapter uses Llama-compatible endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello from Meta AI",
            },
          },
        ],
      })
    );

    const adapter = createMetaAIAdapter({ fetchFn: fetchMock });
    const completion = await adapter.chatWithAI?.({
      userId: "user-4",
      providerId: "meta-ai",
      apiKey: "meta-key",
      traceId: "trace-meta-1",
      input: "hello",
      context: "",
      model: "Llama-3.3-70B-Instruct",
    });

    expect(completion?.message).toBe("Hello from Meta AI");

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.llama.com/compat/v1/chat/completions");
  });
});
