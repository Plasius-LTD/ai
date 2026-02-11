import { v4 as uuidv4 } from "uuid";
import { performance } from "perf_hooks";

import type {
  AIPlatform,
  BalanceCompletion,
  ChatCompletion,
  Completion,
  ImageCompletion,
  SpeechCompletion,
  TextCompletion,
  VideoCompletion,
} from "./index.js";
import { useState } from "react";

interface UploadImageResponse {
  Resp?: { id?: number };
}

interface GenerateVideoResponse {
  Resp?: { id?: number };
}

interface VideoStatusResponse {
  Resp?: { status?: number; url?: string };
}

interface BalanceResponse {
  Resp?: { credit_monthly?: number; credit_package?: number };
}

export interface PixelVersePlatformProps {
  pixelVerseAPIKey: string;
}

export async function PixelVersePlatform(
  userId: string,
  props: PixelVersePlatformProps
): Promise<AIPlatform> {
  async function uploadImage(image: File | URL, apiKey: string): Promise<UploadImageResponse> {
    const headers = new Headers();
    headers.append("API-KEY", apiKey);
    headers.append("Ai-trace-id", uuidv4());
    headers.append("Access-Control-Allow-Origin", "*");

    const formData = new FormData();
    if (image instanceof File) {
      formData.append("image", image, "");
    } else {
      const blob = await fetch(image.toString()).then((r) => r.blob());
      formData.append("image", blob, "image-from-url");
    }

    // pixelapi is proxied through the vite.config.ts file
    // to avoid CORS issues and to allow for local development
    const response = await fetch("/pixelapi/openapi/v2/image/upload", {
      method: "POST",
      headers,
      body: formData,
      redirect: "follow",
    });
    const data = (await response.json()) as UploadImageResponse;
    return data;
  }

  async function generateVideo(
    imgId: number,
    prompt: string,
    apiKey: string,
    seed?: number,
    template_id?: string,
    negative_prompt?: string
  ): Promise<GenerateVideoResponse> {
    const headers = new Headers();
    headers.append("API-KEY", apiKey);
    headers.append("Ai-trace-id", uuidv4());
    headers.append("Content-Type", "application/json");
    headers.append("Access-Control-Allow-Origin", "*");
    headers.append("Accept", "application/json");
    const values: {
      duration: number;
      img_id: number;
      model: string;
      motion_mode: string;
      prompt: string;
      quality: string;
      water_mark: boolean;
      seed?: number;
      template_id?: string;
      negative_prompt?: string;
    } = {
      duration: 5,
      img_id: imgId,
      model: "v3.5",
      motion_mode: "normal",
      prompt: prompt,
      quality: "720p",
      water_mark: false,
    };

    if (seed) {
      values.seed = seed;
    }
    if (template_id) {
      values.template_id = template_id;
    }
    if (negative_prompt) {
      values.negative_prompt = negative_prompt;
    }

    const body = JSON.stringify(values);

    // pixelapi is proxied through the vite.config.ts file
    // to avoid CORS issues and to allow for local development
    const response = await fetch("/pixelapi/openapi/v2/video/img/generate", {
      method: "POST",
      headers: headers,
      referrerPolicy: "no-referrer",
      body,
    });
    const data = (await response.json()) as GenerateVideoResponse;
    return data;
  }

  async function checkVideoStatus(id: number, apiKey: string): Promise<VideoStatusResponse> {
    const headers = new Headers();
    headers.append("API-KEY", apiKey);
    headers.append("Ai-trace-id", uuidv4());
    headers.append("Access-Control-Allow-Origin", "*");
    headers.append("Accept", "application/json");

    // pixelapi is proxied through the vite.config.ts file
    // to avoid CORS issues and to allow for local development
    const response = await fetch(`/pixelapi/openapi/v2/video/result/${id}`, {
      method: "GET",
      headers,
      referrerPolicy: "no-referrer",
    });
    const data = (await response.json()) as VideoStatusResponse;
    return data;
  }

  function baseCompletionData(
    type: string,
    model: string,
    requestor: string,
    duration: number
  ): Completion {
    return {
      partitionKey: requestor,
      id: crypto.randomUUID(),
      type,
      model,
      createdAt: new Date().toISOString(),
      durationMs: duration,
      usage: {},
    };
  }

  const chatWithAI = (
    _userId: string,
    _input: string,
    _context: string,
    _model: string
  ): Promise<ChatCompletion> => {
    void [_userId, _input, _context, _model];
    return Promise.reject(new Error("Not implemented"));
  };

  const synthesizeSpeech = (
    _userId: string,
    _input: string,
    _voice: string,
    _context: string,
    _model: string
  ): Promise<SpeechCompletion> => {
    void [_userId, _input, _voice, _context, _model];
    return Promise.reject(new Error("Not implemented"));
  };

  const transcribeSpeech = (
    _userId: string,
    _input: Buffer,
    _context: string,
    _model: string
  ): Promise<TextCompletion> => {
    void [_userId, _input, _context, _model];
    return Promise.reject(new Error("Not implemented"));
  };

  const generateImage = (
    _userId: string,
    _input: string,
    _context: string,
    _model: string
  ): Promise<ImageCompletion> => {
    void [_userId, _input, _context, _model];
    return Promise.reject(new Error("Not implemented"));
  };

  const produceVideo = (
    userId: string,
    input: string,
    image: File | URL,
    context: string,
    model: string
  ): Promise<VideoCompletion> => {
    const start = performance.now();
    return uploadImage(image, props.pixelVerseAPIKey)
      .then((uploadResult: UploadImageResponse) => {
        const imageId = uploadResult?.Resp?.id;
        if (!imageId) throw new Error("Invalid image upload response.");
        return generateVideo(imageId, input, props.pixelVerseAPIKey);
      })
      .then((generated: GenerateVideoResponse) => {
        const videoId = generated?.Resp?.id;
        if (!videoId)
          throw new Error("Video generation did not return a valid ID.");
        return waitForVideoCompletion(videoId, props.pixelVerseAPIKey);
      })
      .then((videoUrl) => {
        const duration = performance.now() - start;
        const base = baseCompletionData("video", model, userId, duration);
        return {
          ...base,
          url: new URL(videoUrl),
        };
      })
      .catch((err) => {
        // Optional: log or re-throw error for upstream handling
        throw new Error(`produceVideo failed: ${(err as Error).message}`);
      });
  };

  async function waitForVideoCompletion(
    videoId: number,
    apiKey: string,
    maxRetries = 20,
    delayMs = 3000
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await new Promise((res) => setTimeout(res, delayMs));
      try {
        const videoCheck: VideoStatusResponse = await checkVideoStatus(videoId, apiKey);
        if (videoCheck?.Resp?.status === 1) {
          const url = videoCheck?.Resp?.url;
          if (!url)
            throw new Error("Video marked complete but no URL returned.");
          return url;
        }
      } catch (err) {
        console.warn(
          `Attempt ${attempt + 1} failed: ${(err as Error).message}`
        );
      }
    }
    throw new Error("Timed out waiting for video to complete.");
  }

  const checkBalance = (userId: string): Promise<BalanceCompletion> => {
    const start = performance.now();
    const headers = new Headers();
    headers.append("API-KEY", props.pixelVerseAPIKey);
    headers.append("AI-trace-ID", uuidv4());
    headers.append("Access-Control-Allow-Origin", "*");
    headers.append("Accept", "application/json");
    headers.append("Content-Type", "application/json");

    return fetch("/pixelapi/openapi/v2/account/balance", {
      method: "GET",
      headers,
      referrerPolicy: "no-referrer",
    })
      .then(async (res): Promise<BalanceResponse> => (await res.json()) as BalanceResponse)
      .then((data) => {
        if (!data?.Resp) {
          throw new Error("Invalid balance response");
        }
        const duration = performance.now() - start;
        const base = baseCompletionData(
          "balanceCompletion",
          "",
          userId,
          duration
        );
        const monthly = data.Resp.credit_monthly ?? 0;
        const pkg = data.Resp.credit_package ?? 0;
        return {
          ...base,
          balance: monthly + pkg,
        };
      })
      .catch((err) => {
        throw new Error(`checkBalance failed: ${(err as Error).message}`);
      });
  };

  const [currentBalance] = useState<number>((await checkBalance(userId)).balance as number ?? 0);

  return {
    chatWithAI,
    synthesizeSpeech,
    transcribeSpeech,
    generateImage,
    produceVideo,
    checkBalance,
    currentBalance,
  };
}
