# API Reference

## Enums

### `AICapability`

Routing capability enum:

- `Chat`
- `Text`
- `Speech`
- `Image`
- `Video`
- `Balance`
- `Model`

## Core Interfaces

### `AIPlatform`

Contract for runtime adapters:

- `chatWithAI(userId, input, context, model)`
- `synthesizeSpeech(userId, input, voice, context, model)`
- `transcribeSpeech(userId, input, context, model)`
- `generateImage(userId, input, context, model)`
- `produceVideo(userId, input, image, context, model)`
- `generateModel(userId, input, context, model)`
- `checkBalance(userId)`
- `currentBalance`

Optional:

- `canHandle(userId, capabilities)`

## Completion Models

Base type:

- `Completion`
  - `id`
  - `partitionKey`
  - `type`
  - `model`
  - `durationMs`
  - `createdAt`
  - `usage?`

Specialized variants:

- `ChatCompletion`
- `TextCompletion`
- `ImageCompletion`
- `SpeechCompletion`
- `VideoCompletion`
- `ModelCompletion`
- `BalanceCompletion`

## Adapter Composition

### `AICapabilityAdapter`

Provider adapter contract with capability declarations and optional operation handlers:

- `id`
- `capabilities`
- `chatWithAI(request)?`
- `synthesizeSpeech(request)?`
- `transcribeSpeech(request)?`
- `generateImage(request)?`
- `produceVideo(request)?`
- `generateModel(request)?`
- `checkBalance(request)?`

### `createAdapterPlatform(userId, props)`

Builds an `AIPlatform` by routing capability calls to registered adapters and injecting developer-supplied API keys from `props.apiKeys`.

## Exported Schemas

- `completionSchema`
- `chatCompletionSchema`
- `textCompletionSchema`
- `imageCompletionSchema`
- `speechCompletionSchema`
- `videoCompletionSchema`
- `modelCompletionSchema`
- `balanceCompletionSchema`
