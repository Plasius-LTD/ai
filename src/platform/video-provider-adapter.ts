export interface ProviderBalance {
  monthlyCredit: number;
  packageCredit: number;
}

export interface VideoUploadResult {
  imageId: number;
}

export interface VideoGenerationRequest {
  imageId: number;
  prompt: string;
  negativePrompt?: string;
  templateId?: string;
  seed?: number;
  durationSeconds?: number;
  model?: string;
  motionMode?: string;
  quality?: string;
  watermark?: boolean;
}

export interface VideoGenerationResult {
  videoId: number;
}

export type VideoJobState = "pending" | "completed" | "failed";

export interface VideoJobResult {
  state: VideoJobState;
  videoUrl?: string;
}

export interface VideoProviderRequestContext {
  apiKey: string;
  traceId?: string;
  fetchFn?: typeof fetch;
}

export interface VideoProviderAdapter {
  uploadImage(
    image: File | URL,
    context: VideoProviderRequestContext
  ): Promise<VideoUploadResult>;
  generateVideo(
    request: VideoGenerationRequest,
    context: VideoProviderRequestContext
  ): Promise<VideoGenerationResult>;
  getVideoResult(
    videoId: number,
    context: VideoProviderRequestContext
  ): Promise<VideoJobResult>;
  getBalance?(context: VideoProviderRequestContext): Promise<ProviderBalance>;
}

export interface HttpVideoProviderAdapterConfig {
  uploadImagePath: string;
  generateVideoPath: string;
  getVideoResultPath: (videoId: number) => string;
  getBalancePath?: string;
  mapUploadImageId?: (data: unknown) => number | undefined;
  mapGeneratedVideoId?: (data: unknown) => number | undefined;
  mapVideoResult?: (data: unknown) => VideoJobResult;
  mapBalance?: (data: unknown) => ProviderBalance;
  mapGenerateRequestBody?: (request: VideoGenerationRequest) => unknown;
  additionalHeaders?: Record<string, string>;
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

function requireJson(
  value: unknown,
  label: string,
  mapper: (data: unknown) => number | undefined
): number {
  const id = mapper(value);
  if (!id) {
    throw new Error(`Invalid ${label} response.`);
  }
  return id;
}

function defaultRequestBody(request: VideoGenerationRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    img_id: request.imageId,
    prompt: request.prompt,
    duration: request.durationSeconds ?? 5,
    model: request.model ?? "standard",
    motion_mode: request.motionMode ?? "normal",
    quality: request.quality ?? "720p",
    water_mark: request.watermark ?? false,
  };

  if (request.seed !== undefined) {
    body.seed = request.seed;
  }
  if (request.templateId) {
    body.template_id = request.templateId;
  }
  if (request.negativePrompt) {
    body.negative_prompt = request.negativePrompt;
  }

  return body;
}

function defaultHeaders(context: VideoProviderRequestContext): Record<string, string> {
  return {
    "API-KEY": context.apiKey,
    "AI-trace-ID": context.traceId ?? crypto.randomUUID(),
    Accept: "application/json",
  };
}

function defaultUploadMapper(data: unknown): number | undefined {
  const root = asRecord(data);
  const resp = asRecord(root.Resp);
  return asNumber(resp.id);
}

function defaultVideoIdMapper(data: unknown): number | undefined {
  const root = asRecord(data);
  const resp = asRecord(root.Resp);
  return asNumber(resp.id);
}

function defaultResultMapper(data: unknown): VideoJobResult {
  const root = asRecord(data);
  const resp = asRecord(root.Resp);
  const status = asNumber(resp.status);
  const url = asString(resp.url);

  if (status === 1 && url) {
    return { state: "completed", videoUrl: url };
  }
  if (status === -1) {
    return { state: "failed" };
  }

  return { state: "pending" };
}

function defaultBalanceMapper(data: unknown): ProviderBalance {
  const root = asRecord(data);
  const resp = asRecord(root.Resp);
  return {
    monthlyCredit: asNumber(resp.credit_monthly) ?? 0,
    packageCredit: asNumber(resp.credit_package) ?? 0,
  };
}

export function createHttpVideoProviderAdapter(
  config: HttpVideoProviderAdapterConfig
): VideoProviderAdapter {
  const fetchJson = async (
    path: string,
    init: RequestInit,
    context: VideoProviderRequestContext
  ): Promise<unknown> => {
    const fetchFn = context.fetchFn ?? fetch;
    const response = await fetchFn(path, init);
    if (!response.ok) {
      throw new Error(`Provider request failed (${response.status} ${response.statusText}).`);
    }
    return response.json();
  };

  const uploadImage = async (
    image: File | URL,
    context: VideoProviderRequestContext
  ): Promise<VideoUploadResult> => {
    const formData = new FormData();
    if (image instanceof File) {
      formData.append("image", image, "upload-image");
    } else {
      const blob = await fetch(image.toString()).then((result) => result.blob());
      formData.append("image", blob, "upload-image");
    }

    const data = await fetchJson(
      config.uploadImagePath,
      {
        method: "POST",
        headers: {
          ...defaultHeaders(context),
          ...config.additionalHeaders,
        },
        body: formData,
      },
      context
    );

    const imageId = requireJson(data, "image upload", config.mapUploadImageId ?? defaultUploadMapper);
    return { imageId };
  };

  const generateVideo = async (
    request: VideoGenerationRequest,
    context: VideoProviderRequestContext
  ): Promise<VideoGenerationResult> => {
    const body = JSON.stringify(
      config.mapGenerateRequestBody?.(request) ?? defaultRequestBody(request)
    );

    const data = await fetchJson(
      config.generateVideoPath,
      {
        method: "POST",
        headers: {
          ...defaultHeaders(context),
          "Content-Type": "application/json",
          ...config.additionalHeaders,
        },
        body,
      },
      context
    );

    const videoId = requireJson(
      data,
      "video generation",
      config.mapGeneratedVideoId ?? defaultVideoIdMapper
    );

    return { videoId };
  };

  const getVideoResult = async (
    videoId: number,
    context: VideoProviderRequestContext
  ): Promise<VideoJobResult> => {
    const data = await fetchJson(
      config.getVideoResultPath(videoId),
      {
        method: "GET",
        headers: {
          ...defaultHeaders(context),
          ...config.additionalHeaders,
        },
      },
      context
    );

    return (config.mapVideoResult ?? defaultResultMapper)(data);
  };

  const getBalance = config.getBalancePath
    ? async (context: VideoProviderRequestContext): Promise<ProviderBalance> => {
        const data = await fetchJson(
          config.getBalancePath as string,
          {
            method: "GET",
            headers: {
              ...defaultHeaders(context),
              "Content-Type": "application/json",
              ...config.additionalHeaders,
            },
          },
          context
        );

        return (config.mapBalance ?? defaultBalanceMapper)(data);
      }
    : undefined;

  return {
    uploadImage,
    generateVideo,
    getVideoResult,
    getBalance,
  };
}
