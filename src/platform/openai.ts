import OpenAI from "openai";
import type {
  AIPlatform,
  BalanceCompletion,
  Completion,
} from "./index.js";

export interface OpenAIPlatformProps {
  openaiAPIKey: string;
  openaiProjectKey?: string;
  openaiOrgID?: string;
}

function createCompletionData(
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

export async function OpenAIPlatform(
  userId: string,
  props: OpenAIPlatformProps
): Promise<AIPlatform> {
  const apiKey = props.openaiAPIKey.trim();
  if (!apiKey) {
    throw new Error("openaiAPIKey is required.");
  }

  const openai = new OpenAI({
    apiKey,
    project: props.openaiProjectKey?.trim() || undefined,
    organization: props.openaiOrgID?.trim() || undefined,
    dangerouslyAllowBrowser: false,
  });

  void openai;

  const notImplemented = (operation: string): Promise<never> => {
    return Promise.reject(
      new Error(`OpenAIPlatform "${operation}" is not implemented yet.`)
    );
  };

  const checkBalance = async (requestorId: string): Promise<BalanceCompletion> => {
    const base = createCompletionData("balanceCompletion", "", requestorId, 0);
    return Promise.resolve({ ...base, balance: 0.0 });
  };

  const currentBalance = (await checkBalance(userId)).balance;

  return {
    chatWithAI: async () => notImplemented("chatWithAI"),
    synthesizeSpeech: async () => notImplemented("synthesizeSpeech"),
    transcribeSpeech: async () => notImplemented("transcribeSpeech"),
    generateImage: async () => notImplemented("generateImage"),
    produceVideo: async () => notImplemented("produceVideo"),
    generateModel: async () => notImplemented("generateModel"),
    checkBalance,
    currentBalance,
  };
}
