import { performance } from "node:perf_hooks";

import {
  AICapability,
  type AIPlatform,
  type BalanceCompletion,
  type ChatCompletion,
  type Completion,
  type ImageCompletion,
  type ModelCompletion,
  type SpeechCompletion,
  type TextCompletion,
  type VideoCompletion,
} from "./index.js";

export interface AdapterRequestContext {
  userId: string;
  providerId: string;
  apiKey: string;
  traceId: string;
}

export interface AdapterChatRequest extends AdapterRequestContext {
  input: string;
  context: string;
  model: string;
}

export interface AdapterSynthesizeSpeechRequest extends AdapterRequestContext {
  input: string;
  voice: string;
  context: string;
  model: string;
}

export interface AdapterTranscribeSpeechRequest extends AdapterRequestContext {
  input: Buffer;
  context: string;
  model: string;
}

export interface AdapterGenerateImageRequest extends AdapterRequestContext {
  input: string;
  context: string;
  model: string;
}

export interface AdapterVideoRequest extends AdapterRequestContext {
  input: string;
  image: URL;
  context: string;
  model: string;
}

export interface AdapterGenerateModelRequest extends AdapterRequestContext {
  input: string;
  context: string;
  model: string;
}

export interface AdapterBalanceRequest extends AdapterRequestContext {}

export interface AICapabilityAdapter {
  id: string;
  capabilities: AICapability[];
  canHandle?: (capabilities: AICapability[]) => Promise<boolean> | boolean;
  chatWithAI?: (request: AdapterChatRequest) => Promise<ChatCompletion>;
  synthesizeSpeech?: (
    request: AdapterSynthesizeSpeechRequest
  ) => Promise<SpeechCompletion>;
  transcribeSpeech?: (
    request: AdapterTranscribeSpeechRequest
  ) => Promise<TextCompletion>;
  generateImage?: (
    request: AdapterGenerateImageRequest
  ) => Promise<ImageCompletion>;
  produceVideo?: (request: AdapterVideoRequest) => Promise<VideoCompletion>;
  generateModel?: (
    request: AdapterGenerateModelRequest
  ) => Promise<ModelCompletion>;
  checkBalance?: (request: AdapterBalanceRequest) => Promise<BalanceCompletion>;
}

export interface AdapterPlatformProps {
  adapters: AICapabilityAdapter[];
  apiKeys: Record<string, string>;
  defaultAdapterByCapability?: Partial<Record<AICapability, string>>;
}

type AdapterOperationMethod =
  | "chatWithAI"
  | "synthesizeSpeech"
  | "transcribeSpeech"
  | "generateImage"
  | "produceVideo"
  | "generateModel"
  | "checkBalance";

interface ResolvedAdapter {
  adapter: AICapabilityAdapter;
  apiKey: string;
}

function createCompletionBase(
  type: string,
  model: string,
  requestor: string,
  durationMs: number
): Completion {
  return {
    partitionKey: requestor,
    id: crypto.randomUUID(),
    type,
    model,
    createdAt: new Date().toISOString(),
    durationMs,
    usage: {},
  };
}

function createAdapterContext(
  requestorId: string,
  adapter: AICapabilityAdapter,
  apiKey: string
): AdapterRequestContext {
  return {
    userId: requestorId,
    providerId: adapter.id,
    apiKey,
    traceId: crypto.randomUUID(),
  };
}

function requiresOperationalMethod(
  capability: AICapability,
  adapter: AICapabilityAdapter
): boolean {
  switch (capability) {
    case AICapability.Chat:
      return typeof adapter.chatWithAI === "function";
    case AICapability.Text:
      return true;
    case AICapability.Speech:
      return (
        typeof adapter.synthesizeSpeech === "function" ||
        typeof adapter.transcribeSpeech === "function"
      );
    case AICapability.Image:
      return typeof adapter.generateImage === "function";
    case AICapability.Video:
      return typeof adapter.produceVideo === "function";
    case AICapability.Balance:
      return typeof adapter.checkBalance === "function";
    case AICapability.Model:
      return typeof adapter.generateModel === "function";
    default:
      return false;
  }
}

