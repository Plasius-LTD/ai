import { performance } from "node:perf_hooks";

import {
  AICapability,
  type AdapterBalanceRequest,
  type AdapterVideoRequest,
  type AICapabilityAdapter,
  type BalanceCompletion,
  type Completion,
} from "./index.js";
import type {
  HttpVideoProviderAdapterConfig,
  ProviderBalance,
  VideoGenerationRequest,
  VideoJobResult,
} from "./video-provider-adapter.js";
import { createHttpVideoProviderAdapter } from "./video-provider-adapter.js";

export interface PixelverseAdapterOptions {
  id?: string;
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
  httpPolicy?: HttpVideoProviderAdapterConfig["httpPolicy"];
  polling?: {
    maxRetries?: number;
    delayMs?: number;
  };
  defaultVideoRequest?: Partial<Omit<VideoGenerationRequest, "imageId" | "prompt">>;
  paths?: {
    uploadImagePath?: string;
    generateVideoPath?: string;
    getVideoResultPath?: (videoId: number) => string;
    getBalancePath?: string;
  };
  mapUploadImageId?: HttpVideoProviderAdapterConfig["mapUploadImageId"];
  mapGeneratedVideoId?: HttpVideoProviderAdapterConfig["mapGeneratedVideoId"];
  mapVideoResult?: HttpVideoProviderAdapterConfig["mapVideoResult"];
  mapBalance?: HttpVideoProviderAdapterConfig["mapBalance"];
  mapGenerateRequestBody?: HttpVideoProviderAdapterConfig["mapGenerateRequestBody"];
  additionalHeaders?: HttpVideoProviderAdapterConfig["additionalHeaders"];
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const normalized = (baseUrl ?? "https://api.pixelverse.ai").trim();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function createCompletionBase(
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

async function waitForCompletion(
  getVideoResult: (
    videoId: number,
    context: { apiKey: string; traceId: string; fetchFn?: typeof fetch }
  ) => Promise<VideoJobResult>,
  videoId: number,
  apiKey: string,
  maxRetries: number,
  delayMs: number,
  fetchFn: typeof fetch | undefined
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const result = await getVideoResult(videoId, {
      apiKey,
      traceId: crypto.randomUUID(),
      fetchFn,
    });

    if (result.state === "completed" && result.videoUrl) {
      return result.videoUrl;
    }

    if (result.state === "failed") {
      throw new Error("Pixelverse video generation failed.");
    }
  }

  throw new Error("Timed out waiting for Pixelverse video completion.");
}

export function createPixelverseAdapter(
  options: PixelverseAdapterOptions = {}
): AICapabilityAdapter {
  const providerId = (options.id ?? "pixelverse").trim() || "pixelverse";
  const baseUrl = normalizeBaseUrl(options.apiBaseUrl);

  const httpAdapter = createHttpVideoProviderAdapter({
    uploadImagePath:
      options.paths?.uploadImagePath ?? `${baseUrl}/openapi/v1/image/upload`,
    generateVideoPath:
      options.paths?.generateVideoPath ?? `${baseUrl}/openapi/v1/video/generate`,
    getVideoResultPath:
      options.paths?.getVideoResultPath ??
      ((videoId: number) => `${baseUrl}/openapi/v1/video/result/${videoId}`),
    getBalancePath:
      options.paths?.getBalancePath ?? `${baseUrl}/openapi/v1/account/balance`,
    httpPolicy: options.httpPolicy,
    mapUploadImageId: options.mapUploadImageId,
    mapGeneratedVideoId: options.mapGeneratedVideoId,
    mapVideoResult: options.mapVideoResult,
    mapBalance: options.mapBalance,
    mapGenerateRequestBody: options.mapGenerateRequestBody,
    additionalHeaders: options.additionalHeaders,
  });

  const maxRetries = options.polling?.maxRetries ?? 20;
  const delayMs = options.polling?.delayMs ?? 3000;

  const produceVideo = async (request: AdapterVideoRequest) => {
    const startedAt = performance.now();
    const combinedPrompt = request.context
      ? `${request.context}\n\n${request.input}`
      : request.input;

    const uploaded = await httpAdapter.uploadImage(request.image, {
      apiKey: request.apiKey,
      traceId: request.traceId,
      fetchFn: options.fetchFn,
    });

    const generated = await httpAdapter.generateVideo(
      {
        imageId: uploaded.imageId,
        prompt: combinedPrompt,
        model: request.model,
        ...options.defaultVideoRequest,
      },
      {
        apiKey: request.apiKey,
        traceId: crypto.randomUUID(),
        fetchFn: options.fetchFn,
      }
    );

    const videoUrl = await waitForCompletion(
      httpAdapter.getVideoResult,
      generated.videoId,
      request.apiKey,
      maxRetries,
      delayMs,
      options.fetchFn
    );

    const durationMs = performance.now() - startedAt;
    const base = createCompletionBase(
      "video",
      request.model,
      request.userId,
      durationMs,
      { providerVideoId: generated.videoId }
    );

    return {
      ...base,
      url: new URL(videoUrl),
    };
  };

  const checkBalance = async (
    request: AdapterBalanceRequest
  ): Promise<BalanceCompletion> => {
    const startedAt = performance.now();
    const providerBalance: ProviderBalance = httpAdapter.getBalance
      ? await httpAdapter.getBalance({
          apiKey: request.apiKey,
          traceId: request.traceId,
          fetchFn: options.fetchFn,
        })
      : {
          monthlyCredit: 0,
          packageCredit: 0,
        };

    const durationMs = performance.now() - startedAt;
    const base = createCompletionBase(
      "balanceCompletion",
      "",
      request.userId,
      durationMs
    );

    return {
      ...base,
      balance: providerBalance.monthlyCredit + providerBalance.packageCredit,
    };
  };

  return {
    id: providerId,
    capabilities: [AICapability.Video, AICapability.Balance],
    produceVideo,
    checkBalance,
  };
}
