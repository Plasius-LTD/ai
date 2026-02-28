import {
  AICapability,
  type AICapabilityAdapter,
} from "./index.js";
import { createOpenAIAdapter, type OpenAIAdapterOptions } from "./openai-adapter.js";

export interface MetaAIAdapterOptions
  extends Omit<OpenAIAdapterOptions, "id" | "baseUrl" | "defaultModels"> {
  id?: string;
  baseUrl?: string;
  defaultModels?: {
    chat?: string;
    model?: string;
  };
}

export function createMetaAIAdapter(
  options: MetaAIAdapterOptions = {}
): AICapabilityAdapter {
  const base = createOpenAIAdapter({
    ...options,
    id: options.id ?? "meta-ai",
    baseUrl: options.baseUrl ?? "https://api.llama.com/compat/v1",
    defaultModels: {
      chat: options.defaultModels?.chat ?? "Llama-3.3-70B-Instruct",
      model: options.defaultModels?.model ?? "Llama-3.3-70B-Instruct",
    },
  });

  return {
    id: base.id,
    capabilities: [AICapability.Chat, AICapability.Model],
    chatWithAI: base.chatWithAI,
    generateModel: base.generateModel,
  };
}
