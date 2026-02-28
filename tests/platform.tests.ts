import { describe, expect, it } from "vitest";
import {
  AICapability,
  balanceCompletionSchema,
  chatCompletionSchema,
  completionSchema,
  createHttpVideoProviderAdapter,
  createVideoProviderPlatform,
  imageCompletionSchema,
  speechCompletionSchema,
  textCompletionSchema,
  videoCompletionSchema,
} from "../src/platform/index.js";

describe("@plasius/ai platform exports", () => {
  it("exports stable capability enum values", () => {
    expect(AICapability.Chat).toBe(0);
    expect(AICapability.Video).toBe(4);
    expect(AICapability.Balance).toBe(5);
  });

  it("exports completion schemas", () => {
    expect(completionSchema).toBeDefined();
    expect(chatCompletionSchema).toBeDefined();
    expect(textCompletionSchema).toBeDefined();
    expect(imageCompletionSchema).toBeDefined();
    expect(speechCompletionSchema).toBeDefined();
    expect(videoCompletionSchema).toBeDefined();
    expect(balanceCompletionSchema).toBeDefined();
  });

  it("exports generic provider adapter helpers", () => {
    expect(createHttpVideoProviderAdapter).toBeDefined();
    expect(createVideoProviderPlatform).toBeDefined();
  });
});