export async function createAdapterPlatform(
  userId: string,
  props: AdapterPlatformProps
): Promise<AIPlatform> {
  const adapterById = new Map<string, AICapabilityAdapter>();

  for (const adapter of props.adapters) {
    if (!adapter.id || adapter.id.trim().length === 0) {
      throw new Error("Adapter id must be a non-empty string.");
    }
    if (adapterById.has(adapter.id)) {
      throw new Error(`Duplicate adapter id "${adapter.id}" detected.`);
    }
    adapterById.set(adapter.id, adapter);
  }

  const resolveApiKey = (providerId: string): string | undefined => {
    const value = props.apiKeys[providerId];
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const resolveAdapter = (
    capability: AICapability,
    method: AdapterOperationMethod,
    options: { required: boolean }
  ): ResolvedAdapter | undefined => {
    const configuredId = props.defaultAdapterByCapability?.[capability];

    const fail = (message: string): undefined => {
      if (options.required) {
        throw new Error(message);
      }
      return undefined;
    };

    if (configuredId) {
      const configured = adapterById.get(configuredId);
      if (!configured) {
        return fail(
          `Configured adapter "${configuredId}" for capability "${capability}" was not found.`
        );
      }
      if (!configured.capabilities.includes(capability)) {
        return fail(
          `Configured adapter "${configuredId}" does not declare capability "${capability}".`
        );
      }
      if (typeof configured[method] !== "function") {
        return fail(
          `Configured adapter "${configuredId}" does not implement "${method}" for capability "${capability}".`
        );
      }
      const apiKey = resolveApiKey(configured.id);
      if (!apiKey) {
        return fail(`Missing API key for configured adapter "${configured.id}".`);
      }
      return { adapter: configured, apiKey };
    }

    const fallback = props.adapters.find((candidate) => {
      return (
        candidate.capabilities.includes(capability) &&
        typeof candidate[method] === "function"
      );
    });

    if (!fallback) {
      return fail(
        `No adapter found for capability "${capability}" implementing "${method}".`
      );
    }

    const apiKey = resolveApiKey(fallback.id);
    if (!apiKey) {
      return fail(`Missing API key for adapter "${fallback.id}".`);
    }

    return { adapter: fallback, apiKey };
  };

  const canHandle = async (
    _requestorId: string,
    capabilities: AICapability[]
  ): Promise<boolean> => {
    for (const capability of capabilities) {
      const configuredId = props.defaultAdapterByCapability?.[capability];
      const adapter = configuredId
        ? adapterById.get(configuredId)
        : props.adapters.find((candidate) =>
            candidate.capabilities.includes(capability)
          );

      if (!adapter) {
        return false;
      }

      if (!adapter.capabilities.includes(capability)) {
        return false;
      }

      if (!resolveApiKey(adapter.id)) {
        return false;
      }

      if (!requiresOperationalMethod(capability, adapter)) {
        return false;
      }

      if (adapter.canHandle) {
        const accepted = await adapter.canHandle([capability]);
        if (!accepted) {
          return false;
        }
      }
    }

    return true;
  };

  const chatWithAI = async (
    requestorId: string,
    input: string,
    context: string,
    model: string
  ): Promise<ChatCompletion> => {
    const resolved = resolveAdapter(AICapability.Chat, "chatWithAI", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.chatWithAI!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        context,
        model,
      }
    );
  };

  const synthesizeSpeech = async (
    requestorId: string,
    input: string,
    voice: string,
    context: string,
    model: string
  ): Promise<SpeechCompletion> => {
    const resolved = resolveAdapter(AICapability.Speech, "synthesizeSpeech", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.synthesizeSpeech!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        voice,
        context,
        model,
      }
    );
  };

  const transcribeSpeech = async (
    requestorId: string,
    input: Buffer,
    context: string,
    model: string
  ): Promise<TextCompletion> => {
    const resolved = resolveAdapter(AICapability.Speech, "transcribeSpeech", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.transcribeSpeech!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        context,
        model,
      }
    );
  };

  const generateImage = async (
    requestorId: string,
    input: string,
    context: string,
    model: string
  ): Promise<ImageCompletion> => {
    const resolved = resolveAdapter(AICapability.Image, "generateImage", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.generateImage!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        context,
        model,
      }
    );
  };

  const produceVideo = async (
    requestorId: string,
    input: string,
    image: URL,
    context: string,
    model: string
  ): Promise<VideoCompletion> => {
    const resolved = resolveAdapter(AICapability.Video, "produceVideo", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.produceVideo!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        image,
        context,
        model,
      }
    );
  };

  const generateModel = async (
    requestorId: string,
    input: string,
    context: string,
    model: string
  ): Promise<ModelCompletion> => {
    const resolved = resolveAdapter(AICapability.Model, "generateModel", {
      required: true,
    }) as ResolvedAdapter;
    return resolved.adapter.generateModel!(
      {
        ...createAdapterContext(requestorId, resolved.adapter, resolved.apiKey),
        input,
        context,
        model,
      }
    );
  };

  const checkBalance = async (requestorId: string): Promise<BalanceCompletion> => {
    const startedAt = performance.now();
    const resolved = resolveAdapter(AICapability.Balance, "checkBalance", {
      required: false,
    });

    if (!resolved || !resolved.adapter.checkBalance) {
      const durationMs = performance.now() - startedAt;
      const base = createCompletionBase(
        "balanceCompletion",
        "",
        requestorId,
        durationMs
      );
      return {
        ...base,
        balance: 0,
      };
    }

    return resolved.adapter.checkBalance(
      createAdapterContext(requestorId, resolved.adapter, resolved.apiKey)
    );
  };

  const currentBalance = (await checkBalance(userId)).balance;

  return {
    canHandle,
    chatWithAI,
    synthesizeSpeech,
    transcribeSpeech,
    generateImage,
    produceVideo,
    generateModel,
    checkBalance,
    currentBalance,
  };
}
