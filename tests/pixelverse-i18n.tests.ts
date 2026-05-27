import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VideoProviderAdapter } from "../src/platform/video-provider-adapter.js";
import {
  pixelverseEnGbTranslations,
  pixelverseTranslationKeys,
  translatePixelverseText,
  type PixelverseTranslate,
} from "../src/index.js";
import VideoGenerationEditor, {
  waitForVideoCompletion,
} from "../src/components/pixelverse/video-generation-editor.js";

const adapter: VideoProviderAdapter = {
  uploadImage: async () => ({ imageId: 1 }),
  generateVideo: async () => ({ videoId: 2 }),
  getVideoResult: async () => ({ state: "completed", videoUrl: "https://example.test/video.mp4" }),
  getBalance: async () => ({ monthlyCredit: 10, packageCredit: 20 }),
};

describe("Pixelverse translations", () => {
  it("resolves en-GB defaults through the shared translation runtime", () => {
    expect(
      translatePixelverseText(pixelverseTranslationKeys.balanceMonthlyCredit, { value: 10 })
    ).toBe("Monthly Credit: 10");
    expect(pixelverseEnGbTranslations[pixelverseTranslationKeys.videoUploadPrompt]).toBe(
      "Drag/Drop or Click HERE to upload"
    );
  });

  it("falls back to package translations when a consumer translator misses a key", () => {
    const missing: PixelverseTranslate = (key) => key;

    expect(
      translatePixelverseText(pixelverseTranslationKeys.videoPromptLabel, undefined, missing)
    ).toBe("Prompt");
  });

  it("renders Pixelverse UI text from the package translations by default", () => {
    const markup = renderToStaticMarkup(
      React.createElement(VideoGenerationEditor, {
        apiKey: "test-key",
        adapter,
      })
    );

    expect(markup).toContain("Loading balance...");
    expect(markup).toContain("Drag/Drop or Click HERE to upload");
    expect(markup).toContain('title="Upload Image"');
    expect(markup).toContain("Prompt");
  });

  it("allows host applications to supply translated Pixelverse UI text", () => {
    const translate: PixelverseTranslate = (key) => {
      const translations: Partial<Record<Parameters<PixelverseTranslate>[0], string>> = {
        [pixelverseTranslationKeys.balanceLoading]: "Balance loading",
        [pixelverseTranslationKeys.videoPromptLabel]: "Storyboard",
        [pixelverseTranslationKeys.videoUploadImageTitle]: "Select image",
        [pixelverseTranslationKeys.videoUploadPrompt]: "Drop a source image",
      };

      return translations[key] ?? key;
    };

    const markup = renderToStaticMarkup(
      React.createElement(VideoGenerationEditor, {
        apiKey: "test-key",
        adapter,
        translate,
      })
    );

    expect(markup).toContain("Balance loading");
    expect(markup).toContain("Drop a source image");
    expect(markup).toContain('title="Select image"');
    expect(markup).toContain("Storyboard");
  });

  it("returns completed Pixelverse video results", async () => {
    await expect(waitForVideoCompletion(adapter, 2, "test-key", 1, 0)).resolves.toBe(
      "https://example.test/video.mp4"
    );
  });

  it("resolves failed Pixelverse video errors through translations", async () => {
    const failedAdapter: VideoProviderAdapter = {
      ...adapter,
      getVideoResult: async () => ({ state: "failed" }),
    };
    const translate: PixelverseTranslate = (key) =>
      key === pixelverseTranslationKeys.videoErrorFailed ? "Generation failed" : key;

    await expect(
      waitForVideoCompletion(failedAdapter, 2, "test-key", 1, 0, translate)
    ).rejects.toThrow("Generation failed");
  });

  it("resolves timed-out Pixelverse video errors through translations", async () => {
    const pendingAdapter: VideoProviderAdapter = {
      ...adapter,
      getVideoResult: async () => ({ state: "pending" }),
    };
    const translate: PixelverseTranslate = (key) =>
      key === pixelverseTranslationKeys.videoErrorTimeout ? "Still rendering" : key;

    await expect(
      waitForVideoCompletion(pendingAdapter, 2, "test-key", 1, 0, translate)
    ).rejects.toThrow("Still rendering");
  });
});
