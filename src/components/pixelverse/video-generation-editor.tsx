import React, { useState } from "react";
import Balance from "./balance.js";
import {
  pixelverseTranslationKeys,
  translatePixelverseText,
  type PixelverseTranslate,
} from "./i18n.js";
import type {
  VideoGenerationRequest,
  VideoProviderAdapter,
} from "../../platform/video-provider-adapter.js";

export interface VideoGenerationEditorProps {
  apiKey: string;
  adapter: VideoProviderAdapter;
  onVideoGenerated?: (videoUrl: string) => void;
  initialRequest?: Partial<Omit<VideoGenerationRequest, "imageId">>;
  translate?: PixelverseTranslate;
}

const defaultRequest: Omit<VideoGenerationRequest, "imageId"> = {
  prompt: "",
  model: "standard",
  motionMode: "normal",
  quality: "720p",
  durationSeconds: 5,
  watermark: false,
};

function toRequest(
  overrides?: Partial<Omit<VideoGenerationRequest, "imageId">>
): Omit<VideoGenerationRequest, "imageId"> {
  return {
    ...defaultRequest,
    ...overrides,
  };
}

export async function waitForVideoCompletion(
  adapter: VideoProviderAdapter,
  videoId: number,
  apiKey: string,
  maxRetries = 20,
  delayMs = 3000,
  translate?: PixelverseTranslate
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const result = await adapter.getVideoResult(videoId, {
      apiKey,
      traceId: crypto.randomUUID(),
    });

    if (result.state === "completed" && result.videoUrl) {
      return result.videoUrl;
    }

    if (result.state === "failed") {
      throw new Error(
        translatePixelverseText(pixelverseTranslationKeys.videoErrorFailed, undefined, translate)
      );
    }
  }

  throw new Error(
    translatePixelverseText(pixelverseTranslationKeys.videoErrorTimeout, undefined, translate)
  );
}

export function VideoGenerationEditor({
  apiKey,
  adapter,
  onVideoGenerated,
  initialRequest,
  translate,
}: VideoGenerationEditorProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [request, setRequest] = useState<Omit<VideoGenerationRequest, "imageId">>(
    toRequest(initialRequest)
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleRegenerate = () => {
    void handleUploadProcess();
  };

  const handleUploadProcess = async () => {
    if (!selectedFile) {
      return;
    }

    setLoading(true);
    setVideoReady(false);

    try {
      const uploaded = await adapter.uploadImage(selectedFile, {
        apiKey,
        traceId: crypto.randomUUID(),
      });

      const generated = await adapter.generateVideo(
        {
          ...request,
          imageId: uploaded.imageId,
        },
        {
          apiKey,
          traceId: crypto.randomUUID(),
        }
      );

      const generatedUrl = await waitForVideoCompletion(
        adapter,
        generated.videoId,
        apiKey,
        undefined,
        undefined,
        translate
      );
      setVideoUrl(generatedUrl);
      setVideoReady(true);
      onVideoGenerated?.(generatedUrl);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Balance apiKey={apiKey} adapter={adapter} translate={translate} />
      {!videoReady && !selectedFile && (
        <div>
          <p>
            {translatePixelverseText(
              pixelverseTranslationKeys.videoUploadPrompt,
              undefined,
              translate
            )}
          </p>
          <input
            title={translatePixelverseText(
              pixelverseTranslationKeys.videoUploadImageTitle,
              undefined,
              translate
            )}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
          />
        </div>
      )}

      {!videoReady ? (
        <div>
          <label>
            {translatePixelverseText(
              pixelverseTranslationKeys.videoPromptLabel,
              undefined,
              translate
            )}
            <textarea
              value={request.prompt}
              onChange={(event) =>
                setRequest((previous) => ({
                  ...previous,
                  prompt: event.target.value,
                }))
              }
            />
          </label>
        </div>
      ) : null}

      {loading && (
        <div>
          {translatePixelverseText(pixelverseTranslationKeys.videoLoading, undefined, translate)}
        </div>
      )}

      {!videoReady && selectedFile && !loading && (
        <button onClick={handleUploadProcess}>
          {translatePixelverseText(pixelverseTranslationKeys.videoStartUpload, undefined, translate)}
        </button>
      )}

      {videoReady && (
        <div>
          <video src={videoUrl} controls />
          <button onClick={handleRegenerate}>
            {translatePixelverseText(pixelverseTranslationKeys.videoRegenerate, undefined, translate)}
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoGenerationEditor;
