import OpenAI from "openai";
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

export interface OpenAIPlatformProps {
  openaiAPIKey: string;
  openaiProjectKey: string;
  openaiOrgID: string;
}

export async function OpenAIPlatform(
  userId: string,
  props: OpenAIPlatformProps
): Promise<AIPlatform> {
  const openai = new OpenAI({
    apiKey: props.openaiAPIKey,
    project: props.openaiProjectKey,
    organization: props.openaiOrgID,
    dangerouslyAllowBrowser: false,
  });

  void openai;

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
    userId: string,
    input: string,
    context: string,
    model: string
  ): Promise<ChatCompletion> => {
    void [input, context, model];
    const base = baseCompletionData("chat", "model", userId, 0);
    return Promise.resolve({ ...base, message: "Something", outputUser: "" });
  };

  const synthesizeSpeech = (
    userId: string,
    input: string,
    voice: string,
    context: string,
    model: string
  ): Promise<SpeechCompletion> => {
    void [input, voice, context, model];
    const base = baseCompletionData("chat", "model", userId, 0);
    return Promise.resolve({ ...base, url: new URL("Something") });
  };

  const transcribeSpeech = (
    userId: string,
    input: Buffer,
    context: string,
    model: string
  ): Promise<TextCompletion> => {
    void [input, context, model];
    const base = baseCompletionData("chat", "model", userId, 0);
    return Promise.resolve({ ...base, message: "Something" });
  };

  const generateImage = (
    userId: string,
    input: string,
    context: string,
    model: string
  ): Promise<ImageCompletion> => {
    void [input, context, model];
    const base = baseCompletionData("chat", "model", userId, 0);
    return Promise.resolve({ ...base, url: new URL("Something") });
  };

  const produceVideo = (
    userId: string,
    imput: string,
    image: URL,
    context: string,
    model: string
  ): Promise<VideoCompletion> => {
    void [imput, image, context, model];
    const base = baseCompletionData("chat", "model", userId, 0);
    return Promise.resolve({ ...base, url: new URL("Something") });
  };

  const checkBalance = (userId: string): Promise<BalanceCompletion> => {
    const base = baseCompletionData("balanceCompletion", "", userId, 0);
    return Promise.resolve({ ...base, balance: 0.0 });
  };

  const [currentBalance] = useState<number>((await checkBalance(userId)).balance! as number);

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
