# @plasius/ai

[![npm version](https://img.shields.io/npm/v/@plasius/ai.svg)](https://www.npmjs.com/package/@plasius/ai)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/ai/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/ai/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/ai)](https://codecov.io/gh/Plasius-LTD/ai)
[![License](https://img.shields.io/github/license/Plasius-LTD/ai)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

AI capability contracts and completion schemas for Plasius applications.

## Scope

This package currently provides:

- capability contracts (`AICapability`, `AIPlatform`)
- completion model interfaces (`ChatCompletion`, `ImageCompletion`, `ModelCompletion`, etc.)
- schema definitions for completion entities
- adapter contracts/factories for multi-provider routing with developer-supplied API keys

Provider wiring and runtime adapters are documented in [`docs/providers.md`](./docs/providers.md).

## Install

```bash
npm install @plasius/ai
```

## Usage

```ts
import {
  AICapability,
  type AIPlatform,
  completionSchema,
  chatCompletionSchema,
} from "@plasius/ai";

const capabilities = [AICapability.Chat, AICapability.Image];
void capabilities;
void completionSchema;
void chatCompletionSchema;

// Host apps provide the concrete runtime implementation.
const platform: AIPlatform = {
  chatWithAI: async () => ({
    id: crypto.randomUUID(),
    partitionKey: "user-1",
    type: "chat",
    model: "gpt-4.1-mini",
    durationMs: 42,
    createdAt: new Date().toISOString(),
    message: "Hello world",
    outputUser: "assistant",
  }),
  synthesizeSpeech: async () => {
    throw new Error("Not implemented");
  },
  transcribeSpeech: async () => {
    throw new Error("Not implemented");
  },
  generateImage: async () => {
    throw new Error("Not implemented");
  },
  produceVideo: async () => {
    throw new Error("Not implemented");
  },
  generateModel: async () => {
    throw new Error("Not implemented");
  },
  checkBalance: async () => ({
    id: crypto.randomUUID(),
    partitionKey: "user-1",
    type: "balance",
    model: "",
    durationMs: 0,
    createdAt: new Date().toISOString(),
    balance: 0,
  }),
  currentBalance: 0,
};

void platform;
```

## API Surface

- `AICapability`: enum describing logical capability routing.
- `AIPlatform`: interface your runtime adapter must implement.
- Generic multi-capability adapter contracts and helpers:
  - `AICapabilityAdapter`
  - `AdapterPlatformProps`
  - `createAdapterPlatform`
- Generic video-provider adapter contracts and helpers:
  - `VideoProviderAdapter`
  - `VideoGenerationRequest`
  - `createHttpVideoProviderAdapter`
  - `createVideoProviderPlatform`
- `Completion` + typed completion variants:
  - `ChatCompletion`
  - `TextCompletion`
  - `ImageCompletion`
  - `SpeechCompletion`
  - `VideoCompletion`
  - `ModelCompletion`
  - `BalanceCompletion`
- Schemas:
  - `completionSchema`
  - `chatCompletionSchema`
  - `textCompletionSchema`
  - `imageCompletionSchema`
  - `speechCompletionSchema`
  - `videoCompletionSchema`
  - `modelCompletionSchema`
  - `balanceCompletionSchema`

## Documentation

- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- API reference: [`docs/api-reference.md`](./docs/api-reference.md)
- Provider guidance: [`docs/providers.md`](./docs/providers.md)

## Known Limitations

- `src/lib/*` currently contains placeholder files and is not part of the public API.
- Provider-specific runtime adapters are still under stabilization and should be wrapped by host applications.
- The package focuses on contracts/schemas first; runtime behavior is expected to be composed by consumers.

### Multi-Capability Adapter Composition

```ts
import {
  AICapability,
  createAdapterPlatform,
  type AICapabilityAdapter,
} from "@plasius/ai";

const adapters: AICapabilityAdapter[] = [
  {
    id: "openai-chat",
    capabilities: [AICapability.Chat, AICapability.Speech, AICapability.Image],
    chatWithAI: async ({ userId, model }) => ({
      id: crypto.randomUUID(),
      partitionKey: userId,
      type: "chat",
      model,
      durationMs: 10,
      createdAt: new Date().toISOString(),
      message: "Hello from chat adapter",
      outputUser: "assistant",
    }),
    synthesizeSpeech: async () => {
      throw new Error("Implement speech synthesis");
    },
    transcribeSpeech: async () => {
      throw new Error("Implement speech transcription");
    },
    generateImage: async () => {
      throw new Error("Implement image generation");
    },
  },
  {
    id: "model-lab",
    capabilities: [AICapability.Model],
    generateModel: async ({ userId, input, model }) => ({
      id: crypto.randomUUID(),
      partitionKey: userId,
      type: "model",
      model,
      durationMs: 50,
      createdAt: new Date().toISOString(),
      modelId: `generated-${input}`,
    }),
  },
];

const platform = await createAdapterPlatform("user-1", {
  adapters,
  apiKeys: {
    "openai-chat": process.env.OPENAI_API_KEY ?? "",
    "model-lab": process.env.MODEL_LAB_API_KEY ?? "",
  },
  defaultAdapterByCapability: {
    [AICapability.Model]: "model-lab",
  },
});

void platform;
```

### Generic Video Adapter Composition

```ts
import {
  createHttpVideoProviderAdapter,
  createVideoProviderPlatform,
} from "@plasius/ai";

const videoAdapter = createHttpVideoProviderAdapter({
  uploadImagePath: "/provider/image/upload",
  generateVideoPath: "/provider/video/generate",
  getVideoResultPath: (videoId) => `/provider/video/result/${videoId}`,
  getBalancePath: "/provider/account/balance",
});

const platform = await createVideoProviderPlatform("user-1", {
  apiKey: process.env.PROVIDER_API_KEY ?? "",
  adapter: videoAdapter,
});

void platform;
```

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
npm run demo:run
```

## Demo Sanity Check

```bash
npm run demo:run
```

## Publishing

This package is published via GitHub CD only.

1. Configure repository environment `production` with secret `NPM_TOKEN`.
2. Run `.github/workflows/cd.yml` via **Actions -> CD (Publish to npm) -> Run workflow**.
3. Select the version bump (`patch`, `minor`, `major`, or `none`) and optional pre-release id.

## Build Outputs

- ESM: `dist/`
- CJS: `dist-cjs/`
- Types: `dist/*.d.ts`

## License

MIT
