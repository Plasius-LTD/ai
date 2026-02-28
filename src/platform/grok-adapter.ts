import {
  AICapability,
  type AICapabilityAdapter,
} from "./index.js";
import { createOpenAIAdapter, type OpenAIAdapterOptions } from "./openai-adapter.js";

export interface GrokAdapterOptions
  extends Omit<OpenAIAdapterOptions, "id" | "baseUrl" | "defaultModels"> {
  id?: string;
  baseUrl?: string;
  defaultModels?: {
    chat?: string;
    image?: string;
    model?: string;
  };
}

export function createGrokAdapter(
  options: GrokAdapterOptions = {}
): AICapabilityAdapter {
  const base = createOpenAIAdapter({
    ...options,
    id: options.id ?? "grok",
    baseUrl: options.baseUrl ?? "https://api.x.ai/v1",
    defaultModels: {
      chat: options.defaultModels?.chat ?? "grok-3-mini",
      image: options.defaultModels?.image ?? "grok-2-image-1212",
      model: options.defaultModels?.model ?? "grok-3-mini",
    },
  });

  return {
    id: base.id,
    capabilities: [AICapability.Chat, AICapability.Image, AICapability.Model],
    chatWithAI: base.chatWithAI,
    generateImage: base.generateImage,
    generateModel: base.generateModel,
  };
}
