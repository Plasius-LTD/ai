import { performance } from "node:perf_hooks";

import {
  AICapability,
  type AdapterChatRequest,
  type AdapterGenerateImageRequest,
  type AdapterGenerateModelRequest,
  type AICapabilityAdapter,
  type ChatCompletion,
  type Completion,
  type ImageCompletion,
  type ModelCompletion,
} from "./index.js";
import { fetchWithPolicy, type HttpClientPolicy } from "./http-resilience.js";

export interface GeminiAdapterOptions {
  id?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  httpPolicy?: HttpClientPolicy;
  defaultModels?: {
    chat?: string;
    image?: string;
    model?: string;
  };
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const normalized = (baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").trim();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolveFetch(fetchFn?: typeof fetch): typeof fetch {
  const resolved = fetchFn ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!resolved) {
    throw new Error("No fetch implementation available for Gemini adapter.");
  }
  return resolved;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
  const nestedError = asRecord(payload.error);
  return (
    asString(nestedError.message) ??
    asString(payload.message) ??
    asString(payload.error) ??
    fallback
  );
}

function requireApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("Gemini API key is required.");
  }
  return trimmed;
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

function extractGeminiText(body: unknown): string {
  const root = asRecord(body);
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object" ? asRecord(candidates[0]) : {};
  const content = asRecord(first.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .map((part) => {
      const maybePart = asRecord(part);
      return asString(maybePart.text) ?? "";
    })
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini response did not contain text output.");
  }
  return text;
}

function extractGeminiUsage(body: unknown): Record<string, number> | undefined {
  const root = asRecord(body);
  const usageMetadata = asRecord(root.usageMetadata);
  const promptTokenCount = usageMetadata.promptTokenCount;
  const candidatesTokenCount = usageMetadata.candidatesTokenCount;
  const totalTokenCount = usageMetadata.totalTokenCount;
  const usage: Record<string, number> = {};

  if (typeof promptTokenCount === "number") {
    usage.inputTokens = promptTokenCount;
  }
  if (typeof candidatesTokenCount === "number") {
    usage.outputTokens = candidatesTokenCount;
  }
  if (typeof totalTokenCount === "number") {
    usage.totalTokens = totalTokenCount;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function extractGeminiImage(body: unknown): URL {
  const root = asRecord(body);
  const predictions = Array.isArray(root.predictions) ? root.predictions : [];
  const firstPrediction =
    predictions[0] && typeof predictions[0] === "object"
      ? asRecord(predictions[0])
      : {};

  const bytesBase64Encoded =
    asString(firstPrediction.bytesBase64Encoded) ??
    asString(asRecord(firstPrediction.image).bytesBase64Encoded);

  if (!bytesBase64Encoded) {
    throw new Error("Gemini image response did not contain base64 image bytes.");
  }

  const mimeType =
    asString(firstPrediction.mimeType) ??
    asString(asRecord(firstPrediction.image).mimeType) ??
    "image/png";

  return new URL(`data:${mimeType};base64,${bytesBase64Encoded}`);
}

function parseGeneratedModel(text: string): {
  modelId: string;
  artifactUrl?: URL;
} {
  const trimmed = text.trim();
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
    // Fallback below.
  }

  return {
    modelId: trimmed,
  };
}

function withApiKey(path: string, apiKey: string): string {
  const delimiter = path.includes("?") ? "&" : "?";
  return `${path}${delimiter}key=${encodeURIComponent(apiKey)}`;
}

export function createGeminiAdapter(
  options: GeminiAdapterOptions = {}
): AICapabilityAdapter {
  const providerId = (options.id ?? "gemini").trim() || "gemini";
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher = resolveFetch(options.fetchFn);

  const chatWithAI = async (request: AdapterChatRequest): Promise<ChatCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel = request.model || options.defaultModels?.chat || "gemini-2.0-flash";

    const response = await fetchWithPolicy({
      url: withApiKey(`${baseUrl}/models/${resolvedModel}:generateContent`, apiKey),
      operation: "Gemini chat request",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/gemini-adapter",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: request.input }],
            },
          ],
          ...(request.context
            ? {
                systemInstruction: {
                  parts: [{ text: request.context }],
                },
              }
            : {}),
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `Gemini chat request failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const message = extractGeminiText(body);
    const usage = extractGeminiUsage(body);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("chat", resolvedModel, request.userId, durationMs, usage);

    return {
      ...base,
      message,
      outputUser: "assistant",
    };
  };

  const generateImage = async (
    request: AdapterGenerateImageRequest
  ): Promise<ImageCompletion> => {
    const startedAt = performance.now();
    const apiKey = requireApiKey(request.apiKey);
    const resolvedModel =
      request.model || options.defaultModels?.image || "imagen-3.0-generate-002";
    const combinedPrompt = request.context
      ? `${request.context}\n\n${request.input}`
      : request.input;

    const response = await fetchWithPolicy({
      url: withApiKey(`${baseUrl}/models/${resolvedModel}:predict`, apiKey),
      operation: "Gemini image generation",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/gemini-adapter",
        },
        body: JSON.stringify({
          instances: [{ prompt: combinedPrompt }],
          parameters: { sampleCount: 1 },
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `Gemini image generation failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const url = extractGeminiImage(body);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("image", resolvedModel, request.userId, durationMs);

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
    const resolvedModel = request.model || options.defaultModels?.model || "gemini-2.0-flash";

    const systemInstruction = [
      request.context,
      "Return JSON only with fields modelId (string) and optional artifactUrl (string URL).",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetchWithPolicy({
      url: withApiKey(`${baseUrl}/models/${resolvedModel}:generateContent`, apiKey),
      operation: "Gemini model generation",
      fetchFn: fetcher,
      policy: options.httpPolicy,
      createRequestInit: () => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": request.traceId,
          "X-Plasius-Client": "@plasius/ai/gemini-adapter",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: request.input }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }),
      }),
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw new Error(
        resolveErrorMessage(
          body,
          `Gemini model generation failed (${response.status} ${response.statusText}).`
        )
      );
    }

    const text = extractGeminiText(body);
    const parsed = parseGeneratedModel(text);
    const usage = extractGeminiUsage(body);
    const durationMs = performance.now() - startedAt;
    const base = createBaseCompletion("model", resolvedModel, request.userId, durationMs, usage);

    return {
      ...base,
      modelId: parsed.modelId,
      artifactUrl: parsed.artifactUrl,
    };
  };

  return {
    id: providerId,
    capabilities: [AICapability.Chat, AICapability.Image, AICapability.Model],
    chatWithAI,
    generateImage,
    generateModel,
  };
}
