import { describe, expect, it, vi } from "vitest";

import { AICapability, createOpenAIAdapter } from "../src/platform/index.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(text: string, status = 500): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function binaryResponse(
  bytes: number[],
  contentType = "audio/wav",
  status = 200
): Response {
  return new Response(new Uint8Array(bytes), {
    status,
    headers: { "Content-Type": contentType },
  });
}

describe("OpenAI adapter extended behavior", () => {
  it("exposes expected provider metadata", () => {
    const adapter = createOpenAIAdapter();

    expect(adapter.id).toBe("openai");
    expect(adapter.capabilities).toEqual(
      expect.arrayContaining([
        AICapability.Chat,
        AICapability.Speech,
        AICapability.Image,
        AICapability.Model,
        AICapability.Balance,
      ])
    );
  });

  it("synthesizes speech into a data URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      binaryResponse([1, 2, 3, 4], "audio/wav")
    );
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    const completion = await adapter.synthesizeSpeech?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-speech-1",
      input: "hello",
      context: "ctx",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
    });

    expect(completion?.url.toString()).toBe("data:audio/wav;base64,AQIDBA==");
  });

  it("surfaces speech endpoint errors with plain-text responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(textResponse("audio failed", 500));
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    await expect(
      adapter.synthesizeSpeech?.({
        userId: "user-1",
        providerId: "openai",
        apiKey: "openai-key",
        traceId: "trace-speech-2",
        input: "hello",
        context: "ctx",
        model: "gpt-4o-mini-tts",
        voice: "alloy",
      })
    ).rejects.toThrow();
  });

  it("transcribes speech from output_text payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ output_text: "transcribed words" })
    );
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    const completion = await adapter.transcribeSpeech?.({
      userId: "user-1",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-transcribe-1",
      input: Buffer.from([9, 8, 7]),
      context: "ctx",
      model: "gpt-4o-mini-transcribe",
    });

    expect(completion?.message).toBe("transcribed words");
  });

  it("throws when transcription response does not include text", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}));
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    await expect(
      adapter.transcribeSpeech?.({
        userId: "user-1",
        providerId: "openai",
        apiKey: "openai-key",
        traceId: "trace-transcribe-2",
        input: Buffer.from([1, 2]),
        context: "",
        model: "gpt-4o-mini-transcribe",
      })
    ).rejects.toThrow("did not contain text");
  });

  it("supports URL-style image payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ url: "https://images.example.com/final.png" }],
        usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 },
      })
    );
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    const completion = await adapter.generateImage?.({
      userId: "user-2",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-image-1",
      input: "sunset beach",
      context: "high contrast",
      model: "gpt-image-1",
    });

    expect(completion?.url.toString()).toBe("https://images.example.com/final.png");
    expect(completion?.usage?.totalTokens).toBe(6);
  });

  it("fails image generation when payload has no image data", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }));
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    await expect(
      adapter.generateImage?.({
        userId: "user-2",
        providerId: "openai",
        apiKey: "openai-key",
        traceId: "trace-image-2",
        input: "prompt",
        context: "",
        model: "gpt-image-1",
      })
    ).rejects.toThrow("did not contain image data");
  });

  it("parses plain-text model outputs when JSON is not returned", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "model-id-direct-text",
            },
          },
        ],
      })
    );
    const adapter = createOpenAIAdapter({ fetchFn: fetchMock });

    const completion = await adapter.generateModel?.({
      userId: "user-3",
      providerId: "openai",
      apiKey: "openai-key",
      traceId: "trace-model-1",
      input: "generate model",
      context: "json preferred",
      model: "gpt-4.1-mini",
    });

    expect(completion?.modelId).toBe("model-id-direct-text");
  });

  it("returns zero balance completion", async () => {
    const adapter = createOpenAIAdapter();

    const completion = await adapter.checkBalance?.({
      userId: "user-4",
      providerId: "openai",
      traceId: "trace-balance-1",
    });

    expect(completion?.balance).toBe(0);
    expect(completion?.type).toBe("balanceCompletion");
  });

  it("throws when required API key is blank", async () => {
    const adapter = createOpenAIAdapter({ fetchFn: vi.fn<typeof fetch>() });

    await expect(
      adapter.chatWithAI?.({
        userId: "user-5",
        providerId: "openai",
        apiKey: "  ",
        traceId: "trace-chat-blank-key",
        input: "hello",
        context: "",
        model: "gpt-4.1-mini",
      })
    ).rejects.toThrow("OpenAI API key is required.");
  });
});
