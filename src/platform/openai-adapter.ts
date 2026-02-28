import { performance } from "node:perf_hooks";

import {
  AICapability,
  type AICapabilityAdapter,
  type AdapterBalanceRequest,
  type AdapterChatRequest,
  type AdapterGenerateImageRequest,
  type AdapterGenerateModelRequest,
  type AdapterSynthesizeSpeechRequest,
  type AdapterTranscribeSpeechRequest,
  type BalanceCompletion,
  type ChatCompletion,
  type Completion,
  type ImageCompletion,
  type ModelCompletion,
  type SpeechCompletion,
  type TextCompletion,
} from "./index.js";
import { fetchWithPolicy, type HttpClientPolicy } from "./http-resilience.js";

interface OpenAIUsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface OpenAIAdapterOptions {
  id?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  httpPolicy?: HttpClientPolicy;
  defaultModels?: {
    chat?: string;
    speech?: string;
    transcription?: string;
    image?: string;
    model?: string;
  };
  speech?: {
    voice?: string;
    format?: "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm";
  };
  image?: {
    size?: string;
  };
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const normalized = (baseUrl ?? "https://api.openai.com/v1").trim();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolveFetch(fetchFn?: typeof fetch): typeof fetch {
  const resolved = fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!resolved) {
    throw new Error("No fetch implementation available for OpenAI adapter.");
  }
  return resolved;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function resolveErrorMessage(body: unknown, fallback: string): string {
  const payload = asRecord(body);
  const nested = asRecord(payload.error);
  return (
    asString(nested.message) ??
    asString(payload.message) ??
    asString(payload.error) ??
    fallback
  );
}

function requireApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("OpenAI API key is required.");
  }
  return trimmed;
}

function usageFromPayload(payload: unknown): Record<string, number> | undefined {
  const usagePayload = asRecord(payload) as OpenAIUsagePayload;
  const inputTokens = usagePayload.prompt_tokens ?? usagePayload.input_tokens;
  const outputTokens = usagePayload.completion_tokens ?? usagePayload.output_tokens;
  const totalTokens = usagePayload.total_tokens;

  const usage: Record<string, number> = {};
  if (asNumber(inputTokens) !== undefined) {
    usage.inputTokens = inputTokens as number;
  }
  if (asNumber(outputTokens) !== undefined) {
    usage.outputTokens = outputTokens as number;
  }
  if (asNumber(totalTokens) !== undefined) {
    usage.totalTokens = totalTokens as number;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function createBaseCompletion(
  type: string,
  model: string,
  requestor: string,
  durationMs: number,
  usage?: Record<string, number>
): Completion {
  return {
    partitionKey: requestor,
    id: crypto.randomUUID(),
    type,
    model,
    createdAt: new Date().toISOString(),
    durationMs,
    usage: usage ?? {},
  };
}

function extractChatMessage(body: unknown): string {
  const root = asRecord(body);
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices[0] && typeof choices[0] === "object" ? asRecord(choices[0]) : {};
  const message = asRecord(firstChoice.message);
  const content = message.content;

  if (typeof content === "string" && content.length > 0) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        const maybePart = asRecord(part);
        return asString(maybePart.text) ?? "";
      })
      .join("")
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("OpenAI chat response did not contain assistant content.");
}

function extractImageUrl(body: unknown): URL {
  const root = asRecord(body);
  const data = Array.isArray(root.data) ? root.data : [];
  const first = data[0] && typeof data[0] === "object" ? asRecord(data[0]) : {};
  const url = asString(first.url);
  const b64 = asString(first.b64_json);

  if (url) {
    return new URL(url);
  }
  if (b64) {
    return new URL(`data:image/png;base64,${b64}`);
  }

  throw new Error("OpenAI image generation response did not contain image data.");
}

function extractTranscriptionText(body: unknown): string {
  const root = asRecord(body);
  const text = asString(root.text) ?? asString(root.output_text);
  if (!text) {
    throw new Error("OpenAI transcription response did not contain text.");
  }
  return text;
}

function parseGeneratedModel(content: string): {
  modelId: string;
  artifactUrl?: URL;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      modelId: crypto.randomUUID(),
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const root = asRecord(parsed);
    const modelId = asString(root.modelId);
    const artifactUrl = asString(root.artifactUrl);
    if (modelId) {
      return {
        modelId,
        artifactUrl: artifactUrl ? new URL(artifactUrl) : undefined,
      };
    }
  } catch {
    // Fallback to plain text handling below.
  }

  return {
    modelId: trimmed,
  };
}

