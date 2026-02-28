import { describe, expect, it } from "vitest";
import {
  AICapability,
  balanceCompletionSchema,
  chatCompletionSchema,
  completionSchema,
  createAdapterPlatform,
  createGeminiAdapter,
  createGrokAdapter,
  createHttpVideoProviderAdapter,
  createMetaAIAdapter,
  createOpenAIAdapter,
  createPixelverseAdapter,
  createVideoProviderPlatform,
  imageCompletionSchema,
  modelCompletionSchema,
  speechCompletionSchema,
  textCompletionSchema,
  videoCompletionSchema,
} from "../src/platform/index.js";

describe("@plasius/ai platform exports", () => {
  it("exports stable capability enum values", () => {
    expect(AICapability.Chat).toBe(0);
    expect(AICapability.Video).toBe(4);
    expect(AICapability.Balance).toBe(5);
    expect(AICapability.Model).toBe(6);
  });

  it("exports completion schemas", () => {
    expect(completionSchema).toBeDefined();
    expect(chatCompletionSchema).toBeDefined();
    expect(textCompletionSchema).toBeDefined();
    expect(imageCompletionSchema).toBeDefined();
    expect(speechCompletionSchema).toBeDefined();
    expect(videoCompletionSchema).toBeDefined();
    expect(balanceCompletionSchema).toBeDefined();
    expect(modelCompletionSchema).toBeDefined();
  });

  it("exports generic provider adapter helpers", () => {
    expect(createAdapterPlatform).toBeDefined();
    expect(createOpenAIAdapter).toBeDefined();
    expect(createGeminiAdapter).toBeDefined();
    expect(createGrokAdapter).toBeDefined();
    expect(createMetaAIAdapter).toBeDefined();
    expect(createPixelverseAdapter).toBeDefined();
    expect(createHttpVideoProviderAdapter).toBeDefined();
    expect(createVideoProviderPlatform).toBeDefined();
  });
});
