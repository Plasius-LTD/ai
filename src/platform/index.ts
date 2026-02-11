import { createSchema, field } from "@plasius/schema";
import type { FieldBuilder, SchemaShape } from "@plasius/schema";

export const completionSchema = createSchema(
  {
    id: field
      .string()
      .description("A unique ID for this completion")
      .version("1.0"),
    type: field
      .string()
      .description("The type of completion (e.g. 'chat', 'text', 'speech')")
      .version("1.0"),
    model: field
      .string()
      .description("The model used to generate this completion")
      .version("1.0"),
    durationMs: field
      .number()
      .description("How long the AI task took in milliseconds")
      .version("1.0"),
    createdAt: field
      .string()
      .description("ISO timestamp when the completion was created")
      .version("1.0"),
    partitionKey: field
      .string()
      .description("User or system identifier that made the request")
      .version("1.0"),
    usage: field
      .object<Record<string, FieldBuilder<number>>>({} as SchemaShape)
      .description("Optional usage metrics like token count or cost")
      .version("1.0")
      .optional()
      .as<Record<string, number>>(),
  },
  "completion",
  {
    version: "1.0",
    piiEnforcement: "none",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface Completion {
  id: string;
  partitionKey: string;
  type: string;
  model: string;
  durationMs: number;
  createdAt: string;
  usage?: Record<string, number>;
}

export const chatCompletionSchema = createSchema(
  {
    message: field
      .string()
      .description("The response from the AI")
      .version("1.0"),
    outputUser: field
      .string()
      .description("The 'actor' who is chatting")
      .version("1.0"),
  },
  "chatCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface ChatCompletion extends Completion {
  message: string;
  outputUser: string;
}

export const textCompletionSchema = createSchema(
  {
    message: field
      .string()
      .description("The response from the AI")
      .version("1.0"),
  },
  "textCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface TextCompletion extends Completion {
  message: string;
}

export const imageCompletionSchema = createSchema(
  {
    url: field
      .string()
      .description("The response from the AI")
      .version("1.0")
      .as<URL>(),
  },
  "imageCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface ImageCompletion extends Completion {
  url: URL;
}

export const speechCompletionSchema = createSchema(
  {
    url: field
      .string()
      .description("The response from the AI")
      .version("1.0")
      .as<URL>(),
  },
  "speechCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface SpeechCompletion extends Completion {
  url: URL;
}

export const videoCompletionSchema = createSchema(
  {
    url: field
      .string()
      .description("The response from the AI")
      .version("1.0")
      .as<URL>(),
  },
  "videoCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface VideoCompletion extends Completion {
  url: URL;
}

export const balanceCompletionSchema = createSchema(
  {
    balance: field.number().description("Current balance").version("1.0"),
  },
  "balanceCompletion",
  {
    version: "1.0",
    table: "completions",
    schemaValidator: () => {
      return true;
    },
  }
);

export interface BalanceCompletion extends Completion {
  balance: number;
}

export enum AICapability {
  Chat,
  Text,
  Speech,
  Image,
  Video,
  Balance,
}

export interface AIPlatform {
  canHandle?: (
    userId: string,
    capabilities: AICapability[]
  ) => Promise<boolean>;
  chatWithAI: (
    userId: string,
    input: string,
    context: string,
    model: string
  ) => Promise<ChatCompletion>;
  synthesizeSpeech: (
    userId: string,
    input: string,
    voice: string,
    context: string,
    model: string
  ) => Promise<SpeechCompletion>;
  transcribeSpeech: (
    userId: string,
    input: Buffer,
    context: string,
    model: string
  ) => Promise<TextCompletion>;
  generateImage: (
    userId: string,
    input: string,
    context: string,
    model: string
  ) => Promise<ImageCompletion>;
  produceVideo: (
    userId: string,
    imput: string,
    image: URL,
    context: string,
    model: string
  ) => Promise<VideoCompletion>;
  checkBalance: (userId: string) => Promise<BalanceCompletion>;
  currentBalance: number;
}
