import { performance } from "node:perf_hooks";

import type {
  AIPlatform,
  BalanceCompletion,
  ChatCompletion,
  Completion,
  ImageCompletion,
  ModelCompletion,
  SpeechCompletion,
  TextCompletion,
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
): Promise<AIPlatform> {
  const maxRetries = props.polling?.maxRetries ?? 20;
  const delayMs = props.polling?.delayMs ?? 3000;

  const chatWithAI = (
    _userId: string,
    _input: string,
    _context: string,
    _model: string
  ): Promise<ChatCompletion> => {
    return Promise.reject(new Error("Not implemented"));
  };

  const synthesizeSpeech = (
    _userId: string,
    _input: string,
    _voice: string,
    _context: string,
    _model: string
  ): Promise<SpeechCompletion> => {
    return Promise.reject(new Error("Not implemented"));
  };

  const transcribeSpeech = (
    _userId: string,
    _input: Buffer,
    _context: string,
    _model: string
  ): Promise<TextCompletion> => {
    return Promise.reject(new Error("Not implemented"));
  };

  const generateImage = (
    _userId: string,
    _input: string,
    _context: string,
    _model: string
  ): Promise<ImageCompletion> => {
    return Promise.reject(new Error("Not implemented"));
  };

  const produceVideo = async (
    requestorId: string,
    prompt: string,
    image: URL,
    _context: string,
    model: string
  ): Promise<VideoCompletion> => {
    const startedAt = performance.now();

    const uploaded = await props.adapter.uploadImage(image, {
      apiKey: props.apiKey,
      traceId: crypto.randomUUID(),
    });

    const generated = await props.adapter.generateVideo(
      {
        imageId: uploaded.imageId,
        prompt,
        ...props.defaultVideoRequest,
      },
      {
        apiKey: props.apiKey,
        traceId: crypto.randomUUID(),
      }
    );

    const videoUrl = await waitForCompletion(
      props.adapter,
      generated.videoId,
      props.apiKey,
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

  const generateModel = (
    _userId: string,
    _input: string,
    _context: string,
    _model: string
  ): Promise<ModelCompletion> => {
    return Promise.reject(new Error("Not implemented"));
  };

  const checkBalance = async (requestorId: string): Promise<BalanceCompletion> => {
    const startedAt = performance.now();
    const providerBalance = props.adapter.getBalance
      ? await props.adapter.getBalance({
          apiKey: props.apiKey,
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
