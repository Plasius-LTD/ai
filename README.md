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
- completion model interfaces (`ChatCompletion`, `ImageCompletion`, etc.)
- schema definitions for completion entities

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
- `Completion` + typed completion variants:
  - `ChatCompletion`
  - `TextCompletion`
  - `ImageCompletion`
  - `SpeechCompletion`
  - `VideoCompletion`
  - `BalanceCompletion`
- Schemas:
  - `completionSchema`
  - `chatCompletionSchema`
  - `textCompletionSchema`
  - `imageCompletionSchema`
  - `speechCompletionSchema`
  - `videoCompletionSchema`
  - `balanceCompletionSchema`

## Documentation

- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- API reference: [`docs/api-reference.md`](./docs/api-reference.md)
- Provider guidance: [`docs/providers.md`](./docs/providers.md)

## Known Limitations

- `src/lib/*` currently contains placeholder files and is not part of the public API.
- Runtime provider adapters are still under stabilization and should be wrapped by host applications.
- The package focuses on contracts/schemas first; runtime behavior is expected to be composed by consumers.

## Development

```bash
npm install
npm run build
npm test
npm run test:coverage
```

## Build Outputs

- ESM: `dist/`
- CJS: `dist-cjs/`
- Types: `dist/*.d.ts`

## License

MIT