export function createOpenAIAdapter(
  options: OpenAIAdapterOptions = {}
): AICapabilityAdapter {
  const providerId = (options.id ?? "openai").trim() || "openai";
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher = resolveFetch(options.fetchFn);

  const chatWithAI = async (request: AdapterChatRequest): Promise<ChatCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.chat || "gpt-4.1-mini";

    const response = await fetchWithPolicy({
      url: `${baseUrl}/chat/completions`,
      operation: "OpenAI chat request",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.traceId,
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/openai-adapter",
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            ...(request.context
              ? [{ role: "system", content: request.context }]
              : []),
            { role: "user", content: request.input },
          ],
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `OpenAI chat request failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const message = extractChatMessage(body);
    const usage = usageFromPayload(asRecord(body).usage);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("chat", resolvedModel, request.userId, durationMs, usage);

    return {
      ...base,
      message,
      outputUser: "assistant",
    };
  };

  const synthesizeSpeech = async (
    request: AdapterSynthesizeSpeechRequest
  ): Promise<SpeechCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.speech || "gpt-4o-mini-tts";
    const resolvedVoice = request.voice || options.speech?.voice || "alloy";
    const resolvedFormat = options.speech?.format ?? "mp3";

    const response = await fetchWithPolicy({
      url: `${baseUrl}/audio/speech`,
      operation: "OpenAI speech synthesis",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.traceId,
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/openai-adapter",
        },
        body: JSON.stringify({
          model: resolvedModel,
          input: request.input,
          voice: resolvedVoice,
          format: resolvedFormat,
        }),
      }),
    });

    if (!response.ok) {
      const errorBody = await parseResponseBody(response);
      throw new Error(
        resolveErrorMessage(
          errorBody,
          `OpenAI speech synthesis failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const mimeTypeHeader = response.headers.get("content-type");
    const mimeType = (mimeTypeHeader?.split(";")[0]?.trim() || "audio/mpeg").toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("speech", resolvedModel, request.userId, durationMs);

    return {
      ...base,
      url: new URL(`data:${mimeType};base64,${bytes}`),
    };
  };

  const transcribeSpeech = async (
    request: AdapterTranscribeSpeechRequest
  ): Promise<TextCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.transcription || "gpt-4o-mini-transcribe";

    const response = await fetchWithPolicy({
      url: `${baseUrl}/audio/transcriptions`,
      operation: "OpenAI transcription",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => {
        const formData = new FormData();
        formData.append("model", resolvedModel);
        const fileBytes = Uint8Array.from(request.input);
        formData.append(
          "file",
          new Blob([fileBytes], { type: "application/octet-stream" }),
          "audio.webm"
        );

        return {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Idempotency-Key": request.traceId,
            "X-Request-Id": request.traceId,
            "X-Plasius-Client": "@plasius/ai/openai-adapter",
          },
          body: formData,
        };
      },
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `OpenAI transcription failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const message = extractTranscriptionText(body);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("text", resolvedModel, request.userId, durationMs);

    return {
      ...base,
      message,
    };
  };

  const generateImage = async (
    request: AdapterGenerateImageRequest
  ): Promise<ImageCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.image || "gpt-image-1";
    const combinedPrompt = request.context
      ? `${request.context}\n\n${request.input}`
      : request.input;

    const response = await fetchWithPolicy({
      url: `${baseUrl}/images/generations`,
      operation: "OpenAI image generation",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.traceId,
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/openai-adapter",
        },
        body: JSON.stringify({
          model: resolvedModel,
          prompt: combinedPrompt,
          size: options.image?.size ?? "1024x1024",
          response_format: "b64_json",
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `OpenAI image generation failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const url = extractImageUrl(body);
    const usage = usageFromPayload(asRecord(body).usage);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("image", resolvedModel, request.userId, durationMs, usage);

    return {
      ...base,
      url,
    };
  };

  const generateModel = async (
    request: AdapterGenerateModelRequest
  ): Promise<ModelCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.model || "gpt-4.1-mini";
    const systemInstruction = [
      request.context,
      "Return JSON only with fields modelId (string) and optional artifactUrl (string URL).",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetchWithPolicy({
      url: `${baseUrl}/chat/completions`,
      operation: "OpenAI model generation",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": request.traceId,
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/openai-adapter",
        },
        body: JSON.stringify({
          model: resolvedModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: request.input },
          ],
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `OpenAI model generation failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const responseText = extractChatMessage(body);
    const parsed = parseGeneratedModel(responseText);
    const usage = usageFromPayload(asRecord(body).usage);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("model", resolvedModel, request.userId, durationMs, usage);

    return {
      ...base,
      modelId: parsed.modelId,
      artifactUrl: parsed.artifactUrl,
    };
  };

  const checkBalance = async (request: AdapterBalanceRequest): Promise<BalanceCompletion> => {
    const startedAt = performance.now();
    const resolvedModel = options.defaultModels?.chat ?? "";
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion(
      "balanceCompletion",
      resolvedModel,
      request.userId,
      durationMs
    );

    return {
      ...base,
      balance: 0,
    };
  };

  return {
    id: providerId,
    capabilities: [
      AICapability.Chat,
      AICapability.Speech,
      AICapability.Image,
      AICapability.Model,
      AICapability.Balance,
    ],
    chatWithAI,
    synthesizeSpeech,
    transcribeSpeech,
    generateImage,
    generateModel,
    checkBalance,
  };
}
