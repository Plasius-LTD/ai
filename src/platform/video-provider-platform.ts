import { performance } from "node:perf_hooks";

import type {
  BalanceCompletion,
  Completion,
  VideoCompletion,
} from "./index.js";
import type {
  VideoGenerationRequest,
  VideoJobResult,
  VideoProviderAdapter,
} from "./video-provider-adapter.js";

export interface VideoProviderPlatformProps {
  apiKey: string;
  adapter: VideoProviderAdapter;
  polling?: {
    maxRetries?: number;
    delayMs?: number;
  };
  defaultVideoRequest?: Partial<Omit<VideoGenerationRequest, "imageId" | "prompt">>;
}

export interface VideoProviderPlatform {
  produceVideo: (
    requestorId: string,
    prompt: string,
    image: URL,
    context: string,
    model: string
  ) => Promise<VideoCompletion>;
  checkBalance: (userId: string) => Promise<BalanceCompletion>;
  currentBalance: number;
}

export const VIDEO_PROVIDER_PLATFORM_HARDENING_FEATURE_FLAG =
  "platform.repo-hardening-sweep.enabled";

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

async function waitForCompletion(
  adapter: VideoProviderAdapter,
  videoId: number,
  apiKey: string,
  maxRetries: number,
  delayMs: number
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const result: VideoJobResult = await adapter.getVideoResult(videoId, {
      apiKey,
      traceId: crypto.randomUUID(),
    });

    if (result.state === "completed" && result.videoUrl) {
      return result.videoUrl;
    }

    if (result.state === "failed") {
      throw new Error("Video generation failed in provider adapter.");
    }
  }

  throw new Error("Timed out waiting for provider video completion.");
}

export async function createVideoProviderPlatform(
  userId: string,
  props: VideoProviderPlatformProps
): Promise<VideoProviderPlatform> {
  const apiKey = props.apiKey.trim();
  if (!apiKey) {
    throw new Error("apiKey is required for createVideoProviderPlatform.");
  }

  const maxRetries = props.polling?.maxRetries ?? 20;
  const delayMs = props.polling?.delayMs ?? 3000;

  const produceVideo = async (
    requestorId: string,
    prompt: string,
    image: URL,
    _context: string,
    model: string
  ): Promise<VideoCompletion> => {
    const startedAt = performance.now();

    const uploaded = await props.adapter.uploadImage(image, {
      apiKey,
      traceId: crypto.randomUUID(),
    });

    const generated = await props.adapter.generateVideo(
      {
        imageId: uploaded.imageId,
        prompt,
        ...props.defaultVideoRequest,
      },
      {
        apiKey,
        traceId: crypto.randomUUID(),
      }
    );

    const videoUrl = await waitForCompletion(
      props.adapter,
      generated.videoId,
      apiKey,
      maxRetries,
      delayMs
    );

    const durationMs = performance.now() - startedAt;
    const base = createCompletionBase("video", model, requestorId, durationMs);

    return {
      ...base,
      url: new URL(videoUrl),
    };
  };

  const checkBalance = async (requestorId: string): Promise<BalanceCompletion> => {
    const startedAt = performance.now();
    const providerBalance = props.adapter.getBalance
      ? await props.adapter.getBalance({
          apiKey,
          traceId: crypto.randomUUID(),
        })
      : {
          monthlyCredit: 0,
          packageCredit: 0,
        };

    const durationMs = performance.now() - startedAt;
    const base = createCompletionBase("balanceCompletion", "", requestorId, durationMs);

    return {
      ...base,
      balance: providerBalance.monthlyCredit + providerBalance.packageCredit,
    };
  };

  const currentBalance = (await checkBalance(userId)).balance;

  return {
    produceVideo,
    checkBalance,
    currentBalance,
  };
}
