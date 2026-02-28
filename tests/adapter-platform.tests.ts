import { describe, expect, it } from "vitest";

import {
  AICapability,
  createAdapterPlatform,
  type AICapabilityAdapter,
  type AdapterChatRequest,
} from "../src/platform/index.js";

function baseCompletion(userId: string, type: string, model: string) {
  return {
    id: `${type}-1`,
    partitionKey: userId,
    type,
    model,
    durationMs: 1,
    createdAt: "2026-02-28T00:00:00.000Z",
    usage: {},
  };
}

describe("createAdapterPlatform", () => {
  it("routes chat requests and injects the developer-supplied API key", async () => {
    let received: AdapterChatRequest | undefined;

    const adapter: AICapabilityAdapter = {
      id: "chat-provider",
      capabilities: [AICapability.Chat],
      chatWithAI: async (request) => {
        received = request;
        return {
          ...baseCompletion(request.userId, "chat", request.model),
          message: "hello",
          outputUser: "assistant",
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [adapter],
      apiKeys: {
        "chat-provider": "chat-key-123",
      },
    });

    const completion = await platform.chatWithAI(
      "user-1",
      "hello",
      "ctx",
      "gpt-4.1-mini"
    );

    expect(completion.message).toBe("hello");
    expect(received?.apiKey).toBe("chat-key-123");
    expect(received?.providerId).toBe("chat-provider");
  });

  it("uses explicit capability routing when default adapters are configured", async () => {
    const primary: AICapabilityAdapter = {
      id: "primary-image",
      capabilities: [AICapability.Image],
      generateImage: async (request) => {
        return {
          ...baseCompletion(request.userId, "image", request.model),
          url: new URL("https://example.com/primary.png"),
        };
      },
    };

    const secondary: AICapabilityAdapter = {
      id: "secondary-image",
      capabilities: [AICapability.Image],
      generateImage: async (request) => {
        return {
          ...baseCompletion(request.userId, "image", request.model),
          url: new URL("https://example.com/secondary.png"),
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [primary, secondary],
      apiKeys: {
        "primary-image": "key-primary",
        "secondary-image": "key-secondary",
      },
      defaultAdapterByCapability: {
        [AICapability.Image]: "secondary-image",
      },
    });

    const completion = await platform.generateImage(
      "user-1",
      "landscape",
      "ctx",
      "image-model"
    );

    expect(completion.url.toString()).toBe("https://example.com/secondary.png");
  });

  it("throws when a required capability key is not supplied by the package consumer", async () => {
    const adapter: AICapabilityAdapter = {
      id: "image-provider",
      capabilities: [AICapability.Image],
      generateImage: async (request) => {
        return {
          ...baseCompletion(request.userId, "image", request.model),
          url: new URL("https://example.com/image.png"),
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [adapter],
      apiKeys: {},
    });

    await expect(
      platform.generateImage("user-1", "prompt", "ctx", "img-model")
    ).rejects.toThrow(/Missing API key/);
  });

  it("supports model-generation adapters", async () => {
    const adapter: AICapabilityAdapter = {
      id: "model-provider",
      capabilities: [AICapability.Model],
      generateModel: async (request) => {
        return {
          ...baseCompletion(request.userId, "model", request.model),
          modelId: `model-${request.input}`,
          artifactUrl: new URL("https://example.com/models/model.bin"),
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [adapter],
      apiKeys: {
        "model-provider": "model-key",
      },
    });

    const completion = await platform.generateModel(
      "user-1",
      "voice-bot-v1",
      "ctx",
      "model-builder"
    );

    expect(completion.modelId).toBe("model-voice-bot-v1");
  });

  it("falls back to zero balance when no balance adapter is registered", async () => {
    const adapter: AICapabilityAdapter = {
      id: "chat-provider",
      capabilities: [AICapability.Chat],
      chatWithAI: async (request) => {
        return {
          ...baseCompletion(request.userId, "chat", request.model),
          message: "ok",
          outputUser: "assistant",
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [adapter],
      apiKeys: {
        "chat-provider": "chat-key",
      },
    });

    const balance = await platform.checkBalance("user-1");
    expect(balance.balance).toBe(0);
    expect(platform.currentBalance).toBe(0);
  });

  it("reports unsupported capabilities through canHandle", async () => {
    const adapter: AICapabilityAdapter = {
      id: "chat-provider",
      capabilities: [AICapability.Chat],
      chatWithAI: async (request) => {
        return {
          ...baseCompletion(request.userId, "chat", request.model),
          message: "ok",
          outputUser: "assistant",
        };
      },
    };

    const platform = await createAdapterPlatform("user-1", {
      adapters: [adapter],
      apiKeys: {
        "chat-provider": "chat-key",
      },
    });

    const canChat = await platform.canHandle?.("user-1", [AICapability.Chat]);
    const canModel = await platform.canHandle?.("user-1", [AICapability.Model]);

    expect(canChat).toBe(true);
    expect(canModel).toBe(false);
  });
});
