import { createI18n } from "@plasius/translations";
import type { TranslationArgs, TranslationDictionary } from "@plasius/translations";
import { pixelverseEnGbTranslations } from "./translations/en-GB.js";

export const pixelverseTranslationKeys = {
  balanceLoading: "pixelverse.balance.loading",
  balanceMonthlyCredit: "pixelverse.balance.monthlyCredit",
  balancePackageCredit: "pixelverse.balance.packageCredit",
  videoErrorFailed: "pixelverse.video.error.failed",
  videoErrorTimeout: "pixelverse.video.error.timeout",
  videoLoading: "pixelverse.video.loading",
  videoPromptLabel: "pixelverse.video.promptLabel",
  videoRegenerate: "pixelverse.video.regenerate",
  videoStartUpload: "pixelverse.video.startUpload",
  videoUploadImageTitle: "pixelverse.video.uploadImageTitle",
  videoUploadPrompt: "pixelverse.video.uploadPrompt",
} as const;

export type PixelverseTranslationKey =
  (typeof pixelverseTranslationKeys)[keyof typeof pixelverseTranslationKeys];

export type PixelverseTranslate = (
  key: PixelverseTranslationKey,
  args?: TranslationArgs
) => string | undefined;

export const pixelverseTranslations = {
  "en-GB": pixelverseEnGbTranslations,
} satisfies Partial<Record<string, TranslationDictionary>>;

const pixelverseI18n = createI18n({
  language: "en-GB",
  fallback: "en-GB",
  translations: pixelverseTranslations,
});

export function translatePixelverseText(
  key: PixelverseTranslationKey,
  args?: TranslationArgs,
  translate?: PixelverseTranslate
): string {
  const translated = translate?.(key, args);
  if (translated && translated !== key) {
    return translated;
  }

  return pixelverseI18n.t(key, args);
}

